import { z } from 'zod';
import type { Env } from './types';
import { uuid, now, parse, isLocal } from './types';
import { digest, opaqueToken, seal, unseal } from './crypto';
import { mailStatement, processMail } from './mail';
import { email } from './validation';
import { localeFromHeader, localizedPath } from '../shared/locale';

const cancelQueuedTicketMail = (env: Env, id: string) =>
  env.DB.prepare(
    "UPDATE outbox SET status='cancelled',lease_until=NULL,error='Lien de billet remplacé ou révoqué' WHERE registration_id=? AND (body LIKE '%/billet-personnel#%' OR body LIKE '%/personal-ticket#%') AND status IN ('queued','retry','development')",
  ).bind(id);

// Access grants belong to one registration and one exact QR/contact version.
// Tokens in email fragments never enter normal page URLs, access logs or metadata.
export async function ticketDelivery(
  env: Env,
  r: any,
  buyerName: string,
  dedupe: string,
  subject = 'Inscription confirmée — Ride For Brains',
  allowRevive = false,
) {
  const qrHash = await digest(r.ticket);
  const existing = await env.DB.prepare(
    'SELECT * FROM participant_ticket_access WHERE registration_id=? AND revoked_at IS NULL AND recipient=? AND ticket_hash=?',
  )
    .bind(r.id, r.email, qrHash)
    .first<any>();
  const token = existing
      ? ((await unseal(existing.token_cipher, env.BETTER_AUTH_SECRET)) as string)
      : opaqueToken(),
    hash = await digest(token);
  const locale = localeFromHeader(r.locale || parse(r.event_snapshot)?.locale);
  const link = env.APP_URL + localizedPath('/billet-personnel', locale) + '#' + token;
  const english = locale === 'en-CA';
  const body = english
    ? `Hello ${r.first_name},\n\n${buyerName} registered you for Ride For Brains — ${r.activity_name || r.name || 'Your activity'} ${r.distance || ''}.\n\nView my ticket: ${link}\n\nThis private link opens your ticket. Keep it to yourself and show your QR code at check-in. Donations to Brain Canada are separate from registration fees.`
    : `Bonjour ${r.first_name},\n\n${buyerName} vous a inscrit à Ride For Brains — ${r.activity_name || r.name || 'Votre activité'} ${r.distance || ''}.\n\nVoir mon billet : ${link}\n\nCe lien personnel donne accès uniquement à votre billet. Conservez-le sans le partager. Présentez votre QR à l’accueil. Les dons à Brain Canada sont distincts des frais d’inscription.`;
  return [
    env.DB.prepare(
      "INSERT INTO participant_ticket_access(registration_id,token_hash,token_cipher,ticket_hash,recipient) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM visible_registrations WHERE id=? AND email=? AND ticket=? AND status IN ('confirmed','partially_refunded')) AND NOT EXISTS(SELECT 1 FROM participant_email_changes WHERE registration_id=? AND status='pending' AND expires_at>unixepoch()) ON CONFLICT(registration_id) DO UPDATE SET token_hash=excluded.token_hash,token_cipher=excluded.token_cipher,ticket_hash=excluded.ticket_hash,recipient=excluded.recipient,revoked_at=NULL,created_at=unixepoch() WHERE ?=1 OR participant_ticket_access.ticket_hash!=excluded.ticket_hash OR participant_ticket_access.recipient!=excluded.recipient",
    ).bind(
      r.id,
      hash,
      await seal(token, env.BETTER_AUTH_SECRET),
      qrHash,
      r.email,
      r.id,
      r.email,
      r.ticket,
      r.id,
      allowRevive ? 1 : 0,
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO outbox(id,dedupe,user_id,registration_id,recipient,subject,body,kind,available_at,status,locale) SELECT ?,?,?,?,?,?,?,'operational',?,?,? WHERE EXISTS(SELECT 1 FROM participant_ticket_access p JOIN visible_registrations r ON r.id=p.registration_id WHERE p.registration_id=? AND p.token_hash=? AND p.revoked_at IS NULL AND r.status IN ('confirmed','partially_refunded'))",
    ).bind(
      uuid(),
      dedupe,
      null,
      r.id,
      r.email,
      english ? 'Your Ride For Brains ticket' : subject,
      body,
      now(),
      isLocal(env) ? 'development' : 'queued',
      locale,
      r.id,
      hash,
    ),
  ];
}

// Bounded recovery also gives previously confirmed participants their own access.
export async function deliverMissingTickets(env: Env, registrationId?: string) {
  const rows = (
    await env.DB.prepare(
      "SELECT r.*,a.name AS activity_name,a.distance,u.name AS buyer_name,o.event_snapshot FROM visible_registrations r JOIN orders o ON o.id=r.order_id JOIN user u ON u.id=o.user_id JOIN activities a ON a.id=r.activity_id LEFT JOIN participant_ticket_access p ON p.registration_id=r.id WHERE r.status IN ('confirmed','partially_refunded') AND (p.registration_id IS NULL OR p.recipient!=r.email" +
        (registrationId ? ' OR p.revoked_at IS NOT NULL' : '') +
        ") AND NOT EXISTS(SELECT 1 FROM participant_email_changes e WHERE e.registration_id=r.id AND e.status='pending' AND e.expires_at>unixepoch())" +
        (registrationId ? ' AND r.id=?' : '') +
        ' LIMIT 10',
    )
      .bind(...(registrationId ? [registrationId] : []))
      .all<any>()
  ).results;
  for (const r of rows)
    await env.DB.batch(
      await ticketDelivery(
        env,
        r,
        r.buyer_name,
        'personal-ticket:' + r.id + ':' + (await digest(r.ticket + r.email)),
        undefined,
        !!registrationId,
      ),
    );
}

export async function findPersonalTicket(env: Env, token: string) {
  const ticket = await env.DB.prepare(
    "SELECT r.id,r.ticket,r.first_name,r.last_name,r.activity_snapshot,r.email,r.status,p.ticket_hash,o.event_snapshot,a.name,a.distance,a.sport FROM participant_ticket_access p JOIN visible_registrations r ON r.id=p.registration_id JOIN orders o ON o.id=r.order_id JOIN activities a ON a.id=r.activity_id WHERE p.token_hash=? AND p.revoked_at IS NULL AND p.recipient=r.email AND r.status IN ('confirmed','partially_refunded')",
  )
    .bind(await digest(token))
    .first<any>();
  return ticket && (await digest(ticket.ticket)) === ticket.ticket_hash ? ticket : null;
}

export function personalTicketRoutes(
  app: any,
  adminApi: any,
  { actor, staffActor, audit, fail, limited }: any,
) {
  adminApi.post('/participants/:id/ticket-access/revoke', async (c: any) => {
    const a = await staffActor(c, 'participants');
    z.object({ confirm: z.literal(true) })
      .strict()
      .parse(await c.req.json());
    const id = c.req.param('id');
    const r = await c.env.DB.prepare('SELECT id,email,ticket FROM visible_registrations WHERE id=?')
      .bind(id)
      .first();
    if (!r) fail(404, 'Participation introuvable');
    const discarded = opaqueToken();
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO participant_ticket_access(registration_id,token_hash,token_cipher,ticket_hash,recipient,revoked_at) VALUES(?,?,?,?,?,unixepoch()) ON CONFLICT(registration_id) DO UPDATE SET revoked_at=unixepoch()',
      ).bind(
        id,
        await digest(discarded),
        await seal(discarded, c.env.BETTER_AUTH_SECRET),
        await digest(r.ticket),
        r.email,
      ),
      cancelQueuedTicketMail(c.env, id),
      audit(c.env, a.id, 'ticket_access.revoked', id),
    ]);
    return c.json({ ok: true });
  });
  app.post('/api/tickets/view', async (c: any) => {
    await limited(c.env, 'ticket-view:' + (c.req.header('cf-connecting-ip') || 'local'), 40, 60);
    const { token } = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(await c.req.json());
    const r = await findPersonalTicket(c.env, token);
    if (!r) fail(404, 'Ce billet est indisponible. Demandez un nouveau lien à l’organisation.');
    const event = parse(r.event_snapshot),
      activity = parse(r.activity_snapshot);
    return c.json({
      id: r.id,
      ticket: r.ticket,
      first_name: r.first_name,
      last_name: r.last_name,
      status: r.status,
      name: activity.name || r.name,
      distance: activity.distance || r.distance,
      sport: activity.sport || r.sport,
      event: {
        title: event.title || 'Ride For Brains',
        edition: event.edition,
        date: event.date,
        eventAt: event.eventAt,
        reception: event.reception,
        location: event.location,
      },
    });
  });
  app.get('/api/orders/:id/status', async (c: any) => {
    const a = await actor(c);
    const order = await c.env.DB.prepare(
      'SELECT id,status,payment_intent,amount FROM visible_orders WHERE id=? AND user_id=?',
    )
      .bind(c.req.param('id'), a.id)
      .first();
    if (!order) fail(404, 'Dossier introuvable');
    return c.json({
      id: order.id,
      status: order.status,
      paid: !!order.payment_intent || (order.amount === 0 && order.status === 'confirmed'),
    });
  });
  app.get('/api/orders/:id/receipt', async (c: any) => {
    const a = await actor(c);
    const o = await c.env.DB.prepare(
      'SELECT id,amount,refunded,status,created_at,payment_intent,event_snapshot FROM visible_orders WHERE id=? AND user_id=?',
    )
      .bind(c.req.param('id'), a.id)
      .first();
    if (!o) fail(404, 'Reçu introuvable');
    const lines = (
      await c.env.DB.prepare(
        'SELECT r.price,r.activity_snapshot,a.name,a.distance FROM visible_registrations r JOIN activities a ON a.id=r.activity_id WHERE r.order_id=?',
      )
        .bind(o.id)
        .all()
    ).results.map((r: any) => ({
      name: parse(r.activity_snapshot).name || r.name,
      distance: parse(r.activity_snapshot).distance || r.distance,
      amount: r.price,
    }));
    return c.json({
      number: o.id,
      date: o.created_at,
      status: o.status,
      total: o.amount,
      paid: o.payment_intent ? o.amount : 0,
      refunded: o.refunded,
      lines,
    });
  });
  adminApi.post('/participants/:id/email-change', async (c: any) => {
    const a = await staffActor(c, 'participants');
    await limited(c.env, 'email-correction:' + a.id, 10, 3600);
    const x = z
      .object({ email, confirm: z.literal(true) })
      .strict()
      .parse(await c.req.json());
    const r = await c.env.DB.prepare(
      'SELECT id,email,ticket,status FROM visible_registrations WHERE id=?',
    )
      .bind(c.req.param('id'))
      .first();
    if (!r || !['confirmed', 'partially_refunded'].includes(r.status))
      fail(409, 'Seule une participation confirmée peut recevoir un nouveau billet.');
    if (r.email === x.email) fail(400, 'Cette adresse est déjà enregistrée.');
    const token = opaqueToken(),
      id = uuid();
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE participant_email_changes SET status='cancelled' WHERE registration_id=? AND status='pending'",
      ).bind(r.id),
      c.env.DB.prepare(
        'INSERT INTO participant_email_changes(id,registration_id,actor_id,token_hash,old_email,new_email,ticket_hash,expires_at) VALUES(?,?,?,?,?,?,?,?)',
      ).bind(
        id,
        r.id,
        a.id,
        await digest(token),
        r.email,
        x.email,
        await digest(r.ticket),
        now() + 86400,
      ),
      c.env.DB.prepare(
        'UPDATE participant_ticket_access SET revoked_at=unixepoch() WHERE registration_id=?',
      ).bind(r.id),
      cancelQueuedTicketMail(c.env, r.id),
      mailStatement(
        c.env,
        x.email,
        'Confirmez votre adresse — Ride For Brains',
        `L’organisation demande de corriger une adresse de contact.\n\nConfirmer cette adresse : ${c.env.APP_URL}/confirmer-courriel#${token}\n\nCe lien est valable 24 heures. Aucun compte ne sera modifié. Ignorez ce message si vous n’êtes pas concerné.`,
        'participant-email:' + id,
      ),
      audit(c.env, a.id, 'participant.email_change_requested', r.id, { requestId: id }),
    ]);
    c.executionCtx.waitUntil(processMail(c.env));
    return c.json({
      ok: true,
      message:
        'La nouvelle adresse doit être confirmée par son destinataire. L’ancien lien de billet a été désactivé.',
    });
  });
  app.post('/api/tickets/confirm-email', async (c: any) => {
    await limited(
      c.env,
      'confirm-participant-email:' + (c.req.header('cf-connecting-ip') || 'local'),
      20,
      600,
    );
    const { token, confirm } = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/), confirm: z.literal(true) })
      .strict()
      .parse(await c.req.json());
    const change = await c.env.DB.prepare(
      "SELECT * FROM participant_email_changes WHERE token_hash=? AND status='pending' AND expires_at>unixepoch()",
    )
      .bind(await digest(token))
      .first();
    if (!change) fail(404, 'Cette demande a expiré ou a déjà été traitée.');
    const r = await c.env.DB.prepare('SELECT id,email,ticket FROM visible_registrations WHERE id=?')
      .bind(change.registration_id)
      .first();
    if (!r || r.email !== change.old_email || (await digest(r.ticket)) !== change.ticket_hash)
      fail(409, 'Le billet a changé. Demandez une nouvelle correction à l’organisation.');
    const result = await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE registrations SET email=?,ticket=? WHERE id=? AND email=? AND ticket=? AND removed_at IS NULL AND status IN ('confirmed','partially_refunded') AND EXISTS(SELECT 1 FROM participant_email_changes WHERE id=? AND status='pending' AND expires_at>unixepoch())",
      ).bind(change.new_email, opaqueToken(), r.id, r.email, r.ticket, change.id),
      c.env.DB.prepare(
        "UPDATE participant_email_changes SET status='confirmed',confirmed_at=unixepoch() WHERE id=? AND status='pending' AND changes()=1",
      ).bind(change.id),
      c.env.DB.prepare(
        "INSERT INTO audit(id,actor,action,target,detail) SELECT ?,?,'participant.email_changed',registration_id,json_object('requestId',id) FROM participant_email_changes WHERE id=? AND status='confirmed' AND changes()=1",
      ).bind(uuid(), change.actor_id, change.id),
    ]);
    if (!result[0].meta.changes)
      fail(409, 'Cette demande a déjà été traitée ou le billet a changé.');
    await deliverMissingTickets(c.env, r.id);
    c.executionCtx.waitUntil(processMail(c.env));
    return c.json({
      ok: !!confirm,
      message: 'Adresse confirmée. Votre nouveau billet a été préparé pour cette adresse.',
    });
  });
}
