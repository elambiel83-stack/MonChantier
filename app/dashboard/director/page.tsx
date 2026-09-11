import { listAllDeliveries } from '@/lib/deliveryStore';
import { buildDashboardInsights } from '@/lib/dashboardInsights';
import { listAllLoans } from '@/lib/loanStore';
import { listPaymentStatuses } from '@/lib/paymentStore';
import { listProducts } from '@/lib/productStore';
import { listAllQuoteRequests } from '@/lib/quoteStore';
import { listRoleAudit, listStoredRoles } from '@/lib/roleStore';
import { listServices } from '@/lib/serviceStore';
import { listAllSites } from '@/lib/siteStore';

function formatMoneyEntries(entries: Array<[string, number]>) {
  if (entries.length === 0) return 'Aucune donnée';
  return entries
    .map(([currency, amount]) => `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${currency}`)
    .join(' / ');
}

function rate(value: number | null) {
  return value === null ? 'N/A' : `${value}%`;
}

export default async function DirectorDashboardPage() {
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

  const taskCompletionRate =
    dashboard.sites.totalTasks > 0
      ? Math.round((dashboard.sites.completedTasks / dashboard.sites.totalTasks) * 100)
      : null;
  const deliveryCompletionRate =
    dashboard.logistics.totalCount > 0
      ? Math.round((dashboard.logistics.deliveredCount / dashboard.logistics.totalCount) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Directeur</h1>
        <p className="mt-1 text-slate-600">
          Vue consolidée des ventes, du crédit, de la logistique, des chantiers et des équipes.
        </p>
      </div>

      <section id="vue-generale" className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          ['Commandes confirmées', dashboard.commerce.confirmedOrdersCount],
          ['Clients actifs', dashboard.clients.orderingCount],
          ['Livraisons ouvertes', dashboard.logistics.openCount],
          ['Chantiers actifs', dashboard.sites.activeCount],
          ['Rôles actifs', dashboard.workforce.activeAssignments],
          ['Crédits actifs', dashboard.portfolio.activeCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section id="finance" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Finance</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Revenus confirmés :{' '}
              <span className="font-semibold text-slate-900">
                {formatMoneyEntries(dashboard.commerce.confirmedRevenueByCurrency)}
              </span>
            </p>
            <p>
              TVA collectée :{' '}
              <span className="font-semibold text-slate-900">
                {formatMoneyEntries(
                  dashboard.ai.profitability.vatByCurrency.map((item) => [item.currency, item.tva])
                )}
              </span>
            </p>
            <p>
              Capital restant à recouvrer :{' '}
              <span className="font-semibold text-slate-900">
                {formatMoneyEntries(Object.entries(dashboard.portfolio.totalOutstanding))}
              </span>
            </p>
            <p>
              Paiements en attente :{' '}
              <span className="font-semibold text-slate-900">
                {dashboard.commerce.pendingPaymentsCount}
              </span>
            </p>
            <p>
              Panier moyen :{' '}
              <span className="font-semibold text-slate-900">
                {formatMoneyEntries(dashboard.commerce.averageBasketByCurrency)}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Fiscalité & crédit</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Taux de TVA</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.taxSummary.vatRate ?? 'N/A'}%
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Remboursement crédit</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.portfolio.repaymentRate}%
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Capital décaissé</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatMoneyEntries(Object.entries(dashboard.portfolio.totalDisbursed))}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Échéances en défaut</p>
              <p className="mt-1 text-sm font-semibold text-red-700">
                {formatMoneyEntries(Object.entries(dashboard.portfolio.totalOverdue))}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="ventes" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Ventes</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-slate-700">Dernières commandes</h3>
            <div className="mt-3 space-y-3">
              {dashboard.commerce.recentOrders.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Aucune commande confirmée disponible.
                </p>
              ) : (
                dashboard.commerce.recentOrders.map((order) => (
                  <div key={order.reference} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-900">{order.customerName}</span>
                      <span className="text-slate-500">{order.method}</span>
                    </div>
                    <p className="mt-1 text-slate-600">
                      {order.amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}{' '}
                      {order.currency} · {order.orderStatus}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {order.reference} · {new Date(order.updatedAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700">Articles les plus demandés</h3>
            <div className="mt-3 space-y-3">
              {dashboard.commerce.topItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Les factures détaillées ne remontent pas encore assez de lignes.
                </p>
              ) : (
                dashboard.commerce.topItems.map((item) => (
                  <div key={item.name} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <span className="text-slate-500">{item.quantity} unité(s)</span>
                    </div>
                    <p className="mt-1 text-slate-600">{item.orderCount} commande(s)</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatMoneyEntries(item.revenueByCurrency)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="clients" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Clients</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Clients identifiés</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.commerce.uniqueKnownClientsCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Clients récurrents</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.commerce.repeatClientsCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Demandes de devis</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.commerce.quoteRequestsCount}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Commandes sans email</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.commerce.anonymousConfirmedOrdersCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Top clients</h2>
          <div className="mt-4 space-y-3">
            {dashboard.clients.rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aucun profil client consolidé pour le moment.
              </p>
            ) : (
              dashboard.clients.rows.map((client) => (
                <div key={client.key} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{client.label}</span>
                    <span className="text-slate-500">{client.orders} commande(s)</span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {client.quotes} devis · {client.deliveries} livraison(s) · {client.sites} chantier(s) ·{' '}
                    {client.loans} crédit(s)
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section id="fournisseurs" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Fournisseurs & offre</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Produits actifs</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.partners.activeProductsCount}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Services actifs</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.partners.activeServicesCount}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Fournisseurs observés</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.partners.supplierPartnerCount}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Techniciens observés</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.partners.technicianPartnerCount}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Catalogue plateforme : {dashboard.partners.platformProductsCount} produit(s) et{' '}
            {dashboard.partners.platformServicesCount} service(s).
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Répartition officielle des rôles</h2>
          <div className="mt-4 space-y-3">
            {dashboard.partners.byRole.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aucune affectation officielle enregistrée.
              </p>
            ) : (
              dashboard.partners.byRole.map((entry) => (
                <div key={entry.role} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm">
                  <span className="text-slate-700">{entry.label}</span>
                  <span className="font-semibold text-slate-900">{entry.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section id="logistique" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Logistique</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Total livraisons</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.logistics.totalCount}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Sans chauffeur</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.logistics.unassignedCount}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">GPS manquant</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.logistics.missingDestinationCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Livrées</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.logistics.deliveredCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Blocages logistiques</h2>
          <div className="mt-4 space-y-3">
            {dashboard.logistics.staleDeliveries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aucun blocage logistique détecté.
              </p>
            ) : (
              dashboard.logistics.staleDeliveries.map((delivery) => (
                <div key={delivery.id} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm">
                  <p className="font-medium text-amber-900">{delivery.reference}</p>
                  <p className="mt-1 text-amber-800">
                    {delivery.status} · {delivery.ageDays} jour(s) sans évolution
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section id="chantiers" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Chantiers</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Planification</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.sites.planningCount}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">En pause</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.sites.pausedCount}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Tâches totales</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboard.sites.totalTasks}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Incidents ouverts</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.sites.unresolvedIncidents}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Actions terrain</h2>
          <div className="mt-4 space-y-3">
            {dashboard.sites.overdueTasks.length === 0 && dashboard.sites.highIncidents.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aucun retard de tâche ni incident critique remonté.
              </p>
            ) : (
              <>
                {dashboard.sites.highIncidents.map((incident) => (
                  <div key={`${incident.siteName}-${incident.label}`} className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm">
                    <p className="font-medium text-red-900">{incident.siteName}</p>
                    <p className="mt-1 text-red-800">{incident.label}</p>
                  </div>
                ))}
                {dashboard.sites.overdueTasks.map((task) => (
                  <div key={`${task.siteName}-${task.label}`} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm">
                    <p className="font-medium text-amber-900">{task.siteName}</p>
                    <p className="mt-1 text-amber-800">
                      {task.label} · retard {task.ageDays} jour(s)
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      <section id="ressources-humaines" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Ressources humaines</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Affectations officielles</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.workforce.totalAssignments}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Contributeurs observés</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.workforce.observedContributorCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Comptes actifs</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.workforce.activeAssignments}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Comptes inactifs</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboard.workforce.inactiveAssignments}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Dernières actions d&apos;affectation</h2>
          <div className="mt-4 space-y-3">
            {dashboard.workforce.recentAudit.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aucun audit de rôle disponible.
              </p>
            ) : (
              dashboard.workforce.recentAudit.map((event) => (
                <div key={`${event.at}-${event.identity}-${event.action}`} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <p className="font-medium text-slate-900">{event.identity}</p>
                  <p className="mt-1 text-slate-600">
                    {event.action} {event.role ? `· ${event.role}` : ''} par {event.actor}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(event.at).toLocaleString('fr-FR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section id="performance" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Performance</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {[
            ['Ratio commandes / devis', rate(dashboard.commerce.ordersToQuotesRatio)],
            ['Livraisons terminées', rate(deliveryCompletionRate)],
            ['Tâches clôturées', rate(taskCompletionRate)],
            ['Remboursement crédit', `${dashboard.portfolio.repaymentRate}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-100 p-3 text-center">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="analytics" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <div className="mt-4 space-y-3">
          {dashboard.insights.map((insight) => (
            <p key={insight} className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700">
              {insight}
            </p>
          ))}
        </div>
      </section>

      <section id="rapports" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Rapports</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {dashboard.reportLines.map((line) => (
            <li key={line} className="rounded-lg border border-slate-100 p-3">
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
