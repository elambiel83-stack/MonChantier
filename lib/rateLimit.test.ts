import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit } from './rateLimit';

// REDIS_URL n'est volontairement pas défini dans cet environnement de test :
// on exerce ici le repli en mémoire locale.
describe('checkRateLimit (repli mémoire)', () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });

  it('allows requests under the limit', async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i += 1) {
      const result = await checkRateLimit(key, { max: 3, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks once the limit is exceeded', async () => {
    const key = `test:${Math.random()}`;
    await checkRateLimit(key, { max: 2, windowMs: 60_000 });
    await checkRateLimit(key, { max: 2, windowMs: 60_000 });
    const third = await checkRateLimit(key, { max: 2, windowMs: 60_000 });
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks separate keys independently', async () => {
    const keyA = `test:a:${Math.random()}`;
    const keyB = `test:b:${Math.random()}`;
    await checkRateLimit(keyA, { max: 1, windowMs: 60_000 });
    const blockedA = await checkRateLimit(keyA, { max: 1, windowMs: 60_000 });
    const allowedB = await checkRateLimit(keyB, { max: 1, windowMs: 60_000 });
    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });

  it('resets after the window expires', async () => {
    const key = `test:${Math.random()}`;
    await checkRateLimit(key, { max: 1, windowMs: 10 });
    const blocked = await checkRateLimit(key, { max: 1, windowMs: 10 });
    expect(blocked.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 20));
    const afterReset = await checkRateLimit(key, { max: 1, windowMs: 10 });
    expect(afterReset.allowed).toBe(true);
  });
});
