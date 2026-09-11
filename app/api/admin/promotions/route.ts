import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { createPromotion, listPromotions, PromotionTargetType } from '@/lib/promotionStore';
import { getProduct } from '@/lib/productStore';
import { getService } from '@/lib/serviceStore';

async function targetExists(itemType: PromotionTargetType, itemId: number) {
  if (itemType === 'product') return Boolean(await getProduct(itemId));
  return Boolean(await getService(itemId));
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const promotions = await listPromotions();
  return NextResponse.json({ promotions });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const itemType = body?.itemType;
    const itemId = Number(body?.itemId);
    const label = typeof body?.label === 'string' ? body.label.trim() : '';
    const discountPercent = Number(body?.discountPercent);
    const startsAt = typeof body?.startsAt === 'string' && body.startsAt.trim() ? body.startsAt.trim() : null;
    const endsAt = typeof body?.endsAt === 'string' && body.endsAt.trim() ? body.endsAt.trim() : null;

    if (itemType !== 'product' && itemType !== 'service') {
      return NextResponse.json({ message: 'Type de cible invalide' }, { status: 400 });
    }
    if (!Number.isInteger(itemId) || itemId < 1) {
      return NextResponse.json({ message: 'Cible invalide' }, { status: 400 });
    }
    if (!label) {
      return NextResponse.json({ message: 'Libellé requis' }, { status: 400 });
    }
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent >= 100) {
      return NextResponse.json({ message: 'Remise invalide' }, { status: 400 });
    }
    if (startsAt && Number.isNaN(new Date(startsAt).getTime())) {
      return NextResponse.json({ message: 'Date de début invalide' }, { status: 400 });
    }
    if (endsAt && Number.isNaN(new Date(endsAt).getTime())) {
      return NextResponse.json({ message: 'Date de fin invalide' }, { status: 400 });
    }
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      return NextResponse.json({ message: 'La période est invalide' }, { status: 400 });
    }
    if (!(await targetExists(itemType, itemId))) {
      return NextResponse.json({ message: 'Cible introuvable' }, { status: 404 });
    }

    const promotion = await createPromotion({
      itemType,
      itemId,
      label,
      discountPercent,
      startsAt,
      endsAt,
      active: body?.active !== false,
    });
    return NextResponse.json({ success: true, promotion });
  } catch (error) {
    console.error('Erreur création promotion:', error);
    return NextResponse.json({ message: 'Erreur lors de la création de la promotion' }, { status: 500 });
  }
}
