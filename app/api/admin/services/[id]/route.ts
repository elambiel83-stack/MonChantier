import { NextRequest, NextResponse } from 'next/server';
import { deleteService, getService, updateService, UpdateServicePatch } from '@/lib/serviceStore';
import { requireAdmin } from '@/lib/requireAdmin';
import { calculateSellingPrice, hasSubmittedPrice, validateFeePercent } from '@/lib/partnerPricing';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
    }

    const body = await request.json();
    const patch: UpdateServicePatch = {};
    const existing = await getService(id);
    if (!existing) return NextResponse.json({ message: 'Service introuvable' }, { status: 404 });

    if (typeof body?.icon === 'string') patch.icon = body.icon.trim();
    if (typeof body?.fr === 'string') patch.fr = body.fr.trim();
    if (typeof body?.en === 'string') patch.en = body.en.trim();
    if (typeof body?.frDesc === 'string') patch.frDesc = body.frDesc.trim();
    if (typeof body?.enDesc === 'string') patch.enDesc = body.enDesc.trim();
    if (typeof body?.img === 'string') patch.img = body.img.trim();
    if (typeof body?.active === 'boolean') {
      if (existing.ownerIdentity && body.active && existing.pricingStatus !== 'approved') {
        return NextResponse.json({ message: 'Une offre partenaire doit être approuvée avant activation' }, { status: 400 });
      }
      patch.active = body.active;
    }
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
    if (body?.pricingStatus !== undefined) {
      if (!existing.ownerIdentity || !['approved', 'rejected', 'pending'].includes(body.pricingStatus)) {
        return NextResponse.json({ message: 'Décision de tarification invalide' }, { status: 400 });
      }
      const fee = validateFeePercent(body.platformFeePercent);
      if (body.pricingStatus === 'approved' && fee === null) {
        return NextResponse.json({ message: 'Pourcentage MonChantier requis entre 0 et 100' }, { status: 400 });
      }
      if (body.pricingStatus === 'approved' && !hasSubmittedPrice(existing.submittedPriceUSD, existing.submittedPriceCDF)) {
        return NextResponse.json({ message: 'Au moins un prix partenaire positif est requis' }, { status: 400 });
      }
      patch.pricingStatus = body.pricingStatus;
      patch.platformFeePercent = fee ?? existing.platformFeePercent;
      patch.active = body.pricingStatus === 'approved';
      patch.priceUSD = body.pricingStatus === 'approved' ? calculateSellingPrice(existing.submittedPriceUSD, fee!) : null;
      patch.priceCDF = body.pricingStatus === 'approved' ? calculateSellingPrice(existing.submittedPriceCDF, fee!) : null;
    }

    const service = await updateService(id, patch);
    if (!service) {
      return NextResponse.json({ message: 'Service introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, service });
  } catch (error) {
    console.error('Erreur mise à jour service:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour du service' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
  }

  const deleted = await deleteService(id);
  if (!deleted) {
    return NextResponse.json({ message: 'Service introuvable' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
