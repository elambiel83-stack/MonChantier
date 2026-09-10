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

let claimPaymentConfirmation: typeof import('./paymentStore').claimPaymentConfirmation;
let releasePaymentClaim: typeof import('./paymentStore').releasePaymentClaim;
let setStoredPaymentStatus: typeof import('./paymentStore').setStoredPaymentStatus;
let claimWebhookEvent: typeof import('./paymentStore').claimWebhookEvent;
let unclaimWebhookEvent: typeof import('./paymentStore').unclaimWebhookEvent;

beforeAll(async () => {
  ({ claimPaymentConfirmation, releasePaymentClaim, setStoredPaymentStatus, claimWebhookEvent, unclaimWebhookEvent } =
    await import('./paymentStore'));
});

describe('claimPaymentConfirmation', () => {
  it('claims a fresh reference', async () => {
    const result = await claimPaymentConfirmation(`ref-${Math.random()}`, 'card');
    expect(result.outcome).toBe('claimed');
  });

  it('returns in_progress for a reference already being confirmed', async () => {
    const reference = `ref-${Math.random()}`;
    const first = await claimPaymentConfirmation(reference, 'card');
    expect(first.outcome).toBe('claimed');

    const second = await claimPaymentConfirmation(reference, 'card');
    expect(second.outcome).toBe('in_progress');
  });

  it('returns already_confirmed with the stored invoice once confirmed', async () => {
    const reference = `ref-${Math.random()}`;
    await setStoredPaymentStatus({
      reference,
      method: 'card',
      state: 'confirmed',
      updatedAt: new Date().toISOString(),
      invoice: { number: 'FAC-1', sent: true, email: 'a@b.com', standard: 'x', legalReference: 'y', taxRate: 16, totals: { ht: 1, tva: 1, ttc: 2, currency: 'USD' } },
    });

    const result = await claimPaymentConfirmation(reference, 'card');
    expect(result.outcome).toBe('already_confirmed');
    if (result.outcome === 'already_confirmed') {
      expect(result.status.invoice?.number).toBe('FAC-1');
    }
  });

  it('allows a retry after releasePaymentClaim (failed confirmation)', async () => {
    const reference = `ref-${Math.random()}`;
    await claimPaymentConfirmation(reference, 'card');
    await releasePaymentClaim(reference);

    const retry = await claimPaymentConfirmation(reference, 'card');
    expect(retry.outcome).toBe('claimed');
  });
});

describe('claimWebhookEvent / unclaimWebhookEvent', () => {
  it('claims a fresh event once, rejects a concurrent duplicate', async () => {
    const eventId = `evt-${Math.random()}`;
    const first = await claimWebhookEvent('stripe', eventId);
    const second = await claimWebhookEvent('stripe', eventId);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('allows reclaiming after unclaim (failed processing)', async () => {
    const eventId = `evt-${Math.random()}`;
    await claimWebhookEvent('paypal', eventId);
    await unclaimWebhookEvent('paypal', eventId);

    const retry = await claimWebhookEvent('paypal', eventId);
    expect(retry).toBe(true);
  });

  it('keeps stripe and paypal event ids independent', async () => {
    const eventId = `evt-${Math.random()}`;
    const stripeClaim = await claimWebhookEvent('stripe', eventId);
    const paypalClaim = await claimWebhookEvent('paypal', eventId);
    expect(stripeClaim).toBe(true);
    expect(paypalClaim).toBe(true);
  });
});
