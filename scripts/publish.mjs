import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

export function workerUrl(output, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return output.match(new RegExp(`https://${escaped}\\.[a-z0-9-]+\\.workers\\.dev`, 'i'))?.[0];
}

export async function publish({
  cwd = process.cwd(),
  run,
  log = console.log,
  secretFactory = () => randomBytes(48).toString('base64url'),
} = {}) {
  const configPath = resolve(cwd, 'wrangler.json');
  let original = readFileSync(configPath, 'utf8');
  const config = JSON.parse(original);
  const databases = config.d1_databases || [];
  if (
    databases.length !== 1 ||
    databases[0].binding !== 'DB' ||
    !/^[0-9a-f-]{36}$/i.test(databases[0].database_id || '') ||
    /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(databases[0].database_id)
  ) {
    throw new Error(
      'La base du site doit d’abord être reliée au projet. Relance npm run cloudflare:database pour préparer cette connexion, puis réessaie.',
    );
  }
  if (!config.name || config.vars?.APP_ENV !== 'production')
    throw new Error('La configuration de publication doit avoir un nom et APP_ENV=production.');
  const initialSetup =
    !config.vars.APP_URL || config.vars.APP_URL.includes('replace-before-deploy');
  if (initialSetup && config.vars.PAYMENTS_MODE !== 'test')
    throw new Error('Garde PAYMENTS_MODE=test pour la première publication.');

  const execute =
    run ||
    ((module, args, options = {}) => {
      const result = spawnSync(process.execPath, [resolve(cwd, module), ...args], {
        cwd,
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
        encoding: 'utf8',
        input: options.input,
        stdio: [options.input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
      });
      if (options.show !== false) {
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
      }
      if (result.error || result.status !== 0)
        throw new Error(
          'La commande a échoué. Arrête-toi ici et conserve le message affiché au-dessus.',
        );
      return result.stdout || '';
    });
  const wrangler = (args, options) =>
    execute('node_modules/wrangler/bin/wrangler.js', args, options);

  log('1/5 — Vérification et préparation du vrai site.');
  execute('node_modules/typescript/bin/tsc', ['--noEmit']);
  execute('node_modules/vite/bin/vite.js', ['build', '--configLoader', 'runner']);
  log('2/5 — Préparation des tables dans la base Cloudflare.');
  wrangler(['d1', 'migrations', 'apply', 'DB', '--remote']);
  log('3/5 — Envoi du vrai site à Cloudflare.');
  const output = wrangler(['deploy']);
  let url = config.vars.APP_URL;
  if (initialSetup) {
    url = workerUrl(output, config.name);
    if (!url)
      throw new Error(
        'Cloudflare a terminé la commande mais son adresse publique n’a pas été trouvée. Conserve la sortie de déploiement; aucune adresse n’a été inventée.',
      );
    if (readFileSync(configPath, 'utf8') !== original)
      throw new Error(
        'Le fichier wrangler.json a changé pendant la publication. Recharge-le avant de continuer.',
      );
    mkdirSync(resolve(cwd, 'work'), { recursive: true });
    writeFileSync(resolve(cwd, 'work/wrangler.before-first-publication.json'), original);
    config.vars.APP_URL = url;
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    log('4/5 — Configuration automatique de l’adresse du site.');
    wrangler(['deploy']);
  } else {
    log('4/5 — Adresse déjà configurée, conservée.');
  }
  log('5/5 — Vérification du secret de connexion.');
  const names = JSON.parse(wrangler(['secret', 'list', '--format', 'json'], { show: false }));
  if (!Array.isArray(names))
    throw new Error(
      'La liste des secrets Cloudflare est illisible. Le secret existant n’a pas été remplacé.',
    );
  if (!names.some((s) => s.name === 'BETTER_AUTH_SECRET')) {
    wrangler(['secret', 'put', 'BETTER_AUTH_SECRET'], { input: secretFactory() + '\n' });
  }
  log('Adresse de publication : ' + url);
  log(
    'Les courriels, l’accès administrateur et Stripe se configurent séparément. Aucun paiement réel n’est activé par cette commande.',
  );
  return url;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  publish().catch((error) => {
    console.error('\nPublication interrompue : ' + error.message);
    process.exitCode = 1;
  });
}
