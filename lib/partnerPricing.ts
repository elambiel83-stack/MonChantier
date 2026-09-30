export type PricingStatus = 'platform' | 'pending' | 'approved' | 'rejected';

export function calculateSellingPrice(basePrice: number | null, feePercent: number): number | null {
  if (basePrice === null) return null;
  return Math.round(basePrice * (1 + feePercent / 100) * 100) / 100;
}

export function validateFeePercent(value: unknown): number | null {
  const fee = Number(value);
  return Number.isFinite(fee) && fee >= 0 && fee <= 100 ? fee : null;
}
