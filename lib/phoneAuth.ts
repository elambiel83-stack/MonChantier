import { randomInt } from "node:crypto";
import { checkRateLimit } from "./rateLimit";
import { withStore } from "./storeDb";

type PhoneOtpRecord = {
  code: string;
  expiresAt: number;
};

type PhoneOtpStore = Record<string, PhoneOtpRecord>;

const OTP_TTL_MS = 5 * 60 * 1000;
const STORE_KEY = "phone-otp-store";
const buildInitialStore = (): PhoneOtpStore => ({});

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s-]/g, "");
}

function cleanupExpired(store: PhoneOtpStore): void {
  const now = Date.now();
  for (const [phone, record] of Object.entries(store)) {
    if (record.expiresAt <= now) delete store[phone];
  }
}

export async function createPhoneOtp(phone: string): Promise<{ phone: string; code: string; expiresAt: number }> {
  const normalizedPhone = normalizePhone(phone);
  // randomInt (CSPRNG) plutôt que Math.random() : un code de connexion ne
  // doit pas être prévisible à partir d'un générateur non cryptographique.
  const code = randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;

  await withStore(STORE_KEY, buildInitialStore, (store) => {
    cleanupExpired(store);
    store[normalizedPhone] = { code, expiresAt };
  });

  return { phone: normalizedPhone, code, expiresAt };
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<boolean> {
  const normalizedPhone = normalizePhone(phone);

  const attempts = await checkRateLimit(`otp-verify:${normalizedPhone}`, { max: 5, windowMs: OTP_TTL_MS });
  if (!attempts.allowed) return false;

  return withStore(STORE_KEY, buildInitialStore, (store) => {
    cleanupExpired(store);
    const record = store[normalizedPhone];
    if (!record) return false;

    const isValid = record.code === code.trim();
    if (isValid) {
      delete store[normalizedPhone];
    }
    return isValid;
  });
}
