import { NextResponse } from 'next/server';
import { getSiteById, resolveSiteIncident } from '@/lib/siteStore';
import { canManageSite } from '@/lib/sitePermissions';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function PATCH(_request: Request, { params }: { params: { id: string; incidentId: string } }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const existing = await getSiteById(params.id);
  if (!existing) return NextResponse.json({ message: 'Chantier introuvable' }, { status: 404 });
  if (!canManageSite(actor, existing)) {
    return NextResponse.json({ message: 'Ce chantier ne vous appartient pas' }, { status: 403 });
  }

  const site = await resolveSiteIncident(params.id, params.incidentId);
  if (!site) return NextResponse.json({ message: 'Incident introuvable' }, { status: 404 });

  return NextResponse.json({ success: true, site });
}
