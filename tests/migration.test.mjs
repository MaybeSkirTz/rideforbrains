import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { statements, migrate } from '../scripts/migrate.mjs';
test('Incremental platform migration preserves existing settings, paid registration and purchased policy', async () => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("fixture")}}',
    d1Databases: ['DB'],
  });
  try {
    const db = await mf.getD1Database('DB');
    await db.prepare('CREATE TABLE app_migrations(name TEXT PRIMARY KEY)').run();
    for (const name of readdirSync('migrations')
      .filter((n) => n.endsWith('.sql') && n < '0006')
      .sort()) {
      await db.batch([
        ...statements(readFileSync('migrations/' + name, 'utf8'))
          .filter((s) => !s.startsWith('PRAGMA'))
          .map((s) => db.prepare(s)),
        db.prepare('INSERT INTO app_migrations(name) VALUES(?)').bind(name),
      ]);
    }
    await db.batch([
      db.prepare(
        "UPDATE settings SET data=json_set(data,'$.location','Lieu déjà configuré','$.registrationOpen',json('true'),'$.taxMode','not_applicable')",
      ),
      db.prepare(
        "INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES('existing','Fixture','existing@example.test',1,0,0)",
      ),
      db.prepare(
        "INSERT INTO orders(id,user_id,request_key,amount,status,expires_at,payment_intent,event_snapshot) VALUES('order_existing','existing','fixture',1500,'confirmed',0,'pi_fixture','{\"eventAt\":\"2027-08-21T07:30:00-04:00\"}')",
      ),
      db.prepare(
        "INSERT INTO registrations(id,order_id,activity_id,first_name,last_name,email,phone,adult,emergency_name,emergency_phone,answers,form_snapshot,form_version,conditions_version,conditions_snapshot,photo,marketing,price,status,expires_at,ticket) VALUES('reg_existing','order_existing','course-5','Fixture','Existing','existing@example.test','5145550100',1,'Fixture','5145550199','{}','[]',1,'policy_existing','Conditions achetées',0,0,1500,'confirmed',0,'opaque_fixture_ticket')",
      ),
    ]);
    const settings = await db.prepare('SELECT * FROM settings').first(),
      registration = await db.prepare('SELECT * FROM registrations').first(),
      order = await db.prepare('SELECT * FROM orders').first();
    await migrate(db);
    await migrate(db);
    const migratedSettings = await db.prepare('SELECT * FROM settings').first();
    const previous = JSON.parse(settings.data),
      current = JSON.parse(migratedSettings.data);
    for (const [key, value] of Object.entries(previous))
      if (!['minimumAge', 'terms', 'termsVersion', 'privacy', 'faq'].includes(key))
        assert.deepEqual(current[key], value, key);
    assert.equal(current.minimumAge, 0);
    assert.ok(current.terms.includes('parent ou tuteur légal'));
    assert.equal(migratedSettings.revision, settings.revision + 2);
    const nextOrder = await db.prepare('SELECT * FROM orders').first();
    for (const [key, value] of Object.entries(order)) assert.equal(nextOrder[key], value, key);
    assert.equal(nextOrder.removed_at, null);
    assert.equal(nextOrder.removed_by, null);
    const next = await db.prepare('SELECT * FROM registrations').first();
    for (const [key, value] of Object.entries(registration)) assert.equal(next[key], value, key);
    assert.equal(next.refunded_amount, 0);
    assert.equal(next.transferred_user_id, null);
    assert.equal(next.is_minor, 0);
    assert.equal(next.guardian_snapshot, null);
    assert.ok(
      await db.prepare("SELECT name FROM app_migrations WHERE name='0006_platform.sql'").first(),
    );
  } finally {
    await mf.dispose();
  }
});

test('Previously consumed promo codes are archived during migration and old names remain private', async () => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("fixture")}}',
    d1Databases: ['DB'],
  });
  try {
    const db = await mf.getD1Database('DB');
    await db.prepare('CREATE TABLE app_migrations(name TEXT PRIMARY KEY)').run();
    for (const name of readdirSync('migrations')
      .filter((n) => n.endsWith('.sql') && n < '0010')
      .sort())
      await db.batch([
        ...statements(readFileSync('migrations/' + name, 'utf8'))
          .filter((s) => !s.startsWith('PRAGMA'))
          .map((s) => db.prepare(s)),
        db.prepare('INSERT INTO app_migrations(name) VALUES(?)').bind(name),
      ]);
    await db.batch([
      db.prepare(
        "INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES('legacy','Test','legacy@example.test',1,0,0)",
      ),
      db.prepare(
        "INSERT INTO promos(code,percent,max_uses,active) VALUES('USED-A',100,1,1),('USED-B',25,1,1),('AVAILABLE',25,5,1)",
      ),
      db.prepare(
        "INSERT INTO orders(id,user_id,request_key,amount,status,promo,expires_at) VALUES('first','legacy','first',0,'confirmed','USED-A',0),('second','legacy','second',1125,'refunded','USED-B',0)",
      ),
    ]);
    await migrate(db);
    await migrate(db);
    const codes = (
      await db.prepare('SELECT code,active,redeemed FROM promo_usage ORDER BY code').all()
    ).results;
    assert.deepEqual(codes, [
      { code: 'AVAILABLE', active: 1, redeemed: 0 },
      { code: 'USED-A', active: 0, redeemed: 1 },
      { code: 'USED-B', active: 0, redeemed: 1 },
    ]);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM orders').first()).n, 2);
  } finally {
    await mf.dispose();
  }
});
