import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, createFetchMock } from 'miniflare';
import { resolve } from 'node:path';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { migrate } from '../scripts/migrate.mjs';

// These are integration contracts against Workerd + D1. All external HTTP is blocked,
// except explicit test fixtures below. No Stripe account or real money is used.
let mf, db, mock, initialSettings;
const origin = 'http://localhost:8787',
  secret = 'whsec_integration_tests_only';
const termsVersion = '2026-10-29-brouillon';
before(async () => {
  mock = createFetchMock();
  mock.disableNetConnect();
  mf = new Miniflare({
    modules: [{ type: 'ESModule', path: resolve('work/server/index.js') }],
    compatibilityDate: '2026-07-30',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'],
    bindings: {
      APP_ENV: 'development',
      APP_URL: origin,
      BETTER_AUTH_SECRET: 'local-integration-secret-with-more-than-32-bytes',
      STRIPE_SECRET_KEY: 'sk_test_integration_fixture',
      STRIPE_WEBHOOK_SECRET: secret,
      PAYMENTS_MODE: 'test',
    },
    fetchMock: mock,
    serviceBindings: {
      ASSETS: () =>
        new Response(
          '<html><head><title>Ride For Brains</title></head><body><div id="root"></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } },
        ),
    },
  });
  db = await mf.getD1Database('DB');
  await migrate(db);
  initialSettings = (await db.prepare('SELECT data FROM settings').first()).data;
});
after(async () => {
  await mf?.dispose();
  await mock?.close();
});
beforeEach(async () => {
  await db.batch(
    [
      'offline_checkins',
      'order_removals',
      'offline_snapshots',
      'registration_transfers',
      'guest_drafts',
      'funnel_daily',
      'mail_events',
      'marketing_tokens',
      'unsubscribes',
      'outbox',
      'refund_jobs',
      'stripe_events',
      'audit',
      'history',
      'registrations',
      'orders',
      'promos',
      'staff',
      'session_privacy',
      'auth_challenges',
      'session',
      'account',
      'verification',
      'rateLimit',
      'rate_limits',
      'submissions',
      'drafts',
      'templates',
      'user',
    ].map((t) => db.prepare('DELETE FROM ' + t)),
  );
  await db.prepare('UPDATE settings SET data=?,revision=1').bind(initialSettings).run();
  await db
    .prepare(
      'UPDATE activities SET price=1500,capacity=NULL,enabled=1,opens_at=NULL,closes_at=NULL,form_version=1',
    )
    .run();
});
async function request(path, body, cookie = '', method = body ? 'POST' : 'GET', extra = {}) {
  const res = await mf.dispatchFetch(origin + '/api' + path, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { res, status: res.status, data };
}
const fixturePassword = 'Test-password-2027!';
async function login(mail = 'payer@example.test', role = null, permissions = []) {
  const existing = await db.prepare('SELECT id FROM user WHERE email=?').bind(mail).first();
  const start = await request('/auth/request/' + (existing ? 'sign-in' : 'create'), {
    email: mail,
    password: fixturePassword,
    firstName: 'Camille',
    lastName: 'Test',
    rememberMe: true,
  });
  assert.equal(start.status, 200, JSON.stringify(start.data));
  const row = await db
    .prepare(
      "SELECT body FROM outbox WHERE recipient=? AND kind='login' ORDER BY rowid DESC LIMIT 1",
    )
    .bind(mail)
    .first();
  const code = row.body.match(/code de vérification : (\d{6})/)[1];
  const verified = await request('/auth/verify-code', {
    challengeId: start.data.challengeId,
    code,
    password: fixturePassword,
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  const cookie = verified.res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const who = await request('/me', null, cookie);
  assert.ok(who.data.user, JSON.stringify(who.data));
  if (role)
    await db
      .prepare('INSERT INTO staff(user_id,role,permissions) VALUES(?,?,?)')
      .bind(who.data.user.id, role, JSON.stringify(permissions))
      .run();
  return { cookie, id: who.data.user.id, challengeId: start.data.challengeId, code };
}
function participant(activityId = 'course-5', extra = {}) {
  return {
    activityId,
    firstName: 'Camille',
    lastName: 'Test',
    email: 'camille@example.test',
    phone: '5145550100',
    adult: true,
    emergencyName: 'Alex Test',
    emergencyPhone: '5145550199',
    answers:
      activityId === 'velo-100'
        ? { experience: 'Pratique régulière', helmet: true }
        : activityId === 'marche-5'
          ? { group: 'En solo' }
          : { experience: 'Régulière' },
    formVersion: 1,
    conditions: true,
    photo: false,
    marketing: false,
    authority: true,
    ...extra,
  };
}
function order(p = [participant()], extra = {}) {
  return { participants: p, requestKey: randomUUID(), termsVersion, ...extra };
}
async function create(cookie, body = order()) {
  const r = await request('/orders', body, cookie);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
}
async function signedEvent(event) {
  const payload = JSON.stringify({ livemode: false, ...event });
  const t = Math.floor(Date.now() / 1000),
    sig = createHmac('sha256', secret)
      .update(t + '.' + payload)
      .digest('hex');
  const res = await mf.dispatchFetch(origin + '/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` },
    body: payload,
  });
  return { status: res.status, data: await res.json() };
}
async function checkoutFixture(cookie, id, sessionId = 'cs_test_' + randomUUID()) {
  mock
    .get('https://api.stripe.com')
    .intercept({ path: '/v1/checkout/sessions', method: 'POST' })
    .reply(200, {
      id: sessionId,
      url: 'https://checkout.stripe.com/c/pay/test_fixture',
      status: 'open',
    });
  const r = await request('/orders/' + id + '/checkout', {}, cookie);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return sessionId;
}
function sessionFixture(id, sessionId, amount = 1500, overrides = {}) {
  return {
    id: sessionId,
    metadata: { order_id: id },
    client_reference_id: id,
    amount_total: amount,
    currency: 'cad',
    status: 'complete',
    payment_status: 'paid',
    payment_intent: {
      id: 'pi_' + id,
      status: 'succeeded',
      amount_received: amount,
      currency: 'cad',
    },
    ...overrides,
  };
}
function mockSession(session) {
  mock
    .get('https://api.stripe.com')
    .intercept({
      path: new RegExp('^/v1/checkout/sessions/' + session.id + '(?:\\?|$)'),
      method: 'GET',
    })
    .reply(200, session);
}

async function removalPreview(id, cookie) {
  const r = await request('/admin/orders/' + id + '/removal-preview', null, cookie);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
async function removeOrder(id, cookie, amount) {
  return request(
    '/admin/orders/' + id + '/remove',
    {
      confirm: true,
      expectedRefund: amount,
      reason: 'Demande de retrait administratif',
    },
    cookie,
  );
}
async function payOrder(cookie, o) {
  const ss = await checkoutFixture(cookie, o.id);
  const amount = (await db.prepare('SELECT amount FROM orders WHERE id=?').bind(o.id).first())
    .amount;
  mockSession(sessionFixture(o.id, ss, amount));
  const paid = await signedEvent({
    id: 'evt_' + randomUUID(),
    type: 'checkout.session.completed',
    data: { object: { id: ss } },
  });
  assert.equal(paid.status, 200, JSON.stringify(paid.data));
  return ss;
}
function mockRemovalRefund(id, amount, status = 'pending') {
  const refund = {
    id: 're_' + randomUUID(),
    payment_intent: 'pi_' + id,
    amount,
    status,
    metadata: { job_id: 'removal:' + id },
  };
  mock
    .get('https://api.stripe.com')
    .intercept({
      path: '/v1/refunds',
      method: 'POST',
      headers: { 'idempotency-key': 'refund:removal:' + id },
    })
    .reply(200, refund);
  return refund;
}
test('Whole-order removal refunds the discounted payment, hides every ticket and retains a private receipt', async () => {
  const buyer = await login(),
    admin = await login('admin@example.test', 'admin');
  await db.prepare("INSERT INTO promos(code,percent,max_uses,active) VALUES('NET25',25,1,1)").run();
  const o = await create(
    buyer.cookie,
    order([participant(), participant('course-10'), participant('marche-5')], { promo: 'NET25' }),
  );
  await payOrder(buyer.cookie, o);
  const regs = (await db.prepare('SELECT * FROM registrations WHERE order_id=?').bind(o.id).all())
    .results;
  assert.equal((await removalPreview(o.id, admin.cookie)).refundRequested, 3375);
  assert.equal((await removeOrder(o.id, admin.cookie, 4500)).status, 409);
  assert.equal(
    (await db.prepare('SELECT removed_at FROM orders WHERE id=?').bind(o.id).first()).removed_at,
    null,
  );
  const refund = mockRemovalRefund(o.id, 3375);
  const removed = await removeOrder(o.id, admin.cookie, 3375);
  assert.equal(removed.status, 200, JSON.stringify(removed.data));
  assert.equal(removed.data.refundRequested, 3375);
  assert.equal(
    (await db.prepare('SELECT amount FROM refund_jobs WHERE order_id=?').bind(o.id).first()).amount,
    3375,
  );
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM visible_orders').first()).n, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM visible_registrations').first()).n, 0);
  assert.ok(
    (await db.prepare('SELECT removed_at FROM orders WHERE id=?').bind(o.id).first()).removed_at,
  );
  assert.equal((await request('/admin/participants', null, admin.cookie)).data.total, 0);
  assert.equal((await request('/registrations', null, buyer.cookie)).data.registrations.length, 0);
  const overview = (await request('/admin/overview', null, admin.cookie)).data;
  assert.equal(overview.money.received, 0);
  assert.ok(overview.stats.every((r) => r.count === 0));
  const analytics = (await request('/admin/analytics', null, admin.cookie)).data;
  assert.equal(analytics.daily.length, 0);
  assert.equal(analytics.activities.length, 0);
  assert.equal(analytics.orders.length, 0);
  assert.equal(analytics.funnel.find((r) => r.event === 'payment_confirmed').count, 0);
  assert.equal(analytics.promos.find((r) => r.code === 'NET25').uses, 0);
  assert.equal(
    (await request('/admin/checkin/search?q=Camille', null, admin.cookie)).data.length,
    0,
  );
  assert.equal(
    (await request('/admin/offline/snapshot', { confirm: true }, admin.cookie)).data.tickets.length,
    0,
  );
  for (const r of regs) {
    assert.equal(
      (await request('/registrations/' + r.id + '/ticket', null, buyer.cookie)).status,
      404,
    );
    assert.equal((await request('/admin/participants/' + r.id, null, admin.cookie)).status, 404);
    assert.equal((await request('/admin/checkin', { ticket: r.ticket }, admin.cookie)).status, 409);
  }
  const csv = await request('/admin/export', null, admin.cookie);
  assert.ok(regs.every((r) => !csv.data.includes(r.id)));
  const receiptResult = await request('/admin/removed-orders', null, admin.cookie);
  assert.equal(receiptResult.status, 200, JSON.stringify(receiptResult.data));
  const receipts = receiptResult.data;
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].participants, 3);
  assert.equal(receipts[0].refund_amount, 3375);
  const emails = (
    await db.prepare("SELECT recipient,body FROM outbox WHERE dedupe LIKE 'order-removed:%'").all()
  ).results;
  assert.deepEqual(emails.map((e) => e.recipient).sort(), [
    'admin@example.test',
    'payer@example.test',
  ]);
  assert.ok(
    emails.every((e) => e.body.includes('33,75') && e.body.includes('reste en traitement')),
  );
  assert.equal((await removeOrder(o.id, admin.cookie, 3375)).data.alreadyRemoved, true);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM refund_jobs').first()).n, 1);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM outbox WHERE dedupe LIKE 'order-removed:%'").first())
      .n,
    2,
  );
  await create(buyer.cookie, order([participant()], { promo: 'NET25' })); // quota released
  mock
    .get('https://api.stripe.com')
    .intercept({ path: '/v1/refunds/' + refund.id, method: 'GET' })
    .reply(200, { ...refund, status: 'succeeded' });
  const evt = {
    id: 'evt_removed_refunded',
    type: 'refund.updated',
    data: { object: { id: refund.id } },
  };
  assert.equal((await signedEvent(evt)).status, 200);
  assert.equal((await signedEvent(evt)).status, 200);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM outbox WHERE dedupe LIKE 'removed-refund:%'").first())
      .n,
    2,
  );
  assert.equal(
    (await db.prepare('SELECT refunded FROM orders WHERE id=?').bind(o.id).first()).refunded,
    3375,
  );
  // A late duplicate payment webhook must never restore cancelled tickets or refund twice.
  const state = await db.prepare('SELECT stripe_session FROM orders WHERE id=?').bind(o.id).first();
  mockSession(sessionFixture(o.id, state.stripe_session, 3375));
  assert.equal(
    (
      await signedEvent({
        id: 'evt_removed_paid_again',
        type: 'checkout.session.completed',
        data: { object: { id: state.stripe_session } },
      })
    ).status,
    200,
  );
  assert.ok(
    (
      await db.prepare('SELECT status FROM registrations WHERE order_id=?').bind(o.id).all()
    ).results.every((r) => ['cancelled', 'refunded'].includes(r.status)),
  );
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM refund_jobs').first()).n, 1);
});
test('Removal is admin-only and requires an explicit confirmation', async () => {
  const buyer = await login(),
    staff = await login('organizer@example.test', 'organizer', ['participants', 'refunds']),
    admin = await login('admin@example.test', 'admin');
  const o = await create(buyer.cookie);
  assert.equal((await removeOrder(o.id, buyer.cookie, 0)).status, 403);
  assert.equal((await removeOrder(o.id, staff.cookie, 0)).status, 403);
  assert.equal((await request('/admin/removed-orders', null, staff.cookie)).status, 403);
  assert.equal(
    (
      await request(
        '/admin/orders/' + o.id + '/remove',
        { expectedRefund: 0, reason: 'Test' },
        admin.cookie,
      )
    ).status,
    400,
  );
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM order_removals').first()).n, 0);
});
test('Removal respects the frozen refund deadline and never refunds a free promo order', async () => {
  const buyer = await login(),
    admin = await login('admin@example.test', 'admin');
  const s = JSON.parse(initialSettings);
  s.eventAt = new Date(Date.now() + 14 * 86400000).toISOString();
  await db.prepare('UPDATE settings SET data=?').bind(JSON.stringify(s)).run();
  const o = await create(buyer.cookie);
  await payOrder(buyer.cookie, o);
  assert.equal((await removalPreview(o.id, admin.cookie)).refundRequested, 0);
  assert.equal((await removeOrder(o.id, admin.cookie, 0)).status, 200);
  await db.prepare("INSERT INTO promos(code,percent,active) VALUES('FREE',100,1)").run();
  const free = await create(buyer.cookie, order([participant()], { promo: 'FREE' }));
  await db.prepare('UPDATE activities SET price=9000').run();
  assert.equal((await removalPreview(free.id, admin.cookie)).paid, 0);
  assert.equal((await removeOrder(free.id, admin.cookie, 0)).status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM refund_jobs').first()).n, 0);
});
test('Removal refunds only the remaining amount and blocks unsettled refunds', async () => {
  const buyer = await login(),
    admin = await login('admin@example.test', 'admin');
  const o = await create(buyer.cookie);
  await payOrder(buyer.cookie, o);
  await db
    .prepare(
      "INSERT INTO refund_jobs(id,order_id,amount,reason,status,provider_id) VALUES('previous',?,500,'Fixture','succeeded','re_previous')",
    )
    .bind(o.id)
    .run();
  await db
    .prepare("UPDATE orders SET refunded=500,status='partially_refunded' WHERE id=?")
    .bind(o.id)
    .run();
  assert.equal((await removalPreview(o.id, admin.cookie)).refundRequested, 1000);
  await db
    .prepare(
      "INSERT INTO refund_jobs(id,order_id,amount,reason,status) VALUES('pending',?,1000,'Fixture','review')",
    )
    .bind(o.id)
    .run();
  assert.equal((await removeOrder(o.id, admin.cookie, 1000)).status, 409);
  await db.prepare("DELETE FROM refund_jobs WHERE id='pending'").run();
  mockRemovalRefund(o.id, 1000);
  assert.equal((await removeOrder(o.id, admin.cookie, 1000)).status, 200);
  assert.equal(
    (
      await db
        .prepare('SELECT amount FROM refund_jobs WHERE id=?')
        .bind('removal:' + o.id)
        .first()
    ).amount,
    1000,
  );
});
test('A paid webhook after removal of an unpaid checkout refunds net once without issuing tickets', async () => {
  const buyer = await login(),
    admin = await login('admin@example.test', 'admin');
  await db.prepare("INSERT INTO promos(code,percent,active) VALUES('HALF',50,1)").run();
  const o = await create(buyer.cookie, order([participant()], { promo: 'HALF' }));
  const ss = await checkoutFixture(buyer.cookie, o.id);
  mockSession(sessionFixture(o.id, ss, 750)); // checkout cleanup discovers it just completed
  assert.equal((await removeOrder(o.id, admin.cookie, 0)).status, 200);
  mockRemovalRefund(o.id, 750);
  mockSession(sessionFixture(o.id, ss, 750));
  const evt = {
    id: 'evt_late_removed',
    type: 'checkout.session.completed',
    data: { object: { id: ss } },
  };
  assert.equal((await signedEvent(evt)).status, 200);
  assert.equal((await signedEvent(evt)).status, 200);
  const state = await db
    .prepare('SELECT removed_at,payment_intent FROM orders WHERE id=?')
    .bind(o.id)
    .first();
  assert.ok(state.removed_at);
  assert.equal(state.payment_intent, 'pi_' + o.id);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM visible_registrations').first()).n, 0);
  assert.equal(
    (await db.prepare('SELECT amount FROM refund_jobs WHERE order_id=?').bind(o.id).first()).amount,
    750,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM outbox WHERE dedupe LIKE 'removed-late-payment:%'")
        .first()
    ).n,
    2,
  );
});
test('Public configuration contains exactly the supplied activities and no invented place', async () => {
  const r = await request('/public');
  assert.equal(r.status, 200);
  assert.equal(r.data.settings.location, null);
  assert.equal(r.data.settings.eventAt, '2027-08-21T07:30:00-04:00');
  assert.equal(r.data.activities.length, 5);
  assert.ok(r.data.activities.every((a) => a.price === 1500 && a.capacity === null));
});
test('A public visitor can load the session endpoint before external sign-in is configured', async () => {
  const visitor = new Miniflare({
    modules: [{ type: 'ESModule', path: resolve('work/server/index.js') }],
    compatibilityDate: '2026-07-30',
    compatibilityFlags: ['nodejs_compat'],
    bindings: { APP_ENV: 'production', APP_URL: 'https://example.test' },
    serviceBindings: { ASSETS: () => new Response('test assets') },
  });
  try {
    const r = await visitor.dispatchFetch('https://example.test/api/me');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { user: null });
  } finally {
    await visitor.dispose();
  }
});
test('Password and one-use code create a verified account without a redirect', async () => {
  const u = await login();
  assert.equal((await request('/me', null, u.cookie)).data.user.email, 'payer@example.test');
  const replay = await request('/auth/verify-code', {
    challengeId: u.challengeId,
    code: u.code,
    password: fixturePassword,
  });
  assert.equal(replay.status, 400);
});
test('Production sign-in returns a clear JSON error until both mail settings are present', async () => {
  for (const mailBindings of [
    {},
    { RESEND_API_KEY: 're_fixture_only' },
    { MAIL_FROM: 'Ride For Brains <inscriptions@example.test>' },
  ]) {
    const visitor = new Miniflare({
      modules: [{ type: 'ESModule', path: resolve('work/server/index.js') }],
      compatibilityDate: '2026-07-30',
      compatibilityFlags: ['nodejs_compat'],
      bindings: { APP_ENV: 'production', APP_URL: 'https://example.test', ...mailBindings },
      serviceBindings: { ASSETS: () => new Response('test assets') },
    });
    try {
      const r = await visitor.dispatchFetch('https://example.test/api/auth/request/create', {
        method: 'POST',
        headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.test',
          firstName: 'Camille',
          lastName: 'Test',
          password: fixturePassword,
        }),
      });
      assert.equal(r.status, 503);
      assert.match(r.headers.get('content-type'), /application\/json/);
      assert.match((await r.json()).error, /connexion par courriel n’est pas encore activée/);
    } finally {
      await visitor.dispose();
    }
  }
});

test('Production sign-in validates Turnstile, sends through Resend, and verifies a new account', async () => {
  const external = createFetchMock();
  external.disableNetConnect();
  const site = 'https://example.test';
  external
    .get('https://challenges.cloudflare.com')
    .intercept({
      path: '/turnstile/v0/siteverify',
      method: 'POST',
    })
    .reply(200, { success: true, hostname: 'example.test' });
  external
    .get('https://api.resend.com')
    .intercept({
      path: '/emails',
      method: 'POST',
      headers: { authorization: 'Bearer re_login_fixture' },
    })
    .reply(200, { id: 'email_login_fixture' });
  const visitor = new Miniflare({
    modules: [{ type: 'ESModule', path: resolve('work/server/index.js') }],
    compatibilityDate: '2026-07-30',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'],
    bindings: {
      APP_ENV: 'production',
      APP_URL: site,
      BETTER_AUTH_SECRET: 'production-fixture-with-more-than-32-bytes',
      RESEND_API_KEY: 're_login_fixture',
      MAIL_FROM: 'Ride For Brains <inscriptions@example.test>',
      TURNSTILE_SECRET_KEY: 'turnstile_login_fixture',
    },
    fetchMock: external,
    serviceBindings: { ASSETS: () => new Response('test assets') },
  });
  try {
    const productionDb = await visitor.getD1Database('DB');
    await migrate(productionDb);
    const started = await visitor.dispatchFetch(site + '/api/auth/request/create', {
      method: 'POST',
      headers: { Origin: site, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new-account@example.test',
        firstName: 'Camille',
        lastName: 'Test',
        password: fixturePassword,
        rememberMe: true,
        turnstileToken: 'single-use-fixture',
      }),
    });
    assert.equal(started.status, 200, await started.clone().text());
    const mail = await productionDb.prepare('SELECT body,status FROM outbox').first();
    assert.equal(mail.status, 'accepted');
    const challenge = await started.json();
    const verified = await visitor.dispatchFetch(site + '/api/auth/verify-code', {
      method: 'POST',
      headers: { Origin: site, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        code: mail.body.match(/code de vérification : (\d{6})/)[1],
        password: fixturePassword,
      }),
    });
    assert.equal(verified.status, 200, await verified.clone().text());
    const cookie = verified.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const session = await visitor.dispatchFetch(site + '/api/me', { headers: { Cookie: cookie } });
    const account = (await session.json()).user;
    assert.equal(account.email, 'new-account@example.test');
    const row = await productionDb
      .prepare('SELECT emailVerified FROM user WHERE id=?')
      .bind(account.id)
      .first();
    assert.equal(row.emailVerified, 1);
    external.assertNoPendingInterceptors();
  } finally {
    await visitor.dispose();
    await external.close();
  }
});
test('Unauthenticated and foreign-origin mutations are rejected', async () => {
  assert.equal((await request('/orders', order())).status, 401);
  const res = await mf.dispatchFetch(origin + '/api/orders', {
    method: 'POST',
    headers: { Origin: 'https://attacker.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(order()),
  });
  assert.equal(res.status, 403);
});
test('Free registration is persisted, confirmed, has an opaque ticket and local confirmation', async () => {
  const u = await login();
  await db.prepare("UPDATE activities SET price=0 WHERE id='course-5'").run();
  const o = await create(u.cookie);
  assert.equal(o.amount, 0);
  assert.equal(o.status, 'confirmed');
  const list = await request('/registrations', null, u.cookie);
  assert.equal(list.data.registrations[0].answers.experience, 'Régulière');
  assert.equal(list.data.registrations[0].photo, 0);
  const ticket = await request(
    '/registrations/' + list.data.registrations[0].id + '/ticket',
    null,
    u.cookie,
  );
  assert.equal(ticket.status, 200);
  assert.ok(ticket.data.ticket.length >= 64);
  assert.ok(!ticket.data.ticket.includes('@'));
  const mails = await db
    .prepare("SELECT * FROM outbox WHERE subject LIKE 'Inscription confirmée%'")
    .all();
  assert.equal(mails.results.length, 1);
  assert.equal(mails.results[0].status, 'development');
});
test('Paid registration stays pending even after visiting the success URL; signed payment confirms it', async () => {
  const u = await login();
  const o = await create(u.cookie);
  assert.equal(o.status, 'pending');
  const ss = await checkoutFixture(u.cookie, o.id);
  await mf.dispatchFetch(origin + '/espace?commande=' + o.id);
  assert.equal(
    (await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.id).first()).status,
    'pending',
  );
  mockSession(sessionFixture(o.id, ss));
  const done = await signedEvent({
    id: 'evt_paid',
    type: 'checkout.session.completed',
    data: { object: { id: ss } },
  });
  assert.equal(done.status, 200, JSON.stringify(done.data));
  assert.equal(
    (await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.id).first()).status,
    'confirmed',
  );
  const dup = await signedEvent({
    id: 'evt_paid',
    type: 'checkout.session.completed',
    data: { object: { id: ss } },
  });
  assert.equal(dup.status, 200);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM outbox WHERE dedupe LIKE 'confirmed:%'").first()).n,
    1,
  );
});
test('Invalid signature and wrong amount cannot confirm a payment', async () => {
  const u = await login();
  const o = await create(u.cookie);
  const ss = await checkoutFixture(u.cookie, o.id);
  const invalid = await request('/webhooks/stripe', { id: 'fake' });
  assert.equal(invalid.status, 400);
  mockSession(sessionFixture(o.id, ss, 1));
  assert.equal(
    (
      await signedEvent({
        id: 'evt_wrong',
        type: 'checkout.session.completed',
        data: { object: { id: ss } },
      })
    ).status,
    500,
  );
  assert.equal(
    (await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.id).first()).status,
    'pending',
  );
});
test('Abandoned session expires; failed payment cannot create a ticket', async () => {
  const u = await login();
  const o = await create(u.cookie);
  const ss = await checkoutFixture(u.cookie, o.id);
  mockSession(
    sessionFixture(o.id, ss, 1500, {
      status: 'expired',
      payment_status: 'unpaid',
      payment_intent: null,
    }),
  );
  assert.equal(
    (
      await signedEvent({
        id: 'evt_expired',
        type: 'checkout.session.expired',
        data: { object: { id: ss } },
      })
    ).status,
    200,
  );
  const r = (await request('/registrations', null, u.cookie)).data.registrations[0];
  assert.equal(r.status, 'expired');
  assert.equal((await request('/registrations/' + r.id + '/ticket', null, u.cookie)).status, 404);
});
test('Two concurrent baskets for the last place produce one success and one atomic refusal', async () => {
  const u = await login();
  await db.prepare("UPDATE activities SET price=0,capacity=1 WHERE id='course-5'").run();
  const results = await Promise.all([
    request('/orders', order(), u.cookie),
    request('/orders', order(), u.cookie),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM orders').first()).n, 1);
});
test('Multi-person basket rolls back entirely when one activity is full', async () => {
  const u = await login();
  await db.prepare('UPDATE activities SET price=0,capacity=1').run();
  await create(u.cookie);
  const r = await request(
    '/orders',
    order([participant('marche-5'), participant('course-5')]),
    u.cookie,
  );
  assert.equal(r.status, 409);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM registrations WHERE activity_id='marche-5'").first())
      .n,
    0,
  );
});
test('Idempotent basket creation produces one order', async () => {
  const u = await login();
  await db.prepare('UPDATE activities SET price=0').run();
  const input = order();
  const a = await create(u.cookie, input);
  const b = await request('/orders', input, u.cookie);
  assert.equal(b.status, 200);
  assert.equal(a.id, b.data.id);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM orders').first()).n, 1);
});
test('Late payment can confirm if a place remains; older expiration does not undo confirmation', async () => {
  const u = await login();
  const o = await create(u.cookie);
  const ss = await checkoutFixture(u.cookie, o.id);
  await db.batch([
    db.prepare("UPDATE orders SET status='expired',expires_at=1 WHERE id=?").bind(o.id),
    db
      .prepare("UPDATE registrations SET status='expired',expires_at=1 WHERE order_id=?")
      .bind(o.id),
  ]);
  mockSession(sessionFixture(o.id, ss));
  assert.equal(
    (
      await signedEvent({
        id: 'evt_late_ok',
        type: 'checkout.session.completed',
        data: { object: { id: ss } },
      })
    ).status,
    200,
  );
  mockSession(sessionFixture(o.id, ss));
  assert.equal(
    (
      await signedEvent({
        id: 'evt_old_expiry',
        type: 'checkout.session.expired',
        data: { object: { id: ss } },
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.id).first()).status,
    'confirmed',
  );
});
test('Late paid session after quota was consumed is marked paid_review without issuing a ticket', async () => {
  const u = await login();
  await db.prepare("UPDATE activities SET capacity=1 WHERE id='course-5'").run();
  const o = await create(u.cookie);
  const ss = await checkoutFixture(u.cookie, o.id);
  await db.batch([
    db.prepare("UPDATE orders SET status='expired',expires_at=1 WHERE id=?").bind(o.id),
    db
      .prepare("UPDATE registrations SET status='expired',expires_at=1 WHERE order_id=?")
      .bind(o.id),
    db.prepare("UPDATE activities SET price=0 WHERE id='course-5'"),
  ]);
  await create(u.cookie);
  mockSession(sessionFixture(o.id, ss));
  assert.equal(
    (
      await signedEvent({
        id: 'evt_late_full',
        type: 'checkout.session.completed',
        data: { object: { id: ss } },
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.id).first()).status,
    'paid_review',
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM registrations WHERE status='confirmed'").first()).n,
    1,
  );
});
test('Invalid, expired and exhausted promotion codes are refused, and a 100% code is genuinely free', async () => {
  const u = await login();
  assert.equal(
    (await request('/orders', order(undefined, { promo: 'BAD' }), u.cookie)).status,
    400,
  );
  await db.prepare("INSERT INTO promos(code,percent,max_uses) VALUES('ONE',100,1)").run();
  const o = await create(u.cookie, order(undefined, { promo: 'ONE' }));
  assert.equal(o.status, 'confirmed');
  assert.equal(o.amount, 0);
  assert.equal(
    (await request('/orders', order(undefined, { promo: 'ONE' }), u.cookie)).status,
    409,
  );
  assert.equal(
    (await request('/quote', { participants: ['course-5'], promo: 'ONE' }, u.cookie)).status,
    400,
  );
  await db.prepare("INSERT INTO promos(code,percent,expires_at) VALUES('OLD',20,1)").run();
  assert.equal(
    (await request('/orders', order(undefined, { promo: 'OLD' }), u.cookie)).status,
    400,
  );
});
test('Forms and terms are validated server-side; medical or extra answers are not retained', async () => {
  const u = await login();
  assert.equal(
    (
      await request(
        '/orders',
        order([participant('velo-100', { answers: { experience: 'Pratique régulière' } })]),
        u.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (await request('/orders', order([participant('course-5', { adult: false })]), u.cookie)).status,
    400,
  );
  assert.equal(
    (await request('/orders', order([participant('course-5', { formVersion: 9 })]), u.cookie))
      .status,
    409,
  );
  await db.prepare('UPDATE activities SET price=0').run();
  await create(
    u.cookie,
    order([
      participant('course-5', { answers: { experience: 'Régulière', medical: 'DO NOT KEEP' } }),
    ]),
  );
  assert.ok(
    !(await db.prepare('SELECT answers FROM registrations').first()).answers.includes('medical'),
  );
});
test('Participant isolation blocks another person’s ticket and updates', async () => {
  const u = await login(),
    v = await login('other@example.test');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie);
  const r = await db.prepare('SELECT id FROM registrations').first();
  assert.equal((await request('/registrations', null, v.cookie)).data.registrations.length, 0);
  assert.equal((await request('/registrations/' + r.id + '/ticket', null, v.cookie)).status, 404);
  assert.equal(
    (await request('/registrations/' + r.id, { phone: '5145550001' }, v.cookie, 'PATCH')).status,
    404,
  );
  assert.equal(
    (await request('/registrations/' + r.id, { notes: 'sneak' }, u.cookie, 'PATCH')).status,
    400,
  );
});
test('Admin, organizer and check-in roles are enforced on every API', async () => {
  const p = await login(),
    admin = await login('admin@example.test', 'admin'),
    organizer = await login('orga@example.test', 'organizer', ['participants']),
    volunteer = await login('scan@example.test', 'checkin', ['checkin']);
  assert.equal((await request('/admin/overview', null, p.cookie)).status, 403);
  assert.equal((await request('/admin/overview', null, admin.cookie)).status, 200);
  assert.equal((await request('/admin/participants', null, organizer.cookie)).status, 200);
  assert.equal((await request('/admin/export', null, organizer.cookie)).status, 403);
  assert.equal(
    (
      await request(
        '/admin/refunds',
        { orderId: randomUUID(), amount: 1, reason: 'Test only', confirm: true },
        organizer.cookie,
      )
    ).status,
    403,
  );
  assert.equal((await request('/admin/checkin/search?q=Test', null, volunteer.cookie)).status, 200);
  assert.equal((await request('/admin/participants', null, volunteer.cookie)).status, 403);
});
test('Valid ticket scans once; only authorized staff can undo a presence', async () => {
  const u = await login(),
    v = await login('scan@example.test', 'checkin', ['checkin']),
    admin = await login('admin@example.test', 'admin');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie);
  const r = await db.prepare('SELECT ticket FROM registrations').first();
  assert.equal((await request('/admin/checkin', { ticket: r.ticket }, v.cookie)).status, 200);
  assert.equal((await request('/admin/checkin', { ticket: r.ticket }, v.cookie)).status, 409);
  assert.equal(
    (await request('/admin/checkin', { ticket: r.ticket, undo: true }, v.cookie)).status,
    403,
  );
  assert.equal(
    (await request('/admin/checkin', { ticket: r.ticket, undo: true }, admin.cookie)).status,
    200,
  );
});
test('Publishing a form preserves old snapshots and rejects stale submissions', async () => {
  const u = await login(),
    admin = await login('admin@example.test', 'admin');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie);
  const fields = [
    { id: 'new_question', label: 'Une nouvelle question', type: 'text', required: true },
  ];
  const published = await request(
    '/admin/forms',
    { activityId: 'course-5', expectedVersion: 1, fields },
    admin.cookie,
  );
  assert.equal(published.status, 200);
  const r = await db
    .prepare('SELECT form_version,form_snapshot,answers FROM registrations')
    .first();
  assert.equal(r.form_version, 1);
  assert.ok(r.form_snapshot.includes('experience'));
  assert.equal((await request('/orders', order(), u.cookie)).status, 409);
});
test('Mail preview, explicit recipient count, local queue and deduplication all work', async () => {
  const u = await login(),
    admin = await login('admin@example.test', 'admin');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie, order([participant(), participant('marche-5')]));
  const input = {
    kind: 'operational',
    subject: 'Informations {{prenom}}',
    body: 'Bonjour {{prenom}} : {{activite}} · {{numero}}',
    campaign: randomUUID(),
  };
  const preview = await request('/admin/mail/preview', input, admin.cookie);
  assert.equal(preview.data.count, 1);
  assert.match(preview.data.preview, /Camille/);
  assert.equal(
    (await request('/admin/mail', { ...input, expectedCount: 2, confirm: true }, admin.cookie))
      .status,
    409,
  );
  assert.equal(
    (await request('/admin/mail', { ...input, expectedCount: 1, confirm: true }, admin.cookie))
      .status,
    200,
  );
  assert.equal(
    (await request('/admin/mail', { ...input, expectedCount: 1, confirm: true }, admin.cookie))
      .status,
    200,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM outbox WHERE dedupe LIKE 'campaign:%'").first()).n,
    1,
  );
});
test('Marketing respects consent and unsubscribe, and privacy requests are recorded', async () => {
  const u = await login(),
    admin = await login('admin@example.test', 'admin');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie, order([participant('course-5', { marketing: true })]));
  const input = {
    kind: 'marketing',
    subject: 'Nouvelles',
    body: 'Bonjour {{prenom}}',
    campaign: randomUUID(),
  };
  assert.equal((await request('/admin/mail/preview', input, admin.cookie)).data.count, 1);
  await request('/admin/mail', { ...input, expectedCount: 1, confirm: true }, admin.cookie);
  const r = await db.prepare('SELECT token FROM marketing_tokens').first();
  assert.equal((await request('/unsubscribe', { token: r.token })).status, 200);
  assert.equal((await request('/admin/mail/preview', input, admin.cookie)).data.count, 0);
  assert.equal((await request('/account/deletion-request', {}, u.cookie)).status, 200);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM submissions WHERE kind='privacy'").first()).n,
    1,
  );
});
test('CSV export neutralizes spreadsheet formulas and logs the export', async () => {
  const u = await login(),
    admin = await login('admin@example.test', 'admin');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie, order([participant('course-5', { firstName: '=IMPORTXML("x")' })]));
  const r = await request('/admin/export', null, admin.cookie);
  assert.equal(r.status, 200);
  assert.match(r.data, /'=IMPORTXML/);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM audit WHERE action='participants.exported'").first())
      .n,
    1,
  );
});
test('Contact and volunteer submissions are stored without pretending an email was sent', async () => {
  const r = await request('/submissions', {
    kind: 'volunteer',
    name: 'Camille Test',
    email: 'camille@example.test',
    message: 'Je peux aider à l’accueil.',
    consent: true,
  });
  assert.equal(r.status, 201);
  assert.match(r.data.message, /enregistrée/);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM submissions').first()).n, 1);
});
test('Refund webhook reconciles full and partial refunds and ignores duplicate events', async () => {
  const u = await login();
  const o = await create(u.cookie);
  const ss = await checkoutFixture(u.cookie, o.id);
  mockSession(sessionFixture(o.id, ss));
  await signedEvent({
    id: 'evt_pay_refund',
    type: 'checkout.session.completed',
    data: { object: { id: ss } },
  });
  const refund = {
    id: 're_fixture',
    amount: 500,
    payment_intent: 'pi_' + o.id,
    status: 'succeeded',
    metadata: {},
  };
  mock
    .get('https://api.stripe.com')
    .intercept({ path: '/v1/refunds/re_fixture', method: 'GET' })
    .reply(200, refund);
  assert.equal(
    (
      await signedEvent({
        id: 'evt_refund_part',
        type: 'refund.updated',
        data: { object: { id: 're_fixture' } },
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.prepare('SELECT refunded FROM orders WHERE id=?').bind(o.id).first()).refunded,
    500,
  );
  const refund2 = {
    id: 're_fixture2',
    amount: 1000,
    payment_intent: 'pi_' + o.id,
    status: 'succeeded',
    metadata: {},
  };
  mock
    .get('https://api.stripe.com')
    .intercept({ path: '/v1/refunds/re_fixture2', method: 'GET' })
    .reply(200, refund2);
  await signedEvent({
    id: 'evt_refund_rest',
    type: 'refund.updated',
    data: { object: { id: 're_fixture2' } },
  });
  const state = await db
    .prepare('SELECT status,refunded FROM orders WHERE id=?')
    .bind(o.id)
    .first();
  assert.equal(state.refunded, 1500);
  assert.equal(state.status, 'refunded');
  assert.equal(
    (
      await signedEvent({
        id: 'evt_refund_rest',
        type: 'refund.updated',
        data: { object: { id: 're_fixture2' } },
      })
    ).status,
    200,
  );
});
test('Failed payment is separate from expiry and never issues a ticket', async () => {
  const u = await login();
  const o = await create(u.cookie);
  const ss = await checkoutFixture(u.cookie, o.id);
  mockSession(
    sessionFixture(o.id, ss, 1500, {
      status: 'complete',
      payment_status: 'unpaid',
      payment_intent: { id: 'pi_failed', status: 'requires_payment_method' },
    }),
  );
  const r = await signedEvent({
    id: 'evt_failed',
    type: 'checkout.session.async_payment_failed',
    data: { object: { id: ss } },
  });
  assert.equal(r.status, 200);
  assert.equal((await db.prepare('SELECT status FROM orders').first()).status, 'failed');
});
test('Drafts are private, retain partial input, and disappear after actual registration', async () => {
  const u = await login(),
    v = await login('other@example.test');
  const p = participant('course-5', { firstName: '', conditions: false });
  assert.equal(
    (await request('/draft', { participants: [p], promo: '' }, u.cookie, 'PUT')).status,
    200,
  );
  assert.equal((await request('/draft', null, v.cookie)).data, null);
  assert.equal((await request('/draft', null, u.cookie)).data.participants[0].firstName, '');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie);
  assert.equal((await request('/draft', null, u.cookie)).data, null);
});
test('Templates persist in shared storage with permissions', async () => {
  const a = await login('admin@example.test', 'admin'),
    u = await login();
  const body = {
    name: 'Rappel départ',
    subject: 'À bientôt {{prenom}}',
    body: 'Votre activité : {{activite}}',
    kind: 'operational',
  };
  assert.equal((await request('/admin/templates', body, u.cookie, 'PUT')).status, 403);
  assert.equal((await request('/admin/templates', body, a.cookie, 'PUT')).status, 200);
  assert.equal((await request('/admin/templates', null, a.cookie)).data[0].name, 'Rappel départ');
});
test('Original event policy remains attached to a paid order after event settings change', async () => {
  const u = await login();
  const o = await create(u.cookie);
  const snap = JSON.parse(
    (await db.prepare('SELECT event_snapshot FROM orders WHERE id=?').bind(o.id).first())
      .event_snapshot,
  );
  assert.equal(snap.eventAt, '2027-08-21T07:30:00-04:00');
  const s = JSON.parse(initialSettings);
  s.eventAt = '2000-01-01T07:30:00-05:00';
  await db.prepare('UPDATE settings SET data=?').bind(JSON.stringify(s)).run();
  const ss = await checkoutFixture(u.cookie, o.id);
  mockSession(sessionFixture(o.id, ss));
  await signedEvent({
    id: 'evt_snapshot_paid',
    type: 'checkout.session.completed',
    data: { object: { id: ss } },
  });
  mock
    .get('https://api.stripe.com')
    .intercept({ path: '/v1/refunds', method: 'POST' })
    .reply(200, {
      id: 're_snapshot',
      amount: 1500,
      payment_intent: 'pi_' + o.id,
      status: 'pending',
      metadata: {},
    });
  const r = await request('/orders/' + o.id + '/cancel', { confirm: true }, u.cookie);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.refundRequested, 1500);
});
test('Cancellation under 15 days refunds zero and invalidates the ticket', async () => {
  const u = await login();
  const s = JSON.parse(initialSettings);
  s.eventAt = new Date(Date.now() + 14 * 86400000).toISOString();
  await db.prepare('UPDATE settings SET data=?').bind(JSON.stringify(s)).run();
  await db.prepare('UPDATE activities SET price=0').run();
  const o = await create(u.cookie);
  const r = await request('/orders/' + o.id + '/cancel', { confirm: true }, u.cookie);
  assert.equal(r.status, 200);
  assert.equal(r.data.refundRequested, 0);
  assert.equal((await db.prepare('SELECT status FROM registrations').first()).status, 'cancelled');
});
test('Waitlist is a real stored request only when an activity is full', async () => {
  const u = await login();
  const p = { activityId: 'course-5', firstName: 'Camille', lastName: 'Test', adult: true };
  assert.equal((await request('/waitlist', p, u.cookie)).status, 409);
  await db.prepare("UPDATE activities SET capacity=1,price=0 WHERE id='course-5'").run();
  await create(u.cookie);
  assert.equal((await request('/waitlist', p, u.cookie)).status, 200);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM registrations WHERE status='waitlisted'").first()).n,
    1,
  );
});
test('Reducing a quota below actual reservations is blocked in the database', async () => {
  const u = await login();
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie, order([participant(), participant()]));
  await assert.rejects(
    () => db.prepare("UPDATE activities SET capacity=1 WHERE id='course-5'").run(),
    /CAPACITY_EXCEEDED/,
  );
});
test('Mail provider errors retry safely and acceptance is not misreported as delivery', async () => {
  const external = createFetchMock();
  external.disableNetConnect();
  const task = new Miniflare({
    modules: [{ type: 'ESModule', path: resolve('work/tasks/index.js') }],
    compatibilityDate: '2026-07-30',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'],
    bindings: {
      APP_ENV: 'test',
      APP_URL: 'https://test.example',
      RESEND_API_KEY: 're_test_fixture',
      MAIL_FROM: 'Test <test@example.test>',
    },
    fetchMock: external,
  });
  try {
    const d = await task.getD1Database('DB');
    await migrate(d);
    await d
      .prepare(
        "INSERT INTO outbox(id,dedupe,recipient,subject,body) VALUES('mail-fixture','mail-fixture','recipient@example.test','Test fixture','Only mocked HTTP')",
      )
      .run();
    external
      .get('https://api.resend.com')
      .intercept({ path: '/emails', method: 'POST' })
      .reply(429, { error: 'rate limit' });
    assert.equal((await task.dispatchFetch('http://task/mail')).status, 200);
    let row = await d.prepare("SELECT * FROM outbox WHERE id='mail-fixture'").first();
    assert.equal(row.status, 'retry');
    assert.equal(row.attempts, 1);
    await d.prepare("UPDATE outbox SET available_at=0 WHERE id='mail-fixture'").run();
    external
      .get('https://api.resend.com')
      .intercept({
        path: '/emails',
        method: 'POST',
        headers: { 'idempotency-key': 'mail-fixture' },
      })
      .reply(200, { id: 'email_fixture' });
    await task.dispatchFetch('http://task/mail');
    row = await d.prepare("SELECT * FROM outbox WHERE id='mail-fixture'").first();
    assert.equal(row.status, 'accepted');
    assert.equal(row.provider_id, 'email_fixture');
    assert.notEqual(row.status, 'delivered');
  } finally {
    await task.dispose();
    await external.close();
  }
});
test('Refund queue calls the provider with an idempotency key and reconciles a successful response', async () => {
  const external = createFetchMock();
  external.disableNetConnect();
  const task = new Miniflare({
    modules: [{ type: 'ESModule', path: resolve('work/tasks/index.js') }],
    compatibilityDate: '2026-07-30',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'],
    bindings: {
      APP_ENV: 'test',
      APP_URL: 'https://test.example',
      STRIPE_SECRET_KEY: 'sk_test_fixture',
      PAYMENTS_MODE: 'test',
    },
    fetchMock: external,
  });
  try {
    const d = await task.getD1Database('DB');
    await migrate(d);
    await d
      .prepare(
        "INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES('user_fixture','Test','test@example.test',1,0,0)",
      )
      .run();
    await d
      .prepare(
        "INSERT INTO orders(id,user_id,request_key,amount,status,expires_at,payment_intent) VALUES('order_fixture','user_fixture','key_fixture',1500,'refunding',0,'pi_fixture')",
      )
      .run();
    await d
      .prepare(
        "INSERT INTO refund_jobs(id,order_id,amount,reason) VALUES('job_fixture','order_fixture',1500,'Test fixture')",
      )
      .run();
    external
      .get('https://api.stripe.com')
      .intercept({
        path: '/v1/refunds',
        method: 'POST',
        headers: { 'idempotency-key': 'refund:job_fixture' },
      })
      .reply(200, {
        id: 're_task_fixture',
        amount: 1500,
        payment_intent: 'pi_fixture',
        status: 'succeeded',
        metadata: { job_id: 'job_fixture' },
      });
    assert.equal((await task.dispatchFetch('http://task/refunds')).status, 200);
    const row = await d
      .prepare("SELECT status,refunded FROM orders WHERE id='order_fixture'")
      .first();
    assert.equal(row.status, 'refunded');
    assert.equal(row.refunded, 1500);
    await task.dispatchFetch('http://task/refunds');
    assert.equal((await d.prepare('SELECT COUNT(*) n FROM refund_jobs').first()).n, 1);
  } finally {
    await task.dispose();
    await external.close();
  }
});
test('Server rejects a price changed after the participant reviewed the amount', async () => {
  const u = await login();
  assert.equal(
    (await request('/orders', order(undefined, { expectedAmount: 1 }), u.cookie)).status,
    409,
  );
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM orders').first()).n, 0);
});
test('Webhook recovers a session whose provider ID failed to persist at checkout creation', async () => {
  const u = await login();
  const o = await create(u.cookie);
  const ss = 'cs_recovered_' + randomUUID();
  mockSession(sessionFixture(o.id, ss));
  const r = await signedEvent({
    id: 'evt_recover_session',
    type: 'checkout.session.completed',
    data: { object: { id: ss } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const row = await db
    .prepare('SELECT status,stripe_session FROM orders WHERE id=?')
    .bind(o.id)
    .first();
  assert.equal(row.status, 'confirmed');
  assert.equal(row.stripe_session, ss);
});
test('Payment already fully refunded before its first webhook never issues a confirmed ticket', async () => {
  const u = await login();
  const o = await create(u.cookie);
  const ss = await checkoutFixture(u.cookie, o.id);
  const session = sessionFixture(o.id, ss);
  session.payment_intent.latest_charge = {
    id: 'ch_already_refunded',
    refunded: true,
    amount_refunded: 1500,
  };
  mockSession(session);
  mock
    .get('https://api.stripe.com')
    .intercept({ path: /^\/v1\/refunds\?/, method: 'GET' })
    .reply(200, {
      object: 'list',
      data: [
        {
          id: 're_before_payment',
          amount: 1500,
          payment_intent: 'pi_' + o.id,
          status: 'succeeded',
          metadata: {},
        },
      ],
      has_more: false,
    });
  const r = await signedEvent({
    id: 'evt_refunded_first',
    type: 'checkout.session.completed',
    data: { object: { id: ss } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await db.prepare('SELECT status FROM orders').first()).status, 'refunded');
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM history WHERE status='confirmed'").first()).n,
    0,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM outbox WHERE dedupe LIKE 'confirmed:%'").first()).n,
    0,
  );
});

test('Account creation requires password and verifies email on the same page before creating a session', async () => {
  const start = await request('/auth/request/create', {
    email: 'new@example.test',
    firstName: 'Alex',
    lastName: 'Test',
    password: fixturePassword,
    rememberMe: true,
    returnTo: '/inscription?activite=course-10',
  });
  assert.equal(start.status, 200, JSON.stringify(start.data));
  const row = await db.prepare("SELECT * FROM user WHERE email='new@example.test'").first();
  assert.equal(row.emailVerified, 0);
  assert.equal(row.firstName, 'Alex');
  assert.equal(row.lastName, 'Test');
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM session').first()).n, 0);
  const mail = await db
    .prepare("SELECT body FROM outbox WHERE recipient='new@example.test'")
    .first();
  assert.ok(!mail.body.includes('http'));
  const verified = await request('/auth/verify-code', {
    challengeId: start.data.challengeId,
    code: mail.body.match(/code de vérification : (\d{6})/)[1],
    password: fixturePassword,
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  assert.equal(verified.data.returnTo, '/inscription?activite=course-10');
  assert.equal(
    (await db.prepare('SELECT emailVerified FROM user WHERE id=?').bind(row.id).first())
      .emailVerified,
    1,
  );
});
test('Existing-account sign-in preserves the name and returns to the selected waitlist', async () => {
  await login('existing@example.test');
  const r = await request('/auth/request/sign-in', {
    email: 'existing@example.test',
    password: fixturePassword,
    returnTo: '/attente?activite=marche-5',
  });
  assert.equal(r.status, 200);
  const mail = await db
    .prepare(
      "SELECT body FROM outbox WHERE recipient='existing@example.test' ORDER BY rowid DESC LIMIT 1",
    )
    .first();
  const verified = await request('/auth/verify-code', {
    challengeId: r.data.challengeId,
    code: mail.body.match(/code de vérification : (\d{6})/)[1],
    password: fixturePassword,
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  assert.equal(verified.data.returnTo, '/attente?activite=marche-5');
  assert.equal(
    (await db.prepare("SELECT name FROM user WHERE email='existing@example.test'").first()).name,
    'Camille Test',
  );
});
test('Unknown sign-in refuses credentials without creating an account or sending mail', async () => {
  const r = await request('/auth/request/sign-in', {
    email: 'unknown@example.test',
    password: fixturePassword,
  });
  assert.equal(r.status, 401);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM user').first()).n, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM outbox').first()).n, 0);
});
test('Account flows reject unsafe return destinations and close all direct auth bypasses', async () => {
  for (const returnTo of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/api/account/export',
  ]) {
    const r = await request('/auth/request/create', {
      email: 'return@example.test',
      firstName: 'Alex',
      lastName: 'Test',
      password: fixturePassword,
      returnTo,
    });
    assert.equal(r.status, 400, returnTo);
  }
  for (const path of [
    '/auth/sign-in/email',
    '/auth/sign-up/email',
    '/auth/sign-in/magic-link',
    '/auth/verify-email',
    '/auth/reset-password',
    '/auth/sign-in/email-otp',
  ])
    assert.equal(
      (await request(path, { email: 'return@example.test', password: fixturePassword })).status,
      404,
      path,
    );
});
async function latestCode(address) {
  const row = await db
    .prepare(
      "SELECT body FROM outbox WHERE recipient=? AND kind='login' ORDER BY rowid DESC LIMIT 1",
    )
    .bind(address)
    .first();
  return row.body.match(/code de vérification : (\d{6})/)[1];
}
test('Missing or short passwords never create an account', async () => {
  for (const password of [undefined, 'short']) {
    assert.equal(
      (
        await request('/auth/request/create', {
          email: 'weak@example.test',
          firstName: 'Alex',
          lastName: 'Test',
          ...(password ? { password } : {}),
        })
      ).status,
      400,
    );
  }
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM user').first()).n, 0);
});
test('Five wrong codes lock the challenge, including after a resend attempt', async () => {
  const r = await request('/auth/request/create', {
    email: 'lock@example.test',
    firstName: 'Alex',
    lastName: 'Test',
    password: fixturePassword,
  });
  assert.equal(r.status, 200);
  const code = await latestCode('lock@example.test'),
    wrong = code === '000000' ? '000001' : '000000';
  const stored = await db
    .prepare('SELECT * FROM auth_challenges WHERE id=?')
    .bind(r.data.challengeId)
    .first();
  assert.notEqual(stored.code_hash, code);
  assert.ok(stored.expires_at - stored.created_at <= 600);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await request('/auth/verify-code', {
          challengeId: r.data.challengeId,
          code: wrong,
          password: fixturePassword,
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await request('/auth/verify-code', {
        challengeId: r.data.challengeId,
        code,
        password: fixturePassword,
      })
    ).status,
    400,
  );
  await request('/auth/resend-code', { challengeId: r.data.challengeId });
  assert.equal(
    (
      await request('/auth/verify-code', {
        challengeId: r.data.challengeId,
        code,
        password: fixturePassword,
      })
    ).status,
    400,
  );
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM session').first()).n, 0);
});
test('Expired codes cannot activate an account', async () => {
  const r = await request('/auth/request/create', {
    email: 'expiry@example.test',
    firstName: 'Alex',
    lastName: 'Test',
    password: fixturePassword,
  });
  const code = await latestCode('expiry@example.test');
  await db
    .prepare('UPDATE auth_challenges SET expires_at=unixepoch()-1 WHERE id=?')
    .bind(r.data.challengeId)
    .run();
  assert.equal(
    (
      await request('/auth/verify-code', {
        challengeId: r.data.challengeId,
        code,
        password: fixturePassword,
      })
    ).status,
    400,
  );
  assert.equal(
    (await db.prepare("SELECT emailVerified FROM user WHERE email='expiry@example.test'").first())
      .emailVerified,
    0,
  );
});
test('Resending a code has a server cooldown and invalidates the preceding code', async () => {
  const r = await request('/auth/request/create', {
    email: 'resend@example.test',
    firstName: 'Alex',
    lastName: 'Test',
    password: fixturePassword,
    rememberMe: true,
  });
  const first = await latestCode('resend@example.test');
  assert.equal(
    (await request('/auth/resend-code', { challengeId: r.data.challengeId })).status,
    429,
  );
  await db
    .prepare('UPDATE auth_challenges SET sent_at=unixepoch()-61 WHERE id=?')
    .bind(r.data.challengeId)
    .run();
  await db
    .prepare('UPDATE rate_limits SET reset_at=unixepoch()-1 WHERE key=?')
    .bind(
      createHash('sha256')
        .update('auth-cooldown:' + r.data.challengeId)
        .digest('hex'),
    )
    .run();
  assert.equal(
    (await request('/auth/resend-code', { challengeId: r.data.challengeId })).status,
    200,
  );
  const second = await latestCode('resend@example.test');
  // Extremely rarely the random replacement is identical; its old digest is still replaced atomically.
  if (first !== second)
    assert.equal(
      (
        await request('/auth/verify-code', {
          challengeId: r.data.challengeId,
          code: first,
          password: fixturePassword,
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await request('/auth/verify-code', {
        challengeId: r.data.challengeId,
        code: second,
        password: fixturePassword,
      })
    ).status,
    200,
  );
});
test('Temporary sign-in is bound to its tab; remembered sign-in survives without a tab key', async () => {
  const persistent = await login('sessions@example.test');
  assert.ok(persistent.cookie);
  assert.ok((await request('/me', null, persistent.cookie)).data.user);
  const r = await request('/auth/request/sign-in', {
    email: 'sessions@example.test',
    password: fixturePassword,
    rememberMe: false,
  });
  const result = await request('/auth/verify-code', {
    challengeId: r.data.challengeId,
    code: await latestCode('sessions@example.test'),
    password: fixturePassword,
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.match(result.data.tabKey, /^[a-f0-9]{64}$/);
  const cookies = result.res.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.includes('session_token=') && !/max-age|expires=/i.test(c)));
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
  assert.equal((await request('/me', null, cookie)).data.user, null);
  assert.equal((await request('/registrations', null, cookie)).status, 401);
  assert.ok(
    (await request('/me', null, cookie, 'GET', { 'X-RFB-Session': result.data.tabKey })).data.user,
  );
  assert.equal(
    (await request('/me', null, cookie, 'GET', { 'X-RFB-Session': 'wrong-tab' })).data.user,
    null,
  );
  assert.equal(
    (await request('/account/export', null, cookie, 'GET', { 'X-RFB-Session': result.data.tabKey }))
      .status,
    200,
  );
  assert.equal((await request('/auth/sign-out', {}, cookie)).status, 200);
  assert.equal(
    (await request('/me', null, cookie, 'GET', { 'X-RFB-Session': result.data.tabKey })).data.user,
    null,
  );
});
test('Old passwordless accounts set a password by code without replacing identity, roles or purchases', async () => {
  const u = await login('legacy@example.test', 'admin');
  const o = await create(u.cookie);
  await db
    .prepare("DELETE FROM account WHERE userId=? AND providerId='credential'")
    .bind(u.id)
    .run();
  const start = await request('/auth/request/password', {
    email: 'legacy@example.test',
    rememberMe: true,
  });
  assert.equal(start.status, 200);
  const finished = await request('/auth/verify-code', {
    challengeId: start.data.challengeId,
    code: await latestCode('legacy@example.test'),
    newPassword: 'New-password-2027!',
  });
  assert.equal(finished.status, 200, JSON.stringify(finished.data));
  assert.equal(
    (await db.prepare('SELECT user_id FROM orders WHERE id=?').bind(o.id).first()).user_id,
    u.id,
  );
  assert.equal(
    (await db.prepare('SELECT role FROM staff WHERE user_id=?').bind(u.id).first()).role,
    'admin',
  );
  assert.equal(
    (await db.prepare('SELECT name FROM user WHERE id=?').bind(u.id).first()).name,
    'Camille Test',
  );
  assert.equal(
    (await request('/me', null, u.cookie)).data.user,
    null,
    'Old sessions revoked by password setup',
  );
  const cookies = finished.res.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.includes('session_token=') && /max-age=/i.test(c)));
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
  assert.equal((await request('/me', null, cookie)).data.user.id, u.id);
  const credentials = await request('/auth/request/sign-in', {
    email: 'legacy@example.test',
    password: 'New-password-2027!',
  });
  assert.equal(credentials.status, 200);
  assert.equal(
    (
      await request('/auth/request/sign-in', {
        email: 'legacy@example.test',
        password: fixturePassword,
      })
    ).status,
    401,
  );
});
test('Password recovery is neutral for unknown addresses and sends no email to them', async () => {
  const r = await request('/auth/request/password', { email: 'unknown@example.test' });
  assert.equal(r.status, 200);
  assert.ok(r.data.challengeId);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM user').first()).n, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM outbox').first()).n, 0);
});
test('Authentication codes are hidden from the admin mail journal and participant messages', async () => {
  const admin = await login('codes-admin@example.test', 'admin');
  const start = await request('/auth/request/password', { email: 'codes-admin@example.test' });
  assert.equal(start.status, 200);
  const code = await latestCode('codes-admin@example.test');
  const journal = await request('/admin/mail', null, admin.cookie);
  assert.equal(journal.status, 200);
  assert.ok(journal.data.every((row) => row.kind !== 'login'));
  assert.ok(!JSON.stringify(journal.data).includes(code));
  const messages = (await request('/registrations', null, admin.cookie)).data.messages;
  assert.ok(!JSON.stringify(messages).includes(code));
});
test('A code cannot bypass a wrong password and two concurrent verifications create only one session', async () => {
  const start = await request('/auth/request/create', {
    email: 'race@example.test',
    firstName: 'Alex',
    lastName: 'Test',
    password: fixturePassword,
    rememberMe: true,
  });
  const code = await latestCode('race@example.test'),
    body = { challengeId: start.data.challengeId, code, password: fixturePassword };
  assert.equal(
    (await request('/auth/verify-code', { ...body, password: 'wrong-password' })).status,
    400,
  );
  const results = await Promise.all([
    request('/auth/verify-code', body),
    request('/auth/verify-code', body),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM session').first()).n, 1);
});
test('A pre-account registration draft is encrypted, HttpOnly, private and claimed once after sign-in', async () => {
  const p = {
    ...participant('course-10'),
    firstName: 'Private Guest',
    emergencyName: 'Private Emergency',
  };
  const r = await request('/draft/guest', { participants: [p], promo: '' });
  assert.equal(r.status, 200);
  assert.match(r.res.headers.get('set-cookie'), /HttpOnly/i);
  const guestCookie = r.res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const saved = await db.prepare('SELECT * FROM guest_drafts').first();
  assert.ok(!saved.ciphertext.includes('Private Guest'));
  assert.ok(!saved.ciphertext.includes('Private Emergency'));
  assert.ok(!saved.ciphertext.includes(p.emergencyPhone));
  assert.equal((await request('/draft', null, guestCookie)).status, 401);
  const u = await login();
  const restored = await request('/draft', null, u.cookie + '; ' + guestCookie);
  assert.equal(restored.data.participants[0].activityId, 'course-10');
  assert.equal(restored.data.participants[0].firstName, 'Private Guest');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM guest_drafts').first()).n, 0);
});

test('Funnel analytics stores aggregate counts and refuses PII and fake payment confirmations', async () => {
  assert.equal(
    (await request('/analytics', { event: 'activity_view', activityId: 'course-10' })).status,
    200,
  );
  assert.equal(
    (await request('/analytics', { event: 'activity_view', activityId: 'course-10' })).status,
    200,
  );
  assert.equal(
    (await request('/analytics', { event: 'visit', email: 'private@example.test' })).status,
    400,
  );
  assert.equal((await request('/analytics', { event: 'payment_confirmed' })).status, 400);
  const rows = await db.prepare('SELECT * FROM funnel_daily').all();
  assert.equal(rows.results.length, 1);
  assert.equal(rows.results[0].count, 2);
  assert.deepEqual(Object.keys(rows.results[0]).sort(), ['activity_id', 'count', 'day', 'event']);
});

async function paidGroup(cookie) {
  const o = await create(
    cookie,
    order([participant(), participant('course-10'), participant('marche-5')]),
  );
  const ss = await checkoutFixture(cookie, o.id);
  mockSession(sessionFixture(o.id, ss, 4500));
  assert.equal(
    (
      await signedEvent({
        id: 'evt_group_' + randomUUID(),
        type: 'checkout.session.completed',
        data: { object: { id: ss } },
      })
    ).status,
    200,
  );
  return o;
}
test('Cancelling one of three paid participations refunds exactly its price and preserves other tickets', async () => {
  const u = await login(),
    o = await paidGroup(u.cookie);
  const rows = (
    await db.prepare('SELECT * FROM registrations WHERE order_id=? ORDER BY id').bind(o.id).all()
  ).results;
  mock
    .get('https://api.stripe.com')
    .intercept({ path: '/v1/refunds', method: 'POST' })
    .reply(200, (opts) => {
      const b = new URLSearchParams(String(opts.body));
      return {
        id: 're_individual',
        amount: Number(b.get('amount')),
        payment_intent: 'pi_' + o.id,
        status: 'pending',
        metadata: { job_id: b.get('metadata[job_id]') },
      };
    });
  const r = await request('/registrations/' + rows[0].id + '/cancel', { confirm: true }, u.cookie);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.refundRequested, 1500);
  const job = await db
    .prepare('SELECT * FROM refund_jobs WHERE registration_id=?')
    .bind(rows[0].id)
    .first();
  assert.equal(job.amount, 1500);
  assert.equal(
    (await request('/registrations/' + rows[1].id + '/ticket', null, u.cookie)).status,
    200,
  );
  const refund = {
    id: 're_individual',
    amount: 1500,
    payment_intent: 'pi_' + o.id,
    status: 'succeeded',
    metadata: { job_id: job.id },
  };
  mock
    .get('https://api.stripe.com')
    .intercept({ path: '/v1/refunds/re_individual', method: 'GET' })
    .reply(200, refund);
  assert.equal(
    (
      await signedEvent({
        id: 'evt_individual_refund',
        type: 'refund.updated',
        data: { object: { id: refund.id } },
      })
    ).status,
    200,
  );
  const status = (
    await db
      .prepare('SELECT id,status,refunded_amount FROM registrations WHERE order_id=? ORDER BY id')
      .bind(o.id)
      .all()
  ).results;
  assert.equal(status[0].status, 'refunded');
  assert.equal(status[0].refunded_amount, 1500);
  assert.ok(status.slice(1).every((r) => r.status === 'confirmed'));
  assert.equal(
    (await request('/registrations/' + rows[0].id + '/ticket', null, u.cookie)).status,
    404,
  );
  assert.equal(
    (await request('/registrations/' + rows[2].id + '/ticket', null, u.cookie)).status,
    200,
  );
  assert.equal(
    (await request('/registrations/' + rows[0].id + '/cancel', { confirm: true }, u.cookie)).data
      .refundRequested,
    0,
  );
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM refund_jobs').first()).n, 1);
});
test('Individual cancellation under 15 days leaves the rest of a group valid and refunds zero', async () => {
  const u = await login(),
    s = JSON.parse(initialSettings);
  s.eventAt = new Date(Date.now() + 14 * 86400000).toISOString();
  await db.prepare('UPDATE settings SET data=?').bind(JSON.stringify(s)).run();
  await db.prepare('UPDATE activities SET price=0').run();
  const o = await create(u.cookie, order([participant(), participant('course-10')]));
  const rows = (await db.prepare('SELECT id FROM registrations WHERE order_id=?').bind(o.id).all())
    .results;
  const r = await request('/registrations/' + rows[0].id + '/cancel', { confirm: true }, u.cookie);
  assert.equal(r.status, 200);
  assert.equal(r.data.refundRequested, 0);
  assert.equal(
    (await request('/registrations/' + rows[1].id + '/ticket', null, u.cookie)).status,
    200,
  );
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM refund_jobs').first()).n, 0);
});
test('Individual cancellation and offline preparation enforce ownership and staff permissions', async () => {
  const u = await login(),
    other = await login('other@example.test');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie);
  const r = await db.prepare('SELECT id FROM registrations').first();
  assert.equal(
    (await request('/registrations/' + r.id + '/cancel', { confirm: true }, other.cookie)).status,
    404,
  );
  assert.equal((await request('/admin/offline/snapshot', { confirm: true }, u.cookie)).status, 403);
  assert.equal((await request('/admin/analytics', null, u.cookie)).status, 403);
});
test('Offline snapshots contain hashes only; sync is idempotent and distinguishes duplicate or cancelled tickets', async () => {
  const u = await login(),
    staff = await login('door@example.test', 'checkin');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(u.cookie, order([participant(), participant('course-10')]));
  const rows = (await db.prepare('SELECT id,ticket FROM registrations ORDER BY id').all()).results;
  const snap = await request('/admin/offline/snapshot', { confirm: true }, staff.cookie);
  assert.equal(snap.status, 200, JSON.stringify(snap.data));
  assert.equal(snap.data.tickets.length, 2);
  assert.ok(
    snap.data.tickets.every(
      (r) => r.hash.length === 64 && !r.ticket && !r.email && !r.emergency_name,
    ),
  );
  const event = {
      id: randomUUID(),
      registrationId: rows[0].id,
      scannedAt: Math.floor(Date.now() / 1000),
    },
    body = { snapshotId: snap.data.id, events: [event] };
  assert.equal(
    (await request('/admin/offline/sync', body, staff.cookie)).data.results[0].result,
    'accepted',
  );
  assert.equal(
    (await request('/admin/offline/sync', body, staff.cookie)).data.results[0].result,
    'accepted',
  );
  assert.equal(
    (
      await request(
        '/admin/offline/sync',
        { ...body, events: [{ ...event, id: randomUUID() }] },
        staff.cookie,
      )
    ).data.results[0].result,
    'already_used',
  );
  await request('/registrations/' + rows[1].id + '/cancel', { confirm: true }, u.cookie);
  assert.equal(
    (
      await request(
        '/admin/offline/sync',
        { ...body, events: [{ ...event, id: randomUUID(), registrationId: rows[1].id }] },
        staff.cookie,
      )
    ).data.results[0].result,
    'invalid',
  );
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM offline_checkins').first()).n, 3);
  await request('/admin/offline/revoke', { id: snap.data.id }, staff.cookie);
  assert.equal((await request('/admin/offline/sync', body, staff.cookie)).status, 409);
});
test('Transfer API stays closed until a deadline is explicitly configured', async () => {
  const u = await login();
  assert.equal(
    (
      await request(
        '/registrations/' + randomUUID() + '/transfer',
        { recipient: 'new@example.test' },
        u.cookie,
      )
    ).status,
    409,
  );
});
test('Transfer acceptance requires verified recipient and personal consents, then invalidates the old QR', async () => {
  const buyer = await login(),
    recipient = await login('recipient@example.test');
  await db.prepare('UPDATE activities SET price=0').run();
  await create(buyer.cookie);
  const reg = await db.prepare('SELECT id,ticket FROM registrations').first(),
    s = JSON.parse(initialSettings);
  s.editorial = { transfersEnabled: true, transferDeadline: Math.floor(Date.now() / 1000) + 86400 };
  await db.prepare('UPDATE settings SET data=?').bind(JSON.stringify(s)).run();
  const invitation = await request(
    '/registrations/' + reg.id + '/transfer',
    { recipient: 'recipient@example.test' },
    buyer.cookie,
  );
  assert.equal(invitation.status, 201, JSON.stringify(invitation.data));
  const token = new URL(invitation.data.url).searchParams.get('invitation');
  assert.equal((await request('/transfers/' + token, null, buyer.cookie)).status, 404);
  const body = {
    termsVersion,
    participant: participant('course-5', {
      email: 'recipient@example.test',
      firstName: 'Alex',
      lastName: 'Recipient',
    }),
  };
  assert.equal(
    (
      await request(
        '/transfers/' + token + '/accept',
        { ...body, participant: { ...body.participant, conditions: false } },
        recipient.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (await request('/transfers/' + token + '/accept', body, recipient.cookie)).status,
    200,
  );
  const changed = await db
    .prepare('SELECT ticket,transferred_user_id FROM registrations WHERE id=?')
    .bind(reg.id)
    .first();
  assert.notEqual(changed.ticket, reg.ticket);
  assert.equal(changed.transferred_user_id, recipient.id);
  assert.equal(
    (await request('/registrations/' + reg.id + '/ticket', null, buyer.cookie)).status,
    404,
  );
  assert.equal(
    (await request('/registrations/' + reg.id + '/ticket', null, recipient.cookie)).status,
    200,
  );
  assert.equal(
    (await request('/transfers/' + token + '/accept', body, recipient.cookie)).status,
    409,
  );
});
test('CRM details remain private and enforce kind-specific stages', async () => {
  const admin = await login('admin@example.test', 'admin');
  const r = await request('/submissions', {
    kind: 'sponsor',
    name: 'Example',
    email: 'sponsor@example.test',
    message: 'Fixture partenaire',
    consent: true,
  });
  assert.equal(
    (
      await request(
        '/admin/submissions/' + r.data.id,
        {
          stage: 'interested',
          details: {
            company: 'Fixture privée',
            amount: 500,
            paymentReceived: false,
            notes: 'private-note',
          },
        },
        admin.cookie,
        'PATCH',
      )
    ).status,
    200,
  );
  assert.equal(
    (await request('/admin/submissions/' + r.data.id, { stage: 'present' }, admin.cookie, 'PATCH'))
      .status,
    400,
  );
  assert.ok(!JSON.stringify((await request('/public')).data).includes('private-note'));
  const stats = await request('/admin/analytics', null, admin.cookie);
  assert.equal(stats.status, 200, JSON.stringify(stats.data));
  assert.ok(Array.isArray(stats.data.daily));
  assert.equal((await request('/admin/health', null, admin.cookie)).status, 200);
});
test('Server social metadata, sitemap and calendars use D1 facts and keep participant pages noindex', async () => {
  const page = await mf.dispatchFetch(origin + '/activites/course-10');
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /og:image/);
  assert.match(html, /15/);
  assert.match(html, /Course/);
  assert.ok(!html.includes('"location":'));
  assert.ok(html.includes('application/ld+json'));
  const privatePage = await mf.dispatchFetch(origin + '/espace');
  assert.equal(privatePage.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  const sitemap = await (await mf.dispatchFetch(origin + '/sitemap.xml')).text();
  assert.ok(sitemap.includes('/velo'));
  assert.ok(sitemap.includes('/activites/course-10'));
  assert.ok(!sitemap.includes('/admin'));
  const ics = await (await mf.dispatchFetch(origin + '/calendrier.ics')).text();
  assert.match(ics, /DTSTART:20270821T113000Z/);
  assert.ok(!ics.includes('LOCATION:'));
});

test('Media upload stays protected and reports an absent storage binding explicitly', async () => {
  const user = await login(),
    admin = await login('media@example.test', 'admin');
  assert.equal((await request('/admin/media', { data: 'ZmFrZQ==' }, user.cookie)).status, 403);
  assert.equal((await request('/admin/media', { data: 'ZmFrZQ==' }, admin.cookie)).status, 503);
});
test('HTML metadata escapes editorial markup and private routes expose no invitation or query token', async () => {
  const s = JSON.parse(initialSettings);
  s.title = 'Unsafe </title><script>alert(1)</script>';
  await db.prepare('UPDATE settings SET data=?').bind(JSON.stringify(s)).run();
  const page = await mf.dispatchFetch(origin + '/');
  const html = await page.text();
  assert.ok(!html.includes('<script>alert(1)'));
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const privatePage = await mf.dispatchFetch(origin + '/transfert?invitation=private-token');
  assert.equal(privatePage.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.ok(!(await privatePage.text()).includes('private-token'));
});
