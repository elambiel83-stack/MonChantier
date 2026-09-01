import { NextResponse } from 'next/server';
import { getSiteById, updateSite, UpdateSitePatch } from '@/lib/siteStore';
import { canManageSite } from '@/lib/sitePermissions';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const site = await getSiteById(params.id);
  if (!site) return NextResponse.json({ message: 'Chantier introuvable' }, { status: 404 });
  if (!canManageSite(actor, site)) {
    return NextResponse.json({ message: 'Ce chantier ne vous appartient pas' }, { status: 403 });
  }

  return NextResponse.json({ site });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const existing = await getSiteById(params.id);
  if (!existing) return NextResponse.json({ message: 'Chantier introuvable' }, { status: 404 });
  if (!canManageSite(actor, existing)) {
    return NextResponse.json({ message: 'Ce chantier ne vous appartient pas' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const patch: UpdateSitePatch = {};

    if (typeof body?.name === 'string') patch.name = body.name.trim();
    if (typeof body?.address === 'string') patch.address = body.address.trim();
    if (['planning', 'active', 'paused', 'completed'].includes(body?.status)) patch.status = body.status;
    if (body?.currency === 'USD' || body?.currency === 'CDF') patch.currency = body.currency;
    if (body?.budget !== undefined) {
      const budget = body.budget === null || body.budget === '' ? undefined : Number(body.budget);
      if (budget !== undefined && !Number.isFinite(budget)) {
        return NextResponse.json({ message: 'Budget invalide' }, { status: 400 });
      }
      patch.budget = budget;
    }
    if (Array.isArray(body?.team)) {
      patch.team = body.team
        .filter((m: unknown) => m && typeof m === 'object')
        .map((m: { identity?: string; name?: string; role?: string }) => ({
          identity: String(m.identity || '').trim(),
          name: String(m.name || '').trim(),
          role: String(m.role || '').trim(),
        }))
        .filter((m: { identity: string }) => m.identity);
    }

    const site = await updateSite(params.id, patch);
    if (!site) return NextResponse.json({ message: 'Chantier introuvable' }, { status: 404 });

    return NextResponse.json({ success: true, site });
  } catch (error) {
    console.error('Erreur mise à jour chantier:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour du chantier' }, { status: 500 });
  }
}
