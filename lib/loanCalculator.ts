function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function getLoanAnnualInterestRate(): number {
  const raw = process.env.LOAN_ANNUAL_INTEREST_RATE;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) return parsed;
  return 12; // 12%/an par défaut
}

export function getLoanMinTermMonths(): number {
  const raw = Number(process.env.LOAN_MIN_TERM_MONTHS);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

export function getLoanMaxTermMonths(): number {
  const raw = Number(process.env.LOAN_MAX_TERM_MONTHS);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}

export function getLoanLateThresholdDays(): number {
  const raw = Number(process.env.LOAN_LATE_THRESHOLD_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

export function getLoanMaxPrincipal(currency: 'USD' | 'CDF'): number {
  if (currency === 'USD') {
    const raw = Number(process.env.LOAN_MAX_PRINCIPAL_USD);
    return Number.isFinite(raw) && raw > 0 ? raw : 20000;
  }
  const raw = Number(process.env.LOAN_MAX_PRINCIPAL_CDF);
  return Number.isFinite(raw) && raw > 0 ? raw : 20000 * 2850;
}

export function computeMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number
): number {
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return round2(principal / termMonths);
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return round2((principal * monthlyRate * factor) / (factor - 1));
}

export type LoanInstallmentPlan = {
  index: number;
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
};

export function buildAmortizationSchedule(args: {
  principal: number;
  annualRatePercent: number;
  termMonths: number;
  startDate: Date;
}): { monthlyPayment: number; totalRepayable: number; totalInterest: number; installments: LoanInstallmentPlan[] } {
  const { principal, annualRatePercent, termMonths, startDate } = args;
  const monthlyRate = annualRatePercent / 100 / 12;
  const monthlyPayment = computeMonthlyPayment(principal, annualRatePercent, termMonths);

  let remaining = principal;
  const installments: LoanInstallmentPlan[] = [];

  for (let index = 1; index <= termMonths; index += 1) {
    const interest = round2(remaining * monthlyRate);
    let principalPortion = round2(monthlyPayment - interest);
    let amount = monthlyPayment;

    // Dernière échéance: on ajuste pour annuler exactement le solde restant
    // (évite les écarts d'arrondi cumulés sur l'échéancier).
    if (index === termMonths) {
      principalPortion = remaining;
      amount = round2(principalPortion + interest);
    }

    remaining = round2(remaining - principalPortion);

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + index);

    installments.push({
      index,
      dueDate: dueDate.toISOString(),
      amount,
      principal: principalPortion,
      interest,
    });
  }

  const totalRepayable = round2(installments.reduce((sum, i) => sum + i.amount, 0));
  const totalInterest = round2(totalRepayable - principal);

  return { monthlyPayment, totalRepayable, totalInterest, installments };
}
