import { NextRequest, NextResponse } from 'next/server';
import { isAppRole } from '@/lib/roles';
import { listStoredRoles, setStoredRole } from '@/lib/roleStore';

export async function GET() {
  const roles = await listStoredRoles();
  return NextResponse.json({
    roles: Object.entries(roles).map(([identity, role]) => ({ identity, role })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const identity = String(body?.identity || '').trim();
  const role = body?.role;

  if (!identity || !isAppRole(role)) {
    return NextResponse.json(
      { message: 'identity et role (valide) sont requis' },
      { status: 400 }
    );
  }

  await setStoredRole(identity, role);
  return NextResponse.json({ success: true, identity, role });
}
