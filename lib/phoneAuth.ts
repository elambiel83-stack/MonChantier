import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { checkRateLimit } from "./rateLimit";
import { withStore } from "./storeDb";

type PhoneOtpRecord = {
  codeHash: string;
  expiresAt: number;
};

type PhoneOtpStore = Record<string, PhoneOtpRecord>;

const OTP_TTL_MS = 5 * 60 * 1000;
const STORE_KEY = "phone-otp-store";
const buildInitialStore = (): PhoneOtpStore => ({});

export function normalizePhone(phone: string): string | null {
  const normalized = phone.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function hashOtp(phone: string, code: string): string {
  const secret = process.env.OTP_HASH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('OTP_HASH_SECRET ou NEXTAUTH_SECRET manquant');
    return createHmac('sha256', 'monchantier-dev-only').update(`${phone}:${code}`).digest('hex');
  }
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

function cleanupExpired(store: PhoneOtpStore): void {
  const now = Date.now();
  for (const [phone, record] of Object.entries(store)) {
    if (record.expiresAt <= now) delete store[phone];
  }
}

export async function createPhoneOtp(phone: string): Promise<{ phone: string; code: string; expiresAt: number }> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) throw new Error('Numéro invalide : utilisez le format international, par ex. +243...');
  // randomInt (CSPRNG) plutôt que Math.random() : un code de connexion ne
  // doit pas être prévisible à partir d'un générateur non cryptographique.
  const code = randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;

  await withStore(STORE_KEY, buildInitialStore, (store) => {
    cleanupExpired(store);
    store[normalizedPhone] = { codeHash: hashOtp(normalizedPhone, code), expiresAt };
  });

  return { phone: normalizedPhone, code, expiresAt };
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<boolean> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !/^\d{6}$/.test(code.trim())) return false;

  const attempts = await checkRateLimit(`otp-verify:${normalizedPhone}`, { max: 5, windowMs: OTP_TTL_MS });
  if (!attempts.allowed) return false;

  return withStore(STORE_KEY, buildInitialStore, (store) => {
    cleanupExpired(store);
    const record = store[normalizedPhone];
    if (!record) return false;

    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(hashOtp(normalizedPhone, code.trim()), 'hex');
    const isValid = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (isValid) {
      delete store[normalizedPhone];
    }
    return isValid;
  });
}
