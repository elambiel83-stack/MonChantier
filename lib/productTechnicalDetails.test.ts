import { describe, expect, it } from 'vitest';
import { productTechnicalDetails } from './productTechnicalDetails';

const base = { fr: 'Sable concassé 0/5', en: 'Crushed sand 0/5', category: 'aggregats', unitFr: 'm³', unitEn: 'm³' };
describe('catalogue specifications', () => {
  it('preserves grading without inventing its measurement unit', () => {
    expect(productTechnicalDetails(base, 'fr').measurement).toBe('0/5');
  });
  it('preserves explicit dimensions from the designation', () => {
    expect(productTechnicalDetails({ ...base, fr: 'Bloc 15×20×40 cm' }, 'fr').measurement).toBe('15×20×40 cm');
  });
  it('does not invent dimensions, strength or a standard for unnamed products', () => {
    const result = productTechnicalDetails({ ...base, fr: 'Brique rouge', category: 'blocs_paves' }, 'fr');
    expect(result.measurement).toBeNull();
    expect(result.toConfirm).toContain('résistance');
  });
  it('uses the chosen language and the product sales unit', () => {
    const result = productTechnicalDetails({ ...base, en: 'Cement 50 kg', unitEn: 'bag' }, 'en');
    expect(result.measurement).toBe('50 kg');
    expect(result.unit).toBe('bag');
  });
});
