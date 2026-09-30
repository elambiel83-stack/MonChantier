import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { getProduct, updateProduct, UpdateProductPatch } from '@/lib/productStore';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    if (actor.role !== 'supplier') {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
    }

    const existing = await getProduct(id);
    if (!existing) {
      return NextResponse.json({ message: 'Produit introuvable' }, { status: 404 });
    }
    if (existing.ownerIdentity !== actor.identity) {
      return NextResponse.json({ message: 'Ce produit ne vous appartient pas' }, { status: 403 });
    }

    const body = await request.json();
    const patch: UpdateProductPatch = {};

    if (typeof body?.fr === 'string') patch.fr = body.fr.trim();
    if (typeof body?.en === 'string') patch.en = body.en.trim();
    if (typeof body?.unitFr === 'string') patch.unitFr = body.unitFr.trim();
    if (typeof body?.unitEn === 'string') patch.unitEn = body.unitEn.trim();
    if (typeof body?.img === 'string') patch.img = body.img.trim();
    if (body?.priceUSD !== undefined) {
      patch.submittedPriceUSD = body.priceUSD === null || body.priceUSD === '' ? null : Number(body.priceUSD);
      if (patch.submittedPriceUSD !== null && !Number.isFinite(patch.submittedPriceUSD)) {
        return NextResponse.json({ message: 'Prix USD invalide' }, { status: 400 });
      }
    }
    if (body?.priceCDF !== undefined) {
      patch.submittedPriceCDF = body.priceCDF === null || body.priceCDF === '' ? null : Number(body.priceCDF);
      if (patch.submittedPriceCDF !== null && !Number.isFinite(patch.submittedPriceCDF)) {
        return NextResponse.json({ message: 'Prix CDF invalide' }, { status: 400 });
      }
    }
    // Toute modification d'une offre partenaire repasse par la validation centrale.
    patch.priceUSD = null;
    patch.priceCDF = null;
    patch.pricingStatus = 'pending';
    patch.active = false;

    const product = await updateProduct(id, patch);
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Erreur mise à jour produit partenaire:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour du produit' }, { status: 500 });
  }
}
