import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';
mkdirSync('work', { recursive: true });
// All generated state stays in the checkout, including on restricted desktop hosts.
process.env.XDG_CONFIG_HOME = resolve('work/config');
process.env.WRANGLER_SEND_METRICS = 'false';
if (!existsSync('.dev.vars'))
  writeFileSync(
    '.dev.vars',
    `APP_ENV=development\nAPP_URL=http://localhost:8787\nBETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\nPAYMENTS_MODE=test\n`,
  );
const run = (file, args = []) => {
  const r = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) process.exit(r.status || 1);
};
run('node_modules/vite/bin/vite.js', ['build', '--configLoader', 'runner']);
run('node_modules/vite/bin/vite.js', [
  'build',
  '--config',
  'vite.worker.config.ts',
  '--configLoader',
  'runner',
]);
const child = spawn(process.execPath, ['scripts/local-server.mjs'], {
  stdio: 'inherit',
  env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code || 0));
