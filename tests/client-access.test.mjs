import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { clientModules } from './client-modules.mjs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const modules = clientModules();
const { api, downloadPrivate, AdminAccessRequired } = await import(modules.api);
const { Link, Notice, go } = await import(modules.ui);
const { ADMIN_ACCESS_MESSAGE, ADMIN_ACCESS_URL, requiresDocumentNavigation } = await import(
  modules.access
);
const originals = new Map(
  [
    'fetch',
    'sessionStorage',
    'location',
    'history',
    'window',
    'dispatchEvent',
    'PopStateEvent',
  ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
);
const set = (key, value) =>
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
afterEach(() => {
  for (const [key, value] of originals) {
    if (value) Object.defineProperty(globalThis, key, value);
    else delete globalThis[key];
  }
});
const opaque = () => ({
  type: 'opaqueredirect',
  status: 0,
  text() {
    throw Error('Redirect body must not be read');
  },
});

test('Access redirects stop before the CORS login hop and preserve same-origin session credentials', async () => {
  const calls = [];
  set('sessionStorage', { getItem: () => 'tab-key-fixture' });
  set('fetch', async (url, options) => {
    calls.push({ url, options });
    return opaque();
  });
  await assert.rejects(
    api('/admin/overview'),
    (e) => e instanceof AdminAccessRequired && e.message === ADMIN_ACCESS_MESSAGE,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/admin/overview');
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.headers['X-RFB-Session'], 'tab-key-fixture');
});
test('An interrupted administrative POST is never replayed automatically', async () => {
  const calls = [];
  set('fetch', async (url, options) => {
    calls.push({ url, options });
    return opaque();
  });
  await assert.rejects(
    api('/admin/refunds', { orderId: 'fixture', amount: 1125 }),
    AdminAccessRequired,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(JSON.parse(calls[0].options.body).amount, 1125);
});
test('CSV downloads use the same Access redirect guard', async () => {
  let calls = 0;
  set('fetch', async () => {
    calls++;
    return opaque();
  });
  await assert.rejects(downloadPrivate('/admin/export', 'fixture.csv'), AdminAccessRequired);
  assert.equal(calls, 1);
});
test('A denied staff permission stays denied and is not presented as an Access sign-in', async () => {
  set('fetch', async () => Response.json({ error: 'Permission insuffisante.' }, { status: 403 }));
  await assert.rejects(
    api('/admin/staff'),
    (e) => !(e instanceof AdminAccessRequired) && e.message === 'Permission insuffisante.',
  );
});
test('Expired server-side Access identity gives a recoverable verification message', async () => {
  for (const message of [
    ADMIN_ACCESS_MESSAGE,
    'Connectez-vous via l’accès renforcé de l’organisation.',
  ]) {
    set('fetch', async () => Response.json({ error: message }, { status: 403 }));
    await assert.rejects(api('/admin/overview'), AdminAccessRequired);
  }
  const html = renderToStaticMarkup(
    React.createElement(Notice, { error: true }, ADMIN_ACCESS_MESSAGE),
  );
  assert.ok(html.includes('role="alert"'));
  assert.ok(html.includes('href="' + ADMIN_ACCESS_URL + '"'));
  assert.ok(html.includes('Vérifier mon accès administrateur'));
});
test('Network failures have a French message and successful admin data stays intact', async () => {
  set('fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(api('/admin/overview'), /Impossible de joindre le serveur/);
  set('fetch', async () => Response.json({ stats: [{ count: 3 }], money: { received: 3375 } }));
  assert.deepEqual(await api('/admin/overview'), {
    stats: [{ count: 3 }],
    money: { received: 3375 },
  });
});
test('Administration links and post-login navigation load a document so Access can run', () => {
  const assigned = [],
    pushed = [];
  set('location', { assign: (path) => assigned.push(path) });
  set('history', { pushState: (_state, _title, path) => pushed.push(path) });
  set('window', { scrollTo() {} });
  set('dispatchEvent', () => {});
  set('PopStateEvent', class {});
  go('/admin');
  assert.deepEqual(assigned, ['/admin']);
  assert.equal(pushed.length, 0);
  go('/espace');
  assert.deepEqual(pushed, ['/espace']);
  for (const to of ['/admin', '/admin?tab=participants', '/admin/checkin']) {
    let prevented = false;
    Link({ to, children: 'Administration' }).props.onClick({
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      button: 0,
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, false, to);
  }
  for (const path of ['/', '/administrator', '/api/admin/overview'])
    assert.equal(requiresDocumentNavigation(path), false, path);
});

test('Team tools use the permission portal for JSON and protected downloads without entering Cloudflare', async () => {
  set('location', { pathname: '/organisation' });
  const calls = [];
  set('fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json({ rows: [] });
  });
  assert.deepEqual(await api('/admin/participants?page=1'), { rows: [] });
  assert.equal(calls[0].url, '/api/organisation/participants?page=1');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.redirect, 'manual');
  const { STAFF_REAUTH_MESSAGE } = await import(modules.access);
  set('fetch', async () => Response.json({ error: STAFF_REAUTH_MESSAGE }, { status: 401 }));
  await assert.rejects(api('/admin/overview'), (e) => e.message === STAFF_REAUTH_MESSAGE);
  await assert.rejects(
    downloadPrivate('/admin/export', 'fixture.csv'),
    (e) => e.message === STAFF_REAUTH_MESSAGE,
  );
  const html = renderToStaticMarkup(
    React.createElement(Notice, { error: true }, STAFF_REAUTH_MESSAGE),
  );
  assert.match(html, /reauth=1/);
  assert.match(html, /Vérifier mon accès équipe/);
});
