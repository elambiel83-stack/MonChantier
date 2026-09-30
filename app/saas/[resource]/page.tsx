import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getTenantActor } from '@/lib/tenantSessionIdentity';
import { isSaasResource, SAAS_RESOURCES } from '@/lib/saas/resources';
import { tenantQuery, withTenantTransaction } from '@/lib/saas/tenantDb';

export default async function ResourceDashboard({ params }: { params: Promise<{ resource:string }> }) {
  const { resource } = await params;
  if (!isSaasResource(resource)) notFound();
  const actor = await getTenantActor();
  if (!actor) redirect(`/auth/signin?callbackUrl=/saas/${resource}`);
  const config = SAAS_RESOURCES[resource];
  if (!config.roles.includes(actor.tenantRole)) redirect('/saas');
  const rows = await withTenantTransaction(actor, async client =>
    (await tenantQuery(client, `SELECT * FROM saas.${config.table} ORDER BY ${config.orderBy} LIMIT 200`)).rows
  );
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return <main className="min-h-screen bg-slate-50 p-6">
    <div className="mx-auto max-w-7xl">
      <Link href="/saas" className="text-sm font-semibold text-orange-600">← Tous les modules</Link>
      <h1 className="mt-3 text-3xl font-black capitalize">{resource.replaceAll('_',' ')}</h1>
      <p className="mt-1 text-sm text-slate-500">{rows.length} enregistrement(s), isolés par tenant</p>
      <div className="mt-6 overflow-auto rounded-xl border bg-white">
        {rows.length === 0 ? <p className="p-6 text-slate-500">Aucune donnée.</p> :
          <table className="min-w-full text-sm"><thead><tr>{columns.map(c=><th key={c} className="border-b px-3 py-2 text-left">{c}</th>)}</tr></thead>
          <tbody>{rows.map((row:any,index:number)=><tr key={row.id || index}>{columns.map(c=><td key={c} className="border-b px-3 py-2">{typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c] ?? '')}</td>)}</tr>)}</tbody></table>}
      </div>
    </div>
  </main>;
}
