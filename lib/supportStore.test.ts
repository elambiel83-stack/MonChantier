import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mem = newDb({ autoCreateForeignKeyIndices: true });
const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
mem.public.none(schema);
const { Pool } = mem.adapters.createPg();
vi.mock('pg', () => ({ Pool }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

let createTicket: typeof import('./supportStore').createTicket;
let addTicketMessage: typeof import('./supportStore').addTicketMessage;
let setTicketStatus: typeof import('./supportStore').setTicketStatus;
let getTicketById: typeof import('./supportStore').getTicketById;

beforeAll(async () => {
  ({ createTicket, addTicketMessage, setTicketStatus, getTicketById } = await import('./supportStore'));
});

describe('supportStore', () => {
  it('creates a ticket with the first message already in the thread', async () => {
    const ticket = await createTicket({
      identity: 'Client@Example.com',
      subject: 'Colis en retard',
      message: 'Ma commande n\'est pas arrivée.',
    });

    expect(ticket.identity).toBe('client@example.com');
    expect(ticket.status).toBe('open');
    expect(ticket.messages).toHaveLength(1);
    expect(ticket.messages[0].from).toBe('client');
  });

  it('moves the ticket to pending when staff replies', async () => {
    const ticket = await createTicket({ identity: 'a@b.com', subject: 'Question', message: 'Bonjour' });

    const result = await addTicketMessage({
      id: ticket.id,
      from: 'staff',
      authorIdentity: 'admin@monchantier.cd',
      message: 'On regarde ça.',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.status).toBe('pending');
      expect(result.ticket.messages).toHaveLength(2);
    }
  });

  it('reopens a closed ticket when the client writes again', async () => {
    const ticket = await createTicket({ identity: 'a@b.com', subject: 'Question 2', message: 'Bonjour' });
    await setTicketStatus(ticket.id, 'closed');

    const result = await addTicketMessage({
      id: ticket.id,
      from: 'client',
      authorIdentity: 'a@b.com',
      message: 'En fait j\'ai encore un souci',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.status).toBe('open');
    }
  });

  it('refuses a staff reply on a closed ticket', async () => {
    const ticket = await createTicket({ identity: 'a@b.com', subject: 'Question 3', message: 'Bonjour' });
    await setTicketStatus(ticket.id, 'closed');

    const result = await addTicketMessage({
      id: ticket.id,
      from: 'staff',
      authorIdentity: 'admin@monchantier.cd',
      message: 'Trop tard',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('closed');
    }
  });

  it('returns not_found for an unknown ticket id', async () => {
    const result = await addTicketMessage({
      id: 'unknown-id',
      from: 'client',
      authorIdentity: 'a@b.com',
      message: 'x',
    });
    expect(result).toEqual({ success: false, error: 'not_found' });
    expect(await getTicketById('unknown-id')).toBeNull();
  });
});
