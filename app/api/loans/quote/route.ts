import { NextRequest, NextResponse } from 'next/server';
import {
  buildAmortizationSchedule,
  getLoanAnnualInterestRate,
  getLoanMaxPrincipal,
  getLoanMaxTermMonths,
  getLoanMinTermMonths,
} from '@/lib/loanCalculator';
import { WalletCurrency } from '@/lib/walletExchange';

function isCurrency(value: unknown): value is WalletCurrency {
  return value === 'USD' || value === 'CDF';
}

export async function GET(request: NextRequest) {
  try {
    const currency = request.nextUrl.searchParams.get('currency');
    const principal = Number(request.nextUrl.searchParams.get('principal'));
    const termMonths = Number(request.nextUrl.searchParams.get('termMonths'));

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

    const annualInterestRate = getLoanAnnualInterestRate();
    const schedule = buildAmortizationSchedule({
      principal,
      annualRatePercent: annualInterestRate,
      termMonths,
      startDate: new Date(),
    });

    return NextResponse.json({
      success: true,
      annualInterestRate,
      monthlyPayment: schedule.monthlyPayment,
      totalRepayable: schedule.totalRepayable,
      totalInterest: schedule.totalInterest,
      installments: schedule.installments,
    });
  } catch (error) {
    console.error('Erreur simulation prêt:', error);
    return NextResponse.json({ message: 'Erreur lors de la simulation' }, { status: 500 });
  }
}
