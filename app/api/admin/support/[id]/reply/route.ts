import { NextRequest, NextResponse } from 'next/server';
import { addTicketMessage } from '@/lib/supportStore';
import { requireAdmin } from '@/lib/requireAdmin';
import { getSessionActor } from '@/lib/sessionIdentity';
import { isMailerConfigured, sendContactEmail } from '@/lib/mailer';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });

  const body = await request.json();
  const message = String(body?.message || '').trim();
  if (!message) {
    return NextResponse.json({ message: 'Message requis' }, { status: 400 });
  }

  const result = await addTicketMessage({
    id: params.id,
    from: 'staff',
    authorIdentity: actor.identity,
    message,
  });

  if (!result.success) {
    const status = result.error === 'not_found' ? 404 : 400;
    const errorMessage =
      result.error === 'not_found'
        ? 'Ticket introuvable'
        : 'Ticket clos : rouvrez-le avant de répondre';
    return NextResponse.json({ message: errorMessage }, { status });
  }

  if (result.ticket.identity.includes('@') && isMailerConfigured()) {
    try {
      await sendContactEmail({
        to: result.ticket.identity,
        // Tag préservé si le client répond directement à cet email — voir
        // lib/inboundMail.ts.
        subject: `Réponse à votre ticket support: ${result.ticket.subject} [${result.ticket.id}]`,
        text: `Bonjour,\n\nNotre équipe a répondu à votre ticket "${result.ticket.subject}":\n\n${message}\n\nMonChantier`,
      });
    } catch (mailError) {
      console.error('Erreur envoi email réponse support:', mailError);
    }
  }

  return NextResponse.json({ success: true, ticket: result.ticket });
}
