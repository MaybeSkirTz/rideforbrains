import { withLocalDatabase } from './local-db.mjs';
await withLocalDatabase(async () =>
  console.log('Migrations appliquées à la base locale du serveur de développement.'),
);
