import { NextResponse } from 'next/server';
import { createTicket, listTicketsByIdentity } from '@/lib/supportStore';
import { getSessionActor } from '@/lib/sessionIdentity';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const tickets = await listTicketsByIdentity(actor.identity);
  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const body = await request.json();
  const subject = String(body?.subject || '').trim();
  const message = String(body?.message || '').trim();
  if (!subject || !message) {
    return NextResponse.json({ message: 'Sujet et message sont requis' }, { status: 400 });
  }

  const ticket = await createTicket({ identity: actor.identity, subject, message });
  return NextResponse.json({ success: true, ticket });
}
