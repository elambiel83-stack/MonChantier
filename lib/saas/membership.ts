import { getPool } from '@/lib/db';
import type { TenantRole } from '@/lib/tenantRoleStore';

export type SaasMembership = { tenantId: string; tenantRole: TenantRole };

export async function findSaasMembership(identity: string): Promise<SaasMembership | null> {
  try {
    const result = await getPool().query<{
      tenant_id: string;
      role: TenantRole;
      tenant_status: string;
      active: boolean;
    }>(
      `SELECT d.tenant_id, d.role, t.status AS tenant_status, d.active
       FROM saas.identity_directory d
       JOIN saas.tenants t ON t.id = d.tenant_id
       WHERE d.identity = $1`,
      [identity.trim().toLowerCase()],
    );
    const row = result.rows[0];
    if (!row || !row.active || row.tenant_status !== 'active') return null;
    return { tenantId: row.tenant_id, tenantRole: row.role };
  } catch (error: any) {
    // Permet à l'application historique de rester disponible avant que la
    // migration SaaS V2 ait été appliquée.
    if (error?.code === '42P01' || error?.code === '3F000') return null;
    throw error;
  }
}

export async function createSaasTenant(input: {
  identity: string;
  slug: string;
  name: string;
  settings?: Record<string, unknown>;
}) {
  const client = await getPool().connect();
  const identity = input.identity.trim().toLowerCase();
  try {
    await client.query('BEGIN');
    const tenantResult = await client.query<{ id: string }>(
      `INSERT INTO saas.tenants (slug,name,settings)
       VALUES ($1,$2,$3::jsonb) RETURNING id`,
      [input.slug.trim().toLowerCase(), input.name.trim(), JSON.stringify(input.settings || {})],
    );
    const tenantId = tenantResult.rows[0].id;
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await client.query(
      `INSERT INTO saas.memberships (tenant_id,identity,role)
       VALUES ($1,$2,'owner')`,
      [tenantId, identity],
    );
    await client.query(
      `INSERT INTO saas.identity_directory (identity,tenant_id,role,active)
       VALUES ($1,$2,'owner',true)`,
      [identity, tenantId],
    );
    await client.query(
      `INSERT INTO saas.audit_events
       (tenant_id,actor_identity,action,resource_type,resource_id,payload)
       VALUES ($1,$2,'tenant.created','tenant',$1,$3::jsonb)`,
      [tenantId, identity, JSON.stringify({ slug: input.slug, name: input.name })],
    );
    await client.query('COMMIT');
    return { tenantId, tenantRole: 'owner' as const };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
