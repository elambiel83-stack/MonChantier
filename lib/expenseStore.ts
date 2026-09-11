import { readStorePayload, writeStorePayload } from './serverStateStore';

export type StoredExpense = {
  id: number;
  label: string;
  category: string;
  amount: number;
  currency: 'USD' | 'CDF';
  date: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type ExpenseStoreModel = { expenses: StoredExpense[]; nextId: number };

const STORE_KEY = 'expense-store.json';
const INITIAL_STORE: ExpenseStoreModel = { expenses: [], nextId: 1 };

let storeMutex: Promise<void> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storeMutex.then(task, task);
  storeMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}


async function readStore(): Promise<ExpenseStoreModel> {
  const raw = await readStorePayload(STORE_KEY, () => JSON.stringify(INITIAL_STORE, null, 2), { legacyFileName: STORE_KEY });
  try {
    const parsed = JSON.parse(raw) as Partial<ExpenseStoreModel>;
    return {
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
    };
  } catch {
    return { ...INITIAL_STORE };
  }
}

async function writeStore(store: ExpenseStoreModel) {
  await writeStorePayload(STORE_KEY, JSON.stringify(store, null, 2));
}

export function listExpenses(): Promise<StoredExpense[]> {
  return withLock(async () => (await readStore()).expenses);
}

export function createExpense(input: {
  label: string;
  category: string;
  amount: number;
  currency: 'USD' | 'CDF';
  date: string;
  createdBy: string;
}): Promise<StoredExpense> {
  return withLock(async () => {
    const store = await readStore();
    const now = new Date().toISOString();
    const expense: StoredExpense = {
      id: store.nextId,
      label: input.label,
      category: input.category,
      amount: input.amount,
      currency: input.currency,
      date: input.date,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    store.expenses.push(expense);
    store.nextId += 1;
    await writeStore(store);
    return expense;
  });
}

export type UpdateExpensePatch = Partial<
  Pick<StoredExpense, 'label' | 'category' | 'amount' | 'currency' | 'date'>
>;

export function updateExpense(id: number, patch: UpdateExpensePatch): Promise<StoredExpense | null> {
  return withLock(async () => {
    const store = await readStore();
    const expense = store.expenses.find((e) => e.id === id);
    if (!expense) return null;
    Object.assign(expense, patch, { updatedAt: new Date().toISOString() });
    await writeStore(store);
    return expense;
  });
}

export function deleteExpense(id: number): Promise<boolean> {
  return withLock(async () => {
    const store = await readStore();
    const index = store.expenses.findIndex((e) => e.id === id);
    if (index === -1) return false;
    store.expenses.splice(index, 1);
    await writeStore(store);
    return true;
  });
}
