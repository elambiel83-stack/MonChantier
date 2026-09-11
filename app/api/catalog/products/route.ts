import { NextResponse } from 'next/server';
import { applyCatalogPromotions } from '@/lib/catalogPromotions';
import { listPromotions } from '@/lib/promotionStore';
import { listProducts } from '@/lib/productStore';

export async function GET() {
  const products = await listProducts({ activeOnly: true });
  const promotions = await listPromotions({
    activeOnly: true,
    itemType: 'product',
    itemIds: products.map((product) => product.id),
  });
  return NextResponse.json({ products: applyCatalogPromotions(products, promotions, 'product') });
}
