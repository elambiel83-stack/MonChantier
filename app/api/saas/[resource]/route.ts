import { NextResponse } from 'next/server';
import { getTenantActor } from '@/lib/tenantSessionIdentity';
import { isSaasResource, SAAS_RESOURCES } from '@/lib/saas/resources';
import { tenantQuery, withTenantTransaction } from '@/lib/saas/tenantDb';

async function authorize(resource: string) {
  const actor = await getTenantActor();
  if (!actor || !isSaasResource(resource)) return null;
  const config = SAAS_RESOURCES[resource];
  if (!config.roles.includes(actor.tenantRole)) return null;
  return { actor, config };
}

export async function GET(_request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const access = await authorize(resource);
  if (!access) return NextResponse.json({ message:'Accès refusé' }, { status:403 });
  const rows = await withTenantTransaction(access.actor, async client =>
    (await tenantQuery(client, `SELECT * FROM saas.${access.config.table} ORDER BY ${access.config.orderBy} LIMIT 500`)).rows
  );
  return NextResponse.json({ resource, rows });
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const access = await authorize(resource);
  if (!access || access.config.insertable.length === 0) {
    return NextResponse.json({ message:'Création interdite' }, { status:403 });
  }
  const body = await request.json();
  const columns = access.config.insertable.filter(column => body[column] !== undefined);
  if (columns.length === 0) return NextResponse.json({ message:'Données requises' }, { status:400 });
  const values = columns.map(column => body[column]);
  const params = values.map((_, index) => `$${index + 2}`).join(',');
  const row = await withTenantTransaction(access.actor, async client => {
    const result = await tenantQuery(
      client,
      `INSERT INTO saas.${access.config.table} (tenant_id,${columns.join(',')}) VALUES ($1,${params}) RETURNING *`,
      [access.actor.tenantId, ...values],
    );
    await tenantQuery(client,
      'INSERT INTO saas.audit_events (tenant_id,actor_identity,action,resource_type,resource_id) VALUES ($1,$2,$3,$4,$5)',
      [access.actor.tenantId, access.actor.identity, 'created', resource, String(result.rows[0]?.id || '')]);
    return result.rows[0];
  });
  return NextResponse.json({ success:true, row }, { status:201 });
}
