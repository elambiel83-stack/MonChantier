import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/productStore';

// Le catalogue vit en base et change à tout moment via /api/admin/products :
// une réponse mise en cache statique au build figerait les prix/stock pour
// toute la durée de vie du déploiement.
export const dynamic = 'force-dynamic';

export async function GET() {
  const products = await listProducts({ activeOnly: true });
  return NextResponse.json({ products });
}
