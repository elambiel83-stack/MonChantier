import { NextResponse } from 'next/server';
import { getBccUsdToCdfRate } from '@/lib/walletExchange';

export async function GET() {
  try {
    // En production: récupérer le taux réel depuis l'API BCC ou autre source
    const rate = getBccUsdToCdfRate();

    return NextResponse.json({ 
      rate,
      source: 'BCC',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur récupération taux:', error);
    return NextResponse.json(
      { rate: 2800 }, // Taux de fallback
      { status: 200 }
    );
  }
}
