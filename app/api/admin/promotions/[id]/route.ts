import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { deletePromotion, getPromotion, updatePromotion, UpdatePromotionPatch } from '@/lib/promotionStore';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
    }

    const existing = await getPromotion(id);
    if (!existing) {
      return NextResponse.json({ message: 'Promotion introuvable' }, { status: 404 });
    }

    const body = await request.json();
    const patch: UpdatePromotionPatch = {};

    if (typeof body?.label === 'string') {
      const label = body.label.trim();
      if (!label) return NextResponse.json({ message: 'Libellé requis' }, { status: 400 });
      patch.label = label;
    }
    if (typeof body?.active === 'boolean') patch.active = body.active;
    if (body?.discountPercent !== undefined) {
      const discountPercent = Number(body.discountPercent);
      if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent >= 100) {
        return NextResponse.json({ message: 'Remise invalide' }, { status: 400 });
      }
      patch.discountPercent = discountPercent;
    }
    if (body?.startsAt !== undefined) {
      if (body.startsAt !== null && body.startsAt !== '' && Number.isNaN(new Date(body.startsAt).getTime())) {
        return NextResponse.json({ message: 'Date de début invalide' }, { status: 400 });
      }
      patch.startsAt = body.startsAt ? String(body.startsAt).trim() : null;
    }
    if (body?.endsAt !== undefined) {
      if (body.endsAt !== null && body.endsAt !== '' && Number.isNaN(new Date(body.endsAt).getTime())) {
        return NextResponse.json({ message: 'Date de fin invalide' }, { status: 400 });
      }
      patch.endsAt = body.endsAt ? String(body.endsAt).trim() : null;
    }

    const startsAt = patch.startsAt !== undefined ? patch.startsAt : existing.startsAt;
    const endsAt = patch.endsAt !== undefined ? patch.endsAt : existing.endsAt;
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      return NextResponse.json({ message: 'La période est invalide' }, { status: 400 });
    }

    const promotion = await updatePromotion(id, patch);
    return NextResponse.json({ success: true, promotion });
  } catch (error) {
    console.error('Erreur mise à jour promotion:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour de la promotion' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
  }

  const deleted = await deletePromotion(id);
  if (!deleted) {
    return NextResponse.json({ message: 'Promotion introuvable' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
