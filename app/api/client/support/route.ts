import { NextResponse } from 'next/server';
import { createTicket, listTicketsByIdentity } from '@/lib/supportStore';
import { getSessionActor } from '@/lib/sessionIdentity';
import { isMailerConfigured, sendContactEmail } from '@/lib/mailer';

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

  const notifyTo = process.env.SUPPORT_NOTIFICATION_EMAIL || process.env.SMTP_TO;
  if (notifyTo && isMailerConfigured()) {
    try {
      await sendContactEmail({
        to: notifyTo,
        // Le tag [TCK-xxx] est préservé si le staff répond directement à cet
        // email : voir lib/inboundMail.ts, qui l'utilise pour rattacher la
        // réponse au bon ticket plutôt que d'en créer un nouveau.
        subject: `Nouveau ticket support: ${subject} [${ticket.id}]`,
        text: `De: ${actor.identity}\nSujet: ${subject}\n\n${message}`,
        replyTo: actor.identity.includes('@') ? actor.identity : undefined,
      });
    } catch (mailError) {
      console.error('Erreur notification nouveau ticket support:', mailError);
    }
  }

  return NextResponse.json({ success: true, ticket });
}
