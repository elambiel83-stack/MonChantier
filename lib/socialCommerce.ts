import type { CartItem, Currency, Language, Product } from '@/components/monchantier/types';

export const MONCHANTIER_WHATSAPP_NUMBER = '243999972466';

export function storefrontOrigin(explicitOrigin?: string): string {
  const candidate = explicitOrigin || process.env.NEXT_PUBLIC_APP_URL || 'https://monchantier.net';
  return candidate.replace(/\/$/, '');
}

export function productShareUrl(productId: number, channel: 'whatsapp' | 'facebook' | 'tiktok' | 'copy', origin?: string): string {
  const url = new URL(storefrontOrigin(origin));
  url.searchParams.set('product', String(productId));
  url.searchParams.set('utm_source', channel);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'catalogue_monchantier');
  url.hash = 'produits';
  return url.toString();
}

function productName(product: Product, lang: Language): string {
  return lang === 'fr' ? product.fr : product.en;
}

export function productWhatsAppUrl(product: Product, lang: Language, origin?: string): string {
  const name = productName(product, lang);
  const link = productShareUrl(product.id, 'whatsapp', origin);
  const message = lang === 'fr'
    ? `Bonjour MonChantier, je souhaite commander : ${name}.\n${link}`
    : `Hello MonChantier, I would like to order: ${name}.\n${link}`;
  return `https://wa.me/${MONCHANTIER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function facebookShareUrl(product: Product, origin?: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productShareUrl(product.id, 'facebook', origin))}`;
}

export function cartWhatsAppUrl(
  items: CartItem[],
  currency: Currency,
  lang: Language,
  fxRateUSDCDF: number | null,
): string {
  let total = 0;
  const lines = items.map(({ product, quantity }) => {
    const direct = product.prices[currency];
    const converted = currency === 'CDF' && product.prices.USD != null && fxRateUSDCDF
      ? product.prices.USD * fxRateUSDCDF
      : null;
    const unitPrice = direct ?? converted;
    if (unitPrice != null) total += unitPrice * quantity;
    const amount = unitPrice == null ? (lang === 'fr' ? 'prix à confirmer' : 'price to confirm') : `${(unitPrice * quantity).toLocaleString('fr-FR')} ${currency}`;
    return `• ${productName(product, lang)} × ${quantity} — ${amount}`;
  });
  const heading = lang === 'fr' ? 'Bonjour MonChantier, je souhaite commander :' : 'Hello MonChantier, I would like to order:';
  const totalLine = lang === 'fr' ? `Total estimé : ${total.toLocaleString('fr-FR')} ${currency}` : `Estimated total: ${total.toLocaleString('en-US')} ${currency}`;
  const confirmation = lang === 'fr' ? 'Merci de confirmer la disponibilité, la livraison et le montant final.' : 'Please confirm availability, delivery and the final amount.';
  return `https://wa.me/${MONCHANTIER_WHATSAPP_NUMBER}?text=${encodeURIComponent([heading, '', ...lines, '', totalLine, confirmation].join('\n'))}`;
}

export function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
