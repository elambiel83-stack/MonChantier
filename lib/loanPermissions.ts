import { AppRole } from '@/lib/roles';
import type { Loan } from '@/lib/loanStore';

function sameIdentity(left: string | undefined, right: string): boolean {
  return left?.trim().toLowerCase() === right.trim().toLowerCase();
}

export function canViewAllLoans(role: AppRole): boolean {
  return role === 'admin' || role === 'director' || role === 'accountant' || role === 'credit-committee';
}

export function canReviewLoan(role: AppRole): boolean {
  return role === 'credit-agent';
}

export function canDecideLoan(role: AppRole): boolean {
  return role === 'credit-committee';
}

export function canAssignAgent(role: AppRole): boolean {
  return role === 'admin';
}

export function canReleaseTranche(role: AppRole): boolean {
  return role === 'accountant';
}

export function canLogCollectionAction(role: AppRole): boolean {
  return role === 'accountant' || role === 'credit-agent';
}

export function canViewPortfolio(role: AppRole): boolean {
  return role === 'director' || role === 'accountant' || role === 'credit-committee';
}

/** Object-level access control for credit data. */
export function canAccessLoan(actor: { identity: string; role: AppRole }, loan: Loan): boolean {
  if (sameIdentity(loan.identity, actor.identity)) return true;
  if (canViewAllLoans(actor.role)) return true;
  return actor.role === 'credit-agent' && sameIdentity(loan.assignedAgentIdentity, actor.identity);
}

export function canReviewAssignedLoan(actor: { identity: string; role: AppRole }, loan: Loan): boolean {
  return canReviewLoan(actor.role) && sameIdentity(loan.assignedAgentIdentity, actor.identity);
}

export function canWriteLoanEvidence(actor: { identity: string; role: AppRole }, loan: Loan): boolean {
  return sameIdentity(loan.identity, actor.identity) || canReviewAssignedLoan(actor, loan);
}

export function canLogLoanCollection(actor: { identity: string; role: AppRole }, loan: Loan): boolean {
  return actor.role === 'accountant' || (actor.role === 'credit-agent' && sameIdentity(loan.assignedAgentIdentity, actor.identity));
}

export function preservesCreditSeparation(actor: { identity: string }, loan: Loan): boolean {
  return !sameIdentity(loan.reviewedBy, actor.identity) && !sameIdentity(loan.decidedBy, actor.identity);
}
