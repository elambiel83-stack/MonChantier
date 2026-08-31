import { NextResponse } from 'next/server';
import { getSessionActor } from '@/lib/sessionIdentity';
import { canViewAllLoans } from '@/lib/loanPermissions';
import { getRepaymentHealth, listAllLoans, listLoansForAgent } from '@/lib/loanStore';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
  }

  let loans;
  if (canViewAllLoans(actor.role)) {
    loans = await listAllLoans();
  } else if (actor.role === 'credit-agent') {
    loans = await listLoansForAgent(actor.identity);
  } else {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const withHealth = loans.map((loan) => ({ ...loan, repaymentHealth: getRepaymentHealth(loan) }));
  return NextResponse.json({ success: true, loans: withHealth });
}
