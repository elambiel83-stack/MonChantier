import { NextRequest, NextResponse } from 'next/server';
import { listAllTickets } from '@/lib/supportStore';
import { requireAdmin } from '@/lib/requireAdmin';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const tickets = await listAllTickets();
  return NextResponse.json({ tickets });
}
