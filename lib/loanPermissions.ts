import { AppRole } from '@/lib/roles';

export function canViewAllLoans(role: AppRole): boolean {
  return role === 'admin' || role === 'director' || role === 'accountant' || role === 'credit-committee';
}

export function canReviewLoan(role: AppRole): boolean {
  return role === 'admin' || role === 'credit-agent' || role === 'credit-committee';
}

export function canDecideLoan(role: AppRole): boolean {
  return role === 'admin' || role === 'credit-committee';
}

export function canAssignAgent(role: AppRole): boolean {
  return role === 'admin';
}

export function canReleaseTranche(role: AppRole): boolean {
  return role === 'admin' || role === 'accountant' || role === 'credit-committee';
}

export function canLogCollectionAction(role: AppRole): boolean {
  return role === 'admin' || role === 'accountant' || role === 'credit-agent';
}

export function canViewPortfolio(role: AppRole): boolean {
  return role === 'admin' || role === 'director' || role === 'accountant' || role === 'credit-committee';
}
