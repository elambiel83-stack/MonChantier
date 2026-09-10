import { getPool } from './db';

// Remplace le mutex `withLock` en mémoire de process (qui ne protège rien dès
// qu'il y a plusieurs instances/replicas, et perd tout son état à froid en
// serverless) par une vraie transaction Postgres : `SELECT ... FOR UPDATE`
// verrouille la ligne le temps de la transaction, ce qui sérialise les
// lecture-modification-écriture concurrentes même entre plusieurs instances.

export async function readStore<TStore>(key: string, seed: () => TStore): Promise<TStore> {
  const { rows } = await getPool().query<{ value: TStore }>('SELECT value FROM kv_store WHERE key = $1', [key]);
  if (rows.length === 0) return seed();
  return rows[0].value;
}

export async function withStore<TStore, TResult>(
  key: string,
  seed: () => TStore,
  fn: (store: TStore) => Promise<TResult> | TResult
): Promise<TResult> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ value: TStore }>(
      'SELECT value FROM kv_store WHERE key = $1 FOR UPDATE',
      [key]
    );

    let store: TStore;
    if (rows.length === 0) {
      store = seed();
      await client.query('INSERT INTO kv_store (key, value) VALUES ($1, $2::jsonb)', [key, JSON.stringify(store)]);
    } else {
      store = rows[0].value;
    }

    // `fn` mute `store` en place (comme le faisait l'ancien code sur l'objet
    // lu depuis le fichier JSON) : on réécrit son état final tel quel.
    const result = await fn(store);

    await client.query('UPDATE kv_store SET value = $2::jsonb, updated_at = now() WHERE key = $1', [
      key,
      JSON.stringify(store),
    ]);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
