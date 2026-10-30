import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const validId = (id) =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) &&
  id !== '00000000-0000-0000-0000-000000000000';

export async function configureDatabase({ cwd = process.cwd(), run, log = console.log } = {}) {
  const file = resolve(cwd, 'wrangler.json');
  const original = readFileSync(file, 'utf8');
  const config = JSON.parse(original);
  const name = 'ride-for-brains';
  const bindings = config.d1_databases || [];
  if (
    bindings.some((b) => b.database_name !== name || !['DB', 'ride_for_brains'].includes(b.binding))
  ) {
    throw new Error(
      'Une connexion D1 différente est déjà configurée. Aucun fichier ni aucune base n’a été modifié.',
    );
  }

  const execute =
    run ||
    ((args, options = {}) => {
      const result = spawnSync(
        process.execPath,
        [resolve(cwd, 'node_modules/wrangler/bin/wrangler.js'), ...args],
        {
          cwd,
          encoding: 'utf8',
          env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
          stdio: ['inherit', 'pipe', 'pipe'],
        },
      );
      if (options.show !== false && result.stdout) process.stdout.write(result.stdout);
      if ((options.show !== false || result.status !== 0) && result.stderr)
        process.stderr.write(result.stderr);
      if (result.error || result.status !== 0) {
        const error = new Error(
          'Cloudflare n’a pas pu terminer la commande. Conserve le message affiché au-dessus.',
        );
        error.providerOutput = (result.stdout || '') + (result.stderr || '');
        throw error;
      }
      return result.stdout || '';
    });
  const findDatabase = () => {
    const data = JSON.parse(execute(['d1', 'list', '--json'], { show: false }));
    const rows = Array.isArray(data) ? data : data.result;
    if (!Array.isArray(rows))
      throw new Error(
        'La liste des bases Cloudflare est illisible. Aucune connexion n’a été modifiée.',
      );
    const matches = rows.filter((row) => row.name === name);
    if (matches.length > 1)
      throw new Error(
        'Plusieurs bases portent exactement ce nom. Il faut les vérifier avant de continuer.',
      );
    if (matches[0] && !validId(matches[0].uuid || matches[0].id))
      throw new Error('L’identifiant de la base retourné par Cloudflare est invalide.');
    return matches[0] || null;
  };

  log('Recherche de la base ride-for-brains dans ton compte Cloudflare…');
  let database = findDatabase();
  const existed = !!database;
  if (!database) {
    // Do not replace a previously configured database after changing Cloudflare accounts.
    if (bindings.some((b) => validId(b.database_id)))
      throw new Error(
        'La base configurée n’apparaît pas dans ce compte Cloudflare. Vérifie le compte connecté; aucune base supplémentaire n’a été créée.',
      );
    log('Aucune base trouvée sous ce nom. Création de la base du site…');
    try {
      execute(['d1', 'create', name, '--update-config=false']);
    } catch (error) {
      // Another setup can create the database between our list and create calls.
      if (!/database.*already exists/i.test(error.providerOutput || '')) throw error;
    }
    database = findDatabase();
    if (!database)
      throw new Error(
        'La création a été demandée mais la base n’apparaît pas dans la liste. Relance cette même commande; ne crée pas une autre base.',
      );
  }
  const id = database.uuid || database.id;
  if (bindings.some((b) => validId(b.database_id) && b.database_id !== id))
    throw new Error(
      'Le projet pointe vers un autre identifiant D1. Aucun remplacement n’a été effectué : il faut vérifier le compte et la base.',
    );
  if (readFileSync(file, 'utf8') !== original)
    throw new Error(
      'wrangler.json a changé pendant la vérification. Enregistre ou ferme ton éditeur, puis relance cette commande.',
    );
  config.d1_databases = [
    { binding: 'DB', database_name: name, database_id: id, migrations_dir: 'migrations' },
  ];
  const next = JSON.stringify(config, null, 2) + '\n';
  if (next !== original) {
    mkdirSync(resolve(cwd, 'work'), { recursive: true });
    writeFileSync(
      resolve(cwd, 'work', 'wrangler.before-d1-link-' + Date.now() + '.json'),
      original,
    );
    writeFileSync(file, next);
  }
  log(existed ? 'Base existante reliée au projet.' : 'Base créée et reliée au projet.');
  log('Connexion DB prête. Tu peux maintenant lancer : npm run deploy');
  return { id, existed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  configureDatabase().catch((error) => {
    console.error('\nConfiguration interrompue : ' + error.message);
    process.exitCode = 1;
  });
}
