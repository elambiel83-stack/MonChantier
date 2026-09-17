import { NextResponse } from 'next/server';
import { getTenantActor } from '@/lib/tenantSessionIdentity';
import { createTenantProduct, listTenantProducts } from '@/lib/tenantCatalogStore';
import { assertWithinProductLimit } from '@/lib/tenantBilling';

export async function GET() {
  const actor = await getTenantActor();
  if (!actor) return NextResponse.json({ message: 'Aucun tenant associé à ce compte' }, { status: 401 });

  const products = await listTenantProducts(actor.tenantId);
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const actor = await getTenantActor();
  if (!actor) return NextResponse.json({ message: 'Aucun tenant associé à ce compte' }, { status: 401 });
  if (actor.tenantRole === 'member') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const limitCheck = await assertWithinProductLimit(actor.tenantId);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { message: `Limite du plan atteinte (${limitCheck.limit} produits max). Passez à un plan supérieur pour en ajouter.` },
      { status: 402 }
    );
  }

  const body = await request.json();
  const name = String(body?.name || '').trim();
  const priceCents = Number(body?.priceCents);
  const currency = String(body?.currency || '').trim().toUpperCase();
  const stock = body?.stock !== undefined && body.stock !== null ? Number(body.stock) : null;

  if (!name || !Number.isFinite(priceCents) || priceCents < 0 || !/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ message: 'Nom, prix et devise (3 lettres) valides requis' }, { status: 400 });
  }
  if (stock !== null && (!Number.isFinite(stock) || stock < 0)) {
    return NextResponse.json({ message: 'Stock invalide' }, { status: 400 });
  }

  const product = await createTenantProduct(actor.tenantId, { name, priceCents, currency, stock });
  return NextResponse.json({ success: true, product });
}
