import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// pg-mem fournit une implémentation en mémoire compatible avec l'API du
// paquet 'pg' : on l'utilise pour tester les vraies requêtes SQL de
// storeDb.ts (transaction, SELECT ... FOR UPDATE) sans dépendre d'un
// PostgreSQL réel dans l'environnement de test/CI.
const mem = newDb({ autoCreateForeignKeyIndices: true });
const schema = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
mem.public.none(schema);

const { Pool } = mem.adapters.createPg();

vi.mock('pg', () => ({ Pool }));

process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

let readStore: typeof import('./storeDb').readStore;
let withStore: typeof import('./storeDb').withStore;

beforeAll(async () => {
  ({ readStore, withStore } = await import('./storeDb'));
});

type Counter = { value: number };

describe('storeDb', () => {
  it('seeds a store on first read and persists nothing yet', async () => {
    const key = `test-counter-${Math.random()}`;
    const result = await readStore<Counter>(key, () => ({ value: 42 }));
    expect(result).toEqual({ value: 42 });
  });

  it('withStore persists mutations across separate calls', async () => {
    const key = `test-counter-${Math.random()}`;
    await withStore<Counter, void>(key, () => ({ value: 0 }), (store) => {
      store.value += 1;
    });
    await withStore<Counter, void>(key, () => ({ value: 0 }), (store) => {
      store.value += 1;
    });

    const result = await readStore<Counter>(key, () => ({ value: -1 }));
    expect(result.value).toBe(2);
  });

  it('rolls back the transaction when fn throws, leaving state untouched', async () => {
    const key = `test-counter-${Math.random()}`;
    await withStore<Counter, void>(key, () => ({ value: 10 }), (store) => {
      store.value = 999;
    });

    await expect(
      withStore<Counter, void>(key, () => ({ value: 10 }), () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    const result = await readStore<Counter>(key, () => ({ value: -1 }));
    expect(result.value).toBe(999);
  });

  // Note: pg-mem est mono-thread et n'émule pas fidèlement le blocage réel
  // de `SELECT ... FOR UPDATE` entre transactions concurrentes d'un vrai
  // PostgreSQL — on ne teste donc ici que le séquentiel (ci-dessus), pas la
  // sérialisation sous concurrence réelle (à valider manuellement avec une
  // vraie base, ou dans un test d'intégration séparé).
});
