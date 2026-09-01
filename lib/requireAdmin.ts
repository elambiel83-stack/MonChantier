import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from './requireRole';

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  return requireRole(request, ['admin']);
}
