import { listAllDeliveries } from '@/lib/deliveryStore';
import { buildDashboardInsights, InsightSeverity, RiskLevel } from '@/lib/dashboardInsights';
import { listAllLoans } from '@/lib/loanStore';
import { listPaymentStatuses } from '@/lib/paymentStore';
import { listProducts } from '@/lib/productStore';
import { listAllQuoteRequests } from '@/lib/quoteStore';
import { listRoleAudit, listStoredRoles } from '@/lib/roleStore';
import { listServices } from '@/lib/serviceStore';
import { listAllSites } from '@/lib/siteStore';

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
  critical: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-slate-200 bg-slate-50 text-slate-900',
};

const RISK_STYLES: Record<RiskLevel, string> = {
  high: 'border-red-200 bg-red-50 text-red-900',
  medium: 'border-amber-200 bg-amber-50 text-amber-900',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

function formatMoneyEntries(entries: Array<[string, number]>) {
  if (entries.length === 0) return 'Aucune donnée';
  return entries
    .map(([currency, amount]) => `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${currency}`)
    .join(' / ');
}

export default async function AiDashboardPage() {
  const [loans, payments, deliveries, sites, products, services, quotes, roleAssignments, roleAudit] =
    await Promise.all([
      listAllLoans(),
      listPaymentStatuses(),
      listAllDeliveries(),
      listAllSites(),
      listProducts(),
      listServices(),
      listAllQuoteRequests(),
      listStoredRoles(),
      listRoleAudit(),
    ]);

  const dashboard = buildDashboardInsights({
    loans,
    payments,
    deliveries,
    sites,
    products,
    services,
    quotes,
    roleAssignments,
    roleAudit,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IA / Centre de contrôle</h1>
        <p className="mt-1 text-slate-600">
          Détection de risques et recommandations calculées à partir des données réelles disponibles.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Les analyses restent heuristiques : elles exploitent les ventes, crédits, livraisons,
          chantiers, catalogues et rôles stockés dans la plateforme.
        </p>
      </div>

      <section id="alertes" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Alertes prioritaires</h2>
        <div className="mt-4 space-y-3">
          {dashboard.ai.alerts.length === 0 ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              ✅ Aucune anomalie prioritaire détectée.
            </p>
          ) : (
            dashboard.ai.alerts.map((alert) => (
              <div key={alert.id} className={`rounded-lg border p-4 text-sm ${SEVERITY_STYLES[alert.severity]}`}>
                <p className="font-semibold">
                  {alert.area} · {alert.title}
                </p>
                <p className="mt-1">{alert.description}</p>
                <p className="mt-2 text-xs opacity-80">→ {alert.recommendedAction}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section id="ruptures-stock" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Prédiction des ruptures de stock</h2>
        <div className="mt-4 space-y-3">
          {dashboard.ai.stockRisks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Pas assez de demande confirmée pour établir une tension d&apos;approvisionnement.
            </p>
          ) : (
            dashboard.ai.stockRisks.map((risk) => (
              <div key={risk.name} className={`rounded-lg border p-4 text-sm ${RISK_STYLES[risk.risk]}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{risk.name}</p>
                  <span className="text-xs uppercase">{risk.risk}</span>
                </div>
                <p className="mt-1">
                  {risk.quantity} unité(s) sur {risk.orderCount} commande(s) · {risk.catalogMatches} offre(s)
                  active(s) · {risk.partnerMatches} partenaire(s)
                </p>
                <p className="mt-2 text-xs opacity-80">{risk.note}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section id="anomalies-prix" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Détection d&apos;anomalies de prix</h2>
        <div className="mt-4 space-y-3">
          {dashboard.ai.priceAnomalies.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Aucune incohérence majeure détectée sur les prix USD/CDF actuellement renseignés.
            </p>
          ) : (
            dashboard.ai.priceAnomalies.map((anomaly) => (
              <div key={`${anomaly.scope}-${anomaly.name}`} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">
                  {anomaly.scope} · {anomaly.name}
                </p>
                <p className="mt-1">
                  {anomaly.priceUSD.toLocaleString('fr-FR')} USD /{' '}
                  {anomaly.priceCDF.toLocaleString('fr-FR')} CDF
                </p>
                <p className="mt-2 text-xs opacity-80">
                  Taux implicite {Math.round(anomaly.impliedRate).toLocaleString('fr-FR')} CDF/USD · écart{' '}
                  {anomaly.deviationPercent}% vs médiane.
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section id="prevision-ventes" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Prévision des ventes</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {dashboard.ai.forecast.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 md:col-span-3">
              Pas assez d&apos;historique confirmé sur 30 jours pour calculer une projection.
            </p>
          ) : (
            dashboard.ai.forecast.map((forecast) => (
              <div key={forecast.currency} className="rounded-lg border border-slate-100 p-4 text-sm">
                <p className="text-xs text-slate-500">{forecast.currency}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {forecast.projectedAmount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                </p>
                <p className="mt-1 text-slate-600">Projection 30j · tendance {forecast.trend}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Période courante: {forecast.currentAmount.toLocaleString('fr-FR')} · précédente:{' '}
                  {forecast.previousAmount.toLocaleString('fr-FR')}
                  {forecast.deltaPercent !== null ? ` (${forecast.deltaPercent > 0 ? '+' : ''}${forecast.deltaPercent}%)` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section id="itineraires" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Optimisation des itinéraires</h2>
        <div className="mt-4 space-y-3">
          {dashboard.ai.routeInsights.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Aucun scénario logistique exploitable tant que les livraisons et positions ne sont pas alimentées.
            </p>
          ) : (
            dashboard.ai.routeInsights.map((insight) => (
              <div key={insight.title} className="rounded-lg border border-slate-100 p-4 text-sm">
                <p className="font-semibold text-slate-900">{insight.title}</p>
                <p className="mt-1 text-slate-600">{insight.detail}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section id="retards" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Détection des retards</h2>
        <div className="mt-4 space-y-3">
          {dashboard.ai.delays.length === 0 ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Aucun retard notable détecté.
            </p>
          ) : (
            dashboard.ai.delays.map((delay) => (
              <div key={`${delay.area}-${delay.label}`} className={`rounded-lg border p-4 text-sm ${SEVERITY_STYLES[delay.severity]}`}>
                <p className="font-semibold">
                  {delay.area} · {delay.label}
                </p>
                <p className="mt-1">{delay.detail}</p>
                <p className="mt-2 text-xs opacity-80">{delay.ageDays} jour(s)</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section id="rentabilite" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Analyse de rentabilité</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-100 p-4 text-sm">
            <p className="font-medium text-slate-900">Revenus et TVA</p>
            <p className="mt-2 text-slate-600">
              Revenus confirmés : {formatMoneyEntries(dashboard.ai.profitability.revenueByCurrency)}
            </p>
            <div className="mt-3 space-y-2">
              {dashboard.ai.profitability.vatByCurrency.map((item) => (
                <p key={item.currency} className="text-xs text-slate-500">
                  {item.currency} · HT {item.ht.toLocaleString('fr-FR')} · TVA{' '}
                  {item.tva.toLocaleString('fr-FR')} · TTC {item.ttc.toLocaleString('fr-FR')}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 p-4 text-sm">
            <p className="font-medium text-slate-900">Postes générateurs</p>
            <div className="mt-3 space-y-3">
              {dashboard.ai.profitability.topItems.length === 0 ? (
                <p className="text-slate-500">Aucune ligne de facture exploitable.</p>
              ) : (
                dashboard.ai.profitability.topItems.map((item) => (
                  <div key={item.name}>
                    <p className="font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.quantity} unité(s) · {formatMoneyEntries(item.revenueByCurrency)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="approvisionnement" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Recommandations d&apos;approvisionnement</h2>
        <div className="mt-4 space-y-3">
          {dashboard.ai.procurementRecommendations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Aucun besoin de réassort prioritaire détecté.
            </p>
          ) : (
            dashboard.ai.procurementRecommendations.map((item) => (
              <div key={item.name} className="rounded-lg border border-slate-100 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <span className="text-xs text-slate-500">{item.quantity} unité(s)</span>
                </div>
                <p className="mt-1 text-slate-600">{item.supplierCount} partenaire(s) actif(s)</p>
                <p className="mt-2 text-xs text-slate-400">{item.recommendation}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
