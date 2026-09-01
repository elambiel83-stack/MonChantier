import { Site } from '@/lib/siteStore';
import { SessionActor } from '@/lib/sessionIdentity';

export function canManageSite(actor: SessionActor, site: Pick<Site, 'siteManagerIdentity'>): boolean {
  return actor.role === 'admin' || site.siteManagerIdentity === actor.identity;
}
