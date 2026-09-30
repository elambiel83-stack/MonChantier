import { describe, expect, it } from 'vitest';
import { calculateSellingPrice, validateFeePercent } from './partnerPricing';

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
});
