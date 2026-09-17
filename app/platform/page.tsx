"use client";

import { useEffect, useState } from "react";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  plan: "starter" | "pro" | "enterprise";
  subscriptionStatus: string;
  createdAt: string;
};

export default function PlatformConsolePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/platform/tenants", { cache: "no-store" });
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTenants(Array.isArray(data.tenants) ? data.tenants : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleStatus = async (tenant: Tenant) => {
    setBusyId(tenant.id);
    try {
      await fetch(`/api/platform/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: tenant.status === "active" ? "suspended" : "active" }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl p-6 text-sm text-slate-500">Chargement…</div>;
  if (forbidden) return <div className="mx-auto max-w-4xl p-6 text-sm text-slate-500">Accès plateforme refusé.</div>;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Console plateforme — Tenants</h1>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-2 font-medium">Organisation</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Abonnement</th>
              <th className="px-4 py-2 font-medium">Statut</th>
              <th className="px-4 py-2 font-medium">Créé le</th>
              <th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-slate-500">
                  Aucun tenant pour le moment.
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3">
                    {tenant.name} <span className="text-xs text-slate-400">({tenant.slug})</span>
                  </td>
                  <td className="px-4 py-3">{tenant.plan}</td>
                  <td className="px-4 py-3">{tenant.subscriptionStatus}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        tenant.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {tenant.status === "active" ? "Actif" : "Suspendu"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{new Date(tenant.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleStatus(tenant)}
                      disabled={busyId === tenant.id}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      {tenant.status === "active" ? "Suspendre" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
