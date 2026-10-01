import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { createService, listServicesByOwner } from '@/lib/serviceStore';
import { validateSubmittedPrice } from '@/lib/partnerPricing';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
  if (actor.role !== 'technician') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const services = await listServicesByOwner(actor.identity);
  return NextResponse.json({ services });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getSessionActor();
    if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    if (actor.role !== 'technician') {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const icon = String(body?.icon || '🔧').trim();
    const fr = String(body?.fr || '').trim();
    const en = String(body?.en || '').trim();
    const frDesc = String(body?.frDesc || '').trim();
    const enDesc = String(body?.enDesc || '').trim();
    const img = String(body?.img || '/images/services/autres-services.svg').trim();
    const priceUSD = validateSubmittedPrice(body?.priceUSD);
    const priceCDF = validateSubmittedPrice(body?.priceCDF);

    if (!fr || !frDesc) {
      return NextResponse.json({ message: 'Nom (FR) et description (FR) sont requis' }, { status: 400 });
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

    const service = await createService({
      icon,
      fr,
      en: en || fr,
      frDesc,
      enDesc: enDesc || frDesc,
      img,
      priceUSD: null,
      priceCDF: null,
      submittedPriceUSD: priceUSD,
      submittedPriceCDF: priceCDF,
      pricingStatus: 'pending',
      active: false,
      ownerIdentity: actor.identity,
    });

    return NextResponse.json({ success: true, service });
  } catch (error) {
    console.error('Erreur création service partenaire:', error);
    return NextResponse.json({ message: 'Erreur lors de la création du service' }, { status: 500 });
  }
}
