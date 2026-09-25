import { NextResponse } from 'next/server';
import { addTicketMessage, getTicketById } from '@/lib/supportStore';
import { getSessionActor } from '@/lib/sessionIdentity';
import { isMailerConfigured, sendContactEmail } from '@/lib/mailer';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });

  const ticket = await getTicketById(params.id);
  if (!ticket) {
    return NextResponse.json({ message: 'Ticket introuvable' }, { status: 404 });
  }
  if (ticket.identity !== actor.identity) {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const body = await request.json();
  const message = String(body?.message || '').trim();
  if (!message) {
    return NextResponse.json({ message: 'Message requis' }, { status: 400 });
  }

  const result = await addTicketMessage({
    id: params.id,
    from: 'client',
    authorIdentity: actor.identity,
    message,
  });
  if (!result.success) {
    return NextResponse.json({ message: 'Ticket introuvable' }, { status: 404 });
  }

  const notifyTo = process.env.SUPPORT_NOTIFICATION_EMAIL || process.env.SMTP_TO;
  if (notifyTo && isMailerConfigured()) {
    try {
      await sendContactEmail({
        to: notifyTo,
        // Tag préservé si le staff répond directement à cet email — voir
        // lib/inboundMail.ts.
        subject: `Nouveau message sur le ticket support: ${ticket.subject} [${ticket.id}]`,
        text: `De: ${actor.identity}\nTicket: ${ticket.subject} (${ticket.id})\n\n${message}`,
        replyTo: actor.identity.includes('@') ? actor.identity : undefined,
      });
    } catch (mailError) {
      console.error('Erreur notification message ticket support:', mailError);
    }
  }

  return NextResponse.json({ success: true, ticket: result.ticket });
}
