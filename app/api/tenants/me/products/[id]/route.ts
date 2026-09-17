import { NextResponse } from 'next/server';
import { getTenantActor } from '@/lib/tenantSessionIdentity';
import { deleteTenantProduct, updateTenantProduct, UpdateTenantProductPatch } from '@/lib/tenantCatalogStore';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const actor = await getTenantActor();
  if (!actor) return NextResponse.json({ message: 'Aucun tenant associé à ce compte' }, { status: 401 });
  if (actor.tenantRole === 'member') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
  }

  const body = await request.json();
  const patch: UpdateTenantProductPatch = {};

  if (typeof body?.name === 'string') patch.name = body.name.trim();
  if (typeof body?.active === 'boolean') patch.active = body.active;
  if (body?.priceCents !== undefined) {
    patch.priceCents = Number(body.priceCents);
    if (!Number.isFinite(patch.priceCents) || patch.priceCents < 0) {
      return NextResponse.json({ message: 'Prix invalide' }, { status: 400 });
    }
  }
  if (body?.currency !== undefined) {
    patch.currency = String(body.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(patch.currency)) {
      return NextResponse.json({ message: 'Devise invalide' }, { status: 400 });
    }
  }
  if (body?.stock !== undefined) {
    patch.stock = body.stock === null ? null : Number(body.stock);
    if (patch.stock !== null && (!Number.isFinite(patch.stock) || patch.stock < 0)) {
      return NextResponse.json({ message: 'Stock invalide' }, { status: 400 });
    }
  }

  const product = await updateTenantProduct(actor.tenantId, productId, patch);
  if (!product) return NextResponse.json({ message: 'Produit introuvable' }, { status: 404 });

  return NextResponse.json({ success: true, product });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const actor = await getTenantActor();
  if (!actor) return NextResponse.json({ message: 'Aucun tenant associé à ce compte' }, { status: 401 });
  if (actor.tenantRole === 'member') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ message: 'Identifiant invalide' }, { status: 400 });
  }

  const deleted = await deleteTenantProduct(actor.tenantId, productId);
  if (!deleted) return NextResponse.json({ message: 'Produit introuvable' }, { status: 404 });

  return NextResponse.json({ success: true });
}
