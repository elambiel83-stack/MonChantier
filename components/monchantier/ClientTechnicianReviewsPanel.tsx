"use client";

import { useEffect, useState } from "react";

type ReviewOpportunity = {
  orderReference: string;
  serviceId: number;
  serviceName: string;
  technicianIdentity: string;
  customerName: string;
  deliveredAt: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

export default function ClientTechnicianReviewsPanel() {
  const [opportunities, setOpportunities] = useState<ReviewOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [forms, setForms] = useState<Record<string, { rating: string; comment: string }>>({});

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/client/technician-reviews", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Erreur chargement avis");
      setOpportunities(data?.opportunities || []);
    } catch (err) {
      setOpportunities([]);
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submitReview = async (opportunity: ReviewOpportunity) => {
    const key = `${opportunity.orderReference}:${opportunity.serviceId}:${opportunity.technicianIdentity}`;
    const form = forms[key] || { rating: "5", comment: "" };
    const rating = Number(form.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      setBanner({ type: "error", message: "Note invalide." });
      return;
    }

    try {
      setSavingKey(key);
      const res = await fetch("/api/client/technician-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderReference: opportunity.orderReference,
          technicianIdentity: opportunity.technicianIdentity,
          serviceId: opportunity.serviceId,
          rating,
          comment: form.comment,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Erreur envoi avis");
      setBanner({ type: "success", message: "Avis envoyé au technicien." });
      setForms((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setSavingKey(null);
    }
  };

  const bannerClassName =
    banner?.type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div id="avis-techniciens" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Avis techniciens</h2>
      <p className="mt-1 text-sm text-slate-500">
        Évaluez les interventions réellement livrées. Les avis apparaissent ensuite dans le tableau de bord du technicien.
      </p>
      {banner && <div className={`mt-3 rounded-lg border p-3 text-sm ${bannerClassName}`}>{banner.message}</div>}
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : opportunities.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun avis en attente. Les commandes livrées avec un service technicien apparaîtront ici.
          </p>
        ) : (
          opportunities.map((opportunity) => {
            const key = `${opportunity.orderReference}:${opportunity.serviceId}:${opportunity.technicianIdentity}`;
            const form = forms[key] || { rating: "5", comment: "" };

            return (
              <div key={key} className="rounded-lg border border-slate-100 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{opportunity.serviceName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {opportunity.orderReference} · livré le {formatDate(opportunity.deliveredAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {opportunity.technicianIdentity}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[120px_1fr_auto]">
                  <select
                    value={form.rating}
                    onChange={(e) =>
                      setForms((prev) => ({
                        ...prev,
                        [key]: { ...form, rating: e.target.value },
                      }))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="5">5/5</option>
                    <option value="4">4/5</option>
                    <option value="3">3/5</option>
                    <option value="2">2/5</option>
                    <option value="1">1/5</option>
                  </select>
                  <input
                    value={form.comment}
                    onChange={(e) =>
                      setForms((prev) => ({
                        ...prev,
                        [key]: { ...form, comment: e.target.value },
                      }))
                    }
                    placeholder="Commentaire optionnel"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => submitReview(opportunity)}
                    disabled={savingKey === key}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {savingKey === key ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
