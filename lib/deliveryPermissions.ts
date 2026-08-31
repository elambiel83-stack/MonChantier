import { AppRole } from '@/lib/roles';

export function canViewAllDeliveries(role: AppRole): boolean {
  return role === 'admin' || role === 'director';
}

export function canAssignDriver(role: AppRole): boolean {
  return role === 'admin';
}
