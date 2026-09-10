import { readStore, withStore } from './storeDb';

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

const STORE_KEY = 'expense-store';
const buildInitialStore = (): ExpenseStoreModel => ({ expenses: [], nextId: 1 });

export async function listExpenses(): Promise<StoredExpense[]> {
  const store = await readStore(STORE_KEY, buildInitialStore);
  return store.expenses;
}

export function createExpense(input: {
  label: string;
  category: string;
  amount: number;
  currency: 'USD' | 'CDF';
  date: string;
  createdBy: string;
}): Promise<StoredExpense> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
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
    return expense;
  });
}

export type UpdateExpensePatch = Partial<
  Pick<StoredExpense, 'label' | 'category' | 'amount' | 'currency' | 'date'>
>;

export function updateExpense(id: number, patch: UpdateExpensePatch): Promise<StoredExpense | null> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const expense = store.expenses.find((e) => e.id === id);
    if (!expense) return null;
    Object.assign(expense, patch, { updatedAt: new Date().toISOString() });
    return expense;
  });
}

export function deleteExpense(id: number): Promise<boolean> {
  return withStore(STORE_KEY, buildInitialStore, (store) => {
    const index = store.expenses.findIndex((e) => e.id === id);
    if (index === -1) return false;
    store.expenses.splice(index, 1);
    return true;
  });
}
