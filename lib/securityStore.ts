import { promises as fs } from 'fs';
import path from 'path';

export type SecuritySeverity = 'info' | 'warning' | 'critical';

export type SecurityEventType =
  | 'otp_requested'
  | 'otp_request_rate_limited'
  | 'otp_verified'
  | 'otp_verify_failed'
  | 'otp_verify_rate_limited'
  | 'admin_login_succeeded'
  | 'admin_login_failed'
  | 'admin_login_rate_limited';

export type SecurityEvent = {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  identity?: string;
  ip?: string;
  detail?: string;
  createdAt: string;
};

type SecurityStoreModel = {
  events: SecurityEvent[];
};

const STORE_PATH = path.join(process.cwd(), 'data', 'security-store.json');
const MAX_EVENTS = 500;

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function buildSeedStore(): SecurityStoreModel {
  return { events: [] };
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), 'utf8');
  }
}

async function readStore(): Promise<SecurityStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<SecurityStoreModel>;
    return { events: Array.isArray(parsed.events) ? parsed.events : [] };
  } catch {
    return buildSeedStore();
  }
}

async function writeStore(store: SecurityStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeOptionalIdentity(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized.toLowerCase() : undefined;
}

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function recordSecurityEvent(input: {
  type: SecurityEventType;
  severity: SecuritySeverity;
  identity?: string;
  ip?: string;
  detail?: string;
}): Promise<SecurityEvent> {
  return withLock(async () => {
    const store = await readStore();
    const event: SecurityEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: input.type,
      severity: input.severity,
      identity: normalizeOptionalIdentity(input.identity),
      ip: normalizeOptionalText(input.ip),
      detail: input.detail?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    store.events.unshift(event);
    if (store.events.length > MAX_EVENTS) {
      store.events.length = MAX_EVENTS;
    }
    await writeStore(store);
    return event;
  });
}

export function listSecurityEvents(options?: { limit?: number }): Promise<SecurityEvent[]> {
  return withLock(async () => {
    const store = await readStore();
    return store.events.slice(0, options?.limit ?? store.events.length);
  });
}
