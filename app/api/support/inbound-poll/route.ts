import { timingSafeEqual, createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isInboundMailConfigured, pollInboundSupportMail } from '@/lib/inboundMail';

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Déclenche un passage d'ingestion email des tickets support. Pas de
 * session admin ici : c'est fait pour être appelé par un planificateur
 * externe (cron), donc protégé par un secret dédié plutôt que par
 * l'authentification interactive.
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.SUPPORT_INBOUND_SECRET;
  const providedSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';

  if (!expectedSecret || !safeEqual(providedSecret, expectedSecret)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }

  if (!isInboundMailConfigured()) {
    return NextResponse.json({ message: 'Ingestion email non configurée' }, { status: 503 });
  }

  try {
    const stats = await pollInboundSupportMail();
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    console.error('Erreur ingestion email support:', error);
    return NextResponse.json({ message: 'Erreur lors de l\'ingestion email' }, { status: 500 });
  }
}
