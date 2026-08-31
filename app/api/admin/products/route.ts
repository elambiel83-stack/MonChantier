import { NextRequest, NextResponse } from 'next/server';
import { createProduct, listProducts } from '@/lib/productStore';

export async function GET() {
  const products = await listProducts();
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fr = String(body?.fr || '').trim();
    const en = String(body?.en || '').trim();
    const unitFr = String(body?.unitFr || '').trim();
    const unitEn = String(body?.unitEn || '').trim();
    const img = String(body?.img || '').trim();
    const priceUSD = body?.priceUSD !== undefined && body.priceUSD !== '' ? Number(body.priceUSD) : null;
    const priceCDF = body?.priceCDF !== undefined && body.priceCDF !== '' ? Number(body.priceCDF) : null;

    if (!fr || !unitFr || !img) {
      return NextResponse.json({ message: 'Nom (FR), unité (FR) et image sont requis' }, { status: 400 });
    }
    if (priceUSD !== null && !Number.isFinite(priceUSD)) {
      return NextResponse.json({ message: 'Prix USD invalide' }, { status: 400 });
    }
    if (priceCDF !== null && !Number.isFinite(priceCDF)) {
      return NextResponse.json({ message: 'Prix CDF invalide' }, { status: 400 });
    }

    const product = await createProduct({
      fr,
      en: en || fr,
      unitFr,
      unitEn: unitEn || unitFr,
      priceUSD,
      priceCDF,
      img,
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Erreur création produit:', error);
    return NextResponse.json({ message: 'Erreur lors de la création du produit' }, { status: 500 });
  }
}
