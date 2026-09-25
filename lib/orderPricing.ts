import { getProduct } from '@/lib/productStore';

export type PricedOrderItem = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export class OrderPricingError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

/**
 * Source de vérité serveur pour les commandes payables.
 * Le navigateur n'est jamais autorisé à choisir le prix, le libellé ou le total.
 */
export async function priceOrderFromCatalog(
  rawItems: unknown,
  rawCurrency: unknown
): Promise<{ items: PricedOrderItem[]; amount: number; currency: 'USD' | 'CDF'; summary: string }> {
  const currency = String(rawCurrency || '').trim().toUpperCase();
  if (currency !== 'USD' && currency !== 'CDF') {
    throw new OrderPricingError('Devise non prise en charge');
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    throw new OrderPricingError('La commande doit contenir entre 1 et 50 produits');
  }

  const items: PricedOrderItem[] = [];
  for (const raw of rawItems) {
    const input = (raw || {}) as Record<string, unknown>;
    const productId = Number(input.productId);
    const quantity = Number(input.quantity);
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      throw new OrderPricingError('Produit invalide. Les services sans prix catalogue doivent passer par un devis.');
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
      throw new OrderPricingError('Quantité invalide');
    }

    const product = await getProduct(productId);
    if (!product || !product.active) {
      throw new OrderPricingError(`Produit ${productId} indisponible`, 409);
    }
    const unitPrice = currency === 'USD' ? product.priceUSD : product.priceCDF;
    if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new OrderPricingError(`Prix ${currency} indisponible pour ${product.fr}`, 409);
    }
    if (product.stock != null && product.stock < quantity) {
      throw new OrderPricingError(`Stock insuffisant pour ${product.fr}`, 409);
    }
    items.push({ productId, productName: product.fr, quantity, unitPrice });
  }

  const amount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new OrderPricingError('Total de commande invalide');

  return {
    items,
    amount: currency === 'CDF' ? Math.round(amount) : Math.round(amount * 100) / 100,
    currency,
    summary: items.map((item) => `${item.productName} x${item.quantity}`).join(', '),
  };
}
