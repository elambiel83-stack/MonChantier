"use client";

import { useEffect, useState } from "react";

type Tenant = {
  plan: "starter" | "pro" | "enterprise";
  subscriptionStatus: "none" | "trialing" | "active" | "past_due" | "canceled";
};

const PLANS: Array<{ id: "pro" | "enterprise"; label: string; blurb: string }> = [
  { id: "pro", label: "Pro", blurb: "500 produits, support prioritaire." },
  { id: "enterprise", label: "Enterprise", blurb: "Produits illimités, accompagnement dédié." },
];

export default function TenantBillingPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tenants/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setTenant(data.tenant);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const upgrade = async (plan: "pro" | "enterprise") => {
    setBusy(plan);
    setError("");
    try {
      const res = await fetch("/api/tenants/me/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setBusy(null);
    }
  };

  if (loading) return <div className="mx-auto max-w-2xl p-6 text-sm text-slate-500">Chargement…</div>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Facturation</h1>
      <p className="mt-1 text-sm text-slate-500">
        Plan actuel : <span className="font-medium">{tenant?.plan}</span> · Statut abonnement :{" "}
        <span className="font-medium">{tenant?.subscriptionStatus}</span>
      </p>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">{plan.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{plan.blurb}</p>
            <button
              type="button"
              onClick={() => upgrade(plan.id)}
              disabled={busy !== null || tenant?.plan === plan.id}
              className="mt-4 w-full rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {tenant?.plan === plan.id ? "Plan actuel" : busy === plan.id ? "Redirection…" : `Passer à ${plan.label}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
