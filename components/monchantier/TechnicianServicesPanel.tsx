"use client";

import { useEffect, useState } from "react";

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

export default function TechnicianServicesPanel() {
  const [services, setServices] = useState<StoredService[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<number, { priceUSD: string; priceCDF: string }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [banner, setBanner] = useState("");

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
      const res = await fetch("/api/partner/services", { cache: "no-store" });
      const data = await res.json();
      setServices(res.ok ? data.services || [] : []);
    } catch {
      setServices([]);
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
      setBanner("Service ajouté au catalogue public.");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
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
      if (!res.ok) throw new Error("Erreur mise à jour prix");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setBanner("Prix mis à jour.");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
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
      if (!res.ok) throw new Error("Erreur mise à jour");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div id="mes-services">
      <h1 className="text-2xl font-bold tracking-tight">Technicien / Professionnel</h1>
      <p className="mt-1 text-slate-600">Gérer ses interventions et missions.</p>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Proposer un service</h2>
        <p className="mt-1 text-sm text-slate-500">
          Votre service apparaît immédiatement sur le catalogue public de MonChantier.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={newService.icon}
            onChange={(e) => setNewService((prev) => ({ ...prev, icon: e.target.value }))}
            placeholder="Icône (emoji)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newService.fr}
            onChange={(e) => setNewService((prev) => ({ ...prev, fr: e.target.value }))}
            placeholder="Nom (FR)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newService.en}
            onChange={(e) => setNewService((prev) => ({ ...prev, en: e.target.value }))}
            placeholder="Nom (EN)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newService.img}
            onChange={(e) => setNewService((prev) => ({ ...prev, img: e.target.value }))}
            placeholder="Chemin image"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newService.frDesc}
            onChange={(e) => setNewService((prev) => ({ ...prev, frDesc: e.target.value }))}
            placeholder="Description (FR)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={newService.enDesc}
            onChange={(e) => setNewService((prev) => ({ ...prev, enDesc: e.target.value }))}
            placeholder="Description (EN)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            type="number"
            value={newService.priceUSD}
            onChange={(e) => setNewService((prev) => ({ ...prev, priceUSD: e.target.value }))}
            placeholder="Prix USD (optionnel)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={newService.priceCDF}
            onChange={(e) => setNewService((prev) => ({ ...prev, priceCDF: e.target.value }))}
            placeholder="Prix CDF (optionnel)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createServiceEntry}
            disabled={saving}
            className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Ajout…" : "+ Publier ce service"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">Chargement…</td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">Aucun service publié pour le moment.</td>
                </tr>
              ) : (
                services.map((service) => {
                  const edit = edits[service.id] || {
                    priceUSD: service.priceUSD?.toString() || "",
                    priceCDF: service.priceCDF?.toString() || "",
                  };
                  return (
                    <tr key={service.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4">
                        {service.icon} {service.fr}
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          value={edit.priceUSD}
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [service.id]: { ...edit, priceUSD: e.target.value } }))
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          value={edit.priceCDF}
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [service.id]: { ...edit, priceCDF: e.target.value } }))
                          }
                          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <span className={service.active ? "text-emerald-700" : "text-slate-400"}>
                          {service.active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => savePrice(service.id)}
                            disabled={busyId === service.id}
                            className="rounded-lg bg-slate-900 text-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(service)}
                            disabled={busyId === service.id}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                          >
                            {service.active ? "Désactiver" : "Activer"}
                          </button>
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
