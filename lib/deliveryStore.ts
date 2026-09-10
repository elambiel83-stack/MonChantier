import { getCity } from '@/lib/drcCities';
import { readStore, withStore } from './storeDb';

export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type DeliveryCoordinates = { lat: number; lng: number };

export type DeliveryPositionPing = {
  lat: number;
  lng: number;
  at: string;
};

export type DeliveryStatusEntry = {
  id: string;
  at: string;
  by: string;
  status: DeliveryStatus;
  note?: string;
};

export type Delivery = {
  id: string;
  reference: string;
  clientIdentity: string;
  clientName: string;
  driverIdentity?: string;
  status: DeliveryStatus;
  deliveryAddress: string;
  destination: DeliveryCoordinates | null;
  origin: DeliveryCoordinates;
  currentPosition?: DeliveryPositionPing;
  positionHistory: DeliveryPositionPing[];
  createdAt: string;
  statusHistory: DeliveryStatusEntry[];
};

type DeliveryStoreModel = { deliveries: Delivery[] };

const STORE_KEY = 'delivery-store';
const buildInitialStore = (): DeliveryStoreModel => ({ deliveries: [] });
const MAX_POSITION_HISTORY = 200;

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

function makeId() {
  return `DLV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Ordre des statuts valides : chaque transition ne peut avancer que d'un cran
// (ou passer à "cancelled" depuis n'importe quel statut non terminal).
const STATUS_ORDER: DeliveryStatus[] = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
];

function isValidTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (to === 'cancelled') return from !== 'delivered' && from !== 'cancelled';
  const fromIndex = STATUS_ORDER.indexOf(from);
  const toIndex = STATUS_ORDER.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

export function createDeliveryFromPayment(args: {
  reference: string;
  clientIdentity: string;
  clientName: string;
  deliveryAddress: string;
  location?: { lat?: number; lng?: number } | null;
}): Promise<Delivery> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const alreadyExists = store.deliveries.some((delivery) => delivery.reference === args.reference);
    if (alreadyExists) {
      return store.deliveries.find((delivery) => delivery.reference === args.reference)!;
    }

    const origin = getCity('Kolwezi');
    const destination =
      args.location?.lat !== undefined && args.location?.lng !== undefined
        ? { lat: args.location.lat, lng: args.location.lng }
        : null;

    const delivery: Delivery = {
      id: makeId(),
      reference: args.reference,
      clientIdentity: normalizeIdentity(args.clientIdentity),
      clientName: args.clientName,
      status: 'pending',
      deliveryAddress: args.deliveryAddress,
      destination,
      origin: { lat: origin.lat, lng: origin.lng },
      positionHistory: [],
      createdAt: new Date().toISOString(),
      statusHistory: [
        { id: makeEntryId(), at: new Date().toISOString(), by: 'system', status: 'pending' },
      ],
    };

    store.deliveries.unshift(delivery);
    return delivery;
  });
}

export async function listDeliveriesByClient(identity: string): Promise<Delivery[]> {
  const normalized = normalizeIdentity(identity);
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.deliveries.filter((delivery) => delivery.clientIdentity === normalized);
}

export async function listDeliveriesByDriver(identity: string): Promise<Delivery[]> {
  const normalized = normalizeIdentity(identity);
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.deliveries.filter((delivery) => delivery.driverIdentity === normalized);
}

export async function listUnassignedDeliveries(): Promise<Delivery[]> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.deliveries.filter((delivery) => delivery.status === 'pending' && !delivery.driverIdentity);
}

export async function listAllDeliveries(): Promise<Delivery[]> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.deliveries;
}

export async function getDeliveryById(id: string): Promise<Delivery | null> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.deliveries.find((delivery) => delivery.id === id) || null;
}

export type AssignDriverResult =
  | { success: true; delivery: Delivery }
  | { success: false; error: 'not_found' | 'already_assigned' };

export function assignDriver(args: {
  id: string;
  driverIdentity: string;
  assignedBy: string;
}): Promise<AssignDriverResult> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const delivery = store.deliveries.find((item) => item.id === args.id);
    if (!delivery) return { success: false as const, error: 'not_found' as const };
    if (delivery.driverIdentity) return { success: false as const, error: 'already_assigned' as const };

    delivery.driverIdentity = normalizeIdentity(args.driverIdentity);
    delivery.status = 'assigned';
    delivery.statusHistory.push({
      id: makeEntryId(),
      at: new Date().toISOString(),
      by: args.assignedBy,
      status: 'assigned',
      note: delivery.driverIdentity,
    });

    return { success: true as const, delivery };
  });
}

export type UpdateStatusResult =
  | { success: true; delivery: Delivery }
  | { success: false; error: 'not_found' | 'forbidden' | 'invalid_transition' };

export function updateDeliveryStatus(args: {
  id: string;
  status: DeliveryStatus;
  by: string;
  requireDriverIdentity?: string;
  note?: string;
}): Promise<UpdateStatusResult> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const delivery = store.deliveries.find((item) => item.id === args.id);
    if (!delivery) return { success: false as const, error: 'not_found' as const };

    if (
      args.requireDriverIdentity &&
      delivery.driverIdentity !== normalizeIdentity(args.requireDriverIdentity)
    ) {
      return { success: false as const, error: 'forbidden' as const };
    }

    if (!isValidTransition(delivery.status, args.status)) {
      return { success: false as const, error: 'invalid_transition' as const };
    }

    delivery.status = args.status;
    delivery.statusHistory.push({
      id: makeEntryId(),
      at: new Date().toISOString(),
      by: args.by,
      status: args.status,
      note: args.note,
    });

    return { success: true as const, delivery };
  });
}

export type ReportPositionResult =
  | { success: true; delivery: Delivery }
  | { success: false; error: 'not_found' | 'forbidden' | 'not_active' };

export function reportDeliveryPosition(args: {
  id: string;
  driverIdentity: string;
  lat: number;
  lng: number;
}): Promise<ReportPositionResult> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const delivery = store.deliveries.find((item) => item.id === args.id);
    if (!delivery) return { success: false as const, error: 'not_found' as const };
    if (delivery.driverIdentity !== normalizeIdentity(args.driverIdentity)) {
      return { success: false as const, error: 'forbidden' as const };
    }
    if (delivery.status !== 'picked_up' && delivery.status !== 'in_transit') {
      return { success: false as const, error: 'not_active' as const };
    }

    const ping: DeliveryPositionPing = { lat: args.lat, lng: args.lng, at: new Date().toISOString() };
    delivery.currentPosition = ping;
    delivery.positionHistory.push(ping);
    if (delivery.positionHistory.length > MAX_POSITION_HISTORY) {
      delivery.positionHistory = delivery.positionHistory.slice(-MAX_POSITION_HISTORY);
    }

    return { success: true as const, delivery };
  });
}
