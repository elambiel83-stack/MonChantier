import { describe, expect, it } from 'vitest';
import { calculateSellingPrice, hasSubmittedPrice, validateFeePercent, validateSubmittedPrice } from './partnerPricing';

describe('partner pricing', () => {
  it('adds the company percentage to the submitted base price', () => {
    expect(calculateSellingPrice(100, 15)).toBe(115);
    expect(calculateSellingPrice(12.34, 7.5)).toBe(13.27);
    expect(calculateSellingPrice(null, 10)).toBeNull();
  });

  it('accepts only percentages between 0 and 100', () => {
    expect(validateFeePercent('12.5')).toBe(12.5);
    expect(validateFeePercent(-1)).toBeNull();
    expect(validateFeePercent(101)).toBeNull();
    expect(validateFeePercent('invalid')).toBeNull();
  });

  it('accepts only strictly positive submitted prices', () => {
    expect(validateSubmittedPrice('125.50')).toBe(125.5);
    expect(validateSubmittedPrice('')).toBeNull();
    expect(validateSubmittedPrice(0)).toBeNull();
    expect(validateSubmittedPrice(-10)).toBeNull();
    expect(validateSubmittedPrice('invalid')).toBeNull();
  });

  it('requires at least one submitted currency before approval', () => {
    expect(hasSubmittedPrice(10, null)).toBe(true);
    expect(hasSubmittedPrice(null, 25_000)).toBe(true);
    expect(hasSubmittedPrice(null, null)).toBe(false);
  });
});
