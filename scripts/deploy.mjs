import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const id = process.env.CLOUDFLARE_D1_DATABASE_ID,
  appUrl = process.env.APP_URL;
if (!id || !appUrl || !/^https:\/\//.test(appUrl) || appUrl.includes('replace-before-deploy'))
  throw new Error('Configurer CLOUDFLARE_D1_DATABASE_ID et APP_URL avant de déployer.');
const config = JSON.parse(readFileSync('wrangler.json', 'utf8'));
config.main = resolve(config.main);
config.assets.directory = resolve(config.assets.directory);
config.d1_databases = [
  {
    binding: 'DB',
    database_name: 'ride-for-brains',
    database_id: id,
    migrations_dir: resolve('migrations'),
  },
];
config.vars.APP_URL = appUrl.replace(/\/$/, '');
mkdirSync('work', { recursive: true });
writeFileSync('work/wrangler.deploy.json', JSON.stringify(config, null, 2));
for (const args of [
  ['d1', 'migrations', 'apply', 'DB', '--remote', '--config', 'work/wrangler.deploy.json'],
  ['deploy', '--config', 'work/wrangler.deploy.json'],
]) {
  const r = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status || 1);
}
