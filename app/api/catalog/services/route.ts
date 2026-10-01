import { NextResponse } from 'next/server';
import { listServices } from '@/lib/serviceStore';

// Le catalogue vit en base et change à tout moment via /api/admin/services :
// une réponse mise en cache statique au build figerait les prix/stock pour
// toute la durée de vie du déploiement.
export const dynamic = 'force-dynamic';

export async function GET() {
  const services = await listServices({ activeOnly: true });
  const publicServices = services.map(({ ownerIdentity: _ownerIdentity, submittedPriceUSD: _submittedPriceUSD, submittedPriceCDF: _submittedPriceCDF, platformFeePercent: _platformFeePercent, pricingStatus: _pricingStatus, ...service }) => service);
  return NextResponse.json({ services: publicServices });
}
