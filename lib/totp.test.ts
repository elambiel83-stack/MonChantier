import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyAdminTotp } from './totp';

// Base32 encoding helper matching the alphabet used by lib/totp.ts, so tests
// can generate a valid secret and derive the expected code independently of
// the implementation under test.
function encodeBase32(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = value.replace(/[\s=-]/g, '').toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of cleaned) {
    const index = alphabet.indexOf(char);
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateCode(secret: string, counter: number): string {
  const input = Buffer.alloc(8);
  input.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(input).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const SECRET = encodeBase32(Buffer.from('01234567890123456789'));

describe('verifyAdminTotp', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_TOTP_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the code for the current 30s window', () => {
    const counter = Math.floor(Date.now() / 30_000);
    expect(verifyAdminTotp(generateCode(SECRET, counter))).toBe(true);
  });

  it('accepts a code from the adjacent window (clock tolerance)', () => {
    const counter = Math.floor(Date.now() / 30_000);
    expect(verifyAdminTotp(generateCode(SECRET, counter - 1))).toBe(true);
    expect(verifyAdminTotp(generateCode(SECRET, counter + 1))).toBe(true);
  });

  it('rejects a code far outside the tolerance window', () => {
    const counter = Math.floor(Date.now() / 30_000);
    expect(verifyAdminTotp(generateCode(SECRET, counter - 5))).toBe(false);
  });

  it('rejects a malformed code', () => {
    expect(verifyAdminTotp('abcdef')).toBe(false);
    expect(verifyAdminTotp('123')).toBe(false);
  });

  it('fails closed in production when no secret is configured', () => {
    vi.stubEnv('ADMIN_TOTP_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(verifyAdminTotp('123456')).toBe(false);
  });

  it('allows the dev bypass outside production when no secret is configured', () => {
    vi.stubEnv('ADMIN_TOTP_SECRET', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(verifyAdminTotp('123456')).toBe(true);
  });
});
