import { NextRequest, NextResponse } from 'next/server';
import { addUser, listUsers, toggleUserActive } from '@/lib/adminStore';

export async function GET() {
  return NextResponse.json({ users: listUsers() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim();
  const role = body?.role as 'admin' | 'manager' | 'agent';

  if (!name || !email || !role) {
    return NextResponse.json(
      { message: 'Nom, email et rôle sont requis' },
      { status: 400 }
    );
  }

  if (!['admin', 'manager', 'agent'].includes(role)) {
    return NextResponse.json(
      { message: 'Rôle invalide' },
      { status: 400 }
    );
  }

  const created = addUser({ name, email, role });
  return NextResponse.json({ success: true, user: created });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const userId = String(body?.userId || '');

  if (!userId) {
    return NextResponse.json(
      { message: 'userId requis' },
      { status: 400 }
    );
  }

  const updated = toggleUserActive(userId);
  if (!updated) {
    return NextResponse.json(
      { message: 'Utilisateur introuvable' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, user: updated });
}
