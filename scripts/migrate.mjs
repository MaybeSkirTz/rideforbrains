import { readFileSync, readdirSync } from 'node:fs';
export function statements(sql) {
  const out = [];
  let current = '',
    quote = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    current += c;
    if (quote) {
      if (c === quote) {
        if (sql[i + 1] === quote) {
          current += sql[++i];
        } else quote = '';
      }
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (c === ';') {
      if (/^\s*CREATE TRIGGER/i.test(current) && !/\nEND;\s*$/i.test(current)) continue;
      if (current.trim()) out.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
export async function migrate(db) {
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY,applied_at INTEGER NOT NULL DEFAULT (unixepoch()))',
    )
    .run();
  for (const name of readdirSync('migrations')
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    if (await db.prepare('SELECT name FROM app_migrations WHERE name=?').bind(name).first())
      continue;
    const ss = statements(readFileSync('migrations/' + name, 'utf8')).filter(
      (s) => !s.startsWith('PRAGMA'),
    );
    await db.batch([
      ...ss.map((s) => db.prepare(s)),
      db.prepare('INSERT INTO app_migrations(name) VALUES(?)').bind(name),
    ]);
  }
}
