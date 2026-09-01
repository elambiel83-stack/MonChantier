import { NextResponse } from 'next/server';
import { addSiteTask, getSiteById } from '@/lib/siteStore';
import { canManageSite } from '@/lib/sitePermissions';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const existing = await getSiteById(params.id);
  if (!existing) return NextResponse.json({ message: 'Chantier introuvable' }, { status: 404 });
  if (!canManageSite(actor, existing)) {
    return NextResponse.json({ message: 'Ce chantier ne vous appartient pas' }, { status: 403 });
  }

  const body = await request.json();
  const label = String(body?.label || '').trim();
  const dueDate = typeof body?.dueDate === 'string' && body.dueDate ? body.dueDate : undefined;
  if (!label) return NextResponse.json({ message: 'Libellé requis' }, { status: 400 });

  const site = await addSiteTask(params.id, label, dueDate);
  return NextResponse.json({ success: true, site });
}
