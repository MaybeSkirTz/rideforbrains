import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { Miniflare, createFetchMock } from 'miniflare';
import { migrate } from '../scripts/migrate.mjs';

test('MEDIA binding stores optimized WebP privately and exposes only the image route', async () => {
  const network = createFetchMock();
  network.disableNetConnect();
  const origin = 'http://localhost:8787';
  const mf = new Miniflare({
    modules: [{ type: 'ESModule', path: resolve('work/server/index.js') }],
    compatibilityDate: '2026-07-30',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'],
    r2Buckets: ['MEDIA'],
    fetchMock: network,
    bindings: {
      APP_ENV: 'development',
      APP_URL: origin,
      BETTER_AUTH_SECRET: 'media-tests-isolated-secret-more-than-32-bytes',
    },
    serviceBindings: { ASSETS: () => new Response('fixture') },
  });
  try {
    const db = await mf.getD1Database('DB');
    await migrate(db);
    const request = (path, data, cookie = '', method = data ? 'POST' : 'GET') =>
      mf.dispatchFetch(origin + '/api' + path, {
        method,
        headers: {
          Origin: origin,
          Cookie: cookie,
          ...(data ? { 'Content-Type': 'application/json' } : {}),
        },
        body: data ? JSON.stringify(data) : undefined,
        redirect: 'manual',
      });
    assert.equal((await request('/admin/media/status')).status, 401);
    const started = await request('/auth/request/create', {
      email: 'media@example.test',
      firstName: 'Media',
      lastName: 'Fixture',
      password: 'Media-test-password-2027!',
      rememberMe: true,
    });
    assert.equal(started.status, 200, await started.clone().text());
    const mail = await db
      .prepare("SELECT body FROM outbox WHERE kind='login' ORDER BY rowid DESC LIMIT 1")
      .first();
    const verified = await request('/auth/verify-code', {
      challengeId: (await started.json()).challengeId,
      code: mail.body.match(/code de vérification : (\d{6})/)[1],
      password: 'Media-test-password-2027!',
    });
    assert.equal(verified.status, 200, await verified.clone().text());
    const cookie = verified.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const user = await db
      .prepare('SELECT id FROM user WHERE email=?')
      .bind('media@example.test')
      .first();
    assert.equal((await request('/admin/media', { data: 'ZmFrZQ==' }, cookie)).status, 403);
    await db
      .prepare("INSERT INTO staff(user_id,role,permissions) VALUES(?,'admin','[]')")
      .bind(user.id)
      .run();
    assert.deepEqual(await (await request('/admin/media/status', null, cookie)).json(), {
      configured: true,
    });
    assert.equal((await request('/admin/media', { data: 'ZmFrZQ==' }, cookie)).status, 400);
    // A real 1×1 WebP, stored only in an ephemeral Miniflare R2 bucket.
    const data = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
    const uploaded = await request('/admin/media', { data }, cookie);
    assert.equal(uploaded.status, 201, await uploaded.clone().text());
    const { url } = await uploaded.json();
    assert.match(url, /^\/media\/[a-f0-9-]+\.webp$/);
    const config = await (await request('/admin/config', null, cookie)).json();
    const saved = await request(
      '/admin/settings',
      {
        settings: {
          ...config.settings,
          photos: [
            {
              url,
              alt: 'Photo réelle de test',
              caption: 'Légende de test',
              section: 'edition',
              enabled: true,
              order: 0,
            },
          ],
        },
        revision: config.revision,
      },
      cookie,
      'PUT',
    );
    assert.equal(saved.status, 200, await saved.clone().text());
    const published = await (await request('/public')).json();
    assert.equal(published.settings.photos[0].url, url);
    assert.equal(published.settings.photos[0].caption, 'Légende de test');
    const image = await mf.dispatchFetch(origin + url);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/webp');
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
    assert.match(image.headers.get('cache-control'), /immutable/);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(data, 'base64'));
    const bucket = await mf.getR2Bucket('MEDIA');
    assert.equal((await bucket.list()).objects.length, 1);
    assert.equal((await mf.dispatchFetch(origin + '/media/not-a-real-image.webp')).status, 404);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) n FROM audit WHERE action='media.created'").first()).n,
      1,
    );
  } finally {
    await mf.dispose();
    await network.close();
  }
});
