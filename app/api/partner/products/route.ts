import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { createProduct, listProductsByOwner } from '@/lib/productStore';
import { validateSubmittedPrice } from '@/lib/partnerPricing';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
  if (actor.role !== 'supplier') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const products = await listProductsByOwner(actor.identity);
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    if (actor.role !== 'supplier') {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const fr = String(body?.fr || '').trim();
    const en = String(body?.en || '').trim();
    const unitFr = String(body?.unitFr || '').trim();
    const unitEn = String(body?.unitEn || '').trim();
    const img = String(body?.img || '').trim();
    const priceUSD = validateSubmittedPrice(body?.priceUSD);
    const priceCDF = validateSubmittedPrice(body?.priceCDF);

    if (!fr || !unitFr || !img) {
      return NextResponse.json({ message: 'Nom (FR), unité (FR) et image sont requis' }, { status: 400 });
    }
    if (body?.priceUSD !== undefined && body.priceUSD !== '' && priceUSD === null) {
      return NextResponse.json({ message: 'Prix USD invalide' }, { status: 400 });
    }
    if (body?.priceCDF !== undefined && body.priceCDF !== '' && priceCDF === null) {
      return NextResponse.json({ message: 'Prix CDF invalide' }, { status: 400 });
    }
    if (priceUSD === null && priceCDF === null) {
      return NextResponse.json({ message: 'Au moins un prix positif est requis' }, { status: 400 });
    }

    const product = await createProduct({
      fr,
      en: en || fr,
      unitFr,
      unitEn: unitEn || unitFr,
      priceUSD: null,
      priceCDF: null,
      submittedPriceUSD: priceUSD,
      submittedPriceCDF: priceCDF,
      pricingStatus: 'pending',
      active: false,
      img,
      ownerIdentity: actor.identity,
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Erreur création produit partenaire:', error);
    return NextResponse.json({ message: 'Erreur lors de la création du produit' }, { status: 500 });
  }
}
