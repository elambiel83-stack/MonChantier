import { NextRequest, NextResponse } from 'next/server';
import { addUser, listUsers, toggleUserActive } from '@/lib/adminStore';
import { requireAdmin } from '@/lib/requireAdmin';
import { isAppRole } from '@/lib/roles';
import { getSessionActor } from '@/lib/sessionIdentity';
import { setIdentityActive, setStoredRole } from '@/lib/roleStore';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json();
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim();
  const role = body?.role;
  const actor = await getSessionActor();

  if (!name || !email || !role) {
    return NextResponse.json(
      { message: 'Nom, email et rôle sont requis' },
      { status: 400 }
    );
  }

  if (!isAppRole(role) || !actor) {
    return NextResponse.json(
      { message: 'Rôle invalide' },
      { status: 400 }
    );
  }

  const created = await addUser({ name, email, role });
  await setStoredRole({ identity: email, role, actor: actor.identity });
  return NextResponse.json({ success: true, user: created });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json();
  const userId = String(body?.userId || '');
  const actor = await getSessionActor();

  if (!userId) {
    return NextResponse.json(
      { message: 'userId requis' },
      { status: 400 }
    );
  }

  const updated = await toggleUserActive(userId);
  if (!updated) {
    return NextResponse.json(
      { message: 'Utilisateur introuvable' },
      { status: 404 }
    );
  }
  if (actor) await setIdentityActive({ identity: updated.email, active: updated.active, actor: actor.identity });

  return NextResponse.json({ success: true, user: updated });
}
