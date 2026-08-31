import { promises as fs } from 'fs';
import path from 'path';
import { WalletCurrency } from '@/lib/walletExchange';

export type WalletDepositMethod = 'mobilemoney' | 'card' | 'paypal';

export type WalletDepositTransaction = {
  id: string;
  type: 'deposit';
  state: 'pending' | 'confirmed';
  reference: string;
  method: WalletDepositMethod;
  currency: WalletCurrency;
  amount: number;
  balanceAfter: number | null;
  createdAt: string;
  confirmedAt?: string;
};

export type WalletExchangeTransaction = {
  id: string;
  type: 'exchange';
  fromCurrency: WalletCurrency;
  fromAmount: number;
  toCurrency: WalletCurrency;
  toAmount: number;
  bccRate: number;
  appliedRate: number;
  marginPercent: number;
  createdAt: string;
};

export type WalletLoanTransaction = {
  id: string;
  type: 'loan_disbursement' | 'loan_repayment';
  loanId: string;
  currency: WalletCurrency;
  amount: number;
  balanceAfter: number;
  createdAt: string;
};

export type WalletTransaction =
  | WalletDepositTransaction
  | WalletExchangeTransaction
  | WalletLoanTransaction;

export type Wallet = {
  identity: string;
  balances: Record<WalletCurrency, number>;
  transactions: WalletTransaction[];
};

type WalletStoreModel = {
  wallets: Record<string, Wallet>;
};

const STORE_PATH = path.join(process.cwd(), 'data', 'wallet-store.json');
const INITIAL_STORE: WalletStoreModel = { wallets: {} };
const MAX_TRANSACTIONS = 500;

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
    await fs.writeFile(STORE_PATH, JSON.stringify(INITIAL_STORE, null, 2), 'utf8');
  }
}

async function readStore(): Promise<WalletStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<WalletStoreModel>;
    return { wallets: parsed.wallets && typeof parsed.wallets === 'object' ? parsed.wallets : {} };
  } catch {
    return { wallets: {} };
  }
}

async function writeStore(store: WalletStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function emptyWallet(identity: string): Wallet {
  return {
    identity,
    balances: { USD: 0, CDF: 0 },
    transactions: [],
  };
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getWallet(identity: string): Promise<Wallet> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    return store.wallets[normalized] || emptyWallet(normalized);
  });
}

export function registerPendingDeposit(args: {
  identity: string;
  reference: string;
  method: WalletDepositMethod;
  currency: WalletCurrency;
  amount: number;
}): Promise<Wallet> {
  const normalized = normalizeIdentity(args.identity);
  return withLock(async () => {
    const store = await readStore();
    const wallet = store.wallets[normalized] || emptyWallet(normalized);

    const alreadyExists = wallet.transactions.some(
      (tx) => tx.type === 'deposit' && tx.reference === args.reference
    );
    if (!alreadyExists) {
      const transaction: WalletDepositTransaction = {
        id: makeId(),
        type: 'deposit',
        state: 'pending',
        reference: args.reference,
        method: args.method,
        currency: args.currency,
        amount: round2(args.amount),
        balanceAfter: null,
        createdAt: new Date().toISOString(),
      };
      wallet.transactions.unshift(transaction);
      if (wallet.transactions.length > MAX_TRANSACTIONS) {
        wallet.transactions.length = MAX_TRANSACTIONS;
      }
    }

    store.wallets[normalized] = wallet;
    await writeStore(store);
    return wallet;
  });
}

export function confirmDeposit(args: {
  identity: string;
  reference: string;
  method: WalletDepositMethod;
  currency: WalletCurrency;
  amount: number;
}): Promise<{ wallet: Wallet; alreadyConfirmed: boolean }> {
  const normalized = normalizeIdentity(args.identity);
  return withLock(async () => {
    const store = await readStore();
    const wallet = store.wallets[normalized] || emptyWallet(normalized);

    const existing = wallet.transactions.find(
      (tx): tx is WalletDepositTransaction => tx.type === 'deposit' && tx.reference === args.reference
    );

    if (existing?.state === 'confirmed') {
      return { wallet, alreadyConfirmed: true };
    }

    const amount = round2(args.amount);
    const newBalance = round2((wallet.balances[args.currency] || 0) + amount);
    wallet.balances[args.currency] = newBalance;

    if (existing) {
      existing.state = 'confirmed';
      existing.balanceAfter = newBalance;
      existing.confirmedAt = new Date().toISOString();
    } else {
      const transaction: WalletDepositTransaction = {
        id: makeId(),
        type: 'deposit',
        state: 'confirmed',
        reference: args.reference,
        method: args.method,
        currency: args.currency,
        amount,
        balanceAfter: newBalance,
        createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
      };
      wallet.transactions.unshift(transaction);
      if (wallet.transactions.length > MAX_TRANSACTIONS) {
        wallet.transactions.length = MAX_TRANSACTIONS;
      }
    }

    store.wallets[normalized] = wallet;
    await writeStore(store);
    return { wallet, alreadyConfirmed: false };
  });
}

export type ApplyExchangeResult =
  | { success: true; wallet: Wallet; transaction: WalletExchangeTransaction }
  | { success: false; error: 'insufficient_balance' };

export function applyExchange(args: {
  identity: string;
  fromCurrency: WalletCurrency;
  fromAmount: number;
  toCurrency: WalletCurrency;
  toAmount: number;
  bccRate: number;
  appliedRate: number;
  marginPercent: number;
}): Promise<ApplyExchangeResult> {
  const normalized = normalizeIdentity(args.identity);
  return withLock(async () => {
    const store = await readStore();
    const wallet = store.wallets[normalized] || emptyWallet(normalized);

    const currentFromBalance = wallet.balances[args.fromCurrency] || 0;
    if (currentFromBalance < args.fromAmount) {
      return { success: false, error: 'insufficient_balance' };
    }

    wallet.balances[args.fromCurrency] = round2(currentFromBalance - args.fromAmount);
    wallet.balances[args.toCurrency] = round2((wallet.balances[args.toCurrency] || 0) + args.toAmount);

    const transaction: WalletExchangeTransaction = {
      id: makeId(),
      type: 'exchange',
      fromCurrency: args.fromCurrency,
      fromAmount: round2(args.fromAmount),
      toCurrency: args.toCurrency,
      toAmount: round2(args.toAmount),
      bccRate: args.bccRate,
      appliedRate: args.appliedRate,
      marginPercent: args.marginPercent,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(transaction);
    if (wallet.transactions.length > MAX_TRANSACTIONS) {
      wallet.transactions.length = MAX_TRANSACTIONS;
    }

    store.wallets[normalized] = wallet;
    await writeStore(store);
    return { success: true, wallet, transaction };
  });
}

export function creditLoanDisbursement(args: {
  identity: string;
  loanId: string;
  currency: WalletCurrency;
  amount: number;
}): Promise<{ wallet: Wallet; transaction: WalletLoanTransaction }> {
  const normalized = normalizeIdentity(args.identity);
  return withLock(async () => {
    const store = await readStore();
    const wallet = store.wallets[normalized] || emptyWallet(normalized);

    const newBalance = round2((wallet.balances[args.currency] || 0) + args.amount);
    wallet.balances[args.currency] = newBalance;

    const transaction: WalletLoanTransaction = {
      id: makeId(),
      type: 'loan_disbursement',
      loanId: args.loanId,
      currency: args.currency,
      amount: round2(args.amount),
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(transaction);
    if (wallet.transactions.length > MAX_TRANSACTIONS) {
      wallet.transactions.length = MAX_TRANSACTIONS;
    }

    store.wallets[normalized] = wallet;
    await writeStore(store);
    return { wallet, transaction };
  });
}

export type DebitLoanRepaymentResult =
  | { success: true; wallet: Wallet; transaction: WalletLoanTransaction }
  | { success: false; error: 'insufficient_balance' };

export function debitLoanRepayment(args: {
  identity: string;
  loanId: string;
  currency: WalletCurrency;
  amount: number;
}): Promise<DebitLoanRepaymentResult> {
  const normalized = normalizeIdentity(args.identity);
  return withLock(async () => {
    const store = await readStore();
    const wallet = store.wallets[normalized] || emptyWallet(normalized);

    const currentBalance = wallet.balances[args.currency] || 0;
    if (currentBalance < args.amount) {
      return { success: false, error: 'insufficient_balance' };
    }

    const newBalance = round2(currentBalance - args.amount);
    wallet.balances[args.currency] = newBalance;

    const transaction: WalletLoanTransaction = {
      id: makeId(),
      type: 'loan_repayment',
      loanId: args.loanId,
      currency: args.currency,
      amount: round2(args.amount),
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(transaction);
    if (wallet.transactions.length > MAX_TRANSACTIONS) {
      wallet.transactions.length = MAX_TRANSACTIONS;
    }

    store.wallets[normalized] = wallet;
    await writeStore(store);
    return { success: true, wallet, transaction };
  });
}
