import { Pool } from 'pg';

// Un seul pool par process, réutilisé entre les invocations de routes Next.js
// (en dev, `next dev` recharge les modules : on le range sur `globalThis` pour
// éviter d'ouvrir un nouveau pool à chaque hot-reload).
declare global {
  // eslint-disable-next-line no-var
  var __monchantier_pg_pool__: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL manquant : configurez une base PostgreSQL (voir .env.example) — ' +
        'les données ne sont plus persistées en fichiers JSON.'
    );
  }
  return new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });
}

// Lazy à dessein : importer ce module (transitivement, via storeDb.ts) ne
// doit pas exiger DATABASE_URL ni ouvrir de connexion — seul un usage
// effectif (une requête) le fait. Ça permet de tester des fonctions pures
// d'un module *Store.ts sans base de données configurée.
export function getPool(): Pool {
  if (!globalThis.__monchantier_pg_pool__) {
    globalThis.__monchantier_pg_pool__ = createPool();
  }
  return globalThis.__monchantier_pg_pool__;
}
