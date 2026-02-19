import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // En production: récupérer le taux réel depuis l'API BCC ou autre source
    // Pour l'instant, on retourne un taux fixe réaliste
    const rate = 2850; // 1 USD = 2850 CDF (exemple)
    
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
