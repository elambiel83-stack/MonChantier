"use client";

import { useEffect, useState } from "react";

type SupportMessage = {
  id: string;
  from: "client" | "staff";
  message: string;
  createdAt: string;
};

type SupportTicketStatus = "open" | "pending" | "closed";

type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  messages: SupportMessage[];
  createdAt: string;
};

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: "Ouvert",
  pending: "En attente de votre réponse",
  closed: "Fermé",
};

const STATUS_STYLE: Record<SupportTicketStatus, string> = {
  open: "bg-amber-100 text-amber-700",
  pending: "bg-blue-100 text-blue-700",
  closed: "bg-slate-200 text-slate-700",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

export default function SupportPanel() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState("");
  const [newTicket, setNewTicket] = useState({ subject: "", message: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replying, setReplying] = useState(false);

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
      setBanner("Ticket envoyé. Notre équipe vous répondra rapidement.");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async (ticketId: string) => {
    if (!replyDraft.trim()) return;
    try {
      setReplying(true);
      const res = await fetch(`/api/client/support/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur envoi");
      setReplyDraft("");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setReplying(false);
    }
  };

  return (
    <div id="support" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Support</h2>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
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
          tickets.map((ticket) => {
            const expanded = expandedId === ticket.id;
            return (
              <li key={ticket.id} className="rounded-lg border border-slate-200 p-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => {
                    setExpandedId(expanded ? null : ticket.id);
                    setReplyDraft("");
                  }}
                >
                  <div>
                    <p className="text-sm font-medium">{ticket.subject}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(ticket.createdAt)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[ticket.status]}`}
                  >
                    {STATUS_LABEL[ticket.status]}
                  </span>
                </button>

                {expanded && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    {(ticket.messages || []).map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-lg p-2 text-xs ${
                          msg.from === "staff" ? "bg-blue-50 text-blue-900" : "bg-slate-50 text-slate-700"
                        }`}
                      >
                        <p className="font-semibold">{msg.from === "staff" ? "Support MonChantier" : "Vous"}</p>
                        <p className="mt-1 whitespace-pre-line">{msg.message}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{formatDate(msg.createdAt)}</p>
                      </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                      <input
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Répondre…"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => sendReply(ticket.id)}
                        disabled={replying || !replyDraft.trim()}
                        className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-60"
                      >
                        {replying ? "…" : "Envoyer"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
