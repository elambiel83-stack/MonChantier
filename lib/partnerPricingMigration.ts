import { hasSubmittedPrice } from './partnerPricing';
import type { PricingStatus } from './partnerPricing';

type LegacyPricedItem = {
  id: number;
  ownerIdentity?: string;
  priceUSD: number | null;
  priceCDF: number | null;
  submittedPriceUSD?: number | null;
  submittedPriceCDF?: number | null;
  platformFeePercent?: number;
  pricingStatus?: PricingStatus;
  active: boolean;
};

type LegacyPricedStore<T extends LegacyPricedItem> = {
  nextId: number;
  items: T[];
};

const VALID_STATUSES: PricingStatus[] = ['platform', 'pending', 'approved', 'rejected'];

/** Normalise en place les enregistrements antérieurs au workflow de validation. */
export function normalizeLegacyPricingStore<T extends LegacyPricedItem>(store: LegacyPricedStore<T>): boolean {
  let changed = false;

  for (const item of store.items) {
    const isPartner = Boolean(item.ownerIdentity?.trim());
    const originalUSD = item.priceUSD ?? null;
    const originalCDF = item.priceCDF ?? null;

    if (item.submittedPriceUSD === undefined) {
      item.submittedPriceUSD = originalUSD;
      changed = true;
    }
    if (item.submittedPriceCDF === undefined) {
      item.submittedPriceCDF = originalCDF;
      changed = true;
    }
    if (!Number.isFinite(item.platformFeePercent) || item.platformFeePercent! < 0 || item.platformFeePercent! > 100) {
      item.platformFeePercent = 0;
      changed = true;
    }

    const statusIsValid = item.pricingStatus !== undefined && VALID_STATUSES.includes(item.pricingStatus);
    if (!isPartner) {
      if (item.pricingStatus !== 'platform') {
        item.pricingStatus = 'platform';
        changed = true;
      }
      continue;
    }

    if (!statusIsValid || item.pricingStatus === 'platform') {
      item.pricingStatus = 'pending';
      changed = true;
    }

    const hasPrice = hasSubmittedPrice(item.submittedPriceUSD ?? null, item.submittedPriceCDF ?? null);
    if (item.pricingStatus === 'approved' && !hasPrice) {
      item.pricingStatus = 'pending';
      changed = true;
    }

    if (item.pricingStatus !== 'approved') {
      if (item.priceUSD !== null) {
        item.priceUSD = null;
        changed = true;
      }
      if (item.priceCDF !== null) {
        item.priceCDF = null;
        changed = true;
      }
      if (item.active) {
        item.active = false;
        changed = true;
      }
    }
  }

  const nextId = store.items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  if (!Number.isInteger(store.nextId) || store.nextId < nextId) {
    store.nextId = nextId;
    changed = true;
  }
  return changed;
}
