import { readStore, withStore } from './storeDb';

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

const STORE_KEY = 'site-store';
const buildInitialStore = (): SiteStoreModel => ({ sites: [] });

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listAllSites(): Promise<Site[]> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.sites;
}

export async function listSitesByManager(siteManagerIdentity: string): Promise<Site[]> {
  const normalized = siteManagerIdentity.trim().toLowerCase();
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.sites.filter((s) => s.siteManagerIdentity === normalized);
}

export async function getSiteById(id: string): Promise<Site | null> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.sites.find((s) => s.id === id) || null;
}

export function createSite(input: {
  name: string;
  address: string;
  clientIdentity?: string;
  siteManagerIdentity: string;
  budget?: number;
  currency?: 'USD' | 'CDF';
}): Promise<Site> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
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
    return site;
  });
}

export type UpdateSitePatch = Partial<Pick<Site, 'name' | 'address' | 'status' | 'budget' | 'currency' | 'team'>>;

export function updateSite(id: string, patch: UpdateSitePatch): Promise<Site | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const site = store.sites.find((s) => s.id === id);
    if (!site) return null;
    Object.assign(site, patch, { updatedAt: new Date().toISOString() });
    return site;
  });
}

export function addSiteTask(siteId: string, label: string, dueDate?: string): Promise<Site | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const site = store.sites.find((s) => s.id === siteId);
    if (!site) return null;
    site.tasks.push({ id: generateId('TASK'), label, done: false, dueDate, createdAt: new Date().toISOString() });
    site.updatedAt = new Date().toISOString();
    return site;
  });
}

export function setSiteTaskDone(siteId: string, taskId: string, done: boolean): Promise<Site | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const site = store.sites.find((s) => s.id === siteId);
    if (!site) return null;
    const task = site.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    task.done = done;
    site.updatedAt = new Date().toISOString();
    return site;
  });
}

export function addSiteIncident(siteId: string, label: string, severity: IncidentSeverity): Promise<Site | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
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
    return site;
  });
}

export function resolveSiteIncident(siteId: string, incidentId: string): Promise<Site | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const site = store.sites.find((s) => s.id === siteId);
    if (!site) return null;
    const incident = site.incidents.find((i) => i.id === incidentId);
    if (!incident) return null;
    incident.resolved = true;
    site.updatedAt = new Date().toISOString();
    return site;
  });
}
