import { NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canViewPortfolio } from '@/lib/loanPermissions';
import { getPortfolioSummary, listAllLoans } from '@/lib/loanStore';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
  if (!canViewPortfolio(actor.role)) {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const loans = await listAllLoans();
  const summary = getPortfolioSummary(loans);
  return NextResponse.json({ success: true, summary });
}
