import type { Env } from './types';
import { isLocal, uuid, now } from './types';

export function mailStatement(
  env: Env,
  recipient: string,
  subject: string,
  body: string,
  dedupe: string,
  userId: string | null = null,
  registrationId: string | null = null,
  kind = 'operational',
  available = now(),
) {
  return env.DB.prepare(
    'INSERT OR IGNORE INTO outbox(id,dedupe,user_id,registration_id,recipient,subject,body,kind,available_at,status) VALUES(?,?,?,?,?,?,?,?,?,?)',
  ).bind(
    uuid(),
    dedupe,
    userId,
    registrationId,
    recipient,
    subject,
    body,
    kind,
    available,
    isLocal(env) ? 'development' : 'queued',
  );
}
export async function enqueueMail(
  env: Env,
  email: string,
  subject: string,
  body: string,
  dedupe: string,
  kind = 'operational',
) {
  await mailStatement(env, email, subject, body, dedupe, null, null, kind).run();
}

export async function processMail(env: Env) {
  if (isLocal(env) || !env.RESEND_API_KEY || !env.MAIL_FROM) return;
  const rows = await env.DB.prepare(
    "SELECT * FROM outbox WHERE ((status IN ('queued','retry') AND available_at<=?) OR (status='sending' AND lease_until<?)) AND attempts<6 ORDER BY CASE WHEN kind='login' THEN 0 ELSE 1 END,created_at LIMIT 10",
  )
    .bind(now(), now())
    .all<any>();
  for (const row of rows.results) {
    // Provider idempotency is retained for 24 hours. Older ambiguous sends need review.
    if (row.attempts > 0 && row.created_at < now() - 23 * 3600) {
      await env.DB.prepare(
        "UPDATE outbox SET status='review',error='Délai de déduplication du prestataire dépassé' WHERE id=?",
      )
        .bind(row.id)
        .run();
      continue;
    }
    const claimed = await env.DB.prepare(
      "UPDATE outbox SET status='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND (status IN ('queued','retry') OR (status='sending' AND lease_until<?)) RETURNING id",
    )
      .bind(now() + 120, row.id, now())
      .first();
    if (!claimed) continue;
    if (
      row.kind === 'marketing' &&
      (await env.DB.prepare('SELECT 1 FROM unsubscribes WHERE email=?').bind(row.recipient).first())
    ) {
      await env.DB.prepare("UPDATE outbox SET status='unsubscribed' WHERE id=?").bind(row.id).run();
      continue;
    }
    const limit = await env.DB.prepare(
      'INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    )
      .bind('mail:' + Math.floor(now() / 86400), (Math.floor(now() / 86400) + 1) * 86400)
      .first<any>();
    const budget = Math.max(1, Math.min(100000, Number(env.MAIL_DAILY_LIMIT) || 90));
    if (limit.count > budget) {
      await env.DB.prepare(
        "UPDATE outbox SET status='retry',available_at=?,lease_until=NULL,error='Budget quotidien d’envoi atteint' WHERE id=?",
      )
        .bind((Math.floor(now() / 86400) + 1) * 86400, row.id)
        .run();
      continue;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': row.id,
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [row.recipient],
          subject: row.subject,
          text: row.body,
        }),
      });
      if (!res.ok) throw new Error('Prestataire HTTP ' + res.status);
      const data = (await res.json()) as { id: string };
      if (!data.id) throw new Error('Identifiant de courriel absent');
      await env.DB.prepare(
        "UPDATE outbox SET status=CASE WHEN EXISTS(SELECT 1 FROM mail_events WHERE provider_id=? AND type IN ('email.bounced','email.complained')) THEN 'bounced' WHEN EXISTS(SELECT 1 FROM mail_events WHERE provider_id=? AND type='email.delivered') THEN 'delivered' ELSE 'accepted' END,provider_id=?,error=NULL,lease_until=NULL WHERE id=?",
      )
        .bind(data.id, data.id, data.id, row.id)
        .run();
    } catch (e) {
      await env.DB.prepare(
        'UPDATE outbox SET status=?,error=?,available_at=?,lease_until=NULL WHERE id=?',
      )
        .bind(
          row.attempts >= 5 ? 'failed' : 'retry',
          String(e).slice(0, 180),
          now() + Math.min(3600, 60 * 2 ** row.attempts),
          row.id,
        )
        .run();
    }
  }
}
