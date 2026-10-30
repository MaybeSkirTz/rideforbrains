import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { configureDatabase } from '../scripts/cloudflare-database.mjs';

const id = '11111111-2222-3333-4444-555555555555';
const row = { name: 'ride-for-brains', uuid: id };
function fixture(bindings = []) {
  const cwd = mkdtempSync(join(tmpdir(), 'rfb-d1-test-'));
  const config = {
    name: 'ride-for-brains',
    d1_databases: bindings,
    vars: { APP_URL: 'https://event.example', PAYMENTS_MODE: 'test' },
  };
  writeFileSync(join(cwd, 'wrangler.json'), JSON.stringify(config));
  return {
    cwd,
    read: () => JSON.parse(readFileSync(join(cwd, 'wrangler.json'), 'utf8')),
    cleanup: () => {
      assert.equal(dirname(resolve(cwd)), resolve(tmpdir()));
      assert.ok(basename(cwd).startsWith('rfb-d1-test-'));
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}
test('Existing database is linked without create, delete, migration or data access', async () => {
  const f = fixture(),
    calls = [];
  try {
    const result = await configureDatabase({
      cwd: f.cwd,
      log: () => {},
      run: (args) => {
        calls.push(args);
        return JSON.stringify([row]);
      },
    });
    assert.equal(result.existed, true);
    assert.deepEqual(calls, [['d1', 'list', '--json']]);
    assert.deepEqual(f.read().d1_databases, [
      {
        binding: 'DB',
        database_name: 'ride-for-brains',
        database_id: id,
        migrations_dir: 'migrations',
      },
    ]);
    assert.equal(f.read().vars.APP_URL, 'https://event.example');
  } finally {
    f.cleanup();
  }
});
test('New database is created only after an authoritative empty list, then its actual ID is linked', async () => {
  const f = fixture(),
    calls = [];
  let lists = 0;
  try {
    const result = await configureDatabase({
      cwd: f.cwd,
      log: () => {},
      run: (args) => {
        calls.push(args);
        return args[1] === 'list' ? JSON.stringify(++lists === 1 ? [] : [row]) : 'created';
      },
    });
    assert.equal(result.existed, false);
    assert.equal(result.id, id);
    assert.deepEqual(calls, [
      ['d1', 'list', '--json'],
      ['d1', 'create', 'ride-for-brains', '--update-config=false'],
      ['d1', 'list', '--json'],
    ]);
  } finally {
    f.cleanup();
  }
});
test('Repeated setup is safe and does not create a duplicate database', async () => {
  const f = fixture(),
    calls = [];
  try {
    const run = (args) => {
      calls.push(args);
      return JSON.stringify([row]);
    };
    await configureDatabase({ cwd: f.cwd, run, log: () => {} });
    await configureDatabase({ cwd: f.cwd, run, log: () => {} });
    assert.equal(calls.length, 2);
    assert.ok(calls.every((a) => a[1] === 'list'));
    assert.equal(f.read().d1_databases.length, 1);
  } finally {
    f.cleanup();
  }
});
test('Failed listing leaves the configuration untouched and never attempts creation', async () => {
  const f = fixture(),
    before = f.read(),
    calls = [];
  try {
    await assert.rejects(
      () =>
        configureDatabase({
          cwd: f.cwd,
          log: () => {},
          run: (args) => {
            calls.push(args);
            throw new Error('Fixture authentication failure');
          },
        }),
      /authentication failure/,
    );
    assert.deepEqual(f.read(), before);
    assert.equal(calls.length, 1);
  } finally {
    f.cleanup();
  }
});
test('A configured different database is preserved when the account does not match', async () => {
  const f = fixture([
      {
        binding: 'DB',
        database_name: 'ride-for-brains',
        database_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      },
    ]),
    before = f.read();
  try {
    await assert.rejects(
      () => configureDatabase({ cwd: f.cwd, log: () => {}, run: () => JSON.stringify([row]) }),
      /autre identifiant/,
    );
    assert.deepEqual(f.read(), before);
  } finally {
    f.cleanup();
  }
});
test('Setup recovers when another process creates the database between list and create', async () => {
  const f = fixture();
  let lists = 0;
  try {
    const result = await configureDatabase({
      cwd: f.cwd,
      log: () => {},
      run: (args) => {
        if (args[1] === 'list') return JSON.stringify(++lists === 1 ? [] : [row]);
        const e = new Error('conflict');
        e.providerOutput = 'A database with that name already exists';
        throw e;
      },
    });
    assert.equal(result.id, id);
    assert.equal(f.read().d1_databases[0].database_id, id);
  } finally {
    f.cleanup();
  }
});
