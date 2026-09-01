import { getPortfolioSummary, listAllLoans } from "@/lib/loanStore";

function formatMoney(amount: number, currency: "USD" | "CDF") {
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency}`;
}

export default async function DirectorDashboardPage() {
  const loans = await listAllLoans();
  const summary = getPortfolioSummary(loans);

  const statusCards = [
    { title: "Demandes totales", value: summary.totalApplications },
    { title: "Approuvés", value: summary.approvedCount },
    { title: "Actifs", value: summary.activeCount },
    { title: "Soldés", value: summary.paidOffCount },
    { title: "Refusés", value: summary.rejectedCount },
  ];

  const healthCards = [
    { title: "À jour", value: summary.onTrackCount, className: "text-emerald-700" },
    { title: "En retard", value: summary.lateCount, className: "text-amber-700" },
    { title: "Impayés", value: summary.defaultedCount, className: "text-red-700" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Directeur</h1>
      <p className="mt-1 text-slate-600">Portefeuille immobilier — vue consolidée du crédit.</p>
      <p className="mt-1 text-xs text-slate-400">
        Seul le portefeuille crédit est actif ici. Les modules Ventes, Logistique, Chantiers et RH
        restent à construire.
      </p>

      <div id="vue-generale" className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statusCards.map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{card.title}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div id="finance" className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Capital décaissé</p>
          <p className="mt-1 text-lg font-semibold">
            {formatMoney(summary.totalDisbursed.USD, "USD")}
          </p>
          <p className="text-sm text-slate-600">{formatMoney(summary.totalDisbursed.CDF, "CDF")}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Capital restant à recouvrer</p>
          <p className="mt-1 text-lg font-semibold">
            {formatMoney(summary.totalOutstanding.USD, "USD")}
          </p>
          <p className="text-sm text-slate-600">{formatMoney(summary.totalOutstanding.CDF, "CDF")}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Impayés (échéances en défaut)</p>
          <p className="mt-1 text-lg font-semibold text-red-700">
            {formatMoney(summary.totalOverdue.USD, "USD")}
          </p>
          <p className="text-sm text-red-600">{formatMoney(summary.totalOverdue.CDF, "CDF")}</p>
        </div>
      </div>

      <div id="performance" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Performance de remboursement</h2>
        <p className="mt-1 text-sm text-slate-500">
          Taux de remboursement (échéances payées / échéances dues sur crédits actifs et soldés) :{" "}
          <span className="font-semibold text-slate-800">{summary.repaymentRate}%</span>
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {healthCards.map((card) => (
            <div key={card.title} className="rounded-lg border border-slate-100 p-3 text-center">
              <p className="text-xs text-slate-500">{card.title}</p>
              <p className={`mt-1 text-xl font-bold ${card.className}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
