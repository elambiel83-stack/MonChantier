import { NextRequest, NextResponse } from 'next/server';
import { listProducts } from '@/lib/productStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('ids') ?? '';
  const parts = raw.split(',');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^[1-9]\d*$/.test(part))) {
    return NextResponse.json({ error: 'Sélectionnez deux ou trois identifiants valides.' }, { status: 400 });
  }
  const ids = parts.map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id)) || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'Identifiants invalides ou répétés.' }, { status: 400 });
  }
  const catalog = await listProducts({ activeOnly: true });
  const byId = new Map(catalog.map((p) => [p.id, p]));
  if (ids.some((id) => !byId.has(id))) {
    return NextResponse.json({ error: 'Produit indisponible.' }, { status: 404 });
  }
  const products = ids.map((id) => {
    const p = byId.get(id)!;
    return {
      id: p.id, fr: p.fr, en: p.en, category: p.category,
      priceUSD: p.priceUSD, priceCDF: p.priceCDF, stock: p.stock,
      // Aucune caractéristique technique non vérifiée n'est inventée.
      technicalSpecs: p.technicalSpecsVerified ? (p.technicalSpecs ?? {}) : {},
    };
  });
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
}
