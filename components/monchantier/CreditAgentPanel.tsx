"use client";

import { useEffect, useState } from "react";

type WalletCurrency = "USD" | "CDF";
type LoanStatus = "submitted" | "under_review" | "approved" | "rejected" | "active" | "paid_off";
type RepaymentHealth = "on_track" | "late" | "defaulted" | "n_a";

type LoanBorrower = {
  fullName: string;
  phone: string;
  monthlyIncome?: number;
  monthlyCharges?: number;
  employmentStatus?: string;
  employer?: string;
};

type LoanAuditEntry = { id: string; at: string; by: string; action: string; note?: string };
type LoanDocument = { id: string; category: string; fileName: string; uploadedAt: string };

type Loan = {
  id: string;
  identity: string;
  borrower: LoanBorrower;
  purpose: string;
  currency: WalletCurrency;
  principal: number;
  status: LoanStatus;
  repaymentHealth: RepaymentHealth;
  createdAt: string;
  auditLog: LoanAuditEntry[];
  documents: LoanDocument[];
};

const STATUS_LABELS: Record<LoanStatus, string> = {
  submitted: "Soumis",
  under_review: "En analyse",
  approved: "Approuvé",
  rejected: "Refusé",
  active: "Actif",
  paid_off: "Remboursé",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

export default function CreditAgentPanel() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/credit/loans", { cache: "no-store" });
      const data = await res.json();
      setLoans(res.ok ? data.loans || [] : []);
    } catch {
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submitReview = async (loanId: string) => {
    setBusyId(loanId);
    try {
      const res = await fetch(`/api/credit/loans/${loanId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: notes[loanId] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur");
      setBanner("Dossier mis en analyse.");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  };

  const logCollection = async (loanId: string, type: "called" | "notified" | "promise_to_pay" | "escalated") => {
    setBusyId(loanId);
    try {
      const res = await fetch(`/api/credit/loans/${loanId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("Erreur enregistrement action");
      setBanner("Action enregistrée.");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Agent crédit</h1>
      <p className="mt-1 text-slate-600">Analyser les dossiers de crédit qui vous sont assignés.</p>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : loans.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun dossier ne vous est assigné pour le moment.</p>
        ) : (
          loans.map((loan) => (
            <div key={loan.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-slate-500">{loan.id}</p>
                  <p className="text-sm font-medium">{loan.borrower.fullName} — {loan.purpose}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {STATUS_LABELS[loan.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {loan.principal.toLocaleString("fr-FR")} {loan.currency} · {loan.borrower.phone} ·{" "}
                {loan.borrower.employmentStatus || "-"}
              </p>
              {(loan.borrower.monthlyIncome || loan.borrower.monthlyCharges) && (
                <p className="text-xs text-slate-500">
                  Revenu: {loan.borrower.monthlyIncome ?? "-"} · Charges: {loan.borrower.monthlyCharges ?? "-"}
                </p>
              )}

              {loan.status === "submitted" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={notes[loan.id] || ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [loan.id]: e.target.value }))}
                    placeholder="Note d'analyse (optionnel)"
                    className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => submitReview(loan.id)}
                    disabled={busyId === loan.id}
                    className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2"
                  >
                    Mettre en analyse
                  </button>
                </div>
              )}

              {(loan.repaymentHealth === "late" || loan.repaymentHealth === "defaulted") && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Recouvrement</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => logCollection(loan.id, "called")}
                      disabled={busyId === loan.id}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      Appeler
                    </button>
                    <button
                      type="button"
                      onClick={() => logCollection(loan.id, "notified")}
                      disabled={busyId === loan.id}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      Notifier
                    </button>
                    <button
                      type="button"
                      onClick={() => logCollection(loan.id, "promise_to_pay")}
                      disabled={busyId === loan.id}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      Promesse de paiement
                    </button>
                    <button
                      type="button"
                      onClick={() => logCollection(loan.id, "escalated")}
                      disabled={busyId === loan.id}
                      className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-3 py-1.5 text-xs font-medium"
                    >
                      Escalader
                    </button>
                  </div>
                </div>
              )}

              {loan.documents.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs font-semibold text-slate-500 cursor-pointer">
                    Documents ({loan.documents.length})
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {loan.documents.map((doc) => (
                      <li key={doc.id} className="text-xs">
                        <a
                          href={`/api/credit/loans/${loan.id}/documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-700 font-medium"
                        >
                          {doc.fileName}
                        </a>{" "}
                        <span className="text-slate-400">({doc.category})</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <details className="mt-2">
                <summary className="text-xs font-semibold text-slate-500 cursor-pointer">Historique</summary>
                <ul className="mt-1 space-y-1">
                  {loan.auditLog.map((entry) => (
                    <li key={entry.id} className="text-xs text-slate-500">
                      {formatDate(entry.at)} — {entry.by} — {entry.action}
                      {entry.note ? ` (${entry.note})` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
