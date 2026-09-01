import { promises as fs } from 'fs';
import path from 'path';

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

const STORE_PATH = path.join(process.cwd(), 'data', 'project-store.json');
const INITIAL_STORE: ProjectStoreModel = { projects: {} };

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

function generateId() {
  return `PRJ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(INITIAL_STORE, null, 2), 'utf8');
  }
}

async function readStore(): Promise<ProjectStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectStoreModel>;
    return { projects: parsed.projects && typeof parsed.projects === 'object' ? parsed.projects : {} };
  } catch {
    return { ...INITIAL_STORE };
  }
}

async function writeStore(store: ProjectStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export function listProjects(identity: string): Promise<ClientProject[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => (await readStore()).projects[normalized] || []);
}

export function createProject(
  identity: string,
  input: { name: string; address?: string; notes?: string }
): Promise<ClientProject[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
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
    await writeStore(store);
    return list;
  });
}

export function updateProjectStatus(
  identity: string,
  id: string,
  status: ProjectStatus
): Promise<ClientProject[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const list = store.projects[normalized] || [];
    const project = list.find((p) => p.id === id);
    if (project) {
      project.status = status;
      project.updatedAt = new Date().toISOString();
    }
    store.projects[normalized] = list;
    await writeStore(store);
    return list;
  });
}

export function deleteProject(identity: string, id: string): Promise<ClientProject[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    const list = (store.projects[normalized] || []).filter((p) => p.id !== id);
    store.projects[normalized] = list;
    await writeStore(store);
    return list;
  });
}
