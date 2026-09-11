import { promises as fs } from 'fs';
import path from 'path';
import { listAllDeliveries } from '@/lib/deliveryStore';
import { listPaymentStatuses } from '@/lib/paymentStore';

export type SiteStatus = 'planning' | 'active' | 'paused' | 'completed';
export type IncidentSeverity = 'low' | 'medium' | 'high';

export type SiteTeamMember = { identity: string; name: string; role: string };
export type SiteTask = { id: string; label: string; done: boolean; dueDate?: string; createdAt: string };
export type SiteIncident = {
  id: string;
  label: string;
  severity: IncidentSeverity;
  resolved: boolean;
  createdAt: string;
};

export type SiteMaterial = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  note?: string;
  updatedAt: string;
};

export type SiteDocument = {
  id: string;
  name: string;
  url: string;
  category: string;
  createdAt: string;
};

export type SitePhoto = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
};

export type SiteOrderReference = {
  reference: string;
  addedAt: string;
};

export type SiteDeliveryReference = {
  reference: string;
  addedAt: string;
};

export type Site = {
  id: string;
  name: string;
  address: string;
  clientIdentity?: string;
  siteManagerIdentity: string;
  status: SiteStatus;
  budget?: number;
  currency?: 'USD' | 'CDF';
  team: SiteTeamMember[];
  tasks: SiteTask[];
  incidents: SiteIncident[];
  materials: SiteMaterial[];
  documents: SiteDocument[];
  photos: SitePhoto[];
  orderReferences: SiteOrderReference[];
  deliveryReferences: SiteDeliveryReference[];
  createdAt: string;
  updatedAt: string;
};

type SiteStoreModel = { sites: Site[] };

const STORE_PATH = path.join(process.cwd(), 'data', 'site-store.json');
const INITIAL_STORE: SiteStoreModel = { sites: [] };

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIdentity(value?: string) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAddress(value?: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function addressesLikelyMatch(left?: string, right?: string) {
  const normalizedLeft = normalizeAddress(left);
  const normalizedRight = normalizeAddress(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  const [longer, shorter] =
    normalizedLeft.length >= normalizedRight.length
      ? [normalizedLeft, normalizedRight]
      : [normalizedRight, normalizedLeft];
  return shorter.length >= 10 && longer.includes(shorter);
}

function addUniqueReference<T extends { reference: string; addedAt: string }>(
  list: T[],
  factory: () => T
) {
  const next = factory();
  if (list.some((entry) => entry.reference === next.reference)) return false;
  list.push(next);
  return true;
}

function findBestMatchingSiteIndex(
  sites: Site[],
  input: { clientIdentity?: string; address?: string }
) {
  const clientIdentity = normalizeIdentity(input.clientIdentity);
  const address = input.address;
  const scored = sites
    .map((site, index) => {
      const sameAddress = addressesLikelyMatch(site.address, address);
      const sameClient = clientIdentity && normalizeIdentity(site.clientIdentity) === clientIdentity;
      return { index, sameAddress, sameClient };
    })
    .filter((entry) => entry.sameAddress || entry.sameClient);

  const addressAndClient = scored.find((entry) => entry.sameAddress && entry.sameClient);
  if (addressAndClient) return addressAndClient.index;

  const addressMatches = scored.filter((entry) => entry.sameAddress);
  if (addressMatches.length === 1) return addressMatches[0].index;
  if (addressMatches.length > 1) {
    const clientAware = addressMatches.find((entry) => entry.sameClient);
    if (clientAware) return clientAware.index;
  }

  const clientMatches = scored.filter((entry) => entry.sameClient);
  if (clientMatches.length === 1) return clientMatches[0].index;

  return -1;
}

function backfillSiteReferences(
  site: Site,
  payments: Awaited<ReturnType<typeof listPaymentStatuses>>,
  deliveries: Awaited<ReturnType<typeof listAllDeliveries>>
) {
  let changed = false;

  for (const payment of payments) {
    if (!payment.reference) continue;
    if (!addressesLikelyMatch(site.address, payment.fullInvoice?.deliveryAddress)) continue;
    if (
      site.clientIdentity &&
      payment.fullInvoice?.customerEmail &&
      normalizeIdentity(site.clientIdentity) !== normalizeIdentity(payment.fullInvoice.customerEmail)
    ) {
      continue;
    }
    changed =
      addUniqueReference(site.orderReferences, () => ({
        reference: payment.reference,
        addedAt: payment.updatedAt || new Date().toISOString(),
      })) || changed;
  }

  for (const delivery of deliveries) {
    if (!delivery.reference) continue;
    if (!addressesLikelyMatch(site.address, delivery.deliveryAddress)) continue;
    if (site.clientIdentity && normalizeIdentity(site.clientIdentity) !== normalizeIdentity(delivery.clientIdentity)) {
      continue;
    }
    changed =
      addUniqueReference(site.deliveryReferences, () => ({
        reference: delivery.reference,
        addedAt: delivery.createdAt || new Date().toISOString(),
      })) || changed;
  }

  return changed;
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(INITIAL_STORE, null, 2), 'utf8');
  }
}

async function readStore(): Promise<SiteStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<SiteStoreModel>;
    return {
      sites: Array.isArray(parsed.sites)
        ? parsed.sites.map((site) => ({
            ...site,
            team: Array.isArray(site.team) ? site.team : [],
            tasks: Array.isArray(site.tasks) ? site.tasks : [],
            incidents: Array.isArray(site.incidents) ? site.incidents : [],
            materials: Array.isArray(site.materials) ? site.materials : [],
            documents: Array.isArray(site.documents) ? site.documents : [],
            photos: Array.isArray(site.photos) ? site.photos : [],
            orderReferences: Array.isArray(site.orderReferences)
              ? site.orderReferences
                  .filter((entry) => entry && typeof entry === 'object')
                  .map((entry) => ({
                    reference: String(entry.reference || '').trim(),
                    addedAt: String(entry.addedAt || '').trim() || new Date().toISOString(),
                  }))
                  .filter((entry) => entry.reference)
              : [],
            deliveryReferences: Array.isArray(site.deliveryReferences)
              ? site.deliveryReferences
                  .filter((entry) => entry && typeof entry === 'object')
                  .map((entry) => ({
                    reference: String(entry.reference || '').trim(),
                    addedAt: String(entry.addedAt || '').trim() || new Date().toISOString(),
                  }))
                  .filter((entry) => entry.reference)
              : [],
          }))
        : [],
    };
  } catch {
    return { ...INITIAL_STORE };
  }
}

async function writeStore(store: SiteStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export function listAllSites(): Promise<Site[]> {
  return withLock(async () => (await readStore()).sites);
}

export function listSitesByManager(siteManagerIdentity: string): Promise<Site[]> {
  const normalized = siteManagerIdentity.trim().toLowerCase();
  return withLock(async () => (await readStore()).sites.filter((s) => s.siteManagerIdentity === normalized));
}

export function getSiteById(id: string): Promise<Site | null> {
  return withLock(async () => (await readStore()).sites.find((s) => s.id === id) || null);
}

export function createSite(input: {
  name: string;
  address: string;
  clientIdentity?: string;
  siteManagerIdentity: string;
  budget?: number;
  currency?: 'USD' | 'CDF';
}): Promise<Site> {
  return withLock(async () => {
    const [payments, deliveries] = await Promise.all([listPaymentStatuses(), listAllDeliveries()]);
    const store = await readStore();
    const now = new Date().toISOString();
    const site: Site = {
      id: generateId('SITE'),
      name: input.name,
      address: input.address,
      clientIdentity: input.clientIdentity?.trim().toLowerCase(),
      siteManagerIdentity: input.siteManagerIdentity.trim().toLowerCase(),
      status: 'planning',
      budget: input.budget,
      currency: input.currency,
      team: [],
      tasks: [],
      incidents: [],
      materials: [],
      documents: [],
      photos: [],
      orderReferences: [],
      deliveryReferences: [],
      createdAt: now,
      updatedAt: now,
    };
    backfillSiteReferences(site, payments, deliveries);
    store.sites.push(site);
    await writeStore(store);
    return site;
  });
}

export type UpdateSitePatch = Partial<
  Pick<
    Site,
    | 'name'
    | 'address'
    | 'status'
    | 'budget'
    | 'currency'
    | 'team'
    | 'materials'
    | 'documents'
    | 'photos'
    | 'orderReferences'
    | 'deliveryReferences'
  >
>;

export function updateSite(id: string, patch: UpdateSitePatch): Promise<Site | null> {
  return withLock(async () => {
    const store = await readStore();
    const site = store.sites.find((s) => s.id === id);
    if (!site) return null;
    Object.assign(site, patch, { updatedAt: new Date().toISOString() });
    await writeStore(store);
    return site;
  });
}

export function addSiteTask(siteId: string, label: string, dueDate?: string): Promise<Site | null> {
  return withLock(async () => {
    const store = await readStore();
    const site = store.sites.find((s) => s.id === siteId);
    if (!site) return null;
    site.tasks.push({ id: generateId('TASK'), label, done: false, dueDate, createdAt: new Date().toISOString() });
    site.updatedAt = new Date().toISOString();
    await writeStore(store);
    return site;
  });
}

export function setSiteTaskDone(siteId: string, taskId: string, done: boolean): Promise<Site | null> {
  return withLock(async () => {
    const store = await readStore();
    const site = store.sites.find((s) => s.id === siteId);
    if (!site) return null;
    const task = site.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    task.done = done;
    site.updatedAt = new Date().toISOString();
    await writeStore(store);
    return site;
  });
}

export function addSiteIncident(siteId: string, label: string, severity: IncidentSeverity): Promise<Site | null> {
  return withLock(async () => {
    const store = await readStore();
    const site = store.sites.find((s) => s.id === siteId);
    if (!site) return null;
    site.incidents.push({
      id: generateId('INC'),
      label,
      severity,
      resolved: false,
      createdAt: new Date().toISOString(),
    });
    site.updatedAt = new Date().toISOString();
    await writeStore(store);
    return site;
  });
}

export function resolveSiteIncident(siteId: string, incidentId: string): Promise<Site | null> {
  return withLock(async () => {
    const store = await readStore();
    const site = store.sites.find((s) => s.id === siteId);
    if (!site) return null;
    const incident = site.incidents.find((i) => i.id === incidentId);
    if (!incident) return null;
    incident.resolved = true;
    site.updatedAt = new Date().toISOString();
    await writeStore(store);
    return site;
  });
}

export function autoLinkOrderReferenceToSite(input: {
  reference: string;
  clientIdentity?: string;
  deliveryAddress?: string;
}): Promise<Site | null> {
  return withLock(async () => {
    const store = await readStore();
    const index = findBestMatchingSiteIndex(store.sites, {
      clientIdentity: input.clientIdentity,
      address: input.deliveryAddress,
    });
    if (index === -1) return null;
    const site = store.sites[index];
    const changed = addUniqueReference(site.orderReferences, () => ({
      reference: input.reference,
      addedAt: new Date().toISOString(),
    }));
    if (!changed) return site;
    site.updatedAt = new Date().toISOString();
    await writeStore(store);
    return site;
  });
}

export function autoLinkDeliveryReferenceToSite(input: {
  reference: string;
  clientIdentity?: string;
  deliveryAddress?: string;
}): Promise<Site | null> {
  return withLock(async () => {
    const store = await readStore();
    const index = findBestMatchingSiteIndex(store.sites, {
      clientIdentity: input.clientIdentity,
      address: input.deliveryAddress,
    });
    if (index === -1) return null;
    const site = store.sites[index];
    const changed = addUniqueReference(site.deliveryReferences, () => ({
      reference: input.reference,
      addedAt: new Date().toISOString(),
    }));
    if (!changed) return site;
    site.updatedAt = new Date().toISOString();
    await writeStore(store);
    return site;
  });
}
