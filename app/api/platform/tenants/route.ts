import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAuth';
import { listTenants } from '@/lib/tenantStore';

export async function GET() {
  const admin = await requirePlatformAdmin();
  if (!admin) return NextResponse.json({ message: 'Accès plateforme refusé' }, { status: 403 });

  const tenants = await listTenants();
  return NextResponse.json({ tenants });
}
