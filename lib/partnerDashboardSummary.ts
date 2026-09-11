import { StoredPaymentStatus } from '@/lib/paymentStore';
import { StoredProduct } from '@/lib/productStore';
import { StoredQuoteRequest } from '@/lib/quoteStore';
import { StoredService } from '@/lib/serviceStore';

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function groupCurrencyTotals(rows: Array<{ currency: string; amount: number }>) {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    totals[row.currency] = (totals[row.currency] || 0) + row.amount;
  }
  return Object.entries(totals).sort(([left], [right]) => left.localeCompare(right));
}

function getInvoiceCustomer(payment: StoredPaymentStatus) {
  return payment.fullInvoice?.customerName || payment.fullInvoice?.customerEmail || payment.invoice?.email || 'Client';
}

export function buildSupplierSummary(products: StoredProduct[], payments: StoredPaymentStatus[]) {
  const productNames = new Set(
    products.flatMap((product) => [normalizeLabel(product.fr), normalizeLabel(product.en)]).filter(Boolean)
  );

  const matchedPayments = payments.filter((payment) =>
    (payment.fullInvoice?.items || []).some((item) => productNames.has(normalizeLabel(item.productName || '')))
  );

  const matchedConfirmed = matchedPayments.filter((payment) => payment.state === 'confirmed');
  const matchedPending = matchedPayments.filter((payment) => payment.state === 'pending');

  const demandByProduct = products.map((product) => {
    const names = new Set([normalizeLabel(product.fr), normalizeLabel(product.en)]);
    let quantity = 0;
    let orderCount = 0;

    for (const payment of matchedConfirmed) {
      const matchedItems = (payment.fullInvoice?.items || []).filter((item) =>
        names.has(normalizeLabel(item.productName || ''))
      );
      if (matchedItems.length === 0) continue;
      quantity += matchedItems.reduce((sum, item) => sum + item.quantity, 0);
      orderCount += 1;
    }

    return {
      id: product.id,
      name: product.fr,
      unit: product.unitFr,
      active: product.active,
      priced: product.priceUSD !== null || product.priceCDF !== null,
      quantity,
      orderCount,
      stockStatus:
        !product.active ? 'Hors ligne' : orderCount >= 3 ? 'Sous tension' : orderCount > 0 ? 'À surveiller' : 'Stable',
    };
  });

  const categories = Object.entries(
    products.reduce<Record<string, { count: number; activeCount: number }>>((acc, product) => {
      const key = product.unitFr || 'Sans unité';
      const current = acc[key] || { count: 0, activeCount: 0 };
      current.count += 1;
      if (product.active) current.activeCount += 1;
      acc[key] = current;
      return acc;
    }, {})
  )
    .map(([label, value]) => ({ label, ...value }))
    .sort((left, right) => right.count - left.count);

  const clients = Object.values(
    matchedConfirmed.reduce<
      Record<string, { label: string; orders: number; spendByCurrency: Record<string, number> }>
    >((acc, payment) => {
      const key = payment.fullInvoice?.customerEmail || payment.reference;
      const current = acc[key] || { label: getInvoiceCustomer(payment), orders: 0, spendByCurrency: {} };
      current.orders += 1;
      const currency = payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A';
      const amount = payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0;
      current.spendByCurrency[currency] = (current.spendByCurrency[currency] || 0) + amount;
      acc[key] = current;
      return acc;
    }, {})
  )
    .map((client) => ({
      ...client,
      spendByCurrency: Object.entries(client.spendByCurrency).sort(([left], [right]) =>
        left.localeCompare(right)
      ),
    }))
    .sort((left, right) => right.orders - left.orders)
    .slice(0, 6);

  const paymentsByMethod = Object.values(
    matchedPayments.reduce<
      Record<string, { method: string; count: number; totalsByCurrency: Record<string, number> }>
    >((acc, payment) => {
      const current = acc[payment.method] || { method: payment.method, count: 0, totalsByCurrency: {} };
      current.count += 1;
      if (payment.state === 'confirmed') {
        const currency = payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A';
        const amount = payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0;
        current.totalsByCurrency[currency] = (current.totalsByCurrency[currency] || 0) + amount;
      }
      acc[payment.method] = current;
      return acc;
    }, {})
  ).map((row) => ({ ...row, totalsByCurrency: Object.entries(row.totalsByCurrency) }));

  const orderStatus = Object.entries(
    matchedConfirmed.reduce<Record<string, number>>((acc, payment) => {
      const key = payment.orderStatus || 'processing';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ status, count }));

  return {
    totals: {
      productCount: products.length,
      activeCount: products.filter((product) => product.active).length,
      matchedOrderCount: matchedConfirmed.length,
      pendingOrderCount: matchedPending.length,
      pricedCount: products.filter((product) => product.priceUSD !== null || product.priceCDF !== null).length,
      revenueByCurrency: groupCurrencyTotals(
        matchedConfirmed.map((payment) => ({
          currency: payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A',
          amount: payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0,
        }))
      ),
    },
    categories,
    stockRows: demandByProduct.sort((left, right) => right.quantity - left.quantity || Number(right.active) - Number(left.active)),
    recentOrders: matchedConfirmed
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 8)
      .map((payment) => ({
        reference: payment.reference,
        customer: getInvoiceCustomer(payment),
        updatedAt: payment.updatedAt,
        amount: payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0,
        currency: payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A',
        status: payment.orderStatus || 'processing',
      })),
    quoteInfo: {
      count: 0,
      note: "Le store de devis actuel n'établit pas encore de lien direct entre devis et produits fournisseurs.",
    },
    pricingRows: products.map((product) => ({
      id: product.id,
      name: product.fr,
      priceUSD: product.priceUSD,
      priceCDF: product.priceCDF,
      hasDualPricing: product.priceUSD !== null && product.priceCDF !== null,
    })),
    paymentsByMethod,
    orderStatus,
    clients,
    analytics: {
      topProducts: demandByProduct.slice(0, 5),
      inactiveWithDemand: demandByProduct.filter((row) => !row.active && row.orderCount > 0),
    },
  };
}

export function buildTechnicianSummary(services: StoredService[], payments: StoredPaymentStatus[], quotes: StoredQuoteRequest[]) {
  const serviceNames = new Set(
    services.flatMap((service) => [normalizeLabel(service.fr), normalizeLabel(service.en)]).filter(Boolean)
  );

  const matchedPayments = payments.filter((payment) =>
    (payment.fullInvoice?.items || []).some((item) => serviceNames.has(normalizeLabel(item.productName || '')))
  );
  const matchedConfirmed = matchedPayments.filter((payment) => payment.state === 'confirmed');

  const matchedQuotes = quotes.filter((quote) =>
    (quote.services || []).some((serviceName) => serviceNames.has(normalizeLabel(serviceName)))
  );

  const interventions = services.map((service) => {
    const names = new Set([normalizeLabel(service.fr), normalizeLabel(service.en)]);
    const linked = matchedConfirmed.filter((payment) =>
      (payment.fullInvoice?.items || []).some((item) => names.has(normalizeLabel(item.productName || '')))
    );

    return {
      id: service.id,
      name: service.fr,
      active: service.active,
      confirmedJobs: linked.length,
      openJobs: linked.filter((payment) => payment.orderStatus !== 'delivered' && payment.orderStatus !== 'cancelled').length,
      revenueByCurrency: groupCurrencyTotals(
        linked.map((payment) => ({
          currency: payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A',
          amount: payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0,
        }))
      ),
    };
  });

  const clients = Object.values(
    matchedConfirmed.reduce<
      Record<string, { label: string; jobs: number; spendByCurrency: Record<string, number> }>
    >((acc, payment) => {
      const key = payment.fullInvoice?.customerEmail || payment.reference;
      const current = acc[key] || { label: getInvoiceCustomer(payment), jobs: 0, spendByCurrency: {} };
      current.jobs += 1;
      const currency = payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A';
      const amount = payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0;
      current.spendByCurrency[currency] = (current.spendByCurrency[currency] || 0) + amount;
      acc[key] = current;
      return acc;
    }, {})
  )
    .map((client) => ({
      ...client,
      spendByCurrency: Object.entries(client.spendByCurrency),
    }))
    .sort((left, right) => right.jobs - left.jobs)
    .slice(0, 6);

  return {
    totals: {
      serviceCount: services.length,
      activeCount: services.filter((service) => service.active).length,
      quoteCount: matchedQuotes.length,
      confirmedJobs: matchedConfirmed.length,
      revenueByCurrency: groupCurrencyTotals(
        matchedConfirmed.map((payment) => ({
          currency: payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A',
          amount: payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0,
        }))
      ),
    },
    interventions: interventions.sort((left, right) => right.confirmedJobs - left.confirmedJobs),
    missions: matchedConfirmed
      .filter((payment) => payment.orderStatus !== 'delivered' && payment.orderStatus !== 'cancelled')
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 8)
      .map((payment) => ({
        reference: payment.reference,
        customer: getInvoiceCustomer(payment),
        updatedAt: payment.updatedAt,
        status: payment.orderStatus || 'processing',
      })),
    planning: matchedConfirmed
      .filter((payment) => payment.orderStatus !== 'delivered' && payment.orderStatus !== 'cancelled')
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 8)
      .map((payment) => ({
        reference: payment.reference,
        customer: getInvoiceCustomer(payment),
        updatedAt: payment.updatedAt,
      })),
    clients,
    quotes: matchedQuotes.slice(0, 8),
    paymentsByMethod: Object.values(
      matchedConfirmed.reduce<Record<string, { method: string; count: number; totalsByCurrency: Record<string, number> }>>(
        (acc, payment) => {
          const current = acc[payment.method] || { method: payment.method, count: 0, totalsByCurrency: {} };
          current.count += 1;
          const currency = payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A';
          const amount = payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0;
          current.totalsByCurrency[currency] = (current.totalsByCurrency[currency] || 0) + amount;
          acc[payment.method] = current;
          return acc;
        },
        {}
      )
    ).map((row) => ({ ...row, totalsByCurrency: Object.entries(row.totalsByCurrency) })),
    reports: {
      lines: [
        `${matchedConfirmed.length} intervention(s) confirmée(s) détectée(s) dans les paiements.`,
        `${matchedQuotes.length} devis lié(s) à vos services.`,
        `${services.filter((service) => service.active).length}/${services.length} service(s) actuellement actif(s).`,
      ],
      inactiveServices: services.filter((service) => !service.active),
    },
  };
}
