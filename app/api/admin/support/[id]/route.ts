import { NextRequest, NextResponse } from 'next/server';
import { setTicketStatus, SupportTicketStatus } from '@/lib/supportStore';
import { requireAdmin } from '@/lib/requireAdmin';

const VALID_STATUSES: SupportTicketStatus[] = ['open', 'pending', 'closed'];

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json();
  const status = String(body?.status || '') as SupportTicketStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ message: 'Statut invalide' }, { status: 400 });
  }

  const ticket = await setTicketStatus(params.id, status);
  if (!ticket) {
    return NextResponse.json({ message: 'Ticket introuvable' }, { status: 404 });
  }

  return NextResponse.json({ success: true, ticket });
}
