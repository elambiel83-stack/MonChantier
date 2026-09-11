"use client";

import { useEffect, useMemo, useState } from "react";

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
  rejectionReason?: string;
  decidedAt?: string;
  decidedBy?: string;
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

const STATUS_BADGES: Record<LoanStatus, string> = {
  submitted: "bg-sky-100 text-sky-700",
  under_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  active: "bg-emerald-100 text-emerald-700",
  paid_off: "bg-slate-100 text-slate-700",
};

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString("fr-FR") : "—";
}

export default function CreditCommitteePanel() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/credit/loans", { cache: "no-store" });
      const data = await res.json();
      const all: Loan[] = res.ok ? data.loans || [] : [];
      setLoans(all);
    } catch {
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pendingLoans = useMemo(
    () => loans.filter((loan) => loan.status === "submitted" || loan.status === "under_review"),
    [loans]
  );

  const decisionHistory = useMemo(
    () =>
      loans
        .filter((loan) => loan.status !== "submitted" && loan.status !== "under_review")
        .sort(
          (left, right) =>
            new Date(right.decidedAt || right.createdAt).getTime() -
            new Date(left.decidedAt || left.createdAt).getTime()
        ),
    [loans]
  );

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
      setBanner({
        type: "success",
        message: decision === "approved" ? "Crédit approuvé et décaissé." : "Crédit refusé.",
      });
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

  return (
    <div className="space-y-6">
      <div id="dossiers-a-decider">
        <h1 className="text-2xl font-bold tracking-tight">Comité de crédit</h1>
        <p className="mt-1 text-slate-600">Décider de l&apos;octroi ou du refus des crédits soumis.</p>

        {banner && (
          <div className={`mt-3 rounded-lg border p-3 text-sm ${bannerClassName}`}>
            {banner.message}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">À décider</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{pendingLoans.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Décisions prises</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{decisionHistory.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Refus enregistrés</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {decisionHistory.filter((loan) => loan.status === "rejected").length}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : pendingLoans.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun dossier en attente de décision.</p>
          ) : (
            pendingLoans.map((loan) => (
              <div key={loan.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{loan.id}</p>
                    <p className="text-sm font-medium">
                      {loan.borrower.fullName} — {loan.purpose}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGES[loan.status]}`}>
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
                    className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => decide(loan.id, "approved")}
                    disabled={busyId === loan.id}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approuver
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(loan.id, "rejected")}
                    disabled={busyId === loan.id}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-60"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div id="historique-decisions" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Historique des décisions</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : decisionHistory.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune décision historique pour le moment.</p>
          ) : (
            decisionHistory.map((loan) => (
              <div key={loan.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{loan.id}</p>
                    <p className="text-sm font-medium text-slate-900">
                      {loan.borrower.fullName} — {loan.purpose}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGES[loan.status]}`}>
                    {STATUS_LABELS[loan.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {loan.principal.toLocaleString("fr-FR")} {loan.currency} · décision {formatDateTime(loan.decidedAt)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Décidé par {loan.decidedBy || "—"} · Dossier créé le {formatDateTime(loan.createdAt)}
                </p>
                {loan.reviewNote && (
                  <p className="mt-2 text-xs text-slate-500">Analyse: {loan.reviewNote}</p>
                )}
                {loan.rejectionReason && (
                  <p className="mt-2 rounded-lg border border-red-100 bg-red-50 p-2 text-xs text-red-800">
                    Motif du refus: {loan.rejectionReason}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
