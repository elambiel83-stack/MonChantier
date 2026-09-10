import { readStore, withStore } from './storeDb';

export type ProjectStatus = 'planning' | 'in_progress' | 'completed';

export type ClientProject = {
  id: string;
  name: string;
  address?: string;
  status: ProjectStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectStoreModel = { projects: Record<string, ClientProject[]> };

const STORE_KEY = 'project-store';
const buildInitialStore = (): ProjectStoreModel => ({ projects: {} });

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

function generateId() {
  return `PRJ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listProjects(identity: string): Promise<ClientProject[]> {
  const normalized = normalizeIdentity(identity);
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.projects[normalized] || [];
}

export function createProject(
  identity: string,
  input: { name: string; address?: string; notes?: string }
): Promise<ClientProject[]> {
  const normalized = normalizeIdentity(identity);
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const list = store.projects[normalized] || [];
    const now = new Date().toISOString();
    list.push({
      id: generateId(),
      name: input.name,
      address: input.address,
      notes: input.notes,
      status: 'planning',
      createdAt: now,
      updatedAt: now,
    });
    store.projects[normalized] = list;
    return list;
  });
}

export function updateProjectStatus(
  identity: string,
  id: string,
  status: ProjectStatus
): Promise<ClientProject[]> {
  const normalized = normalizeIdentity(identity);
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const list = store.projects[normalized] || [];
    const project = list.find((p) => p.id === id);
    if (project) {
      project.status = status;
      project.updatedAt = new Date().toISOString();
    }
    store.projects[normalized] = list;
    return list;
  });
}

export function deleteProject(identity: string, id: string): Promise<ClientProject[]> {
  const normalized = normalizeIdentity(identity);
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const list = (store.projects[normalized] || []).filter((p) => p.id !== id);
    store.projects[normalized] = list;
    return list;
  });
}
