import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function getWalletIdentity(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.identity || session?.user?.email || null;
}
