import { Miniflare } from 'miniflare';
import { migrate } from './migrate.mjs';

// Workerd owns its local SQLite files while the preview is running. Avoid concurrent
// processes opening the same persistent database, which can block on an exclusive lock.
export async function withLocalDatabase(operation) {
  const running = await fetch('http://localhost:8787/api/public', {
    signal: AbortSignal.timeout(1000),
  }).then(
    () => true,
    () => false,
  );
  if (running)
    throw new Error(
      'Arrêtez le serveur local avec Ctrl+C, lancez cette commande, puis relancez npm run dev.',
    );
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("local database CLI")}}',
    d1Databases: { DB: 'local-ride-for-brains' },
    d1Persist: 'work/runtime/d1',
  });
  try {
    const db = await mf.getD1Database('DB');
    await migrate(db);
    return await operation(db);
  } finally {
    await mf.dispose();
  }
}
