import { NextResponse } from 'next/server';
import { applyCatalogPromotions } from '@/lib/catalogPromotions';
import { listPromotions } from '@/lib/promotionStore';
import { listServices } from '@/lib/serviceStore';

export async function GET() {
  const services = await listServices({ activeOnly: true });
  const promotions = await listPromotions({
    activeOnly: true,
    itemType: 'service',
    itemIds: services.map((service) => service.id),
  });
  return NextResponse.json({ services: applyCatalogPromotions(services, promotions, 'service') });
}
