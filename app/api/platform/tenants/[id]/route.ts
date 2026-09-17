import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAuth';
import { setTenantStatus, TenantStatus } from '@/lib/tenantStore';

const VALID_STATUSES: TenantStatus[] = ['active', 'suspended'];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await requirePlatformAdmin();
  if (!admin) return NextResponse.json({ message: 'Accès plateforme refusé' }, { status: 403 });

  const body = await request.json();
  const status = body?.status as TenantStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ message: 'Statut invalide' }, { status: 400 });
  }

  const tenant = await setTenantStatus(params.id, status);
  if (!tenant) return NextResponse.json({ message: 'Tenant introuvable' }, { status: 404 });

  return NextResponse.json({ success: true, tenant });
}
