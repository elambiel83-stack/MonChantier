import { NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canViewPortfolio } from '@/lib/loanPermissions';
import { listAllLoans } from '@/lib/loanStore';
import { detectPortfolioAlerts } from '@/lib/creditIntelligence';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
  if (!canViewPortfolio(actor.role) && actor.role !== 'ai') {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const loans = await listAllLoans();
  const alerts = detectPortfolioAlerts(loans);
  return NextResponse.json({ success: true, alerts });
}
