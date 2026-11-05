import { countEvent } from './analytics';
import Stripe from 'stripe';
import type { Env } from './types';
import { now, uuid, isLocal } from './types';
import { mailStatement } from './mail';
import { cad, confirmationMails, removalContacts } from './removal-notifications';
import { ticketDelivery } from './personal-tickets';
import { digest } from './crypto';
import { PaymentConfigurationError, stripeConfigurationIssue } from './payment-errors';

export function stripe(env: Env) {
  const issue = stripeConfigurationIssue({
    key: env.STRIPE_SECRET_KEY,
    mode: env.PAYMENTS_MODE,
    local: isLocal(env),
  });
  if (issue) throw new PaymentConfigurationError(issue);
  return new Stripe(env.STRIPE_SECRET_KEY!.trim(), { httpClient: Stripe.createFetchHttpClient() });
}
export async function startCheckout(env: Env, order: any) {
  const api = stripe(env);
  const user = await env.DB.prepare('SELECT email FROM user WHERE id=?')
    .bind(order.user_id)
    .first<any>();
  const session = await api.checkout.sessions.create(
    {
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: order.id,
      metadata: { order_id: order.id },
      payment_intent_data: { metadata: { order_id: order.id } },
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: 'Ride For Brains — inscriptions',
              description: 'Dossier ' + order.id.slice(0, 8),
            },
            unit_amount: order.amount,
          },
          quantity: 1,
        },
      ],
      success_url: env.APP_URL + '/espace?commande=' + order.id,
      cancel_url: env.APP_URL + '/espace?abandon=' + order.id,
      expires_at: order.expires_at,
      payment_method_types: ['card'],
    },
    { idempotencyKey: 'checkout:' + order.id },
  );
  await env.DB.prepare('UPDATE orders SET stripe_session=? WHERE id=? AND stripe_session IS NULL')
    .bind(session.id, order.id)
    .run();
  return session.url;
}

async function reconcileRemovedPayment(
  env: Env,
  order: any,
  pi: Stripe.PaymentIntent,
  event: Stripe.Event,
) {
  const current = await env.DB.prepare('SELECT * FROM orders WHERE id=?')
    .bind(order.id)
    .first<any>();
  if (current.payment_intent) {
    if (current.payment_intent !== pi.id) throw Error('Paiement du retrait incompatible');
    await env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)')
      .bind(event.id, event.type)
      .run();
    return;
  }
  const removal = await removalContacts(env, order.id);
  if (!removal) throw Error('Retrait introuvable');
  const amount = removal.refund_eligible ? Math.max(0, current.amount - current.refunded) : 0,
    job = 'removal:' + order.id;
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE orders SET payment_intent=?,status=? WHERE id=? AND removed_at IS NOT NULL AND payment_intent IS NULL',
    ).bind(pi.id, amount ? 'refunding' : 'cancelled', order.id),
    env.DB.prepare(
      "INSERT OR IGNORE INTO refund_jobs(id,order_id,amount,reason) SELECT ?,o.id,o.amount-o.refunded,'Paiement tardif après retrait administratif' FROM orders o JOIN order_removals r ON r.order_id=o.id WHERE o.id=? AND r.refund_eligible=1 AND o.amount>o.refunded AND o.payment_intent=?",
    ).bind(job, order.id, pi.id),
    env.DB.prepare(
      'UPDATE order_removals SET refund_amount=COALESCE((SELECT amount FROM refund_jobs WHERE id=?),refund_amount),checkout_closed=1 WHERE order_id=?',
    ).bind(job, order.id),
    env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)').bind(
      event.id,
      event.type,
    ),
    ...confirmationMails(
      env,
      removal,
      'Paiement reçu après retrait — Ride For Brains',
      `Un paiement de ${cad(current.amount)} a été confirmé après le retrait de la commande ${order.id}. Aucun billet n’est réactivé. ${amount ? 'Un remboursement de ' + cad(amount) + ' est demandé selon la politique; il reste en traitement.' : 'Aucun nouveau remboursement n’est prévu selon la politique applicable au retrait.'}`,
      'removed-late-payment:' + order.id,
    ),
    env.DB.prepare(
      "INSERT INTO audit(id,actor,action,target) VALUES(?,'stripe','removed_order.payment_received',?)",
    ).bind(uuid(), order.id),
  ]);
}

// The event is signed, then the session is re-read from Stripe to reconcile its current state.
export async function handleStripeEvent(env: Env, event: Stripe.Event, api = stripe(env)) {
  if (await env.DB.prepare('SELECT 1 FROM stripe_events WHERE id=?').bind(event.id).first()) return;
  if (event.livemode !== (env.PAYMENTS_MODE === 'live')) throw new Error('Mode webhook incorrect');
  if (event.type.startsWith('checkout.session.')) {
    const payload = event.data.object as Stripe.Checkout.Session;
    const session = await api.checkout.sessions.retrieve(payload.id, {
      expand: ['payment_intent.latest_charge'],
    });
    const id = session.metadata?.order_id;
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id=?')
      .bind(id || '')
      .first<any>();
    if (
      !order ||
      (order.stripe_session && session.id !== order.stripe_session) ||
      session.amount_total !== order.amount ||
      session.currency !== 'cad' ||
      session.client_reference_id !== id
    )
      throw new Error('Rapprochement Stripe impossible');
    // Recover when Stripe created the session but persisting its ID failed before the response.
    if (!order.stripe_session)
      await env.DB.prepare(
        'UPDATE orders SET stripe_session=? WHERE id=? AND stripe_session IS NULL',
      )
        .bind(session.id, order.id)
        .run();
    const pi = session.payment_intent as Stripe.PaymentIntent | null;
    if (
      session.payment_status === 'paid' &&
      pi?.status === 'succeeded' &&
      pi.amount_received === order.amount &&
      pi.currency === 'cad'
    ) {
      const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      if (charge?.refunded) {
        // A refund can precede the first payment webhook. Never issue a new valid ticket for a fully refunded charge.
        const refunds = await api.refunds.list({ payment_intent: pi.id, limit: 100 });
        const successful = refunds.data.filter((r) => r.status === 'succeeded');
        const total = successful.reduce((n, r) => n + r.amount, 0);
        if (total < order.amount) throw new Error('Rapprochement du remboursement incomplet');
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE orders SET status='refunded',payment_intent=?,refunded=? WHERE id=?",
          ).bind(pi.id, total, order.id),
          env.DB.prepare("UPDATE registrations SET status='refunded' WHERE order_id=?").bind(
            order.id,
          ),
          ...successful.map((r) =>
            env.DB.prepare(
              "INSERT INTO refund_jobs(id,order_id,amount,reason,status,provider_id) VALUES(?,?,?,'Rapprochement Stripe','succeeded',?) ON CONFLICT(id) DO UPDATE SET status='succeeded',provider_id=excluded.provider_id",
            ).bind(r.metadata?.job_id || 'external:' + r.id, order.id, r.amount, r.id),
          ),
          env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)').bind(
            event.id,
            event.type,
          ),
          env.DB.prepare('INSERT INTO audit(id,actor,action,target) VALUES(?,?,?,?)').bind(
            uuid(),
            'stripe',
            'payment.already_refunded',
            order.id,
          ),
        ]);
        return;
      }
      if (order.removed_at) {
        await reconcileRemovedPayment(env, order, pi, event);
        return;
      }
      if (
        ['confirmed', 'refunding', 'partially_refunded', 'refunded', 'paid_review'].includes(
          order.status,
        )
      ) {
        await env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)')
          .bind(event.id, event.type)
          .run();
        return;
      }
      const regs = (
        await env.DB.prepare('SELECT * FROM registrations WHERE order_id=?')
          .bind(order.id)
          .all<any>()
      ).results;
      const statements = [
        env.DB.prepare(
          "UPDATE orders SET status='confirmed',payment_intent=? WHERE id=? AND removed_at IS NULL AND status IN ('pending','failed','expired')",
        ).bind(pi.id, order.id),
        env.DB.prepare(
          "UPDATE registrations SET status='confirmed' WHERE order_id=? AND status IN ('pending','failed','expired')",
        ).bind(order.id),
        ...(
          await Promise.all(
            regs.map(async (r) =>
              ticketDelivery(
                env,
                { ...r, ...JSON.parse(r.activity_snapshot || '{}') },
                (
                  await env.DB.prepare('SELECT name FROM user WHERE id=?')
                    .bind(order.user_id)
                    .first<any>()
                ).name,
                'confirmed:' + r.id,
              ),
            ),
          )
        ).flat(),
        env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)').bind(
          event.id,
          event.type,
        ),
        env.DB.prepare('INSERT INTO audit(id,actor,action,target,detail) VALUES(?,?,?,?,?)').bind(
          uuid(),
          'stripe',
          'payment.confirmed',
          order.id,
          JSON.stringify({ event: event.id, amount: order.amount }),
        ),
      ];
      try {
        await env.DB.batch(statements);
        const current = await env.DB.prepare('SELECT * FROM orders WHERE id=?')
          .bind(order.id)
          .first<any>();
        if (current.removed_at) {
          await reconcileRemovedPayment(env, current, pi, event);
          return;
        }
        await countEvent(env, 'payment_confirmed');
        await countEvent(env, 'registration_confirmed');
      } catch (e) {
        if (!/CAPACITY_EXCEEDED|PROMO_UNAVAILABLE/.test(String(e))) throw e;
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE orders SET status='paid_review',payment_intent=? WHERE id=? AND status IN ('pending','failed','expired')",
          ).bind(pi.id, order.id),
          env.DB.prepare(
            "UPDATE registrations SET status='paid_review' WHERE order_id=? AND status IN ('pending','failed','expired')",
          ).bind(order.id),
          env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)').bind(
            event.id,
            event.type,
          ),
          mailStatement(
            env,
            (
              await env.DB.prepare('SELECT email FROM user WHERE id=?')
                .bind(order.user_id)
                .first<any>()
            ).email,
            'Paiement reçu — vérification nécessaire',
            `Votre paiement a été reçu après l’expiration de la réservation. Le quota est atteint : aucun billet n’est émis. L’organisation doit procéder au remboursement ou résoudre le dossier. Dossier : ${order.id}.`,
            'review:' + order.id,
            order.user_id,
          ),
          env.DB.prepare('INSERT INTO audit(id,actor,action,target) VALUES(?,?,?,?)').bind(
            uuid(),
            'stripe',
            'late_payment.capacity_conflict',
            order.id,
          ),
        ]);
      }
    } else if (
      session.status === 'expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const next = event.type === 'checkout.session.async_payment_failed' ? 'failed' : 'expired';
      await env.DB.batch([
        env.DB.prepare("UPDATE orders SET status=? WHERE id=? AND status='pending'").bind(
          next,
          order.id,
        ),
        env.DB.prepare(
          "UPDATE registrations SET status=? WHERE order_id=? AND status='pending'",
        ).bind(next, order.id),
        env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)').bind(
          event.id,
          event.type,
        ),
      ]);
    } else
      await env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)')
        .bind(event.id, event.type)
        .run();
  } else if (event.type.startsWith('refund.')) {
    const refund = await api.refunds.retrieve((event.data.object as Stripe.Refund).id);
    await applyRefund(env, refund);
    await env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)')
      .bind(event.id, event.type)
      .run();
  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const refunds = await api.refunds.list({ charge: charge.id, limit: 100 });
    for (const refund of refunds.data) await applyRefund(env, refund);
    await env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,type) VALUES(?,?)')
      .bind(event.id, event.type)
      .run();
  }
}
export async function applyRefund(env: Env, refund: Stripe.Refund) {
  const pi =
    typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
  const order = await env.DB.prepare('SELECT * FROM orders WHERE payment_intent=?')
    .bind(pi || '')
    .first<any>();
  if (!order) throw new Error('Commande du remboursement introuvable');
  const status =
    refund.status === 'succeeded'
      ? 'succeeded'
      : refund.status === 'failed' || refund.status === 'canceled'
        ? 'failed'
        : 'pending';
  const id = refund.metadata?.job_id || 'external:' + refund.id;
  const existing = await env.DB.prepare(
    'SELECT order_id,amount,provider_id FROM refund_jobs WHERE id=?',
  )
    .bind(id)
    .first<any>();
  if (
    existing &&
    (existing.order_id !== order.id ||
      existing.amount !== refund.amount ||
      (existing.provider_id && existing.provider_id !== refund.id))
  )
    throw Error('Refund reconciliation mismatch');
  // Reconcile the provider result and all derived balances in one atomic D1 batch.
  // Concurrent webhooks cannot overwrite a newer aggregate with an earlier read.
  const job = await env.DB.prepare('SELECT registration_id FROM refund_jobs WHERE id=?')
    .bind(id)
    .first<any>();
  const paidSum =
    "(SELECT COALESCE(SUM(amount),0) FROM refund_jobs WHERE order_id=orders.id AND status='succeeded')";
  const pending =
    "EXISTS(SELECT 1 FROM refund_jobs WHERE order_id=orders.id AND status IN ('queued','processing','pending'))";
  const statements = [
    env.DB.prepare(
      "INSERT INTO refund_jobs(id,order_id,amount,reason,status,provider_id) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=CASE WHEN refund_jobs.status='succeeded' THEN 'succeeded' ELSE excluded.status END,provider_id=excluded.provider_id",
    ).bind(id, order.id, refund.amount, 'Stripe', status, refund.id),
    env.DB.prepare(
      'UPDATE orders SET refunded=' +
        paidSum +
        ',status=CASE WHEN ' +
        paidSum +
        ">=amount THEN 'refunded' WHEN " +
        pending +
        " THEN 'refunding' WHEN " +
        paidSum +
        ">0 THEN 'partially_refunded' WHEN status='refunding' THEN 'confirmed' ELSE status END WHERE id=?",
    ).bind(order.id),
  ];
  if (job?.registration_id) {
    const partSum =
      "(SELECT COALESCE(SUM(amount),0) FROM refund_jobs WHERE registration_id=registrations.id AND status='succeeded')";
    const partPending =
      "EXISTS(SELECT 1 FROM refund_jobs WHERE registration_id=registrations.id AND status IN ('queued','processing','pending'))";
    statements.push(
      env.DB.prepare(
        'UPDATE registrations SET refunded_amount=' +
          partSum +
          ',status=CASE WHEN ' +
          partSum +
          ">=price THEN 'refunded' WHEN " +
          partPending +
          " THEN 'refunding' ELSE 'cancelled' END WHERE id=?",
      ).bind(job.registration_id),
    );
  } else {
    statements.push(
      env.DB.prepare(
        "UPDATE registrations SET status=(SELECT status FROM orders WHERE id=?) WHERE order_id=? AND status NOT IN ('cancelled','refunded')",
      ).bind(order.id, order.id),
    );
  }
  await env.DB.batch(statements);
  if (!order.removed_at && status === 'succeeded') {
    const buyer = await env.DB.prepare('SELECT email FROM user WHERE id=?')
      .bind(order.user_id)
      .first<any>();
    const participant = job?.registration_id
      ? await env.DB.prepare('SELECT email FROM registrations WHERE id=?')
          .bind(job.registration_id)
          .first<any>()
      : null;
    const notifications = [];
    for (const recipient of new Set<string>([
      buyer.email,
      ...(participant ? [participant.email] : []),
    ]))
      notifications.push(
        mailStatement(
          env,
          recipient,
          'Remboursement confirmé — Ride For Brains',
          'Un remboursement de ' +
            cad(refund.amount) +
            ' a été confirmé pour votre inscription. Le délai de disponibilité sur votre compte dépend de votre banque.',
          'refund-confirmed:' + refund.id + ':' + (await digest(recipient)),
          recipient === buyer.email ? order.user_id : null,
          job?.registration_id || null,
        ),
      );
    await env.DB.batch(notifications);
  }
  if (order.removed_at && status === 'succeeded') {
    const contact = await removalContacts(env, order.id);
    const current = await env.DB.prepare('SELECT refunded FROM orders WHERE id=?')
      .bind(order.id)
      .first<any>();
    if (contact)
      await env.DB.batch(
        confirmationMails(
          env,
          contact,
          'Remboursement confirmé — Ride For Brains',
          'Un remboursement de ' +
            cad(refund.amount) +
            ' est confirmé sur la commande retirée ' +
            order.id +
            '. Total remboursé : ' +
            cad(current.refunded) +
            ' sur ' +
            cad(order.amount) +
            ' réellement payés après rabais. La disponibilité sur le compte bancaire dépend de votre établissement.',
          'removed-refund:' + refund.id,
        ),
      );
  }
}

export async function processRefunds(env: Env) {
  if (!env.STRIPE_SECRET_KEY) return;
  const api = stripe(env);
  const rows = (
    await env.DB.prepare(
      "SELECT j.*,o.payment_intent FROM refund_jobs j JOIN orders o ON o.id=j.order_id WHERE j.status IN ('queued','processing') ORDER BY j.created_at LIMIT 10",
    ).all<any>()
  ).results;
  for (const job of rows) {
    // The same job always uses the same Stripe idempotency key. Ambiguous jobs older than 23h require reconciliation.
    if (job.status === 'processing' && job.created_at < now() - 23 * 3600) {
      await env.DB.prepare(
        "UPDATE refund_jobs SET status='review',error='Rapprochement Stripe requis avant reprise' WHERE id=?",
      )
        .bind(job.id)
        .run();
      continue;
    }
    await env.DB.prepare(
      "UPDATE refund_jobs SET status='processing' WHERE id=? AND status='queued'",
    )
      .bind(job.id)
      .run();
    try {
      const r = await api.refunds.create(
        { payment_intent: job.payment_intent, amount: job.amount, metadata: { job_id: job.id } },
        { idempotencyKey: 'refund:' + job.id },
      );
      await applyRefund(env, r);
    } catch (e) {
      console.error(JSON.stringify({ event: 'refund_retry', code: 'PROVIDER_UNAVAILABLE' }));
      await env.DB.prepare('UPDATE refund_jobs SET error=? WHERE id=?')
        .bind('Prestataire indisponible; reprise avec clé idempotente', job.id)
        .run();
    }
  }
}
