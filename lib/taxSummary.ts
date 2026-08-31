import { StoredPaymentStatus } from '@/lib/paymentStore';

export type TaxTotals = {
  ht: number;
  tva: number;
  ttc: number;
  count: number;
};

export type TaxSummary = {
  vatRate: number | null;
  totalsByCurrency: Record<string, TaxTotals>;
  invoices: Array<{
    reference: string;
    invoiceNumber: string;
    method: string;
    currency: string;
    ht: number;
    tva: number;
    ttc: number;
    updatedAt: string;
  }>;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function computeTaxSummary(statuses: StoredPaymentStatus[]): TaxSummary {
  const totalsByCurrency: Record<string, TaxTotals> = {};
  const invoices: TaxSummary['invoices'] = [];
  let vatRate: number | null = null;

  for (const status of statuses) {
    if (status.state !== 'confirmed' || !status.invoice) continue;
    const { totals, taxRate, number } = status.invoice;
    if (!totals) continue;

    if (vatRate === null) vatRate = taxRate;

    const currency = totals.currency;
    if (!totalsByCurrency[currency]) {
      totalsByCurrency[currency] = { ht: 0, tva: 0, ttc: 0, count: 0 };
    }
    totalsByCurrency[currency].ht = round2(totalsByCurrency[currency].ht + totals.ht);
    totalsByCurrency[currency].tva = round2(totalsByCurrency[currency].tva + totals.tva);
    totalsByCurrency[currency].ttc = round2(totalsByCurrency[currency].ttc + totals.ttc);
    totalsByCurrency[currency].count += 1;

    invoices.push({
      reference: status.reference,
      invoiceNumber: number,
      method: status.method,
      currency,
      ht: totals.ht,
      tva: totals.tva,
      ttc: totals.ttc,
      updatedAt: status.updatedAt,
    });
  }

  invoices.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return { vatRate, totalsByCurrency, invoices };
}
