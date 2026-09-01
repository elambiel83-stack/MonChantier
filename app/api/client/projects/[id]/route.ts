import { NextResponse } from 'next/server';
import { deleteProject, updateProjectStatus } from '@/lib/projectStore';
import { getSessionActor } from '@/lib/sessionIdentity';

const VALID_STATUSES = ['planning', 'in_progress', 'completed'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const body = await request.json();
  if (!VALID_STATUSES.includes(body?.status)) {
    return NextResponse.json({ message: 'Statut invalide' }, { status: 400 });
  }

  const projects = await updateProjectStatus(actor.identity, params.id, body.status);
  return NextResponse.json({ success: true, projects });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const projects = await deleteProject(actor.identity, params.id);
  return NextResponse.json({ success: true, projects });
}
