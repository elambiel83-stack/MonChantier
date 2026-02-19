import { NextResponse } from 'next/server';
import { getAdminStats } from '@/lib/adminStore';

export async function GET() {
  return NextResponse.json(getAdminStats());
}
