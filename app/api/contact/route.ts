import { NextRequest, NextResponse } from 'next/server';
import { recordContact } from '@/lib/adminStore';
import { isMailerConfigured, sendContactEmail } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message, lang, services } = body;
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    const selectedServices = Array.isArray(services) ? services : [];
    const hasRequestedServices = selectedServices.length > 0;
    const servicesSummary =
      hasRequestedServices
        ? selectedServices.join(', ')
        : lang === 'fr'
          ? 'Aucun service sélectionné'
          : 'No service selected';
    const normalizedMessage =
      cleanMessage ||
      (lang === 'fr'
        ? 'Demande de devis sans message additionnel.'
        : 'Quote request without additional message.');
    const fullMessage = `${normalizedMessage}\n\n${
      lang === 'fr' ? 'Services demandés' : 'Requested services'
    }: ${servicesSummary}`;

    // Validation basique
    if (!cleanName || !cleanEmail || (!cleanMessage && !hasRequestedServices)) {
      return NextResponse.json(
        {
          message:
            lang === 'fr'
              ? 'Nom, email, et au moins un message ou service sont requis.'
              : 'Name, email, and at least a message or one service are required.',
        },
        { status: 400 }
      );
    }

    // Simulation d'envoi (en production: envoyer email via SendGrid, Resend, etc.)
    console.log('=== NOUVEAU MESSAGE DE CONTACT ===');
    console.log('Nom:', cleanName);
    console.log('Email:', cleanEmail);
    console.log('Téléphone:', cleanPhone);
    console.log('Services demandés:', servicesSummary);
    console.log('Message:', fullMessage);
    console.log('================================');

    if (!isMailerConfigured()) {
      return NextResponse.json(
        {
          message:
            lang === 'fr'
              ? 'Email non configuré côté serveur. Renseignez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_TO.'
              : 'Email is not configured on the server. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_TO.',
        },
        { status: 500 }
      );
    }

    const emailTo = process.env.QUOTE_REQUEST_TO || process.env.SMTP_TO;
    if (!emailTo) {
      return NextResponse.json(
        {
          message:
            lang === 'fr'
              ? 'Variable QUOTE_REQUEST_TO (ou SMTP_TO) manquante pour la réception des devis.'
              : 'Missing QUOTE_REQUEST_TO (or SMTP_TO) variable for quote recipient.',
        },
        { status: 500 }
      );
    }

    const subject =
      lang === 'fr'
        ? `Nouvelle demande de devis - ${cleanName}`
        : `New quote request - ${cleanName}`;

    const mailText = [
      `Nom: ${cleanName}`,
      `Email: ${cleanEmail}`,
      `Téléphone: ${cleanPhone || 'Non renseigné'}`,
      '',
      fullMessage,
    ].join('\n');

    recordContact({ name: cleanName, email: cleanEmail });

    let emailDelivered = true;
    try {
      await sendContactEmail({
        to: emailTo,
        subject,
        text: mailText,
        replyTo: cleanEmail,
      });
    } catch (mailError) {
      emailDelivered = false;
      console.error('Erreur SMTP (devis):', mailError);
    }

    return NextResponse.json({
      success: true,
      emailDelivered,
      message: emailDelivered
        ? lang === 'fr'
          ? 'Message envoyé avec succès! Nous vous répondrons dans les 24h.'
          : 'Message sent successfully! We will respond within 24h.'
        : lang === 'fr'
          ? 'Demande enregistrée. Un souci temporaire empêche l\'envoi email automatique.'
          : 'Request saved. A temporary issue is preventing automatic email delivery.',
    });
  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json(
      { message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
