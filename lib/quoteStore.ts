import { readStore, withStore } from './storeDb';

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

const STORE_KEY = 'quote-store';
const buildInitialStore = (): QuoteStoreModel => ({ requests: [] });
const MAX_REQUESTS = 500;

export function recordQuoteRequest(entry: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  services?: string[];
}): Promise<StoredQuoteRequest> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
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
    return request;
  });
}

export async function listQuoteRequestsByEmail(email: string): Promise<StoredQuoteRequest[]> {
  const normalized = email.trim().toLowerCase();
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.requests.filter((request) => request.email.trim().toLowerCase() === normalized);
}
