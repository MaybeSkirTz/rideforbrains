import { Miniflare } from 'miniflare';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { migrate } from './migrate.mjs';
const vars = Object.fromEntries(
  readFileSync('.dev.vars', 'utf8')
    .split(/\r?\n/)
    .filter((s) => s.trim() && !s.trim().startsWith('#'))
    .map((s) => {
      const p = s.indexOf('=');
      return [s.slice(0, p).trim(), s.slice(p + 1).trim()];
    }),
);
if (vars.APP_ENV !== 'development' || vars.APP_URL !== 'http://localhost:8787')
  throw new Error('Le serveur local exige APP_ENV=development et APP_URL=http://localhost:8787');
const root = resolve('dist'),
  mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
  };
const mf = new Miniflare({
  modules: [{ type: 'ESModule', path: resolve('work/server/index.js') }],
  compatibilityDate: '2026-07-30',
  compatibilityFlags: ['nodejs_compat'],
  host: '127.0.0.1',
  port: 8787,
  bindings: vars,
  d1Databases: { DB: 'local-ride-for-brains' },
  d1Persist: 'work/runtime/d1',
  serviceBindings: {
    ASSETS: async (req) => {
      let file = resolve(root, '.' + decodeURIComponent(new URL(req.url).pathname));
      if (!file.startsWith(root + sep) && file !== root)
        return new Response('Interdit', { status: 403 });
      if (!extname(file) || !existsSync(file)) file = resolve(root, 'index.html');
      return new Response(readFileSync(file), {
        headers: { 'Content-Type': mime[extname(file)] || 'application/octet-stream' },
      });
    },
  },
});
await mf.ready;
await migrate(await mf.getD1Database('DB'));
console.log('Ride For Brains : http://localhost:8787 · base locale · aucun paiement réel');
// Local equivalent of the production cron trigger.
const cron = setInterval(async () => {
  try {
    await mf.dispatchFetch('http://localhost:8787/api/dev/tick', {
      method: 'POST',
      headers: { Origin: 'http://localhost:8787', 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch (error) {
    console.error('Maintenance locale : ' + error.message);
  }
}, 300000);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    clearInterval(cron);
    await mf.dispose();
    process.exit(0);
  });
