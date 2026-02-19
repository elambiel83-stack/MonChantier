import { NextRequest, NextResponse } from 'next/server';
import { recordContact } from '@/lib/adminStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message, lang } = body;

    // Validation basique
    if (!name || !email || !message) {
      return NextResponse.json(
        { message: lang === 'fr' ? 'Tous les champs sont requis' : 'All fields are required' },
        { status: 400 }
      );
    }

    // Simulation d'envoi (en production: envoyer email via SendGrid, Resend, etc.)
    console.log('=== NOUVEAU MESSAGE DE CONTACT ===');
    console.log('Nom:', name);
    console.log('Email:', email);
    console.log('Téléphone:', phone);
    console.log('Message:', message);
    console.log('================================');

    // Simuler un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 500));

    recordContact({ name, email });

    return NextResponse.json({ 
      success: true,
      message: lang === 'fr' 
        ? 'Message envoyé avec succès! Nous vous répondrons dans les 24h.' 
        : 'Message sent successfully! We will respond within 24h.'
    });
  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json(
      { message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
