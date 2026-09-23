import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLivePaymentEnabled } from './paymentAvailability';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('production payment gates', () => {
  it('keeps production payments off by default', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isLivePaymentEnabled('card')).toBe(false);
  });

  it('requires both the global and method flags', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LIVE_CARD_ENABLED', 'true');
    expect(isLivePaymentEnabled('card')).toBe(false);
    vi.stubEnv('LIVE_PAYMENTS_ENABLED', 'true');
    expect(isLivePaymentEnabled('card')).toBe(true);
    expect(isLivePaymentEnabled('paypal')).toBe(false);
  });
});
