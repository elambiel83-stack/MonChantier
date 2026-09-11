import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/requireRole';
import { buildDashboardInsights } from '@/lib/dashboardInsights';
import { listAllDeliveries } from '@/lib/deliveryStore';
import { listExpenses } from '@/lib/expenseStore';
import { listAllLoans } from '@/lib/loanStore';
import { listPaymentStatuses } from '@/lib/paymentStore';
import { listProducts } from '@/lib/productStore';
import { listAllQuoteRequests } from '@/lib/quoteStore';
import { listRoleAudit, listStoredRoles } from '@/lib/roleStore';
import { listServices } from '@/lib/serviceStore';
import { listAllSites } from '@/lib/siteStore';

export async function GET(request: NextRequest) {
  const denied = await requireRole(request, ['accountant']);
  if (denied) return denied;

  const [loans, payments, deliveries, sites, products, services, quotes, roleAssignments, roleAudit, expenses] =
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
      listExpenses(),
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

  const paymentsByMethod = Object.values(
    payments.reduce<
      Record<
        string,
        {
          method: string;
          totalCount: number;
          confirmedCount: number;
          pendingCount: number;
          totalsByCurrency: Record<string, number>;
        }
      >
    >((acc, payment) => {
      const method = payment.method;
      const current =
        acc[method] ||
        {
          method,
          totalCount: 0,
          confirmedCount: 0,
          pendingCount: 0,
          totalsByCurrency: {},
        };

      current.totalCount += 1;
      if (payment.state === 'confirmed') {
        current.confirmedCount += 1;
        const currency = payment.fullInvoice?.currency || payment.invoice?.totals.currency || 'N/A';
        const amount = payment.fullInvoice?.totalTTC ?? payment.invoice?.totals.ttc ?? 0;
        current.totalsByCurrency[currency] = (current.totalsByCurrency[currency] || 0) + amount;
      } else {
        current.pendingCount += 1;
      }

      acc[method] = current;
      return acc;
    }, {})
  ).map((entry) => ({
    ...entry,
    totalsByCurrency: Object.entries(entry.totalsByCurrency).sort(([a], [b]) => a.localeCompare(b)),
  }));

  const pendingPayments = payments
    .filter((payment) => payment.state === 'pending')
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .slice(0, 8)
    .map((payment) => ({
      reference: payment.reference,
      method: payment.method,
      updatedAt: payment.updatedAt,
      ageDays: Math.max(0, Math.floor((Date.now() - new Date(payment.updatedAt).getTime()) / (1000 * 60 * 60 * 24))),
    }));

  const expenseTotalsByCategory = Object.entries(
    expenses.reduce<Record<string, Record<string, number>>>((acc, expense) => {
      const category = expense.category || 'Autres';
      const currency = expense.currency;
      const currentCategory = acc[category] || {};
      currentCategory[currency] = (currentCategory[currency] || 0) + expense.amount;
      acc[category] = currentCategory;
      return acc;
    }, {})
  ).map(([category, totalsByCurrency]) => ({
    category,
    totalsByCurrency: Object.entries(totalsByCurrency).sort(([a], [b]) => a.localeCompare(b)),
  }));

  return NextResponse.json({
    commerce: {
      confirmedOrdersCount: dashboard.commerce.confirmedOrdersCount,
      pendingPaymentsCount: dashboard.commerce.pendingPaymentsCount,
      quoteRequestsCount: dashboard.commerce.quoteRequestsCount,
      ordersToQuotesRatio: dashboard.commerce.ordersToQuotesRatio,
      anonymousConfirmedOrdersCount: dashboard.commerce.anonymousConfirmedOrdersCount,
      confirmedRevenueByCurrency: dashboard.commerce.confirmedRevenueByCurrency,
      averageBasketByCurrency: dashboard.commerce.averageBasketByCurrency,
      recentOrders: dashboard.commerce.recentOrders,
      paymentsByMethod,
      pendingPayments,
    },
    clients: dashboard.clients,
    partners: dashboard.partners,
    reports: {
      lines: dashboard.reportLines,
      expenseTotalsByCategory,
    },
  });
}
