import { NextRequest, NextResponse } from 'next/server';
import { recordPartner } from '@/lib/adminStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, company, fullname, phone, email, lang } = body;

    // Validation basique
    if (!company || !fullname || !phone) {
      return NextResponse.json(
        { message: lang === 'fr' ? 'Entreprise, nom et téléphone sont requis' : 'Company, name and phone are required' },
        { status: 400 }
      );
    }

    // En production: sauvegarder dans la base de données
    console.log('=== NOUVELLE INSCRIPTION PARTENAIRE ===');
    console.log('Type:', type);
    console.log('Entreprise:', company);
    console.log('Nom:', fullname);
    console.log('Téléphone:', phone);
    console.log('Email:', email);
    console.log('Données complètes:', body);
    console.log('======================================');

    // Simuler un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 800));

    recordPartner({ type, company, fullname });

    // En production: envoyer notification WhatsApp/Email à l'équipe
    return NextResponse.json({ 
      success: true,
      message: lang === 'fr' 
        ? 'Inscription enregistrée avec succès! Notre équipe vous contactera sous 24h.' 
        : 'Registration successful! Our team will contact you within 24h.'
    });
  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json(
      { message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
