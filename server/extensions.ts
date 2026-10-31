import { z } from 'zod';
import { uuid, now, parse, isLocal } from './types';
import { processRefunds } from './payments';
export function extensions(app: any, { actor, staffActor, settings, audit, fail, limited }: any) {
  app.get('/api/admin/media/status', async (c: any) => {
    await staffActor(c, 'event');
    return c.json({ configured: !!c.env.MEDIA });
  });
  app.post('/api/admin/media', async (c: any) => {
    const a = await staffActor(c, 'event');
    if (!c.env.MEDIA)
      fail(
        503,
        'Le stockage des photos n’est pas configuré. Utilisez une adresse HTTPS ou configurez la liaison R2 MEDIA.',
      );
    await limited(c.env, 'media:' + a.id, 20, 3600);
    const { data } = z
      .object({ data: z.string().max(1333340) })
      .strict()
      .parse(await c.req.json());
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(data), (v) => v.charCodeAt(0));
    } catch {
      fail(400, 'Image invalide');
    }
    if (
      bytes!.length > 1000000 ||
      new TextDecoder().decode(bytes!.slice(0, 4)) !== 'RIFF' ||
      new TextDecoder().decode(bytes!.slice(8, 12)) !== 'WEBP'
    )
      fail(400, 'Une image WebP de moins de 1 Mo est requise.');
    const key = uuid() + '.webp';
    await c.env.MEDIA.put(key, bytes!, { httpMetadata: { contentType: 'image/webp' } });
    await audit(c.env, a.id, 'media.created', key, { bytes: bytes!.length }).run();
    return c.json({ url: '/media/' + key }, 201);
  });
  app.get('/media/:key', async (c: any) => {
    const key = c.req.param('key');
    if (!/^[a-f0-9-]{36}\.webp$/.test(key) || !c.env.MEDIA) return c.notFound();
    const object = await c.env.MEDIA.get(key);
    if (!object) return c.notFound();
    return new Response(object.body, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
  app.get('/api/health', async (c: any) => {
    try {
      await c.env.DB.prepare('SELECT 1').first();
      return c.json({ status: 'ok' });
    } catch {
      return c.json({ status: 'unavailable' }, 503);
    }
  });
  app.get('/api/admin/health', async (c: any) => {
    await staffActor(c, 'event');
    const s = await settings(c.env);
    const missing = [
      !s.location && 'lieu',
      s.taxMode === 'unconfirmed' && 'fiscalité',
      !s.legalApproved && 'validation des conditions',
      !s.brandApproved && 'validation des marques',
      !c.env.STRIPE_SECRET_KEY && 'clé Stripe',
      !c.env.STRIPE_WEBHOOK_SECRET && 'webhook Stripe',
      !(c.env.RESEND_API_KEY && c.env.MAIL_FROM) && 'courriel',
      !(c.env.TURNSTILE_SECRET_KEY && c.env.TURNSTILE_SITE_KEY) && 'protection des formulaires',
      !(c.env.ACCESS_TEAM_DOMAIN && c.env.ACCESS_AUD) && 'accès renforcé',
    ].filter(Boolean);
    const jobs = await c.env.DB.prepare(
      "SELECT status,COUNT(*) AS count FROM refund_jobs WHERE status IN ('review','failed','processing','pending') GROUP BY status",
    ).all();
    const mail = await c.env.DB.prepare(
      "SELECT status,COUNT(*) AS count FROM outbox WHERE status IN ('failed','bounced','queued') GROUP BY status",
    ).all();
    return c.json({
      ready: !missing.length,
      missing,
      paymentsMode: c.env.PAYMENTS_MODE,
      media: !!c.env.MEDIA,
      refunds: jobs.results,
      mail: mail.results,
    });
  });
  app.post('/api/registrations/:id/cancel', async (c: any) => {
    const a = await actor(c);
    z.object({ confirm: z.literal(true) })
      .strict()
      .parse(await c.req.json());
    const r = await c.env.DB.prepare(
      'SELECT r.*,o.user_id,o.event_snapshot,o.payment_intent,o.status AS order_status,o.amount,o.refunded FROM visible_registrations r JOIN orders o ON o.id=r.order_id WHERE r.id=? AND o.user_id=?',
    )
      .bind(c.req.param('id'), a.id)
      .first();
    if (!r) fail(404, 'Participation introuvable');
    if (['cancelled', 'refunded', 'refunding'].includes(r.status))
      return c.json({ status: r.status, refundRequested: 0 });
    if (r.order_status === 'refunding')
      fail(409, 'Un remboursement de ce dossier est déjà en cours. Attendez sa confirmation.');
    if (!['confirmed', 'partially_refunded'].includes(r.status))
      fail(409, 'Cette participation ne peut pas être annulée dans cet état.');
    const unallocated = await c.env.DB.prepare(
      "SELECT 1 FROM refund_jobs WHERE order_id=? AND registration_id IS NULL AND status='succeeded' LIMIT 1",
    )
      .bind(r.order_id)
      .first();
    if (unallocated)
      fail(
        409,
        'Un remboursement antérieur concerne ce dossier sans ventilation par participation. Contactez l’organisation pour le rapprocher avant une annulation individuelle.',
      );
    const s = await settings(c.env),
      policy = parse(r.event_snapshot, s),
      eligible =
        Date.now() <=
        Date.parse(policy.eventAt || s.eventAt) - (policy.refundDays ?? 15) * 86400000;
    const amount = eligible ? Math.min(r.price - r.refunded_amount, r.amount - r.refunded) : 0;
    if (amount < 0) fail(409, 'Le remboursement doit être rapproché par l’organisation.');
    const status = amount ? 'refunding' : 'cancelled',
      job = uuid();
    const statements = amount
      ? [
          c.env.DB.prepare(
            "INSERT INTO refund_jobs(id,order_id,registration_id,amount,reason) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM visible_registrations WHERE id=? AND status IN ('confirmed','partially_refunded'))",
          ).bind(job, r.order_id, r.id, amount, 'Annulation individuelle à 15 jours ou plus', r.id),
          c.env.DB.prepare(
            "UPDATE registrations SET status='refunding' WHERE id=? AND EXISTS(SELECT 1 FROM refund_jobs WHERE id=?)",
          ).bind(r.id, job),
          c.env.DB.prepare(
            "UPDATE orders SET status='refunding' WHERE id=? AND EXISTS(SELECT 1 FROM refund_jobs WHERE id=?)",
          ).bind(r.order_id, job),
        ]
      : [
          c.env.DB.prepare(
            "UPDATE registrations SET status='cancelled' WHERE id=? AND status IN ('confirmed','partially_refunded')",
          ).bind(r.id),
        ];
    statements.push(
      audit(c.env, a.id, 'registration.cancellation_requested', r.id, { amount, eligible }),
    );
    try {
      await c.env.DB.batch(statements);
    } catch (e) {
      if (/UNIQUE/.test(String(e)))
        fail(
          409,
          'Un remboursement est déjà en cours pour ce dossier. Réessayez après sa confirmation.',
        );
      throw e;
    }
    c.executionCtx.waitUntil(processRefunds(c.env));
    return c.json({ status, refundRequested: amount });
  });
  app.get('/api/admin/analytics', async (c: any) => {
    await staffActor(c, 'participants');
    const queries = [
      "SELECT date(created_at,'unixepoch') AS label,COUNT(*) AS orders,COALESCE(SUM(CASE WHEN payment_intent IS NOT NULL THEN amount-refunded ELSE 0 END),0) AS revenue FROM visible_orders GROUP BY label ORDER BY label DESC LIMIT 60",
      'SELECT a.name,a.distance,r.status,COUNT(*) AS count FROM visible_registrations r JOIN activities a ON a.id=r.activity_id GROUP BY a.id,r.status',
      'SELECT status,COUNT(*) AS count FROM visible_orders GROUP BY status',
      "SELECT event,SUM(count) AS count FROM funnel_daily WHERE event!='payment_confirmed' AND day>=date('now','-60 days') GROUP BY event UNION ALL SELECT 'payment_confirmed',COUNT(*) FROM visible_orders WHERE payment_intent IS NOT NULL AND status IN ('confirmed','refunding','partially_refunded','refunded','cancelled') AND date(created_at,'unixepoch')>=date('now','-60 days')",
      "SELECT status,COUNT(*) AS count FROM outbox WHERE kind!='login' GROUP BY status",
      'SELECT COUNT(*) AS present FROM visible_registrations WHERE checked_at IS NOT NULL',
      "SELECT p.code,COUNT(o.id) AS uses FROM promos p LEFT JOIN visible_orders o ON o.promo=p.code AND o.status IN ('confirmed','refunding','partially_refunded','refunded') GROUP BY p.code",
      "SELECT date(created_at,'unixepoch') AS label,COUNT(*) AS count FROM visible_registrations WHERE status!='waitlisted' GROUP BY label ORDER BY label DESC LIMIT 60",
    ];
    const results = await Promise.all(queries.map((sql) => c.env.DB.prepare(sql).all()));
    return c.json(
      Object.fromEntries(
        [
          'daily',
          'activities',
          'orders',
          'funnel',
          'mail',
          'checkin',
          'promos',
          'registrationsDaily',
        ].map((key, i) => [key, results[i].results]),
      ),
    );
  });
}
