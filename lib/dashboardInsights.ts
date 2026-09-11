import { detectPortfolioAlerts, PortfolioAlertSeverity } from '@/lib/creditIntelligence';
import { Delivery } from '@/lib/deliveryStore';
import { APP_ROLES, AppRole, ROLE_LABELS } from '@/lib/roles';
import { getDaysLate, getPortfolioSummary, getRepaymentHealth, Loan } from '@/lib/loanStore';
import { StoredPaymentStatus } from '@/lib/paymentStore';
import { StoredProduct } from '@/lib/productStore';
import { StoredQuoteRequest } from '@/lib/quoteStore';
import { RoleAssignment, RoleAuditEvent } from '@/lib/roleStore';
import { StoredService } from '@/lib/serviceStore';
import { Site } from '@/lib/siteStore';
import { computeTaxSummary } from '@/lib/taxSummary';

export type InsightSeverity = PortfolioAlertSeverity;
export type RiskLevel = 'high' | 'medium' | 'low';

type CurrencyTotals = Record<string, number>;

export type OperationalAlert = {
  id: string;
  severity: InsightSeverity;
  area: string;
  title: string;
  description: string;
  recommendedAction: string;
};

export type StockRisk = {
  name: string;
  quantity: number;
  orderCount: number;
  catalogMatches: number;
  partnerMatches: number;
  risk: RiskLevel;
  note: string;
};

export type PriceAnomaly = {
  scope: 'Produit' | 'Service';
  name: string;
  priceUSD: number;
  priceCDF: number;
  impliedRate: number;
  deviationPercent: number;
};

export type DelayInsight = {
  area: string;
  label: string;
  severity: InsightSeverity;
  ageDays: number;
  detail: string;
};

export type RouteInsight = {
  title: string;
  detail: string;
};

export type ProcurementRecommendation = {
  name: string;
  quantity: number;
  supplierCount: number;
  recommendation: string;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function addCurrencyAmount(totals: CurrencyTotals, currency: string | undefined, amount: number) {
  const key = (currency || 'N/A').toUpperCase();
  totals[key] = round2((totals[key] || 0) + amount);
}

function toSortedCurrencyEntries(totals: CurrencyTotals) {
  return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
}

function daysSince(date?: string) {
  if (!date) return 0;
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return 0;
  const diff = Date.now() - timestamp;
  return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function formatClientKey(email?: string | null, fallback?: string | null) {
  if (email && email.trim()) return normalizeLabel(email);
  if (fallback && fallback.trim()) return normalizeLabel(fallback);
  return null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function buildRoleCountMap() {
  return Object.fromEntries(APP_ROLES.map((role) => [role, 0])) as Record<AppRole, number>;
}

function matchCatalogEntries(
  name: string,
  products: StoredProduct[],
  services: StoredService[]
) {
  const normalized = normalizeLabel(name);
  const matchedProducts = products.filter(
    (product) => normalizeLabel(product.fr) === normalized || normalizeLabel(product.en) === normalized
  );
  const matchedServices = services.filter(
    (service) => normalizeLabel(service.fr) === normalized || normalizeLabel(service.en) === normalized
  );
  return [...matchedProducts, ...matchedServices];
}

export function buildDashboardInsights(input: {
  loans: Loan[];
  payments: StoredPaymentStatus[];
  deliveries: Delivery[];
  sites: Site[];
  products: StoredProduct[];
  services: StoredService[];
  quotes: StoredQuoteRequest[];
  roleAssignments: Record<string, RoleAssignment>;
  roleAudit: RoleAuditEvent[];
}) {
  const { loans, payments, deliveries, sites, products, services, quotes, roleAssignments, roleAudit } = input;
  const portfolio = getPortfolioSummary(loans);
  const taxSummary = computeTaxSummary(payments);
  const confirmedPayments = payments
    .filter((payment) => payment.state === 'confirmed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const pendingPayments = payments
    .filter((payment) => payment.state === 'pending')
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  const activeProducts = products.filter((product) => product.active);
  const activeServices = services.filter((service) => service.active);

  const confirmedRevenueByCurrency: CurrencyTotals = {};
  const averageBasketByCurrency: CurrencyTotals = {};
  const basketCounts: Record<string, number> = {};
  const current30DayRevenueByCurrency: CurrencyTotals = {};
  const previous30DayRevenueByCurrency: CurrencyTotals = {};
  const productDemand = new Map<
    string,
    { name: string; quantity: number; orderCount: number; revenue: CurrencyTotals }
  >();
  const clientActivity = new Map<
    string,
    { label: string; orders: number; quotes: number; deliveries: number; sites: number; loans: number }
  >();

  const now = Date.now();
  const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;

  for (const payment of confirmedPayments) {
    const invoice = payment.fullInvoice;
    const currency = invoice?.currency || payment.invoice?.totals.currency || 'N/A';
    const amount = invoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0;
    addCurrencyAmount(confirmedRevenueByCurrency, currency, amount);
    addCurrencyAmount(averageBasketByCurrency, currency, amount);
    basketCounts[currency] = (basketCounts[currency] || 0) + 1;

    const age = now - new Date(payment.updatedAt).getTime();
    if (age <= THIRTY_DAYS) {
      addCurrencyAmount(current30DayRevenueByCurrency, currency, amount);
    } else if (age <= THIRTY_DAYS * 2) {
      addCurrencyAmount(previous30DayRevenueByCurrency, currency, amount);
    }

    const clientKey = formatClientKey(invoice?.customerEmail, payment.invoice?.email);
    if (clientKey) {
      const entry = clientActivity.get(clientKey) || {
        label: invoice?.customerEmail || payment.invoice?.email || 'Client',
        orders: 0,
        quotes: 0,
        deliveries: 0,
        sites: 0,
        loans: 0,
      };
      entry.orders += 1;
      clientActivity.set(clientKey, entry);
    }

    for (const item of invoice?.items || []) {
      const itemKey = normalizeLabel(item.productName || 'Produit');
      const demand =
        productDemand.get(itemKey) || {
          name: item.productName || 'Produit',
          quantity: 0,
          orderCount: 0,
          revenue: {},
        };
      demand.quantity += item.quantity;
      demand.orderCount += 1;
      addCurrencyAmount(demand.revenue, currency, item.lineTotal || 0);
      productDemand.set(itemKey, demand);
    }
  }

  for (const quote of quotes) {
    const key = formatClientKey(quote.email, quote.phone || quote.name);
    if (!key) continue;
    const entry = clientActivity.get(key) || {
      label: quote.email || quote.name,
      orders: 0,
      quotes: 0,
      deliveries: 0,
      sites: 0,
      loans: 0,
    };
    entry.quotes += 1;
    clientActivity.set(key, entry);
  }

  for (const delivery of deliveries) {
    const key = formatClientKey(undefined, delivery.clientIdentity);
    if (!key) continue;
    const entry = clientActivity.get(key) || {
      label: delivery.clientName || delivery.clientIdentity,
      orders: 0,
      quotes: 0,
      deliveries: 0,
      sites: 0,
      loans: 0,
    };
    entry.deliveries += 1;
    clientActivity.set(key, entry);
  }

  for (const site of sites) {
    const key = formatClientKey(undefined, site.clientIdentity);
    if (!key) continue;
    const entry = clientActivity.get(key) || {
      label: site.clientIdentity!,
      orders: 0,
      quotes: 0,
      deliveries: 0,
      sites: 0,
      loans: 0,
    };
    entry.sites += 1;
    clientActivity.set(key, entry);
  }

  for (const loan of loans) {
    const key = formatClientKey(undefined, loan.identity);
    if (!key) continue;
    const entry = clientActivity.get(key) || {
      label: loan.borrower.fullName || loan.identity,
      orders: 0,
      quotes: 0,
      deliveries: 0,
      sites: 0,
      loans: 0,
    };
    entry.loans += 1;
    clientActivity.set(key, entry);
  }

  const averageBasketEntries = Object.entries(averageBasketByCurrency).reduce<CurrencyTotals>(
    (acc, [currency, total]) => {
      const count = basketCounts[currency] || 1;
      acc[currency] = round2(total / count);
      return acc;
    },
    {}
  );

  const clientRows = Array.from(clientActivity.entries())
    .map(([key, value]) => ({ key, ...value }))
    .sort(
      (a, b) =>
        b.orders + b.quotes + b.deliveries + b.sites + b.loans - (a.orders + a.quotes + a.deliveries + a.sites + a.loans)
    );

  const topItems = Array.from(productDemand.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6)
    .map((item) => ({
      name: item.name,
      quantity: item.quantity,
      orderCount: item.orderCount,
      revenueByCurrency: toSortedCurrencyEntries(item.revenue),
    }));

  const supplierProductOwners = new Set(
    activeProducts.map((product) => product.ownerIdentity).filter(Boolean) as string[]
  );
  const technicianServiceOwners = new Set(
    activeServices.map((service) => service.ownerIdentity).filter(Boolean) as string[]
  );

  const roleCounts = buildRoleCountMap();
  let activeAssignments = 0;
  let inactiveAssignments = 0;

  for (const assignment of Object.values(roleAssignments)) {
    roleCounts[assignment.role] += 1;
    if (assignment.active) activeAssignments += 1;
    else inactiveAssignments += 1;
  }

  const byRole = APP_ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role].fr,
    count: roleCounts[role],
  })).filter((entry) => entry.count > 0);

  const deliveryByStatus = {
    pending: deliveries.filter((delivery) => delivery.status === 'pending').length,
    assigned: deliveries.filter((delivery) => delivery.status === 'assigned').length,
    picked_up: deliveries.filter((delivery) => delivery.status === 'picked_up').length,
    in_transit: deliveries.filter((delivery) => delivery.status === 'in_transit').length,
    delivered: deliveries.filter((delivery) => delivery.status === 'delivered').length,
    cancelled: deliveries.filter((delivery) => delivery.status === 'cancelled').length,
  };
  const openDeliveries = deliveries.filter(
    (delivery) => delivery.status !== 'delivered' && delivery.status !== 'cancelled'
  );
  const staleDeliveries = openDeliveries
    .map((delivery) => ({
      id: delivery.id,
      reference: delivery.reference,
      status: delivery.status,
      ageDays: daysSince(delivery.statusHistory.at(-1)?.at || delivery.createdAt),
      driverIdentity: delivery.driverIdentity || null,
    }))
    .filter((delivery) => delivery.ageDays >= 3)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 5);

  const routeInsights: RouteInsight[] = [];
  if (openDeliveries.length > 0) {
    const missingDestinationCount = openDeliveries.filter((delivery) => !delivery.destination).length;
    if (missingDestinationCount > 0) {
      routeInsights.push({
        title: 'Compléter les coordonnées GPS',
        detail: `${missingDestinationCount} livraison(s) ouverte(s) n'ont pas encore de destination exploitable pour un guidage précis.`,
      });
    }
    const driverLoads = Array.from(
      openDeliveries.reduce((map, delivery) => {
        if (!delivery.driverIdentity) return map;
        map.set(delivery.driverIdentity, (map.get(delivery.driverIdentity) || 0) + 1);
        return map;
      }, new Map<string, number>())
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    for (const [driverIdentity, count] of driverLoads) {
      if (count >= 2) {
        routeInsights.push({
          title: `Consolider les tournées de ${driverIdentity}`,
          detail: `${count} livraisons ouvertes sont déjà affectées à ce chauffeur ; une tournée groupée limitera les kilomètres à vide.`,
        });
      }
    }
  }

  const overdueSiteTasks = sites.flatMap((site) =>
    site.tasks
      .filter((task) => !task.done && task.dueDate && new Date(task.dueDate).getTime() < now)
      .map((task) => ({
        siteName: site.name,
        label: task.label,
        ageDays: daysSince(task.dueDate),
      }))
  );

  const creditAlerts = detectPortfolioAlerts(loans).map((alert) => ({
    ...alert,
    area: 'Crédit',
  }));

  const operationalAlerts: OperationalAlert[] = [];
  const oldPendingPayments = pendingPayments.filter((payment) => daysSince(payment.updatedAt) >= 2);
  if (oldPendingPayments.length > 0) {
    operationalAlerts.push({
      id: 'pending-payments-aging',
      area: 'Paiements',
      severity: 'warning',
      title: 'Paiements en attente à relancer',
      description: `${oldPendingPayments.length} paiement(s) sont en attente depuis au moins 48h.`,
      recommendedAction: 'Relancer le client ou vérifier le provider avant accumulation des abandons.',
    });
  }

  const highIncidents = sites.flatMap((site) =>
    site.incidents
      .filter((incident) => !incident.resolved && incident.severity === 'high')
      .map((incident) => ({
        siteName: site.name,
        label: incident.label,
      }))
  );
  if (highIncidents.length > 0) {
    operationalAlerts.push({
      id: 'high-site-incidents',
      area: 'Chantiers',
      severity: 'critical',
      title: 'Incidents chantier non résolus',
      description: `${highIncidents.length} incident(s) critiques restent ouverts sur les chantiers actifs.`,
      recommendedAction: 'Prioriser une revue sécurité et débloquer les équipes terrain.',
    });
  }

  if (staleDeliveries.length > 0) {
    operationalAlerts.push({
      id: 'stale-deliveries',
      area: 'Logistique',
      severity: 'warning',
      title: 'Livraisons bloquées',
      description: `${staleDeliveries.length} livraison(s) n'ont pas avancé depuis au moins 3 jours.`,
      recommendedAction: 'Réaffecter les missions bloquées ou informer le client avant escalade.',
    });
  }

  const stockRisks: StockRisk[] = Array.from(productDemand.values())
    .map((item) => {
      const matches = matchCatalogEntries(item.name, activeProducts, activeServices);
      const partnerMatches = new Set(matches.map((entry) => ('ownerIdentity' in entry ? entry.ownerIdentity : undefined)).filter(Boolean))
        .size;
      const catalogMatches = matches.length;
      let risk: RiskLevel = 'low';
      let note = 'Demande couverte par le catalogue actuel.';

      if (catalogMatches === 0) {
        risk = 'high';
        note = 'Demande confirmée sans offre active correspondante dans le catalogue.';
      } else if (item.quantity >= 5 && partnerMatches <= 1) {
        risk = 'high';
        note = 'Demande soutenue avec peu de fournisseurs/techniciens actifs pour absorber la charge.';
      } else if (item.quantity >= 3 && catalogMatches <= 1) {
        risk = 'medium';
        note = 'Produit/service porté par une seule offre active.';
      }

      return {
        name: item.name,
        quantity: item.quantity,
        orderCount: item.orderCount,
        catalogMatches,
        partnerMatches,
        risk,
        note,
      };
    })
    .filter((item) => item.quantity > 0)
    .sort((a, b) => {
      const riskWeight = { high: 0, medium: 1, low: 2 };
      return riskWeight[a.risk] - riskWeight[b.risk] || b.quantity - a.quantity;
    })
    .slice(0, 6);

  const priceRateRows = [
    ...activeProducts
      .filter((product) => (product.priceUSD || 0) > 0 && (product.priceCDF || 0) > 0)
      .map((product) => ({
        scope: 'Produit' as const,
        name: product.fr,
        priceUSD: product.priceUSD as number,
        priceCDF: product.priceCDF as number,
        impliedRate: (product.priceCDF as number) / (product.priceUSD as number),
      })),
    ...activeServices
      .filter((service) => (service.priceUSD || 0) > 0 && (service.priceCDF || 0) > 0)
      .map((service) => ({
        scope: 'Service' as const,
        name: service.fr,
        priceUSD: service.priceUSD as number,
        priceCDF: service.priceCDF as number,
        impliedRate: (service.priceCDF as number) / (service.priceUSD as number),
      })),
  ];
  const medianRate = median(priceRateRows.map((row) => row.impliedRate));
  const priceAnomalies: PriceAnomaly[] =
    medianRate === null
      ? []
      : priceRateRows
          .map((row) => ({
            ...row,
            deviationPercent: Math.round((Math.abs(row.impliedRate - medianRate) / medianRate) * 100),
          }))
          .filter((row) => row.deviationPercent >= 25)
          .sort((a, b) => b.deviationPercent - a.deviationPercent)
          .slice(0, 6);

  const delayInsights: DelayInsight[] = [
    ...loans
      .filter((loan) => loan.status === 'active' && getRepaymentHealth(loan) !== 'on_track')
      .map((loan) => ({
        area: 'Crédit',
        label: loan.id,
        severity: getRepaymentHealth(loan) === 'defaulted' ? ('critical' as const) : ('warning' as const),
        ageDays: getDaysLate(loan),
        detail: `${loan.borrower.fullName || loan.identity} — ${getDaysLate(loan)} jour(s) de retard.`,
      })),
    ...oldPendingPayments.map((payment) => ({
      area: 'Paiement',
      label: payment.reference,
      severity: 'warning' as const,
      ageDays: daysSince(payment.updatedAt),
      detail: `${payment.method} en attente depuis ${daysSince(payment.updatedAt)} jour(s).`,
    })),
    ...staleDeliveries.map((delivery) => ({
      area: 'Livraison',
      label: delivery.reference,
      severity: 'warning' as const,
      ageDays: delivery.ageDays,
      detail: `${delivery.status} sans évolution depuis ${delivery.ageDays} jour(s).`,
    })),
    ...overdueSiteTasks.map((task) => ({
      area: 'Chantier',
      label: `${task.siteName} — ${task.label}`,
      severity: 'info' as const,
      ageDays: task.ageDays,
      detail: `Tâche échue depuis ${task.ageDays} jour(s).`,
    })),
  ]
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8);

  const procurementRecommendations: ProcurementRecommendation[] = stockRisks
    .filter((risk) => risk.risk !== 'low')
    .map((risk) => ({
      name: risk.name,
      quantity: risk.quantity,
      supplierCount: risk.partnerMatches,
      recommendation:
        risk.catalogMatches === 0
          ? 'Créer une offre active ou onboarder un partenaire dédié.'
          : risk.partnerMatches === 0
            ? 'Ouvrir la catégorie à des partenaires externes pour sécuriser la demande.'
            : 'Ajouter au moins un partenaire supplémentaire et sécuriser le réassort.',
    }))
    .slice(0, 5);

  const profitabilityTopItems = Array.from(productDemand.values())
    .sort((a, b) => {
      const aRevenue = Object.values(a.revenue).reduce((sum, value) => sum + value, 0);
      const bRevenue = Object.values(b.revenue).reduce((sum, value) => sum + value, 0);
      return bRevenue - aRevenue;
    })
    .slice(0, 5)
    .map((item) => ({
      name: item.name,
      revenueByCurrency: toSortedCurrencyEntries(item.revenue),
      quantity: item.quantity,
    }));

  const salesForecastByCurrency = toSortedCurrencyEntries(current30DayRevenueByCurrency).map(
    ([currency, currentAmount]) => {
      const previousAmount = previous30DayRevenueByCurrency[currency] || 0;
      const projectedAmount = round2(currentAmount);
      const trend =
        currentAmount > previousAmount ? 'hausse' : currentAmount < previousAmount ? 'baisse' : 'stable';
      const deltaPercent =
        previousAmount > 0 ? Math.round(((currentAmount - previousAmount) / previousAmount) * 100) : null;
      return { currency, currentAmount, previousAmount, projectedAmount, trend, deltaPercent };
    }
  );

  const insights: string[] = [];
  if (confirmedPayments.length > 0) {
    insights.push(
      `${confirmedPayments.length} commande(s) confirmée(s) alimentent maintenant les vues Direction et IA.`
    );
  }
  if (openDeliveries.length === 0) {
    insights.push('Aucune livraison active n’est encore remontée : le module logistique reste sous-alimenté.');
  }
  if (sites.length === 0) {
    insights.push('Aucun chantier enregistré : la direction ne dispose pas encore de pilotage terrain consolidé.');
  }
  if (activeAssignments === 0) {
    insights.push('Aucune affectation officielle de rôle n’est stockée ; la vue RH repose surtout sur les catalogues et flux observés.');
  }
  if (stockRisks.some((risk) => risk.risk === 'high')) {
    insights.push('Des ventes récentes portent sur des offres peu couvertes, ce qui crée un risque de rupture ou de saturation partenaire.');
  }

  const reportLines = [
    `Commandes confirmées : ${confirmedPayments.length} | Paiements en attente : ${pendingPayments.length}`,
    `Revenus confirmés : ${toSortedCurrencyEntries(confirmedRevenueByCurrency)
      .map(([currency, amount]) => `${amount.toLocaleString('fr-FR')} ${currency}`)
      .join(' / ') || 'aucun'}`,
    `Livraisons ouvertes : ${openDeliveries.length} | Chantiers actifs : ${sites.filter((site) => site.status === 'active').length}`,
    `Portefeuille crédit : ${portfolio.activeCount} actif(s), taux de remboursement ${portfolio.repaymentRate}%`,
  ];

  return {
    portfolio,
    taxSummary,
    commerce: {
      totalPaymentsCount: payments.length,
      confirmedOrdersCount: confirmedPayments.length,
      pendingPaymentsCount: pendingPayments.length,
      uniqueKnownClientsCount: clientRows.length,
      repeatClientsCount: clientRows.filter((client) => client.orders > 1).length,
      anonymousConfirmedOrdersCount: confirmedPayments.filter(
        (payment) => !formatClientKey(payment.fullInvoice?.customerEmail, payment.invoice?.email)
      ).length,
      quoteRequestsCount: quotes.length,
      quoteToOrderRate:
        quotes.length > 0 ? Math.round((confirmedPayments.length / quotes.length) * 100) : null,
      confirmedRevenueByCurrency: toSortedCurrencyEntries(confirmedRevenueByCurrency),
      averageBasketByCurrency: toSortedCurrencyEntries(averageBasketEntries),
      recentOrders: confirmedPayments.slice(0, 6).map((payment) => ({
        reference: payment.reference,
        customerName: payment.fullInvoice?.customerName || payment.invoice?.email || 'Client MonChantier',
        method: payment.method,
        amount: payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0,
        currency: payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A',
        orderStatus: payment.orderStatus || 'processing',
        updatedAt: payment.updatedAt,
      })),
      topItems,
      salesForecastByCurrency,
    },
    clients: {
      rows: clientRows.slice(0, 6),
      orderingCount: clientRows.filter((client) => client.orders > 0).length,
      quotesOnlyCount: clientRows.filter((client) => client.orders === 0 && client.quotes > 0).length,
    },
    partners: {
      activeProductsCount: activeProducts.length,
      activeServicesCount: activeServices.length,
      platformProductsCount: activeProducts.filter((product) => !product.ownerIdentity).length,
      platformServicesCount: activeServices.filter((service) => !service.ownerIdentity).length,
      supplierPartnerCount: supplierProductOwners.size,
      technicianPartnerCount: technicianServiceOwners.size,
      byRole,
    },
    logistics: {
      totalCount: deliveries.length,
      openCount: openDeliveries.length,
      deliveredCount: deliveryByStatus.delivered,
      cancelledCount: deliveryByStatus.cancelled,
      unassignedCount: openDeliveries.filter((delivery) => !delivery.driverIdentity).length,
      missingDestinationCount: openDeliveries.filter((delivery) => !delivery.destination).length,
      byStatus: deliveryByStatus,
      driverLoads: Array.from(
        deliveries.reduce((map, delivery) => {
          if (!delivery.driverIdentity) return map;
          map.set(delivery.driverIdentity, (map.get(delivery.driverIdentity) || 0) + 1);
          return map;
        }, new Map<string, number>())
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      staleDeliveries,
      routeInsights,
    },
    sites: {
      totalCount: sites.length,
      planningCount: sites.filter((site) => site.status === 'planning').length,
      activeCount: sites.filter((site) => site.status === 'active').length,
      pausedCount: sites.filter((site) => site.status === 'paused').length,
      completedCount: sites.filter((site) => site.status === 'completed').length,
      totalTasks: sites.reduce((sum, site) => sum + site.tasks.length, 0),
      completedTasks: sites.reduce(
        (sum, site) => sum + site.tasks.filter((task) => task.done).length,
        0
      ),
      unresolvedIncidents: sites.reduce(
        (sum, site) => sum + site.incidents.filter((incident) => !incident.resolved).length,
        0
      ),
      highIncidents,
      overdueTasks: overdueSiteTasks.slice(0, 5),
    },
    workforce: {
      totalAssignments: Object.keys(roleAssignments).length,
      activeAssignments,
      inactiveAssignments,
      byRole,
      recentAudit: roleAudit.slice(0, 6),
      observedContributorCount: new Set([
        ...supplierProductOwners,
        ...technicianServiceOwners,
        ...sites.map((site) => site.siteManagerIdentity),
        ...deliveries.map((delivery) => delivery.driverIdentity).filter(Boolean),
        ...loans.map((loan) => loan.assignedAgentIdentity).filter(Boolean),
      ]).size,
    },
    insights,
    reportLines,
    ai: {
      alerts: [...creditAlerts, ...operationalAlerts].sort((a, b) => {
        const weights: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
        return weights[a.severity] - weights[b.severity];
      }),
      stockRisks,
      priceAnomalies,
      forecast: salesForecastByCurrency,
      routeInsights,
      delays: delayInsights,
      profitability: {
        revenueByCurrency: toSortedCurrencyEntries(confirmedRevenueByCurrency),
        vatByCurrency: Object.entries(taxSummary.totalsByCurrency).map(([currency, totals]) => ({
          currency,
          tva: totals.tva,
          ht: totals.ht,
          ttc: totals.ttc,
        })),
        topItems: profitabilityTopItems,
      },
      procurementRecommendations,
    },
  };
}
