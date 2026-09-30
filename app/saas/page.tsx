import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTenantActor } from '@/lib/tenantSessionIdentity';
import { SAAS_RESOURCES } from '@/lib/saas/resources';

export default async function SaasHome() {
  const actor = await getTenantActor();
  if (!actor) redirect('/auth/signin?callbackUrl=/saas');
  const resources = Object.entries(SAAS_RESOURCES).filter(([, config]) => config.roles.includes(actor.tenantRole));
  return <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold text-orange-600">MonChantier SaaS V2</p>
      <h1 className="mt-1 text-3xl font-black">Espace organisation</h1>
      <p className="mt-2 text-slate-600">Tenant : {actor.tenantId} · Rôle : {actor.tenantRole}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map(([resource]) => <Link key={resource} href={`/saas/${resource}`} className="rounded-2xl border bg-white p-5 font-bold shadow-sm hover:border-orange-400">{resource.replaceAll('_',' ')}</Link>)}
      </div>
    </div>
  </main>;
}
