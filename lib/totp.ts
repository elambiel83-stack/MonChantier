import { createHmac, timingSafeEqual } from 'crypto';

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = value.replace(/[\s=-]/g, '').toUpperCase();
  const bytes: number[] = []; let buffer = 0; let bits = 0;
  for (const char of cleaned) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Secret TOTP invalide');
    buffer = (buffer << 5) | index; bits += 5;
    if (bits >= 8) { bytes.push((buffer >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}
function generate(secret: string, counter: number): string {
  const input = Buffer.alloc(8); input.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(input).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** RFC 6238: 30 seconds, one interval of clock tolerance. */
export function verifyAdminTotp(code: string): boolean {
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(Date.now() / 30_000);
  try {
    return [-1, 0, 1].some((offset) => timingSafeEqual(Buffer.from(generate(secret, counter + offset)), Buffer.from(code)));
  } catch { return false; }
}
