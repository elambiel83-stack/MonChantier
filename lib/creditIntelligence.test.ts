import { describe, expect, it } from 'vitest';
import { detectPortfolioAlerts } from './creditIntelligence';
import type { Loan, LoanInstallment } from './loanStore';

function installment(overrides: Partial<LoanInstallment> = {}): LoanInstallment {
  return {
    index: 1,
    dueDate: new Date().toISOString(),
    amount: 100,
    principal: 90,
    interest: 10,
    paid: false,
    ...overrides,
  };
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: `LOAN-${Math.random().toString(36).slice(2, 8)}`,
    identity: 'client@example.com',
    borrower: { fullName: 'Client Test', phone: '+243000000000' },
    purpose: 'materials',
    currency: 'USD',
    principal: 1000,
    annualInterestRate: 12,
    termMonths: 6,
    monthlyPayment: 172,
    totalRepayable: 1032,
    totalInterest: 32,
    status: 'active',
    createdAt: new Date().toISOString(),
    documents: [],
    collateral: [],
    disbursementMode: 'lump_sum',
    installments: [installment()],
    auditLog: [],
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('detectPortfolioAlerts', () => {
  it('returns no alerts for a healthy portfolio', () => {
    // Plusieurs prêts de même montant : aucun ne dépasse seul le seuil de
    // concentration (30% du capital actif total).
    const loans = [
      makeLoan({ installments: [installment({ dueDate: daysAgo(-10) })] }),
      makeLoan({ installments: [installment({ dueDate: daysAgo(-10) })] }),
      makeLoan({ installments: [installment({ dueDate: daysAgo(-10) })] }),
      makeLoan({ installments: [installment({ dueDate: daysAgo(-10) })] }),
    ];
    expect(detectPortfolioAlerts(loans)).toEqual([]);
  });

  it('flags a high default rate above the 15% threshold', () => {
    // 2 sur 3 prêts actifs en défaut (>60 jours de retard) : bien au-dessus du seuil.
    const loans = [
      makeLoan({ installments: [installment({ dueDate: daysAgo(90) })] }),
      makeLoan({ installments: [installment({ dueDate: daysAgo(90) })] }),
      makeLoan({ installments: [installment({ dueDate: daysAgo(-10) })] }),
    ];
    const alerts = detectPortfolioAlerts(loans);
    expect(alerts.some((a) => a.id === 'default-rate-high')).toBe(true);
    expect(alerts[0].severity).toBe('critical');
  });

  it('flags high-value active loans without collateral', () => {
    const loans = [makeLoan({ principal: 10000, collateral: [] })];
    const alerts = detectPortfolioAlerts(loans);
    expect(alerts.some((a) => a.id === 'no-collateral-high-value')).toBe(true);
  });

  it('flags loans stuck in review beyond the stale threshold', () => {
    const loans = [
      makeLoan({
        status: 'under_review',
        reviewedAt: daysAgo(10),
        installments: [],
      }),
    ];
    const alerts = detectPortfolioAlerts(loans);
    expect(alerts.some((a) => a.id === 'stale-review')).toBe(true);
  });

  it('flags submitted loans with no assigned agent', () => {
    const loans = [makeLoan({ status: 'submitted', installments: [], assignedAgentIdentity: undefined })];
    const alerts = detectPortfolioAlerts(loans);
    expect(alerts.some((a) => a.id === 'unassigned-submitted')).toBe(true);
  });

  it('orders alerts by severity: critical before warning before info', () => {
    const loans = [
      makeLoan({ status: 'submitted', installments: [], assignedAgentIdentity: undefined }), // info
      makeLoan({ principal: 10000, collateral: [] }), // warning
      makeLoan({ installments: [installment({ dueDate: daysAgo(90) })] }), // pushes default rate over threshold (critical)
      makeLoan({ installments: [installment({ dueDate: daysAgo(90) })] }),
      makeLoan({ installments: [installment({ dueDate: daysAgo(90) })] }),
    ];
    const severities = detectPortfolioAlerts(loans).map((a) => a.severity);
    const firstWarning = severities.indexOf('warning');
    const firstInfo = severities.indexOf('info');
    const firstCritical = severities.indexOf('critical');
    if (firstWarning !== -1 && firstCritical !== -1) expect(firstCritical).toBeLessThan(firstWarning);
    if (firstInfo !== -1 && firstWarning !== -1) expect(firstWarning).toBeLessThan(firstInfo);
  });
});
