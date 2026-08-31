import { promises as fs } from 'fs';
import path from 'path';

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

const STORE_PATH = path.join(process.cwd(), 'data', 'quote-store.json');
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

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(INITIAL_STORE, null, 2), 'utf8');
  }
}

async function readStore(): Promise<QuoteStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<QuoteStoreModel>;
    return { requests: Array.isArray(parsed.requests) ? parsed.requests : [] };
  } catch {
    return { requests: [] };
  }
}

async function writeStore(store: QuoteStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
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
