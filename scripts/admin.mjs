import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { migrate } from './migrate.mjs';
const args = process.argv.slice(2),
  email = args[args.indexOf('--email') + 1],
  remote = args.includes('--remote');
if (
  !args.includes('--email') ||
  !email ||
  !/^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
) {
  console.error('Usage : npm run admin -- --email personne@example.com --local (ou --remote)');
  process.exit(1);
}
// Requires direct database access, never an HTTP bootstrap endpoint or a default password.
const sql = `INSERT INTO staff(user_id,role,permissions) SELECT id,'admin','[]' FROM user WHERE lower(email)='${email.toLowerCase()}' AND emailVerified=1 ON CONFLICT(user_id) DO UPDATE SET role='admin'; SELECT u.email,s.role FROM staff s JOIN user u ON u.id=s.user_id WHERE lower(u.email)='${email.toLowerCase()}';`;
process.env.XDG_CONFIG_HOME = resolve('work/config');
process.env.WRANGLER_SEND_METRICS = 'false';
if (remote) {
  const result = spawnSync(
    process.execPath,
    ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--remote', '--command', sql],
    { stdio: 'inherit', env: process.env },
  );
  if (result.status) process.exit(result.status);
} else {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("local admin CLI")}}',
    d1Databases: { DB: 'local-ride-for-brains' },
    d1Persist: 'work/runtime/d1',
  });
  try {
    const db = await mf.getD1Database('DB');
    await migrate(db);
    await db
      .prepare(
        `INSERT INTO staff(user_id,role,permissions) SELECT id,'admin','[]' FROM user WHERE lower(email)=? AND emailVerified=1 ON CONFLICT(user_id) DO UPDATE SET role='admin'`,
      )
      .bind(email.toLowerCase())
      .run();
    console.log(
      (
        await db
          .prepare(
            'SELECT u.email,s.role FROM staff s JOIN user u ON u.id=s.user_id WHERE lower(u.email)=?',
          )
          .bind(email.toLowerCase())
          .all()
      ).results,
    );
  } finally {
    await mf.dispose();
  }
}
console.log(
  'Vérifiez qu’une ligne confirme le rôle admin. Une table vide signifie que la personne doit d’abord se connecter et vérifier son courriel.',
);
