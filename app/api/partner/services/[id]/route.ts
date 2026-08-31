import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { getService, updateService, UpdateServicePatch } from '@/lib/serviceStore';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    if (actor.role !== 'technician') {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
    }

    const existing = await getService(id);
    if (!existing) {
      return NextResponse.json({ message: 'Service introuvable' }, { status: 404 });
    }
    if (existing.ownerIdentity !== actor.identity) {
      return NextResponse.json({ message: 'Ce service ne vous appartient pas' }, { status: 403 });
    }

    const body = await request.json();
    const patch: UpdateServicePatch = {};

    if (typeof body?.icon === 'string') patch.icon = body.icon.trim();
    if (typeof body?.fr === 'string') patch.fr = body.fr.trim();
    if (typeof body?.en === 'string') patch.en = body.en.trim();
    if (typeof body?.frDesc === 'string') patch.frDesc = body.frDesc.trim();
    if (typeof body?.enDesc === 'string') patch.enDesc = body.enDesc.trim();
    if (typeof body?.img === 'string') patch.img = body.img.trim();
    if (typeof body?.active === 'boolean') patch.active = body.active;
    if (body?.priceUSD !== undefined) {
      patch.priceUSD = body.priceUSD === null || body.priceUSD === '' ? null : Number(body.priceUSD);
      if (patch.priceUSD !== null && !Number.isFinite(patch.priceUSD)) {
        return NextResponse.json({ message: 'Prix USD invalide' }, { status: 400 });
      }
    }
    if (body?.priceCDF !== undefined) {
      patch.priceCDF = body.priceCDF === null || body.priceCDF === '' ? null : Number(body.priceCDF);
      if (patch.priceCDF !== null && !Number.isFinite(patch.priceCDF)) {
        return NextResponse.json({ message: 'Prix CDF invalide' }, { status: 400 });
      }
    }

    const service = await updateService(id, patch);
    return NextResponse.json({ success: true, service });
  } catch (error) {
    console.error('Erreur mise à jour service partenaire:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour du service' }, { status: 500 });
  }
}
