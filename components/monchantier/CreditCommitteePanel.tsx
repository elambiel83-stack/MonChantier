"use client";

import { useEffect, useState } from "react";

type WalletCurrency = "USD" | "CDF";
type LoanStatus = "submitted" | "under_review" | "approved" | "rejected" | "active" | "paid_off";

type LoanBorrower = { fullName: string; phone: string };

type Loan = {
  id: string;
  borrower: LoanBorrower;
  purpose: string;
  currency: WalletCurrency;
  principal: number;
  monthlyPayment: number;
  termMonths: number;
  annualInterestRate: number;
  status: LoanStatus;
  reviewNote?: string;
  createdAt: string;
};

const STATUS_LABELS: Record<LoanStatus, string> = {
  submitted: "Soumis",
  under_review: "En analyse",
  approved: "Approuvé",
  rejected: "Refusé",
  active: "Actif",
  paid_off: "Remboursé",
};

export default function CreditCommitteePanel() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/credit/loans", { cache: "no-store" });
      const data = await res.json();
      const all: Loan[] = res.ok ? data.loans || [] : [];
      setLoans(all.filter((loan) => loan.status === "submitted" || loan.status === "under_review"));
    } catch {
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const decide = async (loanId: string, decision: "approved" | "rejected") => {
    setBusyId(loanId);
    try {
      const res = await fetch(`/api/credit/loans/${loanId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, rejectionReason: rejectionReason[loanId] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur");
      setBanner(decision === "approved" ? "Crédit approuvé et décaissé." : "Crédit refusé.");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Comité de crédit</h1>
      <p className="mt-1 text-slate-600">Décider de l'octroi ou du refus des crédits soumis.</p>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : loans.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun dossier en attente de décision.</p>
        ) : (
          loans.map((loan) => (
            <div key={loan.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-slate-500">{loan.id}</p>
                  <p className="text-sm font-medium">{loan.borrower.fullName} — {loan.purpose}</p>
                </div>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                  {STATUS_LABELS[loan.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {loan.principal.toLocaleString("fr-FR")} {loan.currency} sur {loan.termMonths} mois à{" "}
                {loan.annualInterestRate}%/an · Mensualité {loan.monthlyPayment.toLocaleString("fr-FR")}{" "}
                {loan.currency}
              </p>
              {loan.reviewNote && (
                <p className="mt-1 text-xs text-slate-500">Note d&apos;analyse : {loan.reviewNote}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={rejectionReason[loan.id] || ""}
                  onChange={(e) => setRejectionReason((prev) => ({ ...prev, [loan.id]: e.target.value }))}
                  placeholder="Motif si refus (optionnel)"
                  className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => decide(loan.id, "approved")}
                  disabled={busyId === loan.id}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2"
                >
                  Approuver
                </button>
                <button
                  type="button"
                  onClick={() => decide(loan.id, "rejected")}
                  disabled={busyId === loan.id}
                  className="rounded-lg border border-slate-300 bg-white text-xs font-semibold px-3 py-2 disabled:opacity-60"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
