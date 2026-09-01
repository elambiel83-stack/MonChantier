import { listAllLoans } from "@/lib/loanStore";
import { detectPortfolioAlerts, PortfolioAlertSeverity } from "@/lib/creditIntelligence";
import { ROLE_MENUS } from "@/lib/roles";

const SEVERITY_STYLES: Record<PortfolioAlertSeverity, { icon: string; className: string }> = {
  critical: { icon: "🔴", className: "border-red-200 bg-red-50" },
  warning: { icon: "🟠", className: "border-amber-200 bg-amber-50" },
  info: { icon: "🟡", className: "border-slate-200 bg-slate-50" },
};

export default async function AiDashboardPage() {
  const loans = await listAllLoans();
  const alerts = detectPortfolioAlerts(loans);

  const otherAnalyses = ROLE_MENUS.ai.filter(
    (item) => item.fr !== "Alertes" && item.fr !== "Détection des retards"
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">IA / Centre de contrôle</h1>
      <p className="mt-1 text-slate-600">
        Analyse le portefeuille crédit et fait remonter les exceptions à traiter.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Détection à base de règles métier explicites sur les données réelles — pas un modèle
        prédictif entraîné. Seul le crédit dispose de données réelles pour l&apos;instant ; les
        autres analyses ({otherAnalyses.map((item) => item.fr).join(", ")}) restent à construire
        une fois les modules correspondants alimentés en données.
      </p>

      <div id="alertes" className="mt-6 space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">
              ✅ Aucune anomalie détectée sur le portefeuille crédit actuel.
            </p>
          </div>
        ) : (
          alerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity];
            return (
              <div key={alert.id} className={`rounded-xl border p-4 ${style.className}`}>
                <p className="text-sm font-semibold text-slate-800">
                  {style.icon} {alert.title}
                </p>
                <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  → {alert.recommendedAction}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Dossiers concernés : {alert.affectedLoanIds.join(", ")}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
