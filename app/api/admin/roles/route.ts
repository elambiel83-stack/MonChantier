import { NextRequest, NextResponse } from 'next/server';
import { isAppRole } from '@/lib/roles';
import { listStoredRoles, setStoredRole } from '@/lib/roleStore';
import { getSessionActor } from '@/lib/sessionIdentity';
import { requireAdmin } from '@/lib/requireAdmin';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const roles = await listStoredRoles();
  return NextResponse.json({
    roles: Object.entries(roles).map(([identity, assignment]) => ({ identity, ...assignment })),
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json();
  const identity = String(body?.identity || '').trim();
  const role = body?.role;
  const actor = await getSessionActor();

  if (!identity || !isAppRole(role)) {
    return NextResponse.json(
      { message: 'identity et role (valide) sont requis' },
      { status: 400 }
    );
  }

  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ message: 'Accès administrateur requis' }, { status: 403 });
  }
  const expiresAt = typeof body?.expiresAt === 'string' ? body.expiresAt : undefined;
  const assignment = await setStoredRole({ identity, role, actor: actor.identity, expiresAt });
  return NextResponse.json({ success: true, identity, ...assignment });
}
