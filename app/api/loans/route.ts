import { NextRequest, NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { createLoanApplication, getRepaymentHealth, listLoansByIdentity } from '@/lib/loanStore';
import { getLoanMaxPrincipal, getLoanMaxTermMonths, getLoanMinTermMonths } from '@/lib/loanCalculator';
import { WalletCurrency } from '@/lib/walletExchange';

function isCurrency(value: unknown): value is WalletCurrency {
  return value === 'USD' || value === 'CDF';
}

export async function GET() {
  try {
    const identity = await getWalletIdentity();
    if (!identity) {
      return NextResponse.json({ message: 'Connexion avec email requise' }, { status: 401 });
    }

    const loans = await listLoansByIdentity(identity);
    const withHealth = loans.map((loan) => ({ ...loan, repaymentHealth: getRepaymentHealth(loan) }));
    return NextResponse.json({ success: true, loans: withHealth });
  } catch (error) {
    console.error('Erreur lecture prêts:', error);
    return NextResponse.json({ message: 'Erreur lors de la lecture des prêts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await getWalletIdentity();
    if (!identity) {
      return NextResponse.json({ message: 'Connexion avec email requise' }, { status: 401 });
    }

    const body = await request.json();
    const purpose = String(body?.purpose || '').trim();
    const currency = body?.currency;
    const principal = Number(body?.principal);
    const termMonths = Number(body?.termMonths);

    const fullName = String(body?.borrower?.fullName || '').trim();
    const phone = String(body?.borrower?.phone || '').trim();
    const monthlyIncome = body?.borrower?.monthlyIncome !== undefined ? Number(body.borrower.monthlyIncome) : undefined;
    const monthlyCharges = body?.borrower?.monthlyCharges !== undefined ? Number(body.borrower.monthlyCharges) : undefined;
    const employmentStatus = typeof body?.borrower?.employmentStatus === 'string' ? body.borrower.employmentStatus.trim() : undefined;
    const employer = typeof body?.borrower?.employer === 'string' ? body.borrower.employer.trim() : undefined;

    const project = body?.project
      ? {
          type: String(body.project.type || '').trim(),
          province: typeof body.project.province === 'string' ? body.project.province.trim() : undefined,
          city: typeof body.project.city === 'string' ? body.project.city.trim() : undefined,
          commune: typeof body.project.commune === 'string' ? body.project.commune.trim() : undefined,
          description: String(body.project.description || '').trim(),
          budgetTotal: body.project.budgetTotal !== undefined ? Number(body.project.budgetTotal) : undefined,
          personalContribution:
            body.project.personalContribution !== undefined ? Number(body.project.personalContribution) : undefined,
        }
      : undefined;

    if (!purpose) {
      return NextResponse.json({ message: "L'objet du prêt est requis" }, { status: 400 });
    }
    if (!fullName || !phone) {
      return NextResponse.json(
        { message: 'Nom complet et téléphone de l\'emprunteur requis' },
        { status: 400 }
      );
    }
    if (!isCurrency(currency) || !Number.isFinite(principal) || principal <= 0 || !Number.isInteger(termMonths)) {
      return NextResponse.json({ message: 'Paramètres invalides' }, { status: 400 });
    }

    const minTerm = getLoanMinTermMonths();
    const maxTerm = getLoanMaxTermMonths();
    const maxPrincipal = getLoanMaxPrincipal(currency);

    if (termMonths < minTerm || termMonths > maxTerm) {
      return NextResponse.json(
        { message: `Durée invalide (entre ${minTerm} et ${maxTerm} mois)` },
        { status: 400 }
      );
    }
    if (principal > maxPrincipal) {
      return NextResponse.json(
        { message: `Montant maximum autorisé: ${maxPrincipal} ${currency}` },
        { status: 400 }
      );
    }

    let tranches: Array<{ label: string; condition: string; amount: number }> | undefined;
    if (Array.isArray(body?.tranches) && body.tranches.length > 0) {
      tranches = body.tranches.map(
        (tranche: { label?: unknown; condition?: unknown; amount?: unknown }) => ({
          label: String(tranche?.label || '').trim(),
          condition: String(tranche?.condition || '').trim(),
          amount: Number(tranche?.amount),
        })
      );
      const invalid = tranches!.some(
        (tranche) => !tranche.label || !Number.isFinite(tranche.amount) || tranche.amount <= 0
      );
      if (invalid) {
        return NextResponse.json({ message: 'Tranches invalides' }, { status: 400 });
      }
      const trancheSum = tranches!.reduce((sum, tranche) => sum + tranche.amount, 0);
      if (Math.round(trancheSum * 100) !== Math.round(principal * 100)) {
        return NextResponse.json(
          { message: 'La somme des tranches doit être égale au montant demandé' },
          { status: 400 }
        );
      }
    }

    const loan = await createLoanApplication({
      identity,
      borrower: { fullName, phone, monthlyIncome, monthlyCharges, employmentStatus, employer },
      project,
      purpose,
      currency,
      principal,
      termMonths,
      tranches,
    });
    return NextResponse.json({ success: true, loan });
  } catch (error) {
    console.error('Erreur demande de prêt:', error);
    return NextResponse.json({ message: 'Erreur lors de la demande de prêt' }, { status: 500 });
  }
}
