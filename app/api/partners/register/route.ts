import { type NextRequest, NextResponse } from 'next/server';
import { recordPartner } from '@/lib/adminStore';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidPartnerType(value: unknown) {
  return value === 'transporter' || value === 'supplier' || value === 'artisan';
}

function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`partner-registration:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: 'Trop de demandes. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json();
    const type = body?.type;
    const company = sanitizeText(body?.company, 120);
    const fullname = sanitizeText(body?.fullname, 120);
    const phone = sanitizeText(body?.phone, 40);
    const email = sanitizeText(body?.email, 160).toLowerCase();
    const lang = body?.lang;

    if (!isValidPartnerType(type)) {
      return NextResponse.json(
        { message: lang === 'fr' ? 'Type de partenaire invalide' : 'Invalid partner type' },
        { status: 400 }
      );
    }
    if (!company || !fullname || !phone) {
      return NextResponse.json(
        { message: lang === 'fr' ? 'Entreprise, nom et téléphone sont requis' : 'Company, name and phone are required' },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: lang === 'fr' ? 'Adresse email invalide' : 'Invalid email address' },
        { status: 400 }
      );
    }

    await recordPartner({ type, company, fullname });

    return NextResponse.json({
      success: true,
      message:
        lang === 'fr'
          ? 'Inscription enregistrée avec succès! Notre équipe vous contactera sous 24h.'
          : 'Registration successful! Our team will contact you within 24h.',
    });
  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json(
      { message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
