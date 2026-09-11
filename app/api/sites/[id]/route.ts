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
    if (Array.isArray(body?.materials)) {
      patch.materials = body.materials
        .filter((m: unknown) => m && typeof m === 'object')
        .map((m: { id?: string; name?: string; unit?: string; quantity?: unknown; note?: string; updatedAt?: string }) => ({
          id: String(m.id || '').trim(),
          name: String(m.name || '').trim(),
          unit: String(m.unit || '').trim() || 'unité',
          quantity: Number(m.quantity || 0),
          note: String(m.note || '').trim() || undefined,
          updatedAt: String(m.updatedAt || '').trim() || new Date().toISOString(),
        }))
        .filter((m: { id: string; name: string; quantity: number }) => m.id && m.name && Number.isFinite(m.quantity));
    }
    if (Array.isArray(body?.documents)) {
      patch.documents = body.documents
        .filter((d: unknown) => d && typeof d === 'object')
        .map((d: { id?: string; name?: string; url?: string; category?: string; createdAt?: string }) => ({
          id: String(d.id || '').trim(),
          name: String(d.name || '').trim(),
          url: String(d.url || '').trim(),
          category: String(d.category || '').trim() || 'document',
          createdAt: String(d.createdAt || '').trim() || new Date().toISOString(),
        }))
        .filter((d: { id: string; name: string; url: string }) => d.id && d.name && d.url);
    }
    if (Array.isArray(body?.photos)) {
      patch.photos = body.photos
        .filter((p: unknown) => p && typeof p === 'object')
        .map((p: { id?: string; name?: string; url?: string; createdAt?: string }) => ({
          id: String(p.id || '').trim(),
          name: String(p.name || '').trim(),
          url: String(p.url || '').trim(),
          createdAt: String(p.createdAt || '').trim() || new Date().toISOString(),
        }))
        .filter((p: { id: string; name: string; url: string }) => p.id && p.name && p.url);
    }

    const site = await updateSite(params.id, patch);
    if (!site) return NextResponse.json({ message: 'Chantier introuvable' }, { status: 404 });

    return NextResponse.json({ success: true, site });
  } catch (error) {
    console.error('Erreur mise à jour chantier:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour du chantier' }, { status: 500 });
  }
}
