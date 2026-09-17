import { readStore, withStore } from './storeDb';

// 'open' = en attente du staff (nouveau message client). 'pending' = le
// staff a répondu, en attente du client. 'closed' = résolu — un nouveau
// message du client le rouvre automatiquement en 'open'.
export type SupportTicketStatus = 'open' | 'pending' | 'closed';

// Canal d'origine du ticket : formulaire web authentifié, ou email entrant
// (voir lib/inboundMail.ts) — un client peut aussi simplement écrire à
// l'adresse support sans jamais se connecter au site.
export type SupportChannel = 'web' | 'email';

export type SupportMessageAuthor = 'client' | 'staff';

export type SupportMessage = {
  id: string;
  from: SupportMessageAuthor;
  authorIdentity: string;
  message: string;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  identity: string;
  subject: string;
  // Conservé pour compatibilité (affichage rapide) — le contenu complet vit
  // dans `messages[0]`.
  message: string;
  channel: SupportChannel;
  status: SupportTicketStatus;
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
};

type SupportStoreModel = { tickets: SupportTicket[] };

const STORE_KEY = 'support-store';
const buildInitialStore = (): SupportStoreModel => ({ tickets: [] });

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

export async function getTicketById(id: string): Promise<SupportTicket | null> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.tickets.find((t) => t.id === id) || null;
}

export function createTicket(input: {
  identity: string;
  subject: string;
  message: string;
  channel?: SupportChannel;
}): Promise<SupportTicket> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const now = new Date().toISOString();
    const identity = input.identity.trim().toLowerCase();
    const ticket: SupportTicket = {
      id: generateId('TCK'),
      identity,
      subject: input.subject,
      message: input.message,
      channel: input.channel || 'web',
      status: 'open',
      messages: [
        {
          id: generateId('MSG'),
          from: 'client',
          authorIdentity: identity,
          message: input.message,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    store.tickets.unshift(ticket);
    return ticket;
  });
}

export type AddTicketMessageResult =
  | { success: true; ticket: SupportTicket }
  | { success: false; error: 'not_found' | 'closed' };

/**
 * Ajoute un message au fil. Un message client rouvre automatiquement un
 * ticket 'closed' (statut 'open') ; un message staff le fait passer en
 * 'pending' (en attente du client) sauf s'il était déjà 'closed' (le staff
 * doit alors explicitement rouvrir via setTicketStatus avant de répondre).
 */
export function addTicketMessage(args: {
  id: string;
  from: SupportMessageAuthor;
  authorIdentity: string;
  message: string;
}): Promise<AddTicketMessageResult> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const ticket = store.tickets.find((t) => t.id === args.id);
    if (!ticket) return { success: false as const, error: 'not_found' as const };
    if (ticket.status === 'closed' && args.from === 'staff') {
      return { success: false as const, error: 'closed' as const };
    }

    const now = new Date().toISOString();
    ticket.messages.push({
      id: generateId('MSG'),
      from: args.from,
      authorIdentity: args.authorIdentity.trim().toLowerCase(),
      message: args.message,
      createdAt: now,
    });
    ticket.status = args.from === 'staff' ? 'pending' : 'open';
    ticket.updatedAt = now;

    return { success: true as const, ticket };
  });
}

export function setTicketStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const ticket = store.tickets.find((t) => t.id === id);
    if (!ticket) return null;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    return ticket;
  });
}
