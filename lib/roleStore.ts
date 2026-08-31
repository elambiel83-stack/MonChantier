import { promises as fs } from "fs";
import path from "path";
import { AppRole, isAppRole } from "@/lib/roles";

type RoleStoreModel = {
  roles: Record<string, AppRole>;
};

const STORE_PATH = path.join(process.cwd(), "data", "role-store.json");
const INITIAL_STORE: RoleStoreModel = { roles: {} };

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(INITIAL_STORE, null, 2), "utf8");
  }
}

async function readStore(): Promise<RoleStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<RoleStoreModel>;
    const roles: Record<string, AppRole> = {};
    if (parsed.roles && typeof parsed.roles === "object") {
      for (const [identity, role] of Object.entries(parsed.roles)) {
        if (isAppRole(role)) {
          roles[identity] = role;
        }
      }
    }
    return { roles };
  } catch {
    return { roles: {} };
  }
}

async function writeStore(store: RoleStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

export function getStoredRole(identity: string): Promise<AppRole | null> {
  return withLock(async () => {
    const store = await readStore();
    return store.roles[normalizeIdentity(identity)] || null;
  });
}

export function setStoredRole(identity: string, role: AppRole): Promise<void> {
  return withLock(async () => {
    const store = await readStore();
    store.roles[normalizeIdentity(identity)] = role;
    await writeStore(store);
  });
}

export function listStoredRoles(): Promise<Record<string, AppRole>> {
  return withLock(async () => {
    const store = await readStore();
    return store.roles;
  });
}
