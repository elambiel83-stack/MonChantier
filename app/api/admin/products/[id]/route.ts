import { NextRequest, NextResponse } from 'next/server';
import { deleteProduct, updateProduct, UpdateProductPatch } from '@/lib/productStore';
import { requireAdmin } from '@/lib/requireAdmin';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
    }

    const body = await request.json();
    const patch: UpdateProductPatch = {};

    if (typeof body?.fr === 'string') patch.fr = body.fr.trim();
    if (typeof body?.en === 'string') patch.en = body.en.trim();
    if (typeof body?.unitFr === 'string') patch.unitFr = body.unitFr.trim();
    if (typeof body?.unitEn === 'string') patch.unitEn = body.unitEn.trim();
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

    const product = await updateProduct(id, patch);
    if (!product) {
      return NextResponse.json({ message: 'Produit introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Erreur mise à jour produit:', error);
    return NextResponse.json({ message: 'Erreur lors de la mise à jour du produit' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
  }

  const deleted = await deleteProduct(id);
  if (!deleted) {
    return NextResponse.json({ message: 'Produit introuvable' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
