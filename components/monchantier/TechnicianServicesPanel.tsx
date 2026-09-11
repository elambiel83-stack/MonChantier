"use client";

import { useEffect, useMemo, useState } from "react";

type StoredService = {
  id: number;
  icon: string;
  fr: string;
  en: string;
  frDesc: string;
  enDesc: string;
  img: string;
  priceUSD: number | null;
  priceCDF: number | null;
  active: boolean;
};

type TechnicianSummary = {
  totals: {
    serviceCount: number;
    activeCount: number;
    quoteCount: number;
    confirmedJobs: number;
    revenueByCurrency: Array<[string, number]>;
  };
  interventions: Array<{
    id: number;
    name: string;
    active: boolean;
    confirmedJobs: number;
    openJobs: number;
    revenueByCurrency: Array<[string, number]>;
  }>;
  missions: Array<{
    reference: string;
    customer: string;
    updatedAt: string;
    status: string;
  }>;
  planning: Array<{
    reference: string;
    customer: string;
    updatedAt: string;
  }>;
  clients: Array<{
    label: string;
    jobs: number;
    spendByCurrency: Array<[string, number]>;
  }>;
  quotes: Array<{
    id: string;
    name: string;
    email: string;
    message: string;
    services: string[];
    createdAt: string;
  }>;
  paymentsByMethod: Array<{
    method: string;
    count: number;
    totalsByCurrency: Array<[string, number]>;
  }>;
  reports: {
    lines: string[];
    inactiveServices: StoredService[];
  };
};

const METHOD_LABELS: Record<string, string> = {
  mobilemoney: "Mobile Money",
  card: "Carte bancaire",
  paypal: "PayPal",
};

function formatMoneyEntries(entries: Array<[string, number]>) {
  if (entries.length === 0) return "Aucune donnée";
  return entries
    .map(([currency, amount]) => `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency}`)
    .join(" / ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

export default function TechnicianServicesPanel() {
  const [services, setServices] = useState<StoredService[]>([]);
  const [summary, setSummary] = useState<TechnicianSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<number, { priceUSD: string; priceCDF: string }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [newService, setNewService] = useState({
    icon: "🔧",
    fr: "",
    en: "",
    frDesc: "",
    enDesc: "",
    img: "/images/services/autres-services.svg",
    priceUSD: "",
    priceCDF: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [servicesRes, summaryRes] = await Promise.all([
        fetch("/api/partner/services", { cache: "no-store" }),
        fetch("/api/partner/services/summary", { cache: "no-store" }),
      ]);
      const servicesData = servicesRes.ok ? await servicesRes.json() : { services: [] };
      const summaryData = summaryRes.ok ? await summaryRes.json() : null;
      setServices(servicesRes.ok ? servicesData.services || [] : []);
      setSummary(summaryData);
    } catch {
      setServices([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createServiceEntry = async () => {
    if (!newService.fr.trim() || !newService.frDesc.trim()) return;
    try {
      setSaving(true);
      const res = await fetch("/api/partner/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newService),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur création service");
      setNewService({
        icon: "🔧",
        fr: "",
        en: "",
        frDesc: "",
        enDesc: "",
        img: "/images/services/autres-services.svg",
        priceUSD: "",
        priceCDF: "",
      });
      setBanner({ type: "success", message: "Service ajouté au catalogue public." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setSaving(false);
    }
  };

  const savePrice = async (id: number) => {
    const edit = edits[id];
    if (!edit) return;
    try {
      setBusyId(id);
      const res = await fetch(`/api/partner/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceUSD: edit.priceUSD === "" ? null : edit.priceUSD,
          priceCDF: edit.priceCDF === "" ? null : edit.priceCDF,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Erreur mise à jour prix");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setBanner({ type: "success", message: "Prix mis à jour." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (service: StoredService) => {
    try {
      setBusyId(service.id);
      const res = await fetch(`/api/partner/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !service.active }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Erreur mise à jour");
      setBanner({ type: "success", message: service.active ? "Service désactivé." : "Service activé." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusyId(null);
    }
  };

  const bannerClassName =
    banner?.type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  const pricedServices = useMemo(
    () => services.filter((service) => service.priceUSD !== null || service.priceCDF !== null).length,
    [services]
  );

  return (
    <div className="space-y-6">
      <div id="mes-services">
        <h1 className="text-2xl font-bold tracking-tight">Technicien / Professionnel</h1>
        <p className="mt-1 text-slate-600">Gérer ses interventions et missions.</p>

        {banner && <div className={`mt-3 rounded-lg border p-3 text-sm ${bannerClassName}`}>{banner.message}</div>}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Services", summary?.totals.serviceCount ?? 0],
            ["Actifs", summary?.totals.activeCount ?? 0],
            ["Interventions", summary?.totals.confirmedJobs ?? 0],
            ["Devis liés", summary?.totals.quoteCount ?? 0],
            ["Avec prix", pricedServices],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Proposer un service</h2>
          <p className="mt-1 text-sm text-slate-500">Votre service apparaît immédiatement sur le catalogue public.</p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input value={newService.icon} onChange={(e) => setNewService((prev) => ({ ...prev, icon: e.target.value }))} placeholder="Icône" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newService.fr} onChange={(e) => setNewService((prev) => ({ ...prev, fr: e.target.value }))} placeholder="Nom (FR)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newService.en} onChange={(e) => setNewService((prev) => ({ ...prev, en: e.target.value }))} placeholder="Nom (EN)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newService.img} onChange={(e) => setNewService((prev) => ({ ...prev, img: e.target.value }))} placeholder="Chemin image" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newService.frDesc} onChange={(e) => setNewService((prev) => ({ ...prev, frDesc: e.target.value }))} placeholder="Description (FR)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            <input value={newService.enDesc} onChange={(e) => setNewService((prev) => ({ ...prev, enDesc: e.target.value }))} placeholder="Description (EN)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            <input type="number" value={newService.priceUSD} onChange={(e) => setNewService((prev) => ({ ...prev, priceUSD: e.target.value }))} placeholder="Prix USD" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="number" value={newService.priceCDF} onChange={(e) => setNewService((prev) => ({ ...prev, priceCDF: e.target.value }))} placeholder="Prix CDF" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="button" onClick={createServiceEntry} disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60">
              {saving ? "Ajout…" : "+ Publier ce service"}
            </button>
          </div>
        </div>
      </div>

      <div id="interventions" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mes interventions</h2>
        <div className="mt-4 space-y-3">
          {summary?.interventions.length ? summary.interventions.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{row.name}</span>
                <span className={row.active ? "text-emerald-700" : "text-slate-400"}>{row.active ? "Actif" : "Inactif"}</span>
              </div>
              <p className="mt-1 text-slate-600">{row.confirmedJobs} intervention(s) · {row.openJobs} mission(s) ouverte(s)</p>
              <p className="mt-1 text-xs text-slate-400">{formatMoneyEntries(row.revenueByCurrency)}</p>
            </div>
          )) : <p className="text-sm text-slate-500">Aucune intervention liée à vos services.</p>}
        </div>
      </div>

      <div id="missions" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Missions</h2>
        <div className="mt-4 space-y-3">
          {summary?.missions.length ? summary.missions.map((mission) => (
            <div key={mission.reference} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{mission.customer}</span>
                <span className="text-slate-500">{mission.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{mission.reference} · {formatDate(mission.updatedAt)}</p>
            </div>
          )) : <p className="text-sm text-slate-500">Aucune mission ouverte détectée.</p>}
        </div>
      </div>

      <div id="planning" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Planning</h2>
        <div className="mt-4 space-y-3">
          {summary?.planning.length ? summary.planning.map((entry) => (
            <div key={entry.reference} className="rounded-lg border border-slate-100 p-3 text-sm">
              <p className="font-medium text-slate-900">{entry.customer}</p>
              <p className="mt-1 text-xs text-slate-400">{entry.reference} · {formatDate(entry.updatedAt)}</p>
            </div>
          )) : <p className="text-sm text-slate-500">Aucun planning calculable pour le moment.</p>}
        </div>
      </div>

      <div id="clients" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Clients</h2>
        <div className="mt-4 space-y-3">
          {summary?.clients.length ? summary.clients.map((client) => (
            <div key={client.label} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{client.label}</span>
                <span className="text-slate-500">{client.jobs} intervention(s)</span>
              </div>
              <p className="mt-1 text-slate-600">{formatMoneyEntries(client.spendByCurrency)}</p>
            </div>
          )) : <p className="text-sm text-slate-500">Aucun client rattaché à vos services.</p>}
        </div>
      </div>

      <div id="devis" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Devis</h2>
        <div className="mt-4 space-y-3">
          {summary?.quotes.length ? summary.quotes.map((quote) => (
            <div key={quote.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <p className="font-medium text-slate-900">{quote.name || quote.email}</p>
              <p className="mt-1 text-slate-600">{quote.services.join(", ") || "Sans service détaillé"}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDate(quote.createdAt)}</p>
            </div>
          )) : <p className="text-sm text-slate-500">Aucun devis lié à vos services.</p>}
        </div>
      </div>

      <div id="rapports" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Rapports</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {(summary?.reports.lines || []).map((line) => (
              <p key={line} className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700">{line}</p>
            ))}
          </div>
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-900">Services inactifs</p>
            <div className="mt-3 space-y-2">
              {summary?.reports.inactiveServices.length ? summary.reports.inactiveServices.map((service) => (
                <p key={service.id} className="text-sm text-slate-600">{service.fr}</p>
              )) : <p className="text-sm text-slate-500">Aucun service inactif.</p>}
            </div>
          </div>
        </div>
      </div>

      <div id="photos" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Photos</h2>
        <p className="mt-3 text-sm text-slate-500">Aucune bibliothèque photo n&apos;est encore stockée pour les interventions.</p>
      </div>

      <div id="materiel" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Matériel</h2>
        <p className="mt-3 text-sm text-slate-500">Le suivi du matériel n&apos;est pas encore modélisé ; utilisez cette vue pour contrôler la couverture de services actifs.</p>
        <p className="mt-2 text-sm text-slate-700">{summary?.totals.activeCount ?? 0} service(s) actif(s) sur {summary?.totals.serviceCount ?? 0}.</p>
      </div>

      <div id="paiements" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Paiements</h2>
        <div className="mt-4 space-y-3">
          {summary?.paymentsByMethod.length ? summary.paymentsByMethod.map((row) => (
            <div key={row.method} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{METHOD_LABELS[row.method] || row.method}</span>
                <span className="text-slate-500">{row.count} paiement(s)</span>
              </div>
              <p className="mt-1 text-slate-600">{formatMoneyEntries(row.totalsByCurrency)}</p>
            </div>
          )) : <p className="text-sm text-slate-500">Aucun paiement détecté pour vos services.</p>}
        </div>
      </div>

      <div id="evaluations" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Évaluations</h2>
        <p className="mt-3 text-sm text-slate-500">Aucun module d&apos;avis n&apos;est encore alimenté dans le store actuel.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mes services</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Nom</th>
                <th className="py-2 pr-4 font-medium">Prix USD</th>
                <th className="py-2 pr-4 font-medium">Prix CDF</th>
                <th className="py-2 pr-4 font-medium">Statut</th>
                <th className="py-2 pr-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-3 text-slate-500">Chargement…</td></tr>
              ) : services.length === 0 ? (
                <tr><td colSpan={5} className="py-3 text-slate-500">Aucun service publié pour le moment.</td></tr>
              ) : (
                services.map((service) => {
                  const edit = edits[service.id] || {
                    priceUSD: service.priceUSD?.toString() || "",
                    priceCDF: service.priceCDF?.toString() || "",
                  };
                  return (
                    <tr key={service.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4">{service.icon} {service.fr}</td>
                      <td className="py-3 pr-4"><input type="number" value={edit.priceUSD} onChange={(e) => setEdits((prev) => ({ ...prev, [service.id]: { ...edit, priceUSD: e.target.value } }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs" /></td>
                      <td className="py-3 pr-4"><input type="number" value={edit.priceCDF} onChange={(e) => setEdits((prev) => ({ ...prev, [service.id]: { ...edit, priceCDF: e.target.value } }))} className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs" /></td>
                      <td className="py-3 pr-4"><span className={service.active ? "text-emerald-700" : "text-slate-400"}>{service.active ? "Actif" : "Inactif"}</span></td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => savePrice(service.id)} disabled={busyId === service.id} className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60">Enregistrer</button>
                          <button type="button" onClick={() => toggleActive(service)} disabled={busyId === service.id} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60">{service.active ? "Désactiver" : "Activer"}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
