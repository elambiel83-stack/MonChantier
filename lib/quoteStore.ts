import { readStorePayload, writeStorePayload } from './serverStateStore';

export type StoredQuoteRequest = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  services: string[];
  createdAt: string;
};

type QuoteStoreModel = {
  requests: StoredQuoteRequest[];
};

const STORE_KEY = 'quote-store.json';
const INITIAL_STORE: QuoteStoreModel = { requests: [] };
const MAX_REQUESTS = 500;

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}


async function readStore(): Promise<QuoteStoreModel> {
  const raw = await readStorePayload(STORE_KEY, () => JSON.stringify(INITIAL_STORE, null, 2), { legacyFileName: STORE_KEY });
  try {
    const parsed = JSON.parse(raw) as Partial<QuoteStoreModel>;
    return { requests: Array.isArray(parsed.requests) ? parsed.requests : [] };
  } catch {
    return { requests: [] };
  }
}

async function writeStore(store: QuoteStoreModel) {
  await writeStorePayload(STORE_KEY, JSON.stringify(store, null, 2));
}

export function recordQuoteRequest(entry: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  services?: string[];
}): Promise<StoredQuoteRequest> {
  return withLock(async () => {
    const store = await readStore();
    const request: StoredQuoteRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: entry.name,
      email: entry.email,
      phone: entry.phone || '',
      message: entry.message,
      services: entry.services || [],
      createdAt: new Date().toISOString(),
    };
    store.requests.unshift(request);
    if (store.requests.length > MAX_REQUESTS) {
      store.requests.length = MAX_REQUESTS;
    }
    await writeStore(store);
    return request;
  });
}

export function listQuoteRequestsByEmail(email: string): Promise<StoredQuoteRequest[]> {
  const normalized = email.trim().toLowerCase();
  return withLock(async () => {
    const store = await readStore();
    return store.requests.filter((request) => request.email.trim().toLowerCase() === normalized);
  });
}

export function listAllQuoteRequests(): Promise<StoredQuoteRequest[]> {
  return withLock(async () => {
    const store = await readStore();
    return [...store.requests];
  });
}
