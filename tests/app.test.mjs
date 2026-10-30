import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, createFetchMock } from 'miniflare';
import { resolve } from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
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
    serviceBindings: { ASSETS: () => new Response('test assets') },
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
async function login(mail = 'payer@example.test', role = null, permissions = []) {
  const start = await request('/auth/sign-in/magic-link', {
    email: mail,
    name: 'Camille Test',
    callbackURL: '/espace',
  });
  assert.equal(start.status, 200, JSON.stringify(start.data));
  const row = await db
    .prepare(
      "SELECT body FROM outbox WHERE recipient=? AND subject LIKE 'Votre lien%' ORDER BY rowid DESC LIMIT 1",
    )
    .bind(mail)
    .first();
  const url = row.body.match(/http:\/\/[^\s]+/)[0];
  const verified = await mf.dispatchFetch(url, { redirect: 'manual' });
  assert.equal(verified.status, 302, await verified.clone().text());
  const cookies = verified.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const who = await request('/me', null, cookies);
  assert.equal(who.status, 200);
  assert.ok(who.data.user, 'No authenticated session');
  if (role)
    await db
      .prepare('INSERT INTO staff(user_id,role,permissions) VALUES(?,?,?)')
      .bind(who.data.user.id, role, JSON.stringify(permissions))
      .run();
  return { cookie: cookies, id: who.data.user.id, url };
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
test('Magic link authentication creates a verified account and cannot be reused', async () => {
  const u = await login();
  const row = await db.prepare('SELECT emailVerified FROM user WHERE id=?').bind(u.id).first();
  assert.equal(row.emailVerified, 1);
  const replay = await mf.dispatchFetch(u.url, { redirect: 'manual' });
  assert.equal(replay.status, 302);
  assert.match(replay.headers.get('location'), /error=/);
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
      const r = await visitor.dispatchFetch('https://example.test/api/auth/sign-in/magic-link', {
        method: 'POST',
        headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.test' }),
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
    const started = await visitor.dispatchFetch(site + '/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { Origin: site, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new-account@example.test',
        name: 'Camille Test',
        callbackURL: '/espace',
        turnstileToken: 'single-use-fixture',
      }),
    });
    assert.equal(started.status, 200, await started.clone().text());
    const mail = await productionDb.prepare('SELECT body,status FROM outbox').first();
    assert.equal(mail.status, 'accepted');
    const link = mail.body.match(/https:\/\/[^\s]+/)[0];
    const verified = await visitor.dispatchFetch(link, { redirect: 'manual' });
    assert.equal(verified.status, 302);
    assert.equal(verified.headers.get('location'), site + '/espace');
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
