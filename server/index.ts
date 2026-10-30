import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import Stripe from 'stripe';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Webhook } from 'svix';
import type { AppContext, Env, Actor } from './types';
import { isLocal, uuid, now, json, parse } from './types';
import { auth } from './auth';
import {
  orderSchema,
  validateAnswers,
  settingsSchema,
  activitySchema,
  fieldSchema,
  email,
} from './validation';
import { mailStatement, processMail } from './mail';
import { stripe, startCheckout, handleStripeEvent, processRefunds } from './payments';

export const app = new Hono<AppContext>();
const fail = (status: number, message: string): never => {
  throw new HTTPException(status as any, { message });
};
const settings = async (env: Env) =>
  parse((await env.DB.prepare('SELECT data FROM settings WHERE id=1').first<any>())?.data);
const audit = (env: Env, actor: string, action: string, target: string, detail: unknown = {}) =>
  env.DB.prepare('INSERT INTO audit(id,actor,action,target,detail) VALUES(?,?,?,?,?)').bind(
    uuid(),
    actor,
    action,
    target,
    json(detail),
  );

app.use('/api/*', async (c, next) => {
  if (c.req.header('content-length') && Number(c.req.header('content-length')) > 150000)
    fail(413, 'Requête trop volumineuse');
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) &&
    !c.req.path.startsWith('/api/webhooks/')
  ) {
    if (c.req.header('origin') !== c.env.APP_URL) fail(403, 'Origine de la requête refusée');
    if (!c.req.header('content-type')?.startsWith('application/json')) fail(415, 'JSON requis');
  }
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  c.header('X-Frame-Options', 'DENY');
  if (c.env.APP_URL.startsWith('https:'))
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});
async function limited(env: Env, key: string, max = 30, seconds = 60) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  const r = await env.DB.prepare(
    'INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END RETURNING count',
  )
    .bind(hash, now() + seconds, now(), now())
    .first<any>();
  if (r.count > max) fail(429, 'Trop de demandes. Réessayez dans quelques minutes.');
}
async function botCheck(c: any, token: string | undefined) {
  if (isLocal(c.env)) return;
  if (!c.env.TURNSTILE_SECRET_KEY || !token)
    fail(503, 'La protection du formulaire doit être configurée.');
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET_KEY, response: token! }),
  });
  const data = (await res.json()) as any;
  if (!data.success || data.hostname !== new URL(c.env.APP_URL).hostname)
    fail(403, 'Vérification du formulaire échouée.');
}
async function actor(c: any): Promise<Actor> {
  const session = await auth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session?.user?.emailVerified) return fail(401, 'Connectez-vous pour continuer.');
  const staff = await c.env.DB.prepare('SELECT * FROM staff WHERE user_id=?')
    .bind(session.user.id)
    .first();
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: staff?.role || 'participant',
    permissions: parse(staff?.permissions, []),
  };
}
async function staffActor(c: any, permission: string) {
  const a = await actor(c);
  if (
    a.role !== 'admin' &&
    !a.permissions.includes(permission) &&
    !(a.role === 'checkin' && permission === 'checkin')
  )
    fail(403, 'Permission insuffisante.');
  if (!isLocal(c.env)) {
    if (!c.env.ACCESS_TEAM_DOMAIN || !c.env.ACCESS_AUD)
      fail(503, 'La protection MFA de l’administration doit être configurée.');
    try {
      const domain = c.env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//, '').replace(/\/$/, '');
      if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)) throw new Error();
      const token = c.req.header('cf-access-jwt-assertion');
      const result = await jwtVerify(
        token || '',
        createRemoteJWKSet(new URL(`https://${domain}/cdn-cgi/access/certs`)),
        { issuer: `https://${domain}`, audience: c.env.ACCESS_AUD },
      );
      if (String(result.payload.email).toLowerCase() !== a.email.toLowerCase()) throw new Error();
    } catch {
      fail(403, 'Connectez-vous via l’accès renforcé de l’organisation.');
    }
  }
  return a;
}
app.onError((e, c) => {
  if (isLocal(c.env) && !(e instanceof HTTPException) && !(e instanceof z.ZodError))
    console.error(e.name + ': ' + e.message);
  if (e instanceof HTTPException) return c.json({ error: e.message }, e.status);
  if (e instanceof z.ZodError)
    return c.json(
      {
        error: e.issues
          .map((x) => `${x.path.join('.')} : ${x.message}`)
          .slice(0, 4)
          .join(' · '),
      },
      400,
    );
  if (/CAPACITY_EXCEEDED/.test(String(e)))
    return c.json(
      { error: 'Une activité est complète. Aucune inscription du panier n’a été réservée.' },
      409,
    );
  if (/PROMO_UNAVAILABLE/.test(String(e)))
    return c.json({ error: 'Code promotionnel invalide, expiré ou épuisé.' }, 409);
  return c.json(
    { error: 'La demande n’a pas pu être traitée. Réessayez ou contactez l’organisation.' },
    500,
  );
});
app.get('/api/public', async (c) => {
  const s = await settings(c.env);
  const rows = await c.env.DB.prepare(
    "SELECT a.*, f.fields, (SELECT COUNT(*) FROM registrations r WHERE r.activity_id=a.id AND (r.status IN ('confirmed','partially_refunded','refunding') OR (r.status='pending' AND r.expires_at>unixepoch()))) AS occupied FROM activities a JOIN forms f ON f.activity_id=a.id AND f.version=a.form_version WHERE a.enabled=1",
  ).all<any>();
  return c.json({
    settings: s,
    activities: rows.results.map((a) => ({
      ...a,
      route: parse(a.route),
      fields: parse(a.fields, []),
    })),
    environment: isLocal(c.env)
      ? 'development'
      : c.env.PAYMENTS_MODE === 'live'
        ? 'production'
        : 'test',
    services: {
      payments: !!c.env.STRIPE_SECRET_KEY,
      mail: isLocal(c.env) || !!(c.env.RESEND_API_KEY && c.env.MAIL_FROM),
      turnstile: c.env.TURNSTILE_SITE_KEY || null,
    },
  });
});
app.on(['POST', 'GET'], '/api/auth/*', async (c) => {
  if (c.req.path.endsWith('/sign-in/magic-link') && c.req.method === 'POST') {
    await limited(c.env, 'login:' + (c.req.header('cf-connecting-ip') || 'local'), 5, 600);
    const input = (await c.req.raw.clone().json()) as any;
    await botCheck(c, input.turnstileToken);
  }
  return auth(c.env).handler(c.req.raw);
});
app.get('/api/me', async (c) => {
  try {
    return c.json({ user: await actor(c) });
  } catch (e) {
    if (e instanceof HTTPException && e.status === 401) return c.json({ user: null });
    throw e;
  }
});
app.get('/api/dev/mail', async (c) => {
  if (!isLocal(c.env) || !['localhost', '127.0.0.1'].includes(new URL(c.req.url).hostname))
    fail(404, 'Introuvable');
  return c.json(
    (
      await c.env.DB.prepare(
        'SELECT id,recipient,subject,body,status,created_at FROM outbox ORDER BY created_at DESC,rowid DESC LIMIT 50',
      ).all()
    ).results,
  );
});
app.post('/api/dev/tick', async (c) => {
  if (!isLocal(c.env) || !['localhost', '127.0.0.1'].includes(new URL(c.req.url).hostname))
    fail(404, 'Introuvable');
  await scheduled(c.env);
  return c.json({ ok: true });
});
app.post('/api/quote', async (c) => {
  await actor(c);
  const x = z
    .object({
      participants: z.array(z.string().max(50)).min(1).max(12),
      promo: z.string().max(40).optional(),
    })
    .parse(await c.req.json());
  let percent = 0;
  if (x.promo) {
    const p = await c.env.DB.prepare(
      "SELECT *, (SELECT COUNT(*) FROM orders WHERE promo=promos.code AND (status IN ('confirmed','paid_review','refunding','partially_refunded','refunded') OR (status='pending' AND expires_at>unixepoch()))) AS uses FROM promos WHERE code=? AND active=1 AND (expires_at IS NULL OR expires_at>unixepoch())",
    )
      .bind(x.promo.toUpperCase())
      .first<any>();
    if (!p || (p.max_uses !== null && p.uses >= p.max_uses))
      fail(400, 'Code promotionnel invalide, expiré ou épuisé.');
    percent = p.percent;
  }
  let subtotal = 0,
    amount = 0;
  for (const id of x.participants) {
    const a = await c.env.DB.prepare('SELECT price FROM activities WHERE id=? AND enabled=1')
      .bind(id)
      .first<any>();
    if (!a) fail(400, 'Activité introuvable');
    subtotal += a.price;
    amount += Math.round((a.price * (100 - percent)) / 100);
  }
  return c.json({ subtotal, amount, discount: subtotal - amount, percent });
});
const draftSchema = z.object({
  participants: z
    .array(
      z
        .object({
          activityId: z.string().max(50),
          firstName: z.string().max(150),
          lastName: z.string().max(150),
          email: z.string().max(200),
          phone: z.string().max(35),
          emergencyName: z.string().max(150),
          emergencyPhone: z.string().max(35),
          adult: z.boolean(),
          conditions: z.boolean(),
          authority: z.boolean(),
          photo: z.boolean(),
          marketing: z.boolean(),
          answers: z.record(z.string().max(40), z.union([z.string().max(1000), z.boolean()])),
          formVersion: z.number().int(),
        })
        .strict(),
    )
    .min(1)
    .max(12),
  promo: z.string().max(40),
});
app.get('/api/draft', async (c) => {
  const a = await actor(c);
  const r = await c.env.DB.prepare('SELECT data,updated_at FROM drafts WHERE user_id=?')
    .bind(a.id)
    .first<any>();
  return c.json(r ? { ...parse(r.data), updatedAt: r.updated_at } : null);
});
app.put('/api/draft', async (c) => {
  const a = await actor(c);
  const x = draftSchema.parse(await c.req.json());
  for (const p of x.participants) {
    const f = await c.env.DB.prepare('SELECT fields FROM forms WHERE activity_id=? AND version=?')
      .bind(p.activityId, p.formVersion)
      .first<any>();
    if (!f) fail(400, 'Formulaire introuvable');
    const ids = new Set(parse(f.fields, []).map((f: any) => f.id));
    p.answers = Object.fromEntries(Object.entries(p.answers).filter(([k]) => ids.has(k)));
  }
  await c.env.DB.prepare(
    'INSERT INTO drafts(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=unixepoch()',
  )
    .bind(a.id, json(x))
    .run();
  return c.json({ ok: true });
});

app.post('/api/orders', async (c) => {
  const a = await actor(c);
  await limited(c.env, 'order:' + a.id, 10, 600);
  const input = orderSchema.parse(await c.req.json());
  const existing = await c.env.DB.prepare(
    'SELECT id,status,amount FROM orders WHERE user_id=? AND request_key=?',
  )
    .bind(a.id, input.requestKey)
    .first<any>();
  if (existing) return c.json(existing);
  const s = await settings(c.env);
  if (input.termsVersion !== s.termsVersion)
    fail(409, 'Les conditions ont été mises à jour. Relisez-les avant de continuer.');
  if (
    !isLocal(c.env) &&
    (!s.registrationOpen ||
      (s.salesOpenAt && now() < s.salesOpenAt) ||
      (s.salesCloseAt && now() >= s.salesCloseAt))
  )
    fail(409, 'Les inscriptions ne sont pas ouvertes.');
  if (
    !isLocal(c.env) &&
    c.env.PAYMENTS_MODE === 'live' &&
    (!s.legalApproved || !s.brandApproved || s.taxMode === 'unconfirmed' || !s.location)
  )
    fail(409, 'L’ouverture publique nécessite la validation des informations et des politiques.');
  let percent = 0;
  let promo: null | string = null;
  if (input.promo) {
    const p = await c.env.DB.prepare(
      'SELECT * FROM promos WHERE code=? AND active=1 AND (expires_at IS NULL OR expires_at>?)',
    )
      .bind(input.promo.toUpperCase(), now())
      .first<any>();
    if (!p) fail(400, 'Code promotionnel invalide ou expiré.');
    percent = p.percent;
    promo = p.code;
  }
  const records = [];
  let amount = 0;
  for (const p of input.participants) {
    const activity = await c.env.DB.prepare(
      'SELECT a.*,f.fields FROM activities a JOIN forms f ON f.activity_id=a.id AND f.version=a.form_version WHERE a.id=? AND a.enabled=1',
    )
      .bind(p.activityId)
      .first<any>();
    if (!activity) fail(400, 'Activité introuvable');
    if (
      (activity.opens_at && activity.opens_at > now()) ||
      (activity.closes_at && activity.closes_at <= now())
    )
      fail(409, 'La période d’inscription de cette activité est fermée.');
    if (p.formVersion !== activity.form_version)
      fail(409, 'Le formulaire a changé. Rechargez la page.');
    let answers;
    try {
      answers = validateAnswers(parse(activity.fields, []), p.answers);
    } catch (e) {
      fail(400, (e as Error).message);
    }
    const price = Math.round((activity.price * (100 - percent)) / 100);
    amount += price;
    records.push({ p, activity, answers, price, id: uuid(), ticket: uuid() + uuid() });
  }
  if (input.expectedAmount !== undefined && input.expectedAmount !== amount)
    fail(
      409,
      'Le tarif a changé depuis votre récapitulatif. Revenez en arrière et vérifiez le nouveau montant.',
    );
  if (amount > 0 && !c.env.STRIPE_SECRET_KEY)
    fail(
      503,
      'Les paiements ne sont pas encore ouverts : Stripe doit être configuré. Aucun montant n’a été prélevé.',
    );
  const id = uuid(),
    expires = now() + 35 * 60,
    status = amount === 0 ? 'confirmed' : 'pending';
  const stmts = [
    c.env.DB.prepare(
      'INSERT INTO orders(id,user_id,request_key,amount,status,promo,discount_percent,expires_at,event_snapshot) VALUES(?,?,?,?,?,?,?,?,?)',
    ).bind(
      id,
      a.id,
      input.requestKey,
      amount,
      status,
      promo,
      percent,
      expires,
      json({
        eventAt: s.eventAt,
        refundDays: s.refundDays,
        date: s.date,
        edition: s.edition,
        reception: s.reception,
        location: s.location,
      }),
    ),
  ];
  for (const r of records) {
    const { p, activity } = r;
    stmts.push(
      c.env.DB.prepare(
        'INSERT INTO registrations(id,order_id,activity_id,first_name,last_name,email,phone,adult,emergency_name,emergency_phone,answers,form_snapshot,form_version,conditions_version,conditions_snapshot,photo,marketing,price,status,expires_at,ticket,activity_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ).bind(
        r.id,
        id,
        p.activityId,
        p.firstName,
        p.lastName,
        p.email,
        p.phone,
        1,
        p.emergencyName,
        p.emergencyPhone,
        json(r.answers),
        activity.fields,
        activity.form_version,
        s.termsVersion,
        s.terms,
        p.photo ? 1 : 0,
        p.marketing ? 1 : 0,
        r.price,
        status,
        expires,
        r.ticket,
        json({ name: activity.name, distance: activity.distance, sport: activity.sport }),
      ),
    );
    if (amount === 0)
      stmts.push(
        mailStatement(
          c.env,
          p.email,
          'Inscription confirmée — Ride For Brains',
          `Bonjour ${p.firstName},\nVotre inscription ${r.id} est confirmée. Retrouvez votre billet dans l’espace de l’acheteur : ${c.env.APP_URL}/espace`,
          'confirmed:' + r.id,
          a.id,
          r.id,
        ),
      );
  }
  stmts.push(audit(c.env, a.id, 'order.created', id, { amount, count: records.length }));
  stmts.push(c.env.DB.prepare('DELETE FROM drafts WHERE user_id=?').bind(a.id));
  await c.env.DB.batch(stmts);
  return c.json({ id, status, amount }, 201);
});
app.post('/api/orders/:id/checkout', async (c) => {
  const a = await actor(c);
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id=? AND user_id=?')
    .bind(c.req.param('id'), a.id)
    .first<any>();
  if (!order) fail(404, 'Dossier introuvable');
  if (order.status !== 'pending' || order.expires_at <= now())
    fail(409, 'Réservation expirée. Recommencez une inscription depuis les activités.');
  if (order.stripe_session) {
    const ss = await stripe(c.env).checkout.sessions.retrieve(order.stripe_session);
    if (ss.status === 'open') return c.json({ url: ss.url });
    fail(409, 'Le paiement est déjà traité ou expiré. Consultez le dossier.');
  }
  if (order.expires_at < now() + 31 * 60)
    fail(
      409,
      'La réservation est trop ancienne pour lancer un nouveau paiement sécurisé. Attendez son expiration puis recommencez.',
    );
  return c.json({ url: await startCheckout(c.env, order) });
});
app.get('/api/registrations', async (c) => {
  const a = await actor(c);
  const rows = (
    await c.env.DB.prepare(
      'SELECT r.*,a.name AS activity_name,a.distance,a.sport,o.amount AS order_amount,o.refunded,o.status AS order_status FROM registrations r JOIN orders o ON o.id=r.order_id JOIN activities a ON a.id=r.activity_id WHERE o.user_id=? ORDER BY r.created_at DESC',
    )
      .bind(a.id)
      .all<any>()
  ).results;
  return c.json({
    registrations: rows.map(({ notes, ...r }) => ({
      ...r,
      activity_name: parse(r.activity_snapshot).name || r.activity_name,
      distance: parse(r.activity_snapshot).distance || r.distance,
      answers: parse(r.answers),
      fields: parse(r.form_snapshot, []),
    })),
    messages: (
      await c.env.DB.prepare(
        "SELECT subject,body,created_at FROM outbox WHERE user_id=? AND kind!='login' AND subject NOT LIKE 'Votre lien%' ORDER BY created_at DESC LIMIT 40",
      )
        .bind(a.id)
        .all()
    ).results,
  });
});
app.patch('/api/registrations/:id', async (c) => {
  const a = await actor(c);
  const s = await settings(c.env);
  const r = await c.env.DB.prepare(
    'SELECT r.* FROM registrations r JOIN orders o ON o.id=r.order_id WHERE r.id=? AND o.user_id=?',
  )
    .bind(c.req.param('id'), a.id)
    .first<any>();
  if (!r) fail(404, 'Dossier introuvable');
  const fields = z
    .object({
      phone: z.string().min(7).max(35).optional(),
      emergency_name: z.string().min(1).max(150).optional(),
      emergency_phone: z.string().min(7).max(35).optional(),
    })
    .strict()
    .parse(await c.req.json());
  if (Object.keys(fields).some((k) => !s.editableFields.includes(k)))
    fail(403, 'La modification de ce champ n’est pas autorisée.');
  if (!Object.keys(fields).length) fail(400, 'Aucun changement');
  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE registrations SET ' +
        Object.keys(fields)
          .map((k) => k + '=?')
          .join(',') +
        ' WHERE id=?',
    ).bind(...Object.values(fields), r.id),
    audit(c.env, a.id, 'participant.updated', r.id, { fields: Object.keys(fields) }),
  ]);
  return c.json({ ok: true });
});
app.get('/api/registrations/:id/ticket', async (c) => {
  const a = await actor(c);
  const r = await c.env.DB.prepare(
    "SELECT r.id,r.ticket,r.first_name,r.last_name,a.name,a.distance FROM registrations r JOIN orders o ON o.id=r.order_id JOIN activities a ON a.id=r.activity_id WHERE r.id=? AND o.user_id=? AND r.status IN ('confirmed','partially_refunded')",
  )
    .bind(c.req.param('id'), a.id)
    .first<any>();
  if (!r) fail(404, 'Billet indisponible');
  return c.json(r);
});
app.post('/api/orders/:id/cancel', async (c) => {
  const a = await actor(c);
  const s = await settings(c.env);
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id=? AND user_id=?')
    .bind(c.req.param('id'), a.id)
    .first<any>();
  if (!o) fail(404, 'Dossier introuvable');
  const body = z.object({ confirm: z.literal(true) }).parse(await c.req.json());
  if (!body.confirm) fail(400, 'Confirmation requise');
  if (o.status !== 'confirmed' && o.status !== 'partially_refunded')
    fail(409, 'Le dossier ne peut pas être annulé dans cet état.');
  const policy = parse(o.event_snapshot, s);
  const eligible =
    Date.now() <=
    Date.parse(policy.eventAt || s.eventAt) - (policy.refundDays ?? s.refundDays) * 86400000;
  const amount = eligible ? o.amount - o.refunded : 0;
  const status = amount > 0 ? 'refunding' : 'cancelled';
  const stmts = [
    c.env.DB.prepare(
      "UPDATE orders SET status=? WHERE id=? AND status IN ('confirmed','partially_refunded')",
    ).bind(status, o.id),
    c.env.DB.prepare('UPDATE registrations SET status=? WHERE order_id=?').bind(status, o.id),
    audit(c.env, a.id, 'cancellation.requested', o.id, { eligible, amount }),
  ];
  if (amount > 0)
    stmts.push(
      c.env.DB.prepare('INSERT INTO refund_jobs(id,order_id,amount,reason) VALUES(?,?,?,?)').bind(
        uuid(),
        o.id,
        amount,
        'Annulation par l’acheteur à 15 jours ou plus',
      ),
    );
  stmts.push(
    mailStatement(
      c.env,
      a.email,
      'Demande d’annulation — Ride For Brains',
      amount > 0
        ? 'Votre demande est enregistrée. Le remboursement sera confirmé après traitement par le prestataire.'
        : 'Votre dossier est annulé. Aucun remboursement n’est prévu par la politique à cette date.',
      'cancel:' + o.id,
      a.id,
    ),
  );
  await c.env.DB.batch(stmts);
  c.executionCtx.waitUntil(processRefunds(c.env));
  return c.json({ status, refundRequested: amount });
});
app.post('/api/waitlist', async (c) => {
  const a = await actor(c);
  await limited(c.env, 'waitlist:' + a.id, 10, 3600);
  const p = participantWaitlist(await c.req.json());
  const activity = await c.env.DB.prepare('SELECT * FROM activities WHERE id=? AND enabled=1')
    .bind(p.activityId)
    .first<any>();
  if (!activity) fail(404, 'Activité introuvable');
  const occupied = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM registrations WHERE activity_id=? AND (status IN ('confirmed','partially_refunded','refunding') OR (status='pending' AND expires_at>unixepoch()))",
  )
    .bind(activity.id)
    .first<any>();
  if (activity.capacity === null || occupied.n < activity.capacity)
    fail(409, 'Cette activité dispose encore de places.');
  const id = uuid();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO orders(id,user_id,request_key,amount,status,expires_at) VALUES(?,?,?,0,'draft',?)",
    ).bind(id, a.id, uuid(), now()),
    c.env.DB.prepare(
      "INSERT INTO registrations(id,order_id,activity_id,first_name,last_name,email,phone,adult,emergency_name,emergency_phone,answers,form_snapshot,form_version,conditions_version,conditions_snapshot,photo,marketing,price,status,expires_at,ticket) VALUES(?,?,?,?,?,?,'',1,'','','{}','[]',0,'waitlist','Attente sans réservation ni paiement',0,0,0,'waitlisted',?,?)",
    ).bind(uuid(), id, p.activityId, p.firstName, p.lastName, a.email, now(), uuid() + uuid()),
    audit(c.env, a.id, 'waitlist.joined', id),
  ]);
  return c.json({ ok: true });
});
function participantWaitlist(x: unknown) {
  return z
    .object({
      activityId: z.string().max(50),
      firstName: z.string().min(1).max(150),
      lastName: z.string().min(1).max(150),
      adult: z.literal(true),
    })
    .parse(x);
}
app.post('/api/submissions', async (c) => {
  await limited(c.env, 'contact:' + (c.req.header('cf-connecting-ip') || 'local'), 5, 3600);
  const body = z
    .object({
      kind: z.enum(['contact', 'volunteer', 'sponsor']),
      name: z.string().trim().min(1).max(150),
      email,
      message: z.string().trim().min(10).max(5000),
      consent: z.literal(true),
      turnstileToken: z.string().optional(),
    })
    .parse(await c.req.json());
  await botCheck(c, body.turnstileToken);
  const id = uuid();
  await c.env.DB.prepare('INSERT INTO submissions(id,kind,name,email,message) VALUES(?,?,?,?,?)')
    .bind(id, body.kind, body.name, body.email, body.message)
    .run();
  return c.json(
    { id, message: 'Votre demande est enregistrée et accessible à l’organisation.' },
    201,
  );
});

app.get('/api/admin/overview', async (c) => {
  await staffActor(c, 'participants');
  const stats = await c.env.DB.prepare(
    'SELECT a.id,a.name,a.distance,a.capacity,r.status,COUNT(r.id) AS count,SUM(CASE WHEN r.checked_at IS NOT NULL THEN 1 ELSE 0 END) AS present FROM activities a LEFT JOIN registrations r ON r.activity_id=a.id GROUP BY a.id,r.status',
  ).all();
  const money = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(CASE WHEN status IN ('confirmed','paid_review','refunding','partially_refunded','refunded','cancelled') AND payment_intent IS NOT NULL THEN amount ELSE 0 END),0) AS received,COALESCE(SUM(refunded),0) AS refunded,COALESCE(SUM(CASE WHEN status='pending' AND expires_at>unixepoch() THEN amount ELSE 0 END),0) AS pending FROM orders",
  ).first();
  const alerts = (
    await c.env.DB.prepare(
      "SELECT id,status FROM orders WHERE status='paid_review' UNION ALL SELECT id,'email_'||status FROM outbox WHERE status IN ('failed','review') UNION ALL SELECT id,'refund_'||status FROM refund_jobs WHERE status IN ('review','failed') LIMIT 40",
    ).all()
  ).results;
  return c.json({ stats: stats.results, money, alerts });
});
app.get('/api/admin/participants', async (c) => {
  await staffActor(c, 'participants');
  const page = Math.max(1, Number(c.req.query('page')) || 1),
    q = (c.req.query('q') || '').slice(0, 100),
    status = c.req.query('status') || '',
    activity = c.req.query('activity') || '';
  const where =
    " WHERE (?='' OR r.first_name LIKE ? OR r.last_name LIKE ? OR r.email LIKE ? OR r.id=?) AND (?='' OR r.status=?) AND (?='' OR r.activity_id=?)";
  const values = [
    q,
    '%' + q + '%',
    '%' + q + '%',
    '%' + q + '%',
    q,
    status,
    status,
    activity,
    activity,
  ];
  const total = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM registrations r' + where)
    .bind(...values)
    .first<any>();
  const rows = await c.env.DB.prepare(
    'SELECT r.id,r.first_name,r.last_name,r.email,r.status,r.price,r.order_id,r.checked_at,a.name,a.distance FROM registrations r JOIN activities a ON a.id=r.activity_id' +
      where +
      ' ORDER BY r.created_at DESC,r.id LIMIT 30 OFFSET ?',
  )
    .bind(...values, (page - 1) * 30)
    .all();
  return c.json({ rows: rows.results, total: total.count, page });
});
app.get('/api/admin/participants/:id', async (c) => {
  await staffActor(c, 'participants');
  const r = await c.env.DB.prepare('SELECT * FROM registrations WHERE id=?')
    .bind(c.req.param('id'))
    .first<any>();
  if (!r) fail(404, 'Dossier introuvable');
  return c.json({
    ...r,
    answers: parse(r.answers),
    fields: parse(r.form_snapshot, []),
    history: (
      await c.env.DB.prepare('SELECT * FROM history WHERE registration_id=? ORDER BY at,id')
        .bind(r.id)
        .all()
    ).results,
    order: await c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(r.order_id).first(),
  });
});
app.patch('/api/admin/participants/:id', async (c) => {
  const a = await staffActor(c, 'participants');
  const id = c.req.param('id');
  const x = z
    .object({
      first_name: z.string().min(1).max(150).optional(),
      last_name: z.string().min(1).max(150).optional(),
      phone: z.string().min(7).max(35).optional(),
      emergency_name: z.string().min(1).max(150).optional(),
      emergency_phone: z.string().min(7).max(35).optional(),
      notes: z.string().max(6000).optional(),
    })
    .strict()
    .parse(await c.req.json());
  if (!Object.keys(x).length) fail(400, 'Aucune modification');
  if (!(await c.env.DB.prepare('SELECT id FROM registrations WHERE id=?').bind(id).first()))
    fail(404, 'Dossier introuvable');
  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE registrations SET ' +
        Object.keys(x)
          .map((k) => k + '=?')
          .join(',') +
        ' WHERE id=?',
    ).bind(...Object.values(x), id),
    audit(c.env, a.id, 'admin.participant.updated', id, { fields: Object.keys(x) }),
  ]);
  return c.json({ ok: true });
});
app.get('/api/admin/export', async (c) => {
  const a = await staffActor(c, 'export');
  const rs = (
    await c.env.DB.prepare(
      'SELECT id,first_name,last_name,email,status,activity_id,price,checked_at FROM registrations ORDER BY created_at',
    ).all<any>()
  ).results;
  const clean = (v: any) =>
    '"' +
    String(v ?? '')
      .replace(/^[\s\r\n]*[=+@-]/, "'" + '$&')
      .replace(/"/g, '""') +
    '"';
  const keys = [
    'id',
    'first_name',
    'last_name',
    'email',
    'status',
    'activity_id',
    'price',
    'checked_at',
  ];
  await audit(c.env, a.id, 'participants.exported', 'all', { count: rs.length }).run();
  return new Response(
    '\uFEFF' +
      [keys.join(','), ...rs.map((r) => keys.map((k) => clean(r[k])).join(','))].join('\r\n'),
    {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ride-for-brains-participants.csv"',
        'Cache-Control': 'no-store',
      },
    },
  );
});
app.post('/api/admin/refunds', async (c) => {
  const a = await staffActor(c, 'refunds');
  const body = z
    .object({
      orderId: z.uuid(),
      amount: z.number().int().positive(),
      reason: z.string().min(5).max(500),
      confirm: z.literal(true),
    })
    .parse(await c.req.json());
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id=?')
    .bind(body.orderId)
    .first<any>();
  if (
    !o ||
    !o.payment_intent ||
    !['confirmed', 'paid_review', 'partially_refunded'].includes(o.status) ||
    body.amount > o.amount - o.refunded
  )
    fail(409, 'Montant ou état incompatible avec le remboursement.');
  const id = uuid();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO refund_jobs(id,order_id,amount,reason) VALUES(?,?,?,?)').bind(
      id,
      o.id,
      body.amount,
      body.reason,
    ),
    c.env.DB.prepare("UPDATE orders SET status='refunding' WHERE id=?").bind(o.id),
    c.env.DB.prepare("UPDATE registrations SET status='refunding' WHERE order_id=?").bind(o.id),
    audit(c.env, a.id, 'refund.requested', o.id, {
      job: id,
      amount: body.amount,
      reason: body.reason,
    }),
  ]);
  c.executionCtx.waitUntil(processRefunds(c.env));
  return c.json({ status: 'queued', id });
});
app.get('/api/admin/config', async (c) => {
  await staffActor(c, 'event');
  return c.json({
    settings: await settings(c.env),
    revision: (await c.env.DB.prepare('SELECT revision FROM settings WHERE id=1').first<any>())
      .revision,
    activities: (await c.env.DB.prepare('SELECT * FROM activities').all<any>()).results.map(
      (a) => ({ ...a, route: parse(a.route) }),
    ),
    forms: (
      await c.env.DB.prepare('SELECT * FROM forms ORDER BY activity_id,version DESC').all<any>()
    ).results.map((f) => ({ ...f, fields: parse(f.fields, []) })),
    promos: (await c.env.DB.prepare('SELECT * FROM promos').all()).results,
  });
});
app.put('/api/admin/settings', async (c) => {
  const a = await staffActor(c, 'event');
  const body = z
    .object({ settings: settingsSchema, revision: z.number().int() })
    .parse(await c.req.json());
  const before = await settings(c.env);
  if (before.terms !== body.settings.terms && before.termsVersion === body.settings.termsVersion)
    fail(409, 'Changez la version des conditions quand leur texte change.');
  if (
    body.settings.registrationOpen &&
    c.env.PAYMENTS_MODE === 'live' &&
    (!body.settings.legalApproved ||
      !body.settings.brandApproved ||
      body.settings.taxMode === 'unconfirmed' ||
      !body.settings.location ||
      !c.env.STRIPE_SECRET_KEY ||
      !c.env.STRIPE_WEBHOOK_SECRET ||
      !c.env.RESEND_API_KEY ||
      !c.env.MAIL_FROM ||
      !c.env.TURNSTILE_SECRET_KEY)
  )
    fail(
      409,
      'Configuration de production incomplète : lieu, fiscalité, validations, Stripe, courriel et protection requis.',
    );
  const updated = await c.env.DB.prepare(
    'UPDATE settings SET data=?,revision=revision+1 WHERE id=1 AND revision=? RETURNING revision',
  )
    .bind(json(body.settings), body.revision)
    .first();
  if (!updated) fail(409, 'Un autre membre a modifié les réglages. Rechargez la page.');
  await audit(c.env, a.id, 'settings.updated', 'event', { revision: body.revision + 1 }).run();
  return c.json(updated);
});
app.put('/api/admin/activities', async (c) => {
  const a = await staffActor(c, 'event');
  const x = activitySchema.parse(await c.req.json());
  if (x.capacity !== null) {
    const n = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM registrations WHERE activity_id=? AND (status IN ('confirmed','partially_refunded','refunding') OR (status='pending' AND expires_at>unixepoch()))",
    )
      .bind(x.id)
      .first<any>();
    if (n.n > x.capacity) fail(409, 'Le quota est inférieur aux places déjà réservées.');
  }
  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE activities SET name=?,sport=?,distance=?,price=?,capacity=?,opens_at=?,closes_at=?,enabled=?,route=? WHERE id=?',
    ).bind(
      x.name,
      x.sport,
      x.distance,
      x.price,
      x.capacity,
      x.opens_at,
      x.closes_at,
      x.enabled,
      json(x.route),
      x.id,
    ),
    audit(c.env, a.id, 'activity.updated', x.id, x),
  ]);
  return c.json({ ok: true });
});
app.post('/api/admin/forms', async (c) => {
  const a = await staffActor(c, 'event');
  const x = z
    .object({
      activityId: z.string().max(50),
      expectedVersion: z.number().int(),
      fields: z.array(fieldSchema).max(30),
    })
    .parse(await c.req.json());
  if (new Set(x.fields.map((f) => f.id)).size !== x.fields.length)
    fail(400, 'Identifiants de questions dupliqués');
  for (const f of x.fields) {
    if (f.type === 'select' && !f.options?.length) fail(400, 'Options requises');
    if (f.showWhen && !x.fields.find((v) => v.id === f.showWhen?.field))
      fail(400, 'Condition de question invalide');
  }
  const current = await c.env.DB.prepare('SELECT form_version FROM activities WHERE id=?')
    .bind(x.activityId)
    .first<any>();
  if (!current || current.form_version !== x.expectedVersion)
    fail(409, 'Version du formulaire dépassée');
  const version = current.form_version + 1;
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO forms(activity_id,version,fields) VALUES(?,?,?)').bind(
      x.activityId,
      version,
      json(x.fields),
    ),
    c.env.DB.prepare('UPDATE activities SET form_version=? WHERE id=? AND form_version=?').bind(
      version,
      x.activityId,
      current.form_version,
    ),
    audit(c.env, a.id, 'form.published', x.activityId, { version }),
  ]);
  return c.json({ version });
});
app.put('/api/admin/promos', async (c) => {
  const a = await staffActor(c, 'event');
  const x = z
    .object({
      code: z.string().regex(/^[A-Z0-9_-]{2,40}$/),
      percent: z.number().int().min(1).max(100),
      maxUses: z.number().int().positive().nullable(),
      expiresAt: z.number().int().nullable(),
      active: z.boolean(),
    })
    .parse(await c.req.json());
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO promos(code,percent,max_uses,expires_at,active) VALUES(?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,max_uses=excluded.max_uses,expires_at=excluded.expires_at,active=excluded.active',
    ).bind(x.code, x.percent, x.maxUses, x.expiresAt, x.active ? 1 : 0),
    audit(c.env, a.id, 'promo.updated', x.code),
  ]);
  return c.json({ ok: true });
});
app.get('/api/admin/staff', async (c) => {
  const a = await staffActor(c, 'staff');
  if (a.role !== 'admin') fail(403, 'Administrateur principal requis');
  return c.json(
    (
      await c.env.DB.prepare(
        'SELECT u.id,u.email,u.name,s.role,s.permissions FROM staff s JOIN user u ON u.id=s.user_id',
      ).all()
    ).results,
  );
});
app.put('/api/admin/staff', async (c) => {
  const a = await staffActor(c, 'staff');
  if (a.role !== 'admin') fail(403, 'Administrateur principal requis');
  const x = z
    .object({
      email,
      role: z.enum(['admin', 'organizer', 'checkin']),
      permissions: z.array(
        z.enum([
          'participants',
          'export',
          'refunds',
          'event',
          'communications',
          'checkin',
          'submissions',
        ]),
      ),
    })
    .parse(await c.req.json());
  const u = await c.env.DB.prepare('SELECT id FROM user WHERE email=? AND emailVerified=1')
    .bind(x.email)
    .first<any>();
  if (!u) fail(404, 'La personne doit d’abord se connecter avec ce courriel.');
  if (u.id === a.id && x.role !== 'admin')
    fail(409, 'Vous ne pouvez pas retirer votre propre rôle principal.');
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO staff(user_id,role,permissions) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,permissions=excluded.permissions',
    ).bind(u.id, x.role, json(x.role === 'checkin' ? ['checkin'] : x.permissions)),
    audit(c.env, a.id, 'staff.updated', u.id, { role: x.role, permissions: x.permissions }),
  ]);
  return c.json({ ok: true });
});
app.get('/api/admin/checkin/search', async (c) => {
  await staffActor(c, 'checkin');
  const q = (c.req.query('q') || '').trim().slice(0, 100);
  if (q.length < 2) return c.json([]);
  return c.json(
    (
      await c.env.DB.prepare(
        'SELECT r.id,r.ticket,r.first_name,r.last_name,r.status,r.checked_at,a.name,a.distance FROM registrations r JOIN activities a ON a.id=r.activity_id WHERE r.first_name LIKE ? OR r.last_name LIKE ? OR r.id=? LIMIT 20',
      )
        .bind('%' + q + '%', '%' + q + '%', q)
        .all()
    ).results,
  );
});
app.post('/api/admin/checkin', async (c) => {
  const a = await staffActor(c, 'checkin');
  const x = z
    .object({ ticket: z.string().min(20).max(100), undo: z.boolean().optional() })
    .parse(await c.req.json());
  if (x.undo && a.role !== 'admin' && !a.permissions.includes('participants'))
    fail(403, 'L’annulation de présence nécessite une permission supérieure.');
  const r = await c.env.DB.prepare(
    "UPDATE registrations SET checked_at=? WHERE ticket=? AND status IN ('confirmed','partially_refunded') AND " +
      (x.undo ? 'checked_at IS NOT NULL' : 'checked_at IS NULL') +
      ' RETURNING id,first_name,last_name,checked_at',
  )
    .bind(x.undo ? null : now(), x.ticket)
    .first();
  if (!r)
    fail(
      409,
      x.undo ? 'Présence introuvable ou billet invalide.' : 'Billet invalide ou déjà utilisé.',
    );
  await audit(c.env, a.id, x.undo ? 'checkin.undone' : 'checkin.recorded', (r as any).id).run();
  return c.json(r);
});
app.get('/api/admin/submissions', async (c) => {
  await staffActor(c, 'submissions');
  return c.json(
    (await c.env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT 200').all())
      .results,
  );
});
app.patch('/api/admin/submissions/:id', async (c) => {
  const a = await staffActor(c, 'submissions');
  const x = z
    .object({ status: z.enum(['new', 'in_progress', 'closed']) })
    .parse(await c.req.json());
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE submissions SET status=? WHERE id=?').bind(
      x.status,
      c.req.param('id'),
    ),
    audit(c.env, a.id, 'submission.updated', c.req.param('id'), x),
  ]);
  return c.json({ ok: true });
});
app.get('/api/admin/mail', async (c) => {
  await staffActor(c, 'communications');
  return c.json(
    (
      await c.env.DB.prepare(
        "SELECT id,recipient,subject,body,kind,status,attempts,error,available_at,created_at FROM outbox WHERE subject NOT LIKE 'Votre lien%' ORDER BY created_at DESC LIMIT 200",
      ).all()
    ).results,
  );
});
app.get('/api/admin/templates', async (c) => {
  await staffActor(c, 'communications');
  return c.json((await c.env.DB.prepare('SELECT * FROM templates ORDER BY name').all()).results);
});
app.put('/api/admin/templates', async (c) => {
  const a = await staffActor(c, 'communications');
  const x = z
    .object({
      id: z.uuid().optional(),
      name: z.string().min(1).max(100),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(16000),
      kind: z.enum(['operational', 'marketing']),
    })
    .parse(await c.req.json());
  const id = x.id || uuid();
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO templates(id,name,subject,body,kind) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,subject=excluded.subject,body=excluded.body,kind=excluded.kind,updated_at=unixepoch()',
    ).bind(id, x.name, x.subject, x.body, x.kind),
    audit(c.env, a.id, 'template.saved', id),
  ]);
  return c.json({ id });
});
async function recipients(env: Env, input: any) {
  const where = input.ids?.length
    ? 'r.id IN (' + input.ids.map(() => '?').join(',') + ')'
    : input.activityId
      ? 'r.activity_id=?'
      : "r.status IN ('confirmed','partially_refunded')";
  const rows = (
    await env.DB.prepare(
      'SELECT r.*,o.user_id,a.name AS activity_name FROM registrations r JOIN orders o ON o.id=r.order_id JOIN activities a ON a.id=r.activity_id WHERE ' +
        where,
    )
      .bind(...(input.ids?.length ? input.ids : input.activityId ? [input.activityId] : []))
      .all<any>()
  ).results;
  const unique = new Map<string, any>();
  for (const r of rows)
    if (input.kind !== 'marketing' || r.marketing) unique.set(r.email.toLowerCase(), r);
  if (input.kind === 'marketing')
    for (const e of (await env.DB.prepare('SELECT email FROM unsubscribes').all<any>()).results)
      unique.delete(e.email.toLowerCase());
  return [...unique.values()];
}
const mailInput = z.object({
  ids: z.array(z.uuid()).max(2000).optional(),
  activityId: z.string().max(50).optional(),
  kind: z.enum(['operational', 'marketing']),
  subject: z
    .string()
    .min(1)
    .max(200)
    .refine((v) => !/[\r\n]/.test(v)),
  body: z.string().min(1).max(16000),
  availableAt: z.number().int().optional(),
  campaign: z.uuid(),
  expectedCount: z.number().int().optional(),
  confirm: z.boolean().optional(),
});
app.post('/api/admin/mail/preview', async (c) => {
  await staffActor(c, 'communications');
  const x = mailInput.parse(await c.req.json());
  const rows = await recipients(c.env, x);
  return c.json({
    count: rows.length,
    preview: renderMail(
      x.body,
      rows[0] || { first_name: 'Prénom', activity_name: 'Activité', id: 'Numéro' },
    ),
  });
});
function renderMail(text: string, r: any) {
  return text
    .replace(/\{\{prenom\}\}/g, r.first_name)
    .replace(/\{\{activite\}\}/g, r.activity_name)
    .replace(/\{\{numero\}\}/g, r.id);
}
app.post('/api/admin/mail', async (c) => {
  const a = await staffActor(c, 'communications');
  const x = mailInput.parse(await c.req.json());
  const rows = await recipients(c.env, x);
  if (!x.confirm || x.expectedCount !== rows.length)
    fail(409, 'Revalidez le nombre actuel de destinataires.');
  if (rows.length > 2000) fail(400, 'Limitez la sélection à 2 000 destinataires.');
  const stmts = [];
  for (const r of rows) {
    let body = renderMail(x.body, r);
    if (x.kind === 'marketing') {
      const token = uuid() + uuid();
      const old = await c.env.DB.prepare('SELECT token FROM unsubscribes WHERE email=?')
        .bind(r.email)
        .first<any>();
      // A token is stored only when unsubscribe is requested; the mail carries a signed opaque token in a separate table.
      if (!old)
        stmts.push(
          c.env.DB.prepare('INSERT OR IGNORE INTO marketing_tokens(token,email) VALUES(?,?)').bind(
            token,
            r.email,
          ),
        );
      body +=
        '\n\nSe désabonner des communications promotionnelles : ' +
        c.env.APP_URL +
        '/desabonnement?token=' +
        token;
    }
    stmts.push(
      mailStatement(
        c.env,
        r.email,
        renderMail(x.subject, r),
        body,
        'campaign:' + x.campaign + ':' + r.email,
        r.user_id,
        r.id,
        x.kind,
        x.availableAt || now(),
      ),
    );
  }
  stmts.push(audit(c.env, a.id, 'mail.queued', x.campaign, { count: rows.length, kind: x.kind }));
  // Bounded chunks; every recipient has a stable deduplication key for safe resume.
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  c.executionCtx.waitUntil(processMail(c.env));
  return c.json({ status: isLocal(c.env) ? 'development' : 'queued', count: rows.length });
});
app.post('/api/unsubscribe', async (c) => {
  const x = z.object({ token: z.string().min(40).max(100) }).parse(await c.req.json());
  const r = await c.env.DB.prepare('SELECT email FROM marketing_tokens WHERE token=?')
    .bind(x.token)
    .first<any>();
  if (!r) fail(404, 'Lien introuvable');
  await c.env.DB.prepare('INSERT OR IGNORE INTO unsubscribes(email,token) VALUES(?,?)')
    .bind(r.email, x.token)
    .run();
  return c.json({ ok: true });
});
app.get('/api/admin/audit', async (c) => {
  const a = await staffActor(c, 'staff');
  if (a.role !== 'admin') fail(403, 'Administrateur principal requis');
  return c.json(
    (await c.env.DB.prepare('SELECT * FROM audit ORDER BY at DESC LIMIT 200').all()).results,
  );
});
app.post('/api/admin/resend/:id', async (c) => {
  const a = await staffActor(c, 'communications');
  const r = await c.env.DB.prepare(
    "SELECT r.*,o.user_id FROM registrations r JOIN orders o ON o.id=r.order_id WHERE r.id=? AND r.status IN ('confirmed','partially_refunded')",
  )
    .bind(c.req.param('id'))
    .first<any>();
  if (!r) fail(404, 'Dossier confirmé introuvable');
  await c.env.DB.batch([
    mailStatement(
      c.env,
      r.email,
      'Rappel de confirmation — Ride For Brains',
      `Bonjour ${r.first_name},\nVotre dossier ${r.id} est confirmé. Espace de l’acheteur : ${c.env.APP_URL}/espace`,
      'resend:' + uuid(),
      r.user_id,
      r.id,
    ),
    audit(c.env, a.id, 'confirmation.queued', r.id),
  ]);
  return c.json({ status: isLocal(c.env) ? 'development' : 'queued' });
});
app.get('/api/account/export', async (c) => {
  const a = await actor(c);
  const regs = (
    await c.env.DB.prepare(
      'SELECT r.* FROM registrations r JOIN orders o ON o.id=r.order_id WHERE o.user_id=?',
    )
      .bind(a.id)
      .all<any>()
  ).results.map(({ notes, ticket, ...r }) => r);
  await audit(c.env, a.id, 'account.exported', a.id).run();
  return c.json({ account: { name: a.name, email: a.email }, registrations: regs });
});
app.post('/api/account/deletion-request', async (c) => {
  const a = await actor(c);
  await c.env.DB.prepare('INSERT INTO submissions(id,kind,name,email,message) VALUES(?,?,?,?,?)')
    .bind(
      uuid(),
      'privacy',
      a.name,
      a.email,
      'Demande de suppression du compte et des données. Vérifier les obligations de conservation avant exécution.',
    )
    .run();
  return c.json({
    ok: true,
    message: 'Demande de suppression enregistrée pour traitement par le responsable.',
  });
});
app.post('/api/webhooks/stripe', async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET || !c.env.STRIPE_SECRET_KEY) fail(503, 'Stripe non configuré');
  let event;
  try {
    event = await stripe(c.env).webhooks.constructEventAsync(
      await c.req.text(),
      c.req.header('stripe-signature') || '',
      c.env.STRIPE_WEBHOOK_SECRET!,
      300,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    fail(400, 'Signature Stripe invalide');
  }
  await handleStripeEvent(c.env, event!);
  return c.json({ received: true });
});
app.post('/api/webhooks/resend', async (c) => {
  if (!c.env.RESEND_WEBHOOK_SECRET) fail(503, 'Webhook courriel non configuré');
  let data: any;
  try {
    data = new Webhook(c.env.RESEND_WEBHOOK_SECRET!).verify(await c.req.text(), {
      'svix-id': c.req.header('svix-id') || '',
      'svix-timestamp': c.req.header('svix-timestamp') || '',
      'svix-signature': c.req.header('svix-signature') || '',
    });
  } catch {
    fail(400, 'Signature courriel invalide');
  }
  const id = c.req.header('svix-id')!;
  const emailId = data.data?.email_id;
  const type = data.type;
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT OR IGNORE INTO mail_events(id,provider_id,type,at) VALUES(?,?,?,?)',
    ).bind(id, emailId || '', type, Date.parse(data.created_at) / 1000 || now()),
    c.env.DB.prepare(
      "UPDATE outbox SET status=CASE WHEN EXISTS(SELECT 1 FROM mail_events WHERE provider_id=? AND type IN ('email.bounced','email.complained')) THEN 'bounced' WHEN EXISTS(SELECT 1 FROM mail_events WHERE provider_id=? AND type='email.delivered') THEN 'delivered' ELSE status END WHERE provider_id=?",
    ).bind(emailId, emailId, emailId),
  ]);
  return c.json({ ok: true });
});
app.all('/api/*', (c) => c.json({ error: 'Route introuvable' }, 404));
app.get('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  return new Response(res.body, { status: res.status, headers });
});
export async function scheduled(env: Env) {
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE registrations SET status='expired' WHERE status='pending' AND expires_at<unixepoch()",
    ),
    env.DB.prepare(
      "UPDATE orders SET status='expired' WHERE status='pending' AND expires_at<unixepoch()",
    ),
    env.DB.prepare('DELETE FROM rate_limits WHERE reset_at<unixepoch()-86400'),
    env.DB.prepare('DELETE FROM verification WHERE expiresAt<?').bind(Date.now() - 86400000),
    env.DB.prepare('DELETE FROM session WHERE expiresAt<?').bind(Date.now() - 86400000),
  ]);
  await processRefunds(env);
  await processMail(env);
}
export default {
  fetch: app.fetch,
  scheduled: (_controller: ScheduledController, env: Env, ctx: ExecutionContext) =>
    ctx.waitUntil(scheduled(env)),
};
