import { NextResponse } from 'next/server';
import { getSiteById, setSiteTaskDone } from '@/lib/siteStore';
import { canManageSite } from '@/lib/sitePermissions';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function PATCH(request: Request, { params }: { params: { id: string; taskId: string } }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const existing = await getSiteById(params.id);
  if (!existing) return NextResponse.json({ message: 'Chantier introuvable' }, { status: 404 });
  if (!canManageSite(actor, existing)) {
    return NextResponse.json({ message: 'Ce chantier ne vous appartient pas' }, { status: 403 });
  }

  const body = await request.json();
  const done = Boolean(body?.done);

  const site = await setSiteTaskDone(params.id, params.taskId, done);
  if (!site) return NextResponse.json({ message: 'Tâche introuvable' }, { status: 404 });

  return NextResponse.json({ success: true, site });
}
