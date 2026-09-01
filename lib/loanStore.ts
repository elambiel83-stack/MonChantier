import { promises as fs } from 'fs';
import path from 'path';
import { WalletCurrency } from '@/lib/walletExchange';
import {
  buildAmortizationSchedule,
  getLoanAnnualInterestRate,
  getLoanLateThresholdDays,
} from '@/lib/loanCalculator';
import { creditLoanDisbursement, debitLoanRepayment } from '@/lib/walletStore';

export type LoanStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'active' | 'paid_off';

export type RepaymentHealth = 'on_track' | 'late' | 'defaulted' | 'n_a';

export type LoanInstallment = {
  index: number;
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
  paid: boolean;
  paidAt?: string;
};

export type LoanBorrower = {
  fullName: string;
  phone: string;
  monthlyIncome?: number;
  monthlyCharges?: number;
  employmentStatus?: string;
  employer?: string;
};

export type LoanProject = {
  type: string;
  province?: string;
  city?: string;
  commune?: string;
  description: string;
  budgetTotal?: number;
  personalContribution?: number;
};

export type LoanDocumentCategory = 'identity' | 'income' | 'project' | 'property' | 'collateral' | 'other';

export type LoanDocument = {
  id: string;
  category: LoanDocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedAt: string;
  uploadedBy: string;
};

export type LoanCollateralType = 'terrain' | 'immeuble' | 'vehicule' | 'autre';

export type LoanCollateral = {
  id: string;
  type: LoanCollateralType;
  description: string;
  estimatedValue: number;
  currency: WalletCurrency;
  owner: string;
  documentId?: string;
  createdAt: string;
};

export type CollectionActionType =
  | 'called'
  | 'notified'
  | 'promise_to_pay'
  | 'payment_recorded'
  | 'escalated';

export type LoanAuditEntry = {
  id: string;
  at: string;
  by: string;
  action:
    | 'submitted'
    | 'review_started'
    | 'approved'
    | 'rejected'
    | 'disbursed'
    | 'installment_paid'
    | 'paid_off'
    | 'agent_assigned'
    | 'tranche_released'
    | 'document_added'
    | 'collateral_added'
    | `collection_${CollectionActionType}`;
  note?: string;
};

export type LoanDisbursementMode = 'lump_sum' | 'tranches';

export type LoanTranche = {
  id: string;
  index: number;
  label: string;
  condition: string;
  amount: number;
  status: 'pending' | 'released';
  releasedAt?: string;
  releasedBy?: string;
};

export type Loan = {
  id: string;
  identity: string;
  borrower: LoanBorrower;
  project?: LoanProject;
  purpose: string;
  currency: WalletCurrency;
  principal: number;
  annualInterestRate: number;
  termMonths: number;
  monthlyPayment: number;
  totalRepayable: number;
  totalInterest: number;
  status: LoanStatus;
  createdAt: string;
  assignedAgentIdentity?: string;
  documents: LoanDocument[];
  collateral: LoanCollateral[];
  disbursementMode: LoanDisbursementMode;
  tranches?: LoanTranche[];
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  decidedAt?: string;
  decidedBy?: string;
  rejectionReason?: string;
  disbursedAt?: string;
  installments: LoanInstallment[];
  auditLog: LoanAuditEntry[];
};

type LoanStoreModel = { loans: Loan[] };

const STORE_PATH = path.join(process.cwd(), 'data', 'loan-store.json');
const INITIAL_STORE: LoanStoreModel = { loans: [] };

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

async function readStore(): Promise<LoanStoreModel> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<LoanStoreModel>;
    return { loans: Array.isArray(parsed.loans) ? parsed.loans : [] };
  } catch {
    return { loans: [] };
  }
}

async function writeStore(store: LoanStoreModel) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

function makeId() {
  return `LOAN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeAuditId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendAudit(loan: Loan, entry: Omit<LoanAuditEntry, 'id' | 'at'>) {
  loan.auditLog.push({ id: makeAuditId(), at: new Date().toISOString(), ...entry });
}

export function getRepaymentHealth(loan: Loan): RepaymentHealth {
  if (loan.status !== 'active') return 'n_a';

  const next = loan.installments.find((installment) => !installment.paid);
  if (!next) return 'on_track';

  const daysLate = (Date.now() - new Date(next.dueDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysLate <= 0) return 'on_track';
  if (daysLate <= getLoanLateThresholdDays()) return 'late';
  return 'defaulted';
}

export function createLoanApplication(args: {
  identity: string;
  borrower: LoanBorrower;
  project?: LoanProject;
  purpose: string;
  currency: WalletCurrency;
  principal: number;
  termMonths: number;
  tranches?: Array<{ label: string; condition: string; amount: number }>;
}): Promise<Loan> {
  return withLock(async () => {
    const store = await readStore();
    const annualInterestRate = getLoanAnnualInterestRate();
    const now = new Date();
    const schedule = buildAmortizationSchedule({
      principal: args.principal,
      annualRatePercent: annualInterestRate,
      termMonths: args.termMonths,
      startDate: now,
    });

    const identity = normalizeIdentity(args.identity);
    const hasTranches = Array.isArray(args.tranches) && args.tranches.length > 0;
    const loan: Loan = {
      id: makeId(),
      identity,
      borrower: args.borrower,
      project: args.project,
      purpose: args.purpose,
      currency: args.currency,
      principal: args.principal,
      annualInterestRate,
      termMonths: args.termMonths,
      monthlyPayment: schedule.monthlyPayment,
      totalRepayable: schedule.totalRepayable,
      totalInterest: schedule.totalInterest,
      status: 'submitted',
      createdAt: now.toISOString(),
      documents: [],
      collateral: [],
      disbursementMode: hasTranches ? 'tranches' : 'lump_sum',
      tranches: hasTranches
        ? args.tranches!.map((tranche, index) => ({
            id: makeAuditId(),
            index: index + 1,
            label: tranche.label,
            condition: tranche.condition,
            amount: tranche.amount,
            status: 'pending' as const,
          }))
        : undefined,
      installments: schedule.installments.map((installment) => ({ ...installment, paid: false })),
      auditLog: [],
    };
    appendAudit(loan, { by: identity, action: 'submitted' });

    store.loans.unshift(loan);
    await writeStore(store);
    return loan;
  });
}

export function listLoansByIdentity(identity: string): Promise<Loan[]> {
  const normalized = normalizeIdentity(identity);
  return withLock(async () => {
    const store = await readStore();
    return store.loans.filter((loan) => loan.identity === normalized);
  });
}

export function listAllLoans(): Promise<Loan[]> {
  return withLock(async () => {
    const store = await readStore();
    return store.loans;
  });
}

export function getLoanById(id: string): Promise<Loan | null> {
  return withLock(async () => {
    const store = await readStore();
    return store.loans.find((loan) => loan.id === id) || null;
  });
}

export type ReviewLoanResult =
  | { success: true; loan: Loan }
  | { success: false; error: 'not_found' | 'not_submitted' };

export function reviewLoan(args: {
  id: string;
  reviewedBy: string;
  note?: string;
}): Promise<ReviewLoanResult> {
  return withLock(async () => {
    const store = await readStore();
    const loan = store.loans.find((item) => item.id === args.id);
    if (!loan) return { success: false as const, error: 'not_found' as const };
    if (loan.status !== 'submitted') return { success: false as const, error: 'not_submitted' as const };

    loan.status = 'under_review';
    loan.reviewedAt = new Date().toISOString();
    loan.reviewedBy = args.reviewedBy;
    loan.reviewNote = args.note;
    appendAudit(loan, { by: args.reviewedBy, action: 'review_started', note: args.note });

    await writeStore(store);
    return { success: true as const, loan };
  });
}

export type DecideLoanResult =
  | { success: true; loan: Loan }
  | { success: false; error: 'not_found' | 'not_decidable' | 'separation_of_duties' };

export async function decideLoan(args: {
  id: string;
  decision: 'approved' | 'rejected';
  decidedBy: string;
  rejectionReason?: string;
}): Promise<DecideLoanResult> {
  const result = await withLock(async () => {
    const store = await readStore();
    const loan = store.loans.find((item) => item.id === args.id);
    if (!loan) return { success: false as const, error: 'not_found' as const };
    if (loan.status !== 'submitted' && loan.status !== 'under_review') {
      return { success: false as const, error: 'not_decidable' as const };
    }
    if (normalizeIdentity(loan.reviewedBy || '') === normalizeIdentity(args.decidedBy)) {
      return { success: false as const, error: 'separation_of_duties' as const };
    }

    loan.decidedAt = new Date().toISOString();
    loan.decidedBy = args.decidedBy;

    if (args.decision === 'rejected') {
      loan.status = 'rejected';
      loan.rejectionReason = args.rejectionReason;
      appendAudit(loan, { by: args.decidedBy, action: 'rejected', note: args.rejectionReason });
    } else {
      loan.status = 'approved';
      appendAudit(loan, { by: args.decidedBy, action: 'approved' });
    }

    await writeStore(store);
    return { success: true as const, loan };
  });

  if (!result.success || result.loan.status !== 'approved') {
    return result;
  }

  if (result.loan.disbursementMode === 'tranches') {
    // Décaissement par tranches: aucun versement automatique, chaque
    // tranche sera libérée manuellement via releaseTranche().
    return withLock(async () => {
      const store = await readStore();
      const loan = store.loans.find((item) => item.id === args.id);
      if (!loan) return { success: false as const, error: 'not_found' as const };
      loan.status = 'active';
      loan.disbursedAt = new Date().toISOString();
      appendAudit(loan, { by: 'system', action: 'disbursed', note: 'Décaissement par tranches activé' });
      await writeStore(store);
      return { success: true as const, loan };
    });
  }

  // Décaissement effectif dans le porte-monnaie du client, hors verrou du
  // store des prêts (le verrou du wallet store est indépendant).
  await creditLoanDisbursement({
    identity: result.loan.identity,
    loanId: result.loan.id,
    currency: result.loan.currency,
    amount: result.loan.principal,
  });

  return withLock(async () => {
    const store = await readStore();
    const loan = store.loans.find((item) => item.id === args.id);
    if (!loan) return { success: false as const, error: 'not_found' as const };
    loan.status = 'active';
    loan.disbursedAt = new Date().toISOString();
    appendAudit(loan, { by: 'system', action: 'disbursed' });
    await writeStore(store);
    return { success: true as const, loan };
  });
}

export type ReleaseTrancheResult =
  | { success: true; loan: Loan }
  | { success: false; error: 'not_found' | 'tranche_not_found' | 'not_active' | 'already_released' | 'separation_of_duties' };

export async function releaseTranche(args: {
  id: string;
  trancheId: string;
  releasedBy: string;
}): Promise<ReleaseTrancheResult> {
  const loan = await getLoanById(args.id);
  if (!loan) return { success: false, error: 'not_found' };
  if (
    normalizeIdentity(loan.reviewedBy || '') === normalizeIdentity(args.releasedBy) ||
    normalizeIdentity(loan.decidedBy || '') === normalizeIdentity(args.releasedBy)
  ) {
    return { success: false, error: 'separation_of_duties' };
  }
  if (loan.status !== 'active') return { success: false, error: 'not_active' };

  const tranche = loan.tranches?.find((item) => item.id === args.trancheId);
  if (!tranche) return { success: false, error: 'tranche_not_found' };
  if (tranche.status === 'released') return { success: false, error: 'already_released' };

  await creditLoanDisbursement({
    identity: loan.identity,
    loanId: `${loan.id}:${tranche.id}`,
    currency: loan.currency,
    amount: tranche.amount,
  });

  return withLock(async () => {
    const store = await readStore();
    const stored = store.loans.find((item) => item.id === args.id);
    if (!stored) return { success: false as const, error: 'not_found' as const };

    const storedTranche = stored.tranches?.find((item) => item.id === args.trancheId);
    if (storedTranche) {
      storedTranche.status = 'released';
      storedTranche.releasedAt = new Date().toISOString();
      storedTranche.releasedBy = args.releasedBy;
    }
    appendAudit(stored, {
      by: args.releasedBy,
      action: 'tranche_released',
      note: `${tranche.label} (${tranche.amount} ${stored.currency})`,
    });

    await writeStore(store);
    return { success: true as const, loan: stored };
  });
}

export type PayInstallmentResult =
  | { success: true; loan: Loan }
  | { success: false; error: 'not_found' | 'forbidden' | 'not_active' | 'already_paid' | 'insufficient_balance' };

export async function payNextInstallment(args: {
  id: string;
  identity: string;
}): Promise<PayInstallmentResult> {
  const normalized = normalizeIdentity(args.identity);
  const loan = await getLoanById(args.id);
  if (!loan) return { success: false, error: 'not_found' };
  if (loan.identity !== normalized) return { success: false, error: 'forbidden' };
  if (loan.status !== 'active') return { success: false, error: 'not_active' };

  const nextInstallment = loan.installments.find((installment) => !installment.paid);
  if (!nextInstallment) return { success: false, error: 'already_paid' };

  const debit = await debitLoanRepayment({
    identity: loan.identity,
    loanId: loan.id,
    currency: loan.currency,
    amount: nextInstallment.amount,
  });

  if (!debit.success) {
    return { success: false, error: 'insufficient_balance' };
  }

  return withLock(async () => {
    const store = await readStore();
    const stored = store.loans.find((item) => item.id === args.id);
    if (!stored) return { success: false as const, error: 'not_found' as const };

    const installment = stored.installments.find((item) => item.index === nextInstallment.index);
    if (installment) {
      installment.paid = true;
      installment.paidAt = new Date().toISOString();
    }
    appendAudit(stored, {
      by: normalized,
      action: 'installment_paid',
      note: `Échéance #${nextInstallment.index}`,
    });

    const allPaid = stored.installments.every((item) => item.paid);
    if (allPaid) {
      stored.status = 'paid_off';
      appendAudit(stored, { by: 'system', action: 'paid_off' });
    }

    await writeStore(store);
    return { success: true as const, loan: stored };
  });
}

export function getDaysLate(loan: Loan): number {
  if (loan.status !== 'active') return 0;
  const next = loan.installments.find((installment) => !installment.paid);
  if (!next) return 0;
  const days = (Date.now() - new Date(next.dueDate).getTime()) / (1000 * 60 * 60 * 24);
  return days > 0 ? Math.floor(days) : 0;
}

export function listLoansForAgent(agentIdentity: string): Promise<Loan[]> {
  const normalized = normalizeIdentity(agentIdentity);
  return withLock(async () => {
    const store = await readStore();
    return store.loans.filter((loan) => loan.assignedAgentIdentity === normalized);
  });
}

export type AssignAgentResult =
  | { success: true; loan: Loan }
  | { success: false; error: 'not_found' };

export function assignAgent(args: {
  id: string;
  agentIdentity: string;
  assignedBy: string;
}): Promise<AssignAgentResult> {
  return withLock(async () => {
    const store = await readStore();
    const loan = store.loans.find((item) => item.id === args.id);
    if (!loan) return { success: false as const, error: 'not_found' as const };

    loan.assignedAgentIdentity = normalizeIdentity(args.agentIdentity);
    appendAudit(loan, {
      by: args.assignedBy,
      action: 'agent_assigned',
      note: loan.assignedAgentIdentity,
    });

    await writeStore(store);
    return { success: true as const, loan };
  });
}

export type AddDocumentResult =
  | { success: true; loan: Loan; document: LoanDocument }
  | { success: false; error: 'not_found' };

export function addLoanDocument(args: {
  id: string;
  category: LoanDocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string;
}): Promise<AddDocumentResult> {
  return withLock(async () => {
    const store = await readStore();
    const loan = store.loans.find((item) => item.id === args.id);
    if (!loan) return { success: false as const, error: 'not_found' as const };

    const document: LoanDocument = {
      id: makeAuditId(),
      category: args.category,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      storagePath: args.storagePath,
      uploadedAt: new Date().toISOString(),
      uploadedBy: args.uploadedBy,
    };
    loan.documents.push(document);
    appendAudit(loan, { by: args.uploadedBy, action: 'document_added', note: args.fileName });

    await writeStore(store);
    return { success: true as const, loan, document };
  });
}

export type AddCollateralResult =
  | { success: true; loan: Loan; collateral: LoanCollateral }
  | { success: false; error: 'not_found' };

export function addLoanCollateral(args: {
  id: string;
  type: LoanCollateralType;
  description: string;
  estimatedValue: number;
  currency: WalletCurrency;
  owner: string;
  documentId?: string;
  addedBy: string;
}): Promise<AddCollateralResult> {
  return withLock(async () => {
    const store = await readStore();
    const loan = store.loans.find((item) => item.id === args.id);
    if (!loan) return { success: false as const, error: 'not_found' as const };

    const collateral: LoanCollateral = {
      id: makeAuditId(),
      type: args.type,
      description: args.description,
      estimatedValue: args.estimatedValue,
      currency: args.currency,
      owner: args.owner,
      documentId: args.documentId,
      createdAt: new Date().toISOString(),
    };
    loan.collateral.push(collateral);
    appendAudit(loan, { by: args.addedBy, action: 'collateral_added', note: args.description });

    await writeStore(store);
    return { success: true as const, loan, collateral };
  });
}

export type LogCollectionActionResult =
  | { success: true; loan: Loan }
  | { success: false; error: 'not_found' };

export function logCollectionAction(args: {
  id: string;
  by: string;
  type: CollectionActionType;
  note?: string;
}): Promise<LogCollectionActionResult> {
  return withLock(async () => {
    const store = await readStore();
    const loan = store.loans.find((item) => item.id === args.id);
    if (!loan) return { success: false as const, error: 'not_found' as const };

    appendAudit(loan, { by: args.by, action: `collection_${args.type}`, note: args.note });

    await writeStore(store);
    return { success: true as const, loan };
  });
}

export type PortfolioSummary = {
  totalApplications: number;
  approvedCount: number;
  activeCount: number;
  paidOffCount: number;
  rejectedCount: number;
  totalDisbursed: Record<WalletCurrency, number>;
  totalOutstanding: Record<WalletCurrency, number>;
  totalOverdue: Record<WalletCurrency, number>;
  onTrackCount: number;
  lateCount: number;
  defaultedCount: number;
  repaymentRate: number;
};

export function getPortfolioSummary(loans: Loan[]): PortfolioSummary {
  const summary: PortfolioSummary = {
    totalApplications: loans.length,
    approvedCount: 0,
    activeCount: 0,
    paidOffCount: 0,
    rejectedCount: 0,
    totalDisbursed: { USD: 0, CDF: 0 },
    totalOutstanding: { USD: 0, CDF: 0 },
    totalOverdue: { USD: 0, CDF: 0 },
    onTrackCount: 0,
    lateCount: 0,
    defaultedCount: 0,
    repaymentRate: 0,
  };

  let totalDueInstallments = 0;
  let totalPaidInstallments = 0;

  for (const loan of loans) {
    if (loan.status === 'approved') summary.approvedCount += 1;
    if (loan.status === 'active') summary.activeCount += 1;
    if (loan.status === 'paid_off') summary.paidOffCount += 1;
    if (loan.status === 'rejected') summary.rejectedCount += 1;

    if (loan.status === 'active' || loan.status === 'paid_off') {
      const disbursedAmount =
        loan.disbursementMode === 'tranches'
          ? (loan.tranches || [])
              .filter((tranche) => tranche.status === 'released')
              .reduce((sum, tranche) => sum + tranche.amount, 0)
          : loan.principal;
      summary.totalDisbursed[loan.currency] += disbursedAmount;

      const paidAmount = loan.installments
        .filter((installment) => installment.paid)
        .reduce((sum, installment) => sum + installment.amount, 0);
      const outstanding = Math.max(0, loan.totalRepayable - paidAmount);
      summary.totalOutstanding[loan.currency] += outstanding;

      totalDueInstallments += loan.installments.length;
      totalPaidInstallments += loan.installments.filter((installment) => installment.paid).length;
    }

    if (loan.status === 'active') {
      const health = getRepaymentHealth(loan);
      if (health === 'on_track') summary.onTrackCount += 1;
      if (health === 'late') summary.lateCount += 1;
      if (health === 'defaulted') {
        summary.defaultedCount += 1;
        const next = loan.installments.find((installment) => !installment.paid);
        if (next) summary.totalOverdue[loan.currency] += next.amount;
      }
    }
  }

  summary.repaymentRate =
    totalDueInstallments > 0 ? Math.round((totalPaidInstallments / totalDueInstallments) * 1000) / 10 : 0;

  return summary;
}
