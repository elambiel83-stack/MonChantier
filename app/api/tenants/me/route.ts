import { NextResponse } from 'next/server';
import { getTenantActor } from '@/lib/tenantSessionIdentity';
import { getTenantById } from '@/lib/tenantStore';

export async function GET() {
  const actor = await getTenantActor();
  if (!actor) return NextResponse.json({ message: 'Aucun tenant associé à ce compte' }, { status: 401 });

  const tenant = await getTenantById(actor.tenantId);
  if (!tenant) return NextResponse.json({ message: 'Tenant introuvable' }, { status: 404 });

  return NextResponse.json({ tenant, tenantRole: actor.tenantRole });
}
