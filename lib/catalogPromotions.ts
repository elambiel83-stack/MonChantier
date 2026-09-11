import { StoredPromotion, isPromotionLive } from './promotionStore';

type CatalogPricedItem = {
  id: number;
  priceUSD: number | null;
  priceCDF: number | null;
};

export type CatalogPromotionFields = {
  promotionLabel: string | null;
  promotionDiscountPercent: number | null;
  originalPriceUSD: number | null;
  originalPriceCDF: number | null;
};

function applyDiscount(price: number | null, discountPercent: number): number | null {
  if (price === null) return null;
  const discounted = price * (1 - discountPercent / 100);
  return Number(discounted.toFixed(2));
}

export function applyCatalogPromotions<T extends CatalogPricedItem>(
  items: T[],
  promotions: StoredPromotion[]
): Array<T & CatalogPromotionFields> {
  return items.map((item) => {
    const bestPromotion =
      promotions
        .filter((promotion) => promotion.itemId === item.id && isPromotionLive(promotion))
        .sort((left, right) => right.discountPercent - left.discountPercent)[0] || null;

    if (!bestPromotion) {
      return {
        ...item,
        promotionLabel: null,
        promotionDiscountPercent: null,
        originalPriceUSD: null,
        originalPriceCDF: null,
      };
    }

    return {
      ...item,
      priceUSD: applyDiscount(item.priceUSD, bestPromotion.discountPercent),
      priceCDF: applyDiscount(item.priceCDF, bestPromotion.discountPercent),
      promotionLabel: bestPromotion.label,
      promotionDiscountPercent: bestPromotion.discountPercent,
      originalPriceUSD: item.priceUSD,
      originalPriceCDF: item.priceCDF,
    };
  });
}
