import { NextRequest, NextResponse } from 'next/server';
import { getAdminStats } from '@/lib/adminStore';
import { requireAdmin } from '@/lib/requireAdmin';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  return NextResponse.json(getAdminStats());
}
