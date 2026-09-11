import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { buildSecurityDashboardSummary } from '@/lib/securityDashboard';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  return NextResponse.json(await buildSecurityDashboardSummary());
}
