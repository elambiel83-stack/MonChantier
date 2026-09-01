import { NextResponse } from 'next/server';
import { createSite, listAllSites, listSitesByManager } from '@/lib/siteStore';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor || (actor.role !== 'site-manager' && actor.role !== 'admin')) {
    return NextResponse.json({ message: 'Accès non autorisé' }, { status: 403 });
  }

  const sites = actor.role === 'admin' ? await listAllSites() : await listSitesByManager(actor.identity);
  return NextResponse.json({ sites });
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || (actor.role !== 'site-manager' && actor.role !== 'admin')) {
    return NextResponse.json({ message: 'Accès non autorisé' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const address = String(body?.address || '').trim();
    const clientIdentity = typeof body?.clientIdentity === 'string' ? body.clientIdentity.trim() : undefined;
    const budget = body?.budget !== undefined && body.budget !== '' ? Number(body.budget) : undefined;
    const currency = body?.currency === 'USD' || body?.currency === 'CDF' ? body.currency : undefined;
    const siteManagerIdentity =
      actor.role === 'admin' && typeof body?.siteManagerIdentity === 'string' && body.siteManagerIdentity.trim()
        ? body.siteManagerIdentity.trim()
        : actor.identity;

    if (!name || !address) {
      return NextResponse.json({ message: 'Nom et adresse sont requis' }, { status: 400 });
    }
    if (budget !== undefined && !Number.isFinite(budget)) {
      return NextResponse.json({ message: 'Budget invalide' }, { status: 400 });
    }

    const site = await createSite({ name, address, clientIdentity, siteManagerIdentity, budget, currency });
    return NextResponse.json({ success: true, site });
  } catch (error) {
    console.error('Erreur création chantier:', error);
    return NextResponse.json({ message: 'Erreur lors de la création du chantier' }, { status: 500 });
  }
}
