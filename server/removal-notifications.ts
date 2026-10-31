import type { Env } from './types';
import { isLocal, uuid, now } from './types';
export const cad = (amount: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(amount / 100);
/** Receipts are committed in the same transaction as the removal. */
export function removalMail(
  env: Env,
  orderId: string,
  receiptId: string,
  recipient: string,
  userId: string,
  subject: string,
  body: string,
  dedupe: string,
) {
  return env.DB.prepare(
    "INSERT OR IGNORE INTO outbox(id,dedupe,user_id,recipient,subject,body,kind,available_at,status) SELECT ?,?,?,?,?,?,'operational',?,? WHERE EXISTS(SELECT 1 FROM order_removals WHERE order_id=? AND id=?)",
  ).bind(
    uuid(),
    dedupe,
    userId,
    recipient,
    subject,
    body,
    now(),
    isLocal(env) ? 'development' : 'queued',
    orderId,
    receiptId,
  );
}
export async function removalContacts(env: Env, orderId: string) {
  return env.DB.prepare(
    'SELECT r.*,b.email AS buyer_email,b.id AS buyer_id,a.email AS admin_email,a.id AS admin_id FROM order_removals r JOIN orders o ON o.id=r.order_id JOIN user b ON b.id=o.user_id JOIN user a ON a.id=r.actor_id WHERE r.order_id=?',
  )
    .bind(orderId)
    .first<any>();
}
export function confirmationMails(
  env: Env,
  contact: any,
  subject: string,
  body: string,
  key: string,
) {
  const recipients = [
    { email: contact.buyer_email, id: contact.buyer_id },
    ...(contact.admin_email.toLowerCase() === contact.buyer_email.toLowerCase()
      ? []
      : [{ email: contact.admin_email, id: contact.admin_id }]),
  ];
  return recipients.map((r) =>
    removalMail(env, contact.order_id, contact.id, r.email, r.id, subject, body, key + ':' + r.id),
  );
}
