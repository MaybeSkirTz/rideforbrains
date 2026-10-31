import { z } from 'zod';
import type { Env } from './types';
import { uuid, now, parse } from './types';
import { stripe, processRefunds } from './payments';
import { processMail } from './mail';
import { cad, confirmationMails } from './removal-notifications';
export const removalJobId = (orderId: string) => 'removal:' + orderId;
export async function closeRemovedCheckouts(env: Env, orderId?: string) {
  if (!env.STRIPE_SECRET_KEY) return;
  const rows = (
    await env.DB.prepare(
      'SELECT o.id,o.stripe_session FROM orders o JOIN order_removals r ON r.order_id=o.id WHERE r.checkout_closed=0' +
        (orderId ? ' AND o.id=?' : '') +
        ' LIMIT 10',
    )
      .bind(...(orderId ? [orderId] : []))
      .all<any>()
  ).results;
  for (const row of rows) {
    try {
      const api = stripe(env),
        session = await api.checkout.sessions.retrieve(row.stripe_session);
      if (session.status === 'open') await api.checkout.sessions.expire(row.stripe_session);
      await env.DB.prepare('UPDATE order_removals SET checkout_closed=1 WHERE order_id=?')
        .bind(row.id)
        .run();
    } catch {
      console.warn(
        JSON.stringify({ event: 'removed_checkout_retry', code: 'PROVIDER_UNAVAILABLE' }),
      );
    }
  }
}
export function orderRemovalRoutes(app: any, { staffActor, settings, audit, fail, limited }: any) {
  const admin = async (c: any) => {
    const a = await staffActor(c, 'participants');
    if (a.role !== 'admin') fail(403, 'Seul un administrateur peut retirer une commande complète.');
    return a;
  };
  const preview = async (c: any, id: string) => {
    const o = await c.env.DB.prepare(
      'SELECT o.*,u.email AS buyer_email FROM orders o JOIN user u ON u.id=o.user_id WHERE o.id=?',
    )
      .bind(id)
      .first();
    if (!o) fail(404, 'Commande introuvable.');
    const s = await settings(c.env),
      policy = parse(o.event_snapshot, s),
      eligible =
        Date.now() <=
        Date.parse(policy.eventAt || s.eventAt) - (policy.refundDays ?? 15) * 86400000;
    const blocked = !!(await c.env.DB.prepare(
      "SELECT 1 FROM refund_jobs WHERE order_id=? AND status IN ('queued','processing','pending','review') LIMIT 1",
    )
      .bind(o.id)
      .first());
    const registrations = (
      await c.env.DB.prepare(
        'SELECT r.id,r.first_name,r.last_name,r.price,a.name,a.distance FROM registrations r JOIN activities a ON a.id=r.activity_id WHERE r.order_id=?',
      )
        .bind(id)
        .all()
    ).results;
    return {
      order: o,
      eligible,
      blocked,
      registrations,
      refundRequested: o.payment_intent && eligible ? Math.max(0, o.amount - o.refunded) : 0,
    };
  };
  app.get('/api/admin/orders/:id/removal-preview', async (c: any) => {
    await admin(c);
    const p = await preview(c, c.req.param('id'));
    return c.json({
      id: p.order.id,
      buyerEmail: p.order.buyer_email,
      paid: p.order.payment_intent ? p.order.amount : 0,
      refunded: p.order.refunded,
      refundRequested: p.refundRequested,
      eligible: p.eligible,
      blocked: p.blocked,
      removed: !!p.order.removed_at,
      registrations: p.registrations,
      promo: p.order.promo,
    });
  });
  app.post('/api/admin/orders/:id/remove', async (c: any) => {
    const a = await admin(c);
    await limited(c.env, 'order-removal:' + a.id, 20, 3600);
    const x = z
      .object({
        confirm: z.literal(true),
        expectedRefund: z.number().int().nonnegative(),
        reason: z.string().trim().min(3).max(500),
      })
      .strict()
      .parse(await c.req.json());
    const p = await preview(c, c.req.param('id')),
      o = p.order;
    if (o.removed_at)
      return c.json({
        removed: true,
        alreadyRemoved: true,
        refundRequested: (
          await c.env.DB.prepare('SELECT refund_amount FROM order_removals WHERE order_id=?')
            .bind(o.id)
            .first()
        ).refund_amount,
      });
    if (p.blocked)
      fail(
        409,
        'Un remboursement est en cours ou doit être rapproché. Réglez ce dossier avant de le retirer.',
      );
    if (x.expectedRefund !== p.refundRequested)
      fail(409, 'Le montant du remboursement a changé. Rechargez la confirmation.');
    const id = uuid(),
      at = now(),
      job = removalJobId(o.id),
      status = p.refundRequested ? 'refunding' : o.status === 'refunded' ? 'refunded' : 'cancelled';
    const receipt = {
      id,
      order_id: o.id,
      buyer_email: o.buyer_email,
      buyer_id: o.user_id,
      admin_email: a.email,
      admin_id: a.id,
    };
    const body = `La commande ${o.id} a été retirée par l’administration. Ses participations sont annulées et ses billets ne sont plus valides. Elle ne figure plus dans les listes et statistiques de l’événement.\n\nMontant réellement payé, après rabais : ${cad(o.payment_intent ? o.amount : 0)}.\nDéjà remboursé : ${cad(o.refunded)}.\n${p.refundRequested ? `Remboursement demandé : ${cad(p.refundRequested)}. Il reste en traitement; ce courriel ne confirme pas encore son exécution par Stripe.` : o.payment_intent && !p.eligible ? 'Aucun remboursement prévu : la demande est à moins de 15 jours de l’événement.' : 'Aucun nouveau remboursement à effectuer.'}\n\nUne trace privée est conservée pour le suivi comptable et Stripe. Contact : ${(await settings(c.env)).contact}.`;
    const statements = [
      c.env.DB.prepare(
        "INSERT INTO order_removals(order_id,id,actor_id,reason,refund_eligible,refund_amount,checkout_closed) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND removed_at IS NULL AND payment_intent IS ? AND amount=? AND refunded=? AND status=?) AND NOT EXISTS(SELECT 1 FROM refund_jobs WHERE order_id=? AND status IN ('queued','processing','pending','review'))",
      ).bind(
        o.id,
        id,
        a.id,
        x.reason,
        p.eligible ? 1 : 0,
        p.refundRequested,
        !o.stripe_session || o.payment_intent ? 1 : 0,
        o.id,
        o.payment_intent,
        o.amount,
        o.refunded,
        o.status,
        o.id,
      ),
      ...(p.refundRequested
        ? [
            c.env.DB.prepare(
              'INSERT INTO refund_jobs(id,order_id,amount,reason) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM order_removals WHERE id=?)',
            ).bind(
              job,
              o.id,
              p.refundRequested,
              'Retrait administratif selon la politique de remboursement',
              id,
            ),
          ]
        : []),
      c.env.DB.prepare(
        'UPDATE orders SET removed_at=?,removed_by=?,status=? WHERE id=? AND EXISTS(SELECT 1 FROM order_removals WHERE id=?)',
      ).bind(at, a.id, status, o.id, id),
      c.env.DB.prepare(
        "INSERT INTO audit(id,actor,action,target,detail) SELECT ?,?,'order.removed',?,json_object('refundRequested',?,'eligible',?) WHERE EXISTS(SELECT 1 FROM order_removals WHERE id=?)",
      ).bind(uuid(), a.id, o.id, p.refundRequested, p.eligible ? 1 : 0, id),
      ...confirmationMails(
        c.env,
        receipt,
        'Commande retirée — Ride For Brains',
        body,
        'order-removed:' + o.id,
      ),
    ];
    try {
      const result = await c.env.DB.batch(statements);
      if (!result[0].meta.changes)
        fail(409, 'Cette commande a changé. Rechargez son état avant de réessayer.');
    } catch (error) {
      if (/UNIQUE/.test(String(error))) {
        const existing = await c.env.DB.prepare(
          'SELECT refund_amount FROM order_removals WHERE order_id=?',
        )
          .bind(o.id)
          .first();
        if (existing)
          return c.json({
            removed: true,
            alreadyRemoved: true,
            refundRequested: existing.refund_amount,
          });
        fail(409, 'Un remboursement vient de démarrer. Attendez sa confirmation.');
      }
      throw error;
    }
    c.executionCtx.waitUntil(
      Promise.allSettled([
        processRefunds(c.env),
        processMail(c.env),
        closeRemovedCheckouts(c.env, o.id),
      ]),
    );
    return c.json({
      removed: true,
      refundRequested: p.refundRequested,
      registrationIds: p.registrations.map((r: any) => r.id),
      message: 'Commande retirée. Les confirmations sont ajoutées à la file de courriels.',
    });
  });
  app.get('/api/admin/removed-orders', async (c: any) => {
    await admin(c);
    return c.json(
      (
        await c.env.DB.prepare(
          "SELECT r.order_id,r.reason,r.created_at,r.refund_amount,r.refund_eligible,r.checkout_closed,u.name AS removed_by,o.amount,o.refunded,o.status,(SELECT status FROM refund_jobs WHERE order_id=o.id ORDER BY created_at DESC,rowid DESC LIMIT 1) AS refund_status,(SELECT COUNT(*) FROM registrations WHERE order_id=o.id) AS participants,(SELECT COUNT(*) FROM outbox WHERE instr(dedupe,'order-removed:'||o.id||':')=1) AS confirmations FROM order_removals r JOIN orders o ON o.id=r.order_id JOIN user u ON u.id=r.actor_id ORDER BY r.created_at DESC LIMIT 200",
        ).all()
      ).results,
    );
  });
}
