import { readStorePayload, writeStorePayload } from './serverStateStore';

export type SupportTicketStatus = 'open' | 'closed';

export type SupportTicket = {
  id: string;
  identity: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
};

type SupportStoreModel = { tickets: SupportTicket[] };

const STORE_KEY = 'support-store.json';
const INITIAL_STORE: SupportStoreModel = { tickets: [] };

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function generateId() {
  return `TCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}


async function readStore(): Promise<SupportStoreModel> {
  const raw = await readStorePayload(STORE_KEY, () => JSON.stringify(INITIAL_STORE, null, 2), { legacyFileName: STORE_KEY });
  try {
    const parsed = JSON.parse(raw) as Partial<SupportStoreModel>;
    return { tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [] };
  } catch {
    return { ...INITIAL_STORE };
  }
}

async function writeStore(store: SupportStoreModel) {
  await writeStorePayload(STORE_KEY, JSON.stringify(store, null, 2));
}

export function listTicketsByIdentity(identity: string): Promise<SupportTicket[]> {
  const normalized = identity.trim().toLowerCase();
  return withLock(async () => (await readStore()).tickets.filter((t) => t.identity === normalized));
}

export function listAllTickets(): Promise<SupportTicket[]> {
  return withLock(async () => (await readStore()).tickets);
}

export function createTicket(input: { identity: string; subject: string; message: string }): Promise<SupportTicket> {
  return withLock(async () => {
    const store = await readStore();
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: generateId(),
      identity: input.identity.trim().toLowerCase(),
      subject: input.subject,
      message: input.message,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    store.tickets.unshift(ticket);
    await writeStore(store);
    return ticket;
  });
}
