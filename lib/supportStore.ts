import { readStore, withStore } from './storeDb';

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

const STORE_KEY = 'support-store';
const buildInitialStore = (): SupportStoreModel => ({ tickets: [] });

function generateId() {
  return `TCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listTicketsByIdentity(identity: string): Promise<SupportTicket[]> {
  const normalized = identity.trim().toLowerCase();
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.tickets.filter((t) => t.identity === normalized);
}

export async function listAllTickets(): Promise<SupportTicket[]> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.tickets;
}

export function createTicket(input: { identity: string; subject: string; message: string }): Promise<SupportTicket> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
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
    return ticket;
  });
}
