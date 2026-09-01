import { promises as fs } from 'fs';
import path from 'path';

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
    return { sites: Array.isArray(parsed.sites) ? parsed.sites : [] };
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
      createdAt: now,
      updatedAt: now,
    };
    store.sites.push(site);
    await writeStore(store);
    return site;
  });
}

export type UpdateSitePatch = Partial<Pick<Site, 'name' | 'address' | 'status' | 'budget' | 'currency' | 'team'>>;

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
