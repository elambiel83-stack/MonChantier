import { NextRequest, NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { listProductsByOwner } from '@/lib/productStore';
import { listPromotions } from '@/lib/promotionStore';

export async function GET(_request: NextRequest) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
  if (actor.role !== 'supplier') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const products = await listProductsByOwner(actor.identity);
  const promotions = await listPromotions({
    itemType: 'product',
    itemIds: products.map((product) => product.id),
  });

  return NextResponse.json({ promotions });
}
