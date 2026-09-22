import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/drcCities', () => ({ getCity: () => ({ lat: -10.7167, lng: 25.4725 }) }));

const mem = newDb({ autoCreateForeignKeyIndices: true });
const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
mem.public.none(schema);
const { Pool } = mem.adapters.createPg();
vi.mock('pg', () => ({ Pool }));
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

let api: typeof import('./deliveryStore');

beforeAll(async () => {
  api = await import('./deliveryStore');
});

async function assignedDelivery() {
  const delivery = await api.createDeliveryFromPayment({
    reference: `PAY-${Math.random()}`,
    clientIdentity: 'client@example.com',
    clientName: 'Client',
    deliveryAddress: 'Kolwezi',
    location: { lat: -10.7, lng: 25.47 },
  });
  const assigned = await api.assignDriver({
    id: delivery.id, driverIdentity: 'driver@example.com', assignedBy: 'admin@example.com',
  });
  if (!assigned.success) throw new Error('assignment failed');
  return assigned.delivery;
}

describe('delivery lifecycle', () => {
  it('crée une seule livraison par paiement', async () => {
    const reference = `PAY-${Math.random()}`;
    const first = await api.createDeliveryFromPayment({
      reference, clientIdentity: 'CLIENT@EXAMPLE.COM', clientName: 'Client', deliveryAddress: 'Kolwezi',
    });
    const second = await api.createDeliveryFromPayment({
      reference, clientIdentity: 'client@example.com', clientName: 'Client', deliveryAddress: 'Kolwezi',
    });
    expect(second.id).toBe(first.id);
    expect((await api.listDeliveriesByClient('client@example.com')).filter(d => d.reference === reference)).toHaveLength(1);
  });

  it('impose l’ordre assigned → picked_up → in_transit → delivered', async () => {
    const delivery = await assignedDelivery();
    const skipped = await api.updateDeliveryStatus({
      id: delivery.id, status: 'delivered', by: 'driver@example.com', requireDriverIdentity: 'driver@example.com',
    });
    expect(skipped).toEqual({ success: false, error: 'invalid_transition' });

    for (const status of ['picked_up', 'in_transit', 'delivered'] as const) {
      const result = await api.updateDeliveryStatus({
        id: delivery.id, status, by: 'driver@example.com', requireDriverIdentity: 'driver@example.com',
      });
      expect(result.success).toBe(true);
    }
  });

  it('interdit à un autre chauffeur de modifier la livraison', async () => {
    const delivery = await assignedDelivery();
    const result = await api.updateDeliveryStatus({
      id: delivery.id, status: 'picked_up', by: 'intrus@example.com', requireDriverIdentity: 'intrus@example.com',
    });
    expect(result).toEqual({ success: false, error: 'forbidden' });
  });

  it('refuse les coordonnées GPS hors limites', async () => {
    const delivery = await assignedDelivery();
    await api.updateDeliveryStatus({
      id: delivery.id, status: 'picked_up', by: 'driver@example.com', requireDriverIdentity: 'driver@example.com',
    });
    const result = await api.reportDeliveryPosition({
      id: delivery.id, driverIdentity: 'driver@example.com', lat: 200, lng: 25,
    });
    expect(result).toEqual({ success: false, error: 'invalid_position' });
  });

  it('refuse la réaffectation et conserve un historique horodaté', async () => {
    const delivery = await assignedDelivery();
    const second = await api.assignDriver({
      id: delivery.id, driverIdentity: 'other@example.com', assignedBy: 'admin@example.com',
    });
    expect(second).toEqual({ success: false, error: 'already_assigned' });
    const stored = await api.getDeliveryById(delivery.id);
    expect(stored?.statusHistory.map(entry => entry.status)).toEqual(['pending', 'assigned']);
  });
});
