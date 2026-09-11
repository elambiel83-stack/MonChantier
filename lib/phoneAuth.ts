import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkRateLimit } from "./rateLimit";
import { recordSecurityEvent } from "./securityStore";

type PhoneOtpRecord = {
  code: string;
  expiresAt: number;
};

type PhoneOtpStore = Record<string, PhoneOtpRecord>;

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_STORE_DIR = path.join(process.cwd(), "data");
const OTP_STORE_FILE = path.join(OTP_STORE_DIR, "phone-otp-store.json");

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s-]/g, "");
}

async function readOtpStore(): Promise<PhoneOtpStore> {
  try {
    const raw = await readFile(OTP_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PhoneOtpStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeOtpStore(store: PhoneOtpStore): Promise<void> {
  await mkdir(OTP_STORE_DIR, { recursive: true });
  await writeFile(OTP_STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function cleanupExpired(store: PhoneOtpStore): PhoneOtpStore {
  const now = Date.now();
  const cleaned: PhoneOtpStore = {};

  for (const [phone, record] of Object.entries(store)) {
    if (record.expiresAt > now) {
      cleaned[phone] = record;
    }
  }

  return cleaned;
}

export async function createPhoneOtp(phone: string): Promise<{ phone: string; code: string; expiresAt: number }> {
  const normalizedPhone = normalizePhone(phone);
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;

  const store = cleanupExpired(await readOtpStore());
  store[normalizedPhone] = { code, expiresAt };
  await writeOtpStore(store);

  return { phone: normalizedPhone, code, expiresAt };
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<boolean> {
  return verifyPhoneOtpWithContext(phone, code);
}

export async function verifyPhoneOtpWithContext(
  phone: string,
  code: string,
  context?: { ip?: string }
): Promise<boolean> {
  const normalizedPhone = normalizePhone(phone);

  const attempts = checkRateLimit(`otp-verify:${normalizedPhone}`, { max: 5, windowMs: OTP_TTL_MS });
  if (!attempts.allowed) {
    await recordSecurityEvent({
      type: "otp_verify_rate_limited",
      severity: "warning",
      identity: normalizedPhone,
      ip: context?.ip,
      detail: `Retry in ${Math.ceil(attempts.retryAfterMs / 1000)}s`,
    });
    return false;
  }

  const store = cleanupExpired(await readOtpStore());
  const record = store[normalizedPhone];

  if (!record) {
    await writeOtpStore(store);
    await recordSecurityEvent({
      type: "otp_verify_failed",
      severity: "warning",
      identity: normalizedPhone,
      ip: context?.ip,
      detail: "OTP introuvable ou expiré",
    });
    return false;
  }

  const isValid = record.code === code.trim();
  if (isValid) {
    delete store[normalizedPhone];
  }

  await writeOtpStore(store);
  await recordSecurityEvent({
    type: isValid ? "otp_verified" : "otp_verify_failed",
    severity: isValid ? "info" : "warning",
    identity: normalizedPhone,
    ip: context?.ip,
    detail: isValid ? "Connexion téléphone validée" : "Code OTP invalide",
  });

  return isValid;
}
