import { describe, expect, it } from 'vitest';
import { cartWhatsAppUrl, csvCell, productShareUrl, productWhatsAppUrl } from './socialCommerce';
import type { Product } from '@/components/monchantier/types';

const product: Product = {
  id: 7, fr: 'Ciment gris', en: 'Grey cement', price: '$12', prices: { USD: 12, CDF: null },
  unitFr: 'sac', unitEn: 'bag', img: '/ciment.jpg', fallback: '/fallback.jpg',
};

describe('social commerce links', () => {
  it('creates a traceable product URL', () => {
    const url = new URL(productShareUrl(7, 'facebook', 'https://shop.example/'));
    expect(url.origin).toBe('https://shop.example');
    expect(url.searchParams.get('product')).toBe('7');
    expect(url.searchParams.get('utm_source')).toBe('facebook');
    expect(url.hash).toBe('#produits');
  });

  it('creates an encoded WhatsApp product message', () => {
    const url = new URL(productWhatsAppUrl(product, 'fr', 'https://shop.example'));
    expect(url.hostname).toBe('wa.me');
    expect(url.searchParams.get('text')).toContain('Ciment gris');
    expect(url.searchParams.get('text')).toContain('utm_source=whatsapp');
  });

  it('creates a complete cart message with converted totals', () => {
    const url = new URL(cartWhatsAppUrl([{ product, quantity: 2 }], 'CDF', 'fr', 2800));
    const message = url.searchParams.get('text') || '';
    expect(message).toContain('Ciment gris × 2');
    expect(message).toContain('67 200 CDF');
    expect(message).toContain('confirmer la disponibilité');
  });

  it('escapes CSV values safely', () => {
    expect(csvCell('Ciment, 50 "premium"')).toBe('"Ciment, 50 ""premium"""');
  });
});
