import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phoneAuth';

describe('phone authentication validation', () => {
  it('normalizes valid international numbers', () => {
    expect(normalizePhone('+243 963 985 553')).toBe('+243963985553');
    expect(normalizePhone('+33 (6) 12-34-56-78')).toBe('+33612345678');
  });

  it('rejects local, malformed and oversized numbers', () => {
    expect(normalizePhone('0963985553')).toBeNull();
    expect(normalizePhone('+243abc')).toBeNull();
    expect(normalizePhone('+1234567890123456')).toBeNull();
  });
});
