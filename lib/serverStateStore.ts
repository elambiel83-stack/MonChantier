import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

function getDataDirectory() {
  return path.join(process.cwd(), 'data');
}

function getDatabasePath() {
  return process.env.MONCHANTIER_STATE_DB_PATH || path.join(getDataDirectory(), 'monchantier.sqlite');
}

declare global {
  // eslint-disable-next-line no-var
  var __monchantier_state_dbs__: Map<string, DatabaseSync> | undefined;
}

function ensureDatabaseDirectory(databasePath: string) {
  mkdirSync(path.dirname(databasePath), { recursive: true });
}

function getDatabase() {
  const databasePath = getDatabasePath();
  if (!globalThis.__monchantier_state_dbs__) {
    globalThis.__monchantier_state_dbs__ = new Map();
  }

  const existing = globalThis.__monchantier_state_dbs__.get(databasePath);
  if (existing) {
    return existing;
  }

  ensureDatabaseDirectory(databasePath);
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS json_state (
      store_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  globalThis.__monchantier_state_dbs__.set(databasePath, database);
  return database;
}

function loadLegacyPayload(legacyFileName: string | undefined, createInitialPayload: () => string) {
  if (legacyFileName) {
    const legacyPath = path.join(getDataDirectory(), legacyFileName);
    if (existsSync(legacyPath)) {
      return readFileSync(legacyPath, 'utf8');
    }
  }

  return createInitialPayload();
}

export async function readStorePayload(
  storeKey: string,
  createInitialPayload: () => string,
  options?: { legacyFileName?: string }
) {
  const database = getDatabase();
  const existing = database
    .prepare('SELECT payload FROM json_state WHERE store_key = ?')
    .get(storeKey) as { payload?: string } | undefined;

  if (typeof existing?.payload === 'string') {
    return existing.payload;
  }

  const payload = loadLegacyPayload(options?.legacyFileName, createInitialPayload);
  database
    .prepare(
      `INSERT INTO json_state (store_key, payload, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(store_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(storeKey, payload);

  return payload;
}

export async function writeStorePayload(storeKey: string, payload: string) {
  const database = getDatabase();
  database
    .prepare(
      `INSERT INTO json_state (store_key, payload, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(store_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(storeKey, payload);
}
