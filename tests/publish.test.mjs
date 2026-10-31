import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { publish, workerUrl } from '../scripts/publish.mjs';

function fixture(config) {
  const cwd = mkdtempSync(join(tmpdir(), 'rfb-publish-test-'));
  writeFileSync(join(cwd, 'wrangler.json'), JSON.stringify(config));
  return {
    cwd,
    cleanup: () => {
      assert.equal(dirname(resolve(cwd)), resolve(tmpdir()));
      assert.ok(basename(cwd).startsWith('rfb-publish-test-'));
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}
const config = (url = 'https://replace-before-deploy.example') => ({
  name: 'ride-for-brains',
  d1_databases: [{ binding: 'DB', database_id: '11111111-2222-3333-4444-555555555555' }],
  vars: { APP_ENV: 'production', APP_URL: url, PAYMENTS_MODE: 'test' },
});
test('First publication applies migrations, captures the actual URL, and sends a new secret only through stdin', async () => {
  const f = fixture(config()),
    calls = [],
    logs = [];
  try {
    const run = (module, args, options = {}) => {
      calls.push({ module, args, options });
      if (args[0] === 'deploy') return 'Uploaded\nhttps://ride-for-brains.example-team.workers.dev';
      if (args[0] === 'secret' && args[1] === 'list') return '[]';
      return '';
    };
    const url = await publish({
      cwd: f.cwd,
      run,
      log: (s) => logs.push(s),
      secretFactory: () => 'TEST_SECRET_STDIN_ONLY',
    });
    assert.equal(url, 'https://ride-for-brains.example-team.workers.dev');
    assert.equal(JSON.parse(readFileSync(join(f.cwd, 'wrangler.json'), 'utf8')).vars.APP_URL, url);
    assert.ok(
      calls.findIndex((c) => c.args[0] === 'd1') < calls.findIndex((c) => c.args[0] === 'deploy'),
    );
    assert.equal(calls.filter((c) => c.args[0] === 'deploy').length, 2);
    assert.equal(
      calls.find((c) => c.args[0] === 'secret' && c.args[1] === 'put').options.input,
      'TEST_SECRET_STDIN_ONLY\n',
    );
    assert.ok(!JSON.stringify(logs).includes('TEST_SECRET_STDIN_ONLY'));
    assert.ok(!JSON.stringify(calls.map((c) => c.args)).includes('TEST_SECRET_STDIN_ONLY'));
  } finally {
    f.cleanup();
  }
});
test('Later publication preserves a configured domain and existing authentication secret', async () => {
  const f = fixture(config('https://event.example')),
    calls = [];
  try {
    await publish({
      cwd: f.cwd,
      log: () => {},
      run: (_module, args) => {
        calls.push(args);
        return args[0] === 'secret' ? '[{"name":"BETTER_AUTH_SECRET"}]' : '';
      },
      secretFactory: () => {
        throw new Error('Existing secret must not rotate');
      },
    });
    assert.equal(calls.filter((c) => c[0] === 'deploy').length, 1);
    assert.ok(calls.filter((c) => c[0] === 'deploy').every((c) => c.includes('--keep-vars')));
    assert.equal(
      JSON.parse(readFileSync(join(f.cwd, 'wrangler.json'), 'utf8')).vars.APP_URL,
      'https://event.example',
    );
    assert.ok(!calls.some((c) => c[0] === 'secret' && c[1] === 'put'));
  } finally {
    f.cleanup();
  }
});
test('Missing, duplicated or placeholder D1 bindings stop before any remote command', async () => {
  for (const databases of [
    [],
    [...config().d1_databases, ...config().d1_databases],
    [{ binding: 'DB', database_id: '00000000-0000-0000-0000-000000000000' }],
  ]) {
    const f = fixture({ ...config(), d1_databases: databases });
    try {
      await assert.rejects(
        () =>
          publish({
            cwd: f.cwd,
            log: () => {},
            run: () => {
              throw new Error('Must not execute');
            },
          }),
        /base du site/,
      );
    } finally {
      f.cleanup();
    }
  }
});
test('A failed migration stops publication and does not change the URL', async () => {
  const f = fixture(config()),
    calls = [];
  try {
    await assert.rejects(
      () =>
        publish({
          cwd: f.cwd,
          log: () => {},
          run: (_module, args) => {
            calls.push(args);
            if (args[0] === 'd1') throw new Error('Fixture migration failure');
            return '';
          },
        }),
      /migration failure/,
    );
    assert.ok(!calls.some((c) => c[0] === 'deploy'));
    assert.equal(
      JSON.parse(readFileSync(join(f.cwd, 'wrangler.json'), 'utf8')).vars.APP_URL,
      config().vars.APP_URL,
    );
  } finally {
    f.cleanup();
  }
});
test('URL discovery never substitutes a preview URL or an unrelated Worker', () => {
  assert.equal(workerUrl('https://other.team.workers.dev', 'ride-for-brains'), undefined);
  assert.equal(
    workerUrl('https://123-ride-for-brains.team.workers.dev', 'ride-for-brains'),
    undefined,
  );
  assert.equal(
    workerUrl('https://ride-for-brains.team.workers.dev', 'ride-for-brains'),
    'https://ride-for-brains.team.workers.dev',
  );
});
