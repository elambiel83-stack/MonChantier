import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = newDb({ autoCreateForeignKeyIndices: true });
const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
mem.public.none(schema);
const { Pool } = mem.adapters.createPg();
vi.mock('pg', () => ({ Pool }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// Chaque "source" simulée est juste une clé qui indexe dans PARSED_BY_SOURCE
// ci-dessous : pas besoin de vrais octets MIME pour tester la logique de
// routage (nouveau ticket / réponse / staff / automatisé).
const PARSED_BY_SOURCE = new Map<string, { from?: string; subject?: string; text?: string; headers?: Map<string, string> }>();

vi.mock('mailparser', () => ({
  simpleParser: vi.fn(async (source: string) => {
    const entry = PARSED_BY_SOURCE.get(source) || {};
    return {
      from: entry.from ? { value: [{ address: entry.from }] } : undefined,
      subject: entry.subject,
      text: entry.text,
      headers: entry.headers || new Map(),
    };
  }),
}));

type FakeMessage = { uid: number; source: string };
let inboxMessages: FakeMessage[] = [];
const flaggedSeen: number[] = [];

vi.mock('imapflow', () => ({
  ImapFlow: vi.fn().mockImplementation(() => ({
    connect: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    getMailboxLock: vi.fn(async () => ({ release: vi.fn() })),
    fetch: vi.fn(function* () {
      for (const message of inboxMessages) yield message;
    }),
    messageFlagsAdd: vi.fn(async (uid: number) => {
      flaggedSeen.push(uid);
      return true;
    }),
  })),
}));

let pollInboundSupportMail: typeof import('./inboundMail').pollInboundSupportMail;
let extractTicketId: typeof import('./inboundMail').extractTicketId;
let looksAutomated: typeof import('./inboundMail').looksAutomated;
let getTicketById: typeof import('./supportStore').getTicketById;

beforeAll(async () => {
  ({ pollInboundSupportMail, extractTicketId, looksAutomated } = await import('./inboundMail'));
  ({ getTicketById } = await import('./supportStore'));
});

beforeEach(() => {
  process.env.SUPPORT_IMAP_HOST = 'imap.example.com';
  process.env.SUPPORT_IMAP_USER = 'support@example.com';
  process.env.SUPPORT_IMAP_PASSWORD = 'secret';
  process.env.ADMIN_EMAILS = 'admin@monchantier.cd';
  inboxMessages = [];
  flaggedSeen.length = 0;
  PARSED_BY_SOURCE.clear();
});

afterEach(() => {
  delete process.env.SUPPORT_IMAP_HOST;
  delete process.env.SUPPORT_IMAP_USER;
  delete process.env.SUPPORT_IMAP_PASSWORD;
  delete process.env.ADMIN_EMAILS;
});

describe('extractTicketId', () => {
  it('extracts the ticket tag from a subject', () => {
    expect(extractTicketId('Re: Nouveau ticket support: Colis [TCK-123-abc]')).toBe('TCK-123-abc');
  });

  it('returns null when no tag is present', () => {
    expect(extractTicketId('Bonjour, question sur ma commande')).toBeNull();
  });
});

describe('looksAutomated', () => {
  it('flags an Auto-Submitted header', () => {
    expect(looksAutomated({ subject: 'x', headers: new Map([['auto-submitted', 'auto-replied']]) })).toBe(true);
  });

  it('does not flag Auto-Submitted: no', () => {
    expect(looksAutomated({ subject: 'x', headers: new Map([['auto-submitted', 'no']]) })).toBe(false);
  });

  it('flags an out-of-office subject', () => {
    expect(looksAutomated({ subject: 'Out of Office: back Monday', headers: new Map() })).toBe(true);
  });

  it('does not flag a normal message', () => {
    expect(looksAutomated({ subject: 'Ma commande', headers: new Map() })).toBe(false);
  });
});

describe('pollInboundSupportMail', () => {
  it('creates a new ticket from an unrecognized client email', async () => {
    inboxMessages = [{ uid: 1, source: 'msg-1' }];
    PARSED_BY_SOURCE.set('msg-1', { from: 'client@example.com', subject: 'Souci livraison', text: 'Ma commande est en retard' });

    const stats = await pollInboundSupportMail();

    expect(stats).toEqual({ processed: 1, ticketsCreated: 1, repliesAdded: 0, skipped: 0 });
    expect(flaggedSeen).toEqual([1]);
  });

  it('appends a client reply to the tagged ticket instead of creating a new one', async () => {
    inboxMessages = [{ uid: 1, source: 'first' }];
    PARSED_BY_SOURCE.set('first', { from: 'client2@example.com', subject: 'Question facture', text: 'Bonjour' });
    await pollInboundSupportMail();

    const tickets = await import('./supportStore').then((m) => m.listTicketsByIdentity('client2@example.com'));
    const ticketId = tickets[0].id;

    inboxMessages = [{ uid: 2, source: 'reply' }];
    PARSED_BY_SOURCE.set('reply', {
      from: 'client2@example.com',
      subject: `Re: Nouveau ticket support: Question facture [${ticketId}]`,
      text: 'Un détail en plus',
    });
    const stats = await pollInboundSupportMail();

    expect(stats).toEqual({ processed: 1, ticketsCreated: 0, repliesAdded: 1, skipped: 0 });
    const ticket = await getTicketById(ticketId);
    expect(ticket?.messages).toHaveLength(2);
    expect(ticket?.messages[1].from).toBe('client');
  });

  it('treats a reply from an ADMIN_EMAILS address as a staff message', async () => {
    inboxMessages = [{ uid: 1, source: 'first' }];
    PARSED_BY_SOURCE.set('first', { from: 'client3@example.com', subject: 'Aide', text: 'Bonjour' });
    await pollInboundSupportMail();
    const tickets = await import('./supportStore').then((m) => m.listTicketsByIdentity('client3@example.com'));
    const ticketId = tickets[0].id;

    inboxMessages = [{ uid: 2, source: 'staff-reply' }];
    PARSED_BY_SOURCE.set('staff-reply', {
      from: 'admin@monchantier.cd',
      subject: `Re: [${ticketId}]`,
      text: 'On regarde ça',
    });
    const stats = await pollInboundSupportMail();

    expect(stats.repliesAdded).toBe(1);
    const ticket = await getTicketById(ticketId);
    expect(ticket?.status).toBe('pending');
    expect(ticket?.messages[1].from).toBe('staff');
  });

  it('does not let a guessed tag attach a reply to someone else\'s ticket', async () => {
    inboxMessages = [{ uid: 1, source: 'victim' }];
    PARSED_BY_SOURCE.set('victim', { from: 'victim@example.com', subject: 'Privé', text: 'Confidentiel' });
    await pollInboundSupportMail();
    const tickets = await import('./supportStore').then((m) => m.listTicketsByIdentity('victim@example.com'));
    const ticketId = tickets[0].id;

    inboxMessages = [{ uid: 2, source: 'attacker' }];
    PARSED_BY_SOURCE.set('attacker', {
      from: 'attacker@example.com',
      subject: `Re: [${ticketId}]`,
      text: 'Je tente de m\'incruster',
    });
    const stats = await pollInboundSupportMail();

    // Refusé sur le ticket de la victime : un nouveau ticket est créé pour
    // l'attaquant à la place, pas d'ajout au fil d'autrui.
    expect(stats).toEqual({ processed: 1, ticketsCreated: 1, repliesAdded: 0, skipped: 0 });
    const victimTicket = await getTicketById(ticketId);
    expect(victimTicket?.messages).toHaveLength(1);
  });

  it('skips automated mail without creating a ticket', async () => {
    inboxMessages = [{ uid: 1, source: 'bounce' }];
    PARSED_BY_SOURCE.set('bounce', {
      from: 'mailer-daemon@example.com',
      subject: 'Undeliverable: Nouveau ticket support',
      text: '...',
      headers: new Map([['auto-submitted', 'auto-generated']]),
    });

    const stats = await pollInboundSupportMail();
    expect(stats).toEqual({ processed: 1, ticketsCreated: 0, repliesAdded: 0, skipped: 1 });
  });

  it('skips a stray staff email with no recognizable ticket tag', async () => {
    inboxMessages = [{ uid: 1, source: 'stray' }];
    PARSED_BY_SOURCE.set('stray', { from: 'admin@monchantier.cd', subject: 'Note interne', text: 'Pense-bête' });

    const stats = await pollInboundSupportMail();
    expect(stats).toEqual({ processed: 1, ticketsCreated: 0, repliesAdded: 0, skipped: 1 });
  });
});
