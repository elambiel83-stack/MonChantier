import { NextResponse } from 'next/server';
import { listServices } from '@/lib/serviceStore';

// Le catalogue vit en base et change à tout moment via /api/admin/services :
// une réponse mise en cache statique au build figerait les prix/stock pour
// toute la durée de vie du déploiement.
export const dynamic = 'force-dynamic';

export async function GET() {
  const services = await listServices({ activeOnly: true });
  return NextResponse.json({ services });
}
