export type PricingStatus = 'platform' | 'pending' | 'approved' | 'rejected';

export function calculateSellingPrice(basePrice: number | null, feePercent: number): number | null {
  if (basePrice === null) return null;
  return Math.round(basePrice * (1 + feePercent / 100) * 100) / 100;
}

export function validateFeePercent(value: unknown): number | null {
  const fee = Number(value);
  return Number.isFinite(fee) && fee >= 0 && fee <= 100 ? fee : null;
}

export function validateSubmittedPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function hasSubmittedPrice(priceUSD: number | null, priceCDF: number | null): boolean {
  return (priceUSD !== null && priceUSD > 0) || (priceCDF !== null && priceCDF > 0);
}
