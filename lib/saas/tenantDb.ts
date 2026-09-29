import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getPool } from '@/lib/db';

export type TenantContext = { tenantId: string; identity: string; role: string };

/** Toutes les requêtes métier SaaS doivent passer par cette transaction. */
export async function withTenantTransaction<T>(context: TenantContext, task: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(context.tenantId)) throw new Error('tenantId invalide');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenantId]);
    await client.query("SELECT set_config('app.identity', $1, true)", [context.identity.toLowerCase()]);
    const result = await task(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function tenantQuery<R extends QueryResultRow = QueryResultRow>(client: PoolClient, text: string, values: unknown[] = []): Promise<QueryResult<R>> {
  return client.query<R>(text, values);
}
