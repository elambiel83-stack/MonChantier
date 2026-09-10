import { describe, expect, it } from 'vitest';
import { buildAmortizationSchedule, computeMonthlyPayment } from './loanCalculator';

describe('computeMonthlyPayment', () => {
  it('splits principal evenly when the rate is zero', () => {
    expect(computeMonthlyPayment(1200, 0, 12)).toBe(100);
  });

  it('computes a standard amortized payment for a positive rate', () => {
    // 1200 principal, 12%/an, 12 mois : mensualité standard ~ 106.59
    const payment = computeMonthlyPayment(1200, 12, 12);
    expect(payment).toBeCloseTo(106.59, 1);
  });
});

describe('buildAmortizationSchedule', () => {
  it('produces one installment per month with a constant monthly payment', () => {
    const schedule = buildAmortizationSchedule({
      principal: 1200,
      annualRatePercent: 12,
      termMonths: 12,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
    });

    expect(schedule.installments).toHaveLength(12);
    for (const installment of schedule.installments.slice(0, -1)) {
      expect(installment.amount).toBe(schedule.monthlyPayment);
    }
  });

  it('fully amortizes the loan: last installment zeroes the remaining balance', () => {
    const schedule = buildAmortizationSchedule({
      principal: 1200,
      annualRatePercent: 12,
      termMonths: 12,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
    });

    const totalPrincipalPaid = schedule.installments.reduce((sum, i) => sum + i.principal, 0);
    expect(totalPrincipalPaid).toBeCloseTo(1200, 1);
  });

  it('computes total interest as the gap between total repayable and principal', () => {
    const schedule = buildAmortizationSchedule({
      principal: 1000,
      annualRatePercent: 10,
      termMonths: 6,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
    });

    expect(schedule.totalInterest).toBeCloseTo(schedule.totalRepayable - 1000, 2);
    expect(schedule.totalInterest).toBeGreaterThan(0);
  });

  it('schedules due dates one month apart', () => {
    const schedule = buildAmortizationSchedule({
      principal: 500,
      annualRatePercent: 5,
      termMonths: 3,
      startDate: new Date('2024-01-15T00:00:00.000Z'),
    });

    expect(schedule.installments.map((i) => i.dueDate.slice(0, 10))).toEqual([
      '2024-02-15',
      '2024-03-15',
      '2024-04-15',
    ]);
  });
});
