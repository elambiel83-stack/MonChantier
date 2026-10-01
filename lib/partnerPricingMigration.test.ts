import { describe, expect, it } from 'vitest';
import { normalizeLegacyPricingStore } from './partnerPricingMigration';

describe('legacy partner pricing migration', () => {
  it('moves a legacy partner price to submitted fields and disables publication', () => {
    const item = { id: 7, ownerIdentity: 'Partner@Test.cd', priceUSD: 100, priceCDF: null, active: true };
    const store = { items: [item], nextId: 1 };

    expect(normalizeLegacyPricingStore(store)).toBe(true);
    expect(item).toMatchObject({
      priceUSD: null,
      submittedPriceUSD: 100,
      submittedPriceCDF: null,
      platformFeePercent: 0,
      pricingStatus: 'pending',
      active: false,
    });
    expect(store.nextId).toBe(8);
    expect(normalizeLegacyPricingStore(store)).toBe(false);
  });

  it('keeps platform and approved prices available', () => {
    const platform = { id: 1, priceUSD: 20, priceCDF: null, active: true };
    const approved = {
      id: 2,
      ownerIdentity: 'partner@test.cd',
      priceUSD: 115,
      priceCDF: null,
      submittedPriceUSD: 100,
      submittedPriceCDF: null,
      platformFeePercent: 15,
      pricingStatus: 'approved' as const,
      active: true,
    };
    const store = { items: [platform, approved], nextId: 3 };

    normalizeLegacyPricingStore(store);
    expect(platform).toMatchObject({ priceUSD: 20, pricingStatus: 'platform', active: true });
    expect(approved).toMatchObject({ priceUSD: 115, pricingStatus: 'approved', active: true });
  });
});
