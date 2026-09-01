import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppRole, DEFAULT_ROLE } from '@/lib/roles';

export type SessionActor = {
  identity: string;
  role: AppRole;
};

export async function getSessionActor(): Promise<SessionActor | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const identity = user?.identity || user?.email;
  if (!identity) return null;
  return { identity: identity.toLowerCase(), role: user?.role || DEFAULT_ROLE };
}
