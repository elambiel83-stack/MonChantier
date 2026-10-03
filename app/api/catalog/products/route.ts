import { NextRequest, NextResponse } from 'next/server';
import { listProducts, type StoredProduct } from '@/lib/productStore';

// Le catalogue change à tout moment via /api/admin/products : ne pas figer
// les prix ou le stock dans le cache statique du build.
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;
const AVAILABILITY = new Set(['all', 'priced', 'quote']);
const SORTS = new Set(['default', 'price-asc', 'price-desc']);

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function publicProduct(product: StoredProduct) {
  const {
    ownerIdentity: _ownerIdentity,
    submittedPriceUSD: _submittedPriceUSD,
    submittedPriceCDF: _submittedPriceCDF,
    platformFeePercent: _platformFeePercent,
    pricingStatus: _pricingStatus,
    ...publicFields
  } = product;
  return publicFields;
}

function comparablePrice(product: StoredProduct): number | null {
  return product.priceUSD ?? product.priceCDF ?? null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get('q')?.trim() ?? '';
  const category = params.get('category')?.trim() || 'all';
  const availability = params.get('availability')?.trim() || 'all';
  const sort = params.get('sort')?.trim() || 'default';

  const pageRaw = Number.parseInt(params.get('page') || '1', 10);
  const limitRaw = Number.parseInt(params.get('limit') || String(DEFAULT_LIMIT), 10);
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) ? Math.min(MAX_LIMIT, Math.max(1, limitRaw)) : DEFAULT_LIMIT;

  if (!AVAILABILITY.has(availability)) {
    return NextResponse.json({ message: 'Filtre de disponibilité invalide' }, { status: 400 });
  }
  if (!SORTS.has(sort)) {
    return NextResponse.json({ message: 'Tri invalide' }, { status: 400 });
  }

  const products = await listProducts({ activeOnly: true });
  const normalizedQuery = normalize(q);

  let filtered = products
    .filter((product) => category === 'all' || product.category === category)
    .filter((product) => {
      if (availability === 'all') return true;
      const hasPrice = product.priceUSD !== null || product.priceCDF !== null;
      return availability === 'priced' ? hasPrice : !hasPrice;
    })
    .filter((product) => {
      if (!normalizedQuery) return true;
      return normalize(`${product.fr} ${product.en}`).includes(normalizedQuery);
    });

  if (sort !== 'default') {
    filtered = [...filtered].sort((a, b) => {
      const priceA = comparablePrice(a);
      const priceB = comparablePrice(b);
      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      return sort === 'price-asc' ? priceA - priceB : priceB - priceA;
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const publicProducts = filtered.slice(offset, offset + limit).map(publicProduct);

  return NextResponse.json({
    products: publicProducts,
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  });
}
