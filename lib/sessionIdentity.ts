import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppRole, DEFAULT_ROLE } from '@/lib/roles';

export type SessionActor = {
  identity: string;
  role: AppRole;
};

export async function getSessionActor(): Promise<SessionActor | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return { identity: session.user.email, role: session.user.role || DEFAULT_ROLE };
}
