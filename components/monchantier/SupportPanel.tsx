"use client";

import { useEffect, useState } from "react";

type SupportTicket = { id: string; subject: string; message: string; status: "open" | "closed"; createdAt: string };

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

export default function SupportPanel() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState("");
  const [bannerTone, setBannerTone] = useState<"success" | "error">("success");
  const [newTicket, setNewTicket] = useState({ subject: "", message: "" });

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/client/support", { cache: "no-store" });
      const data = await res.json();
      setTickets(res.ok ? data.tickets || [] : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) return;
    try {
      setSaving(true);
      const res = await fetch("/api/client/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTicket),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur envoi");
      setNewTicket({ subject: "", message: "" });
      setBannerTone("success");
      setBanner("Ticket envoyé. Notre équipe vous répondra rapidement.");
      await load();
    } catch (err) {
      setBannerTone("error");
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="support" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Support</h2>

      {banner && (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            bannerTone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {banner}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <input
          value={newTicket.subject}
          onChange={(e) => setNewTicket((prev) => ({ ...prev, subject: e.target.value }))}
          placeholder="Sujet"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          value={newTicket.message}
          onChange={(e) => setNewTicket((prev) => ({ ...prev, message: e.target.value }))}
          placeholder="Décrivez votre problème ou votre question"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={createTicket}
          disabled={saving}
          className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Envoi…" : "Envoyer au support"}
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="text-sm text-slate-500">Chargement…</li>
        ) : tickets.length === 0 ? (
          <li className="text-sm text-slate-500">Aucune demande envoyée.</li>
        ) : (
          tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{ticket.subject}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    ticket.status === "open" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {ticket.status === "open" ? "Ouvert" : "Fermé"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">{ticket.message}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDate(ticket.createdAt)}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
