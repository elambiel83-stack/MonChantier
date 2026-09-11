"use client";

import { useEffect, useMemo, useState } from "react";

type StoredOrder = {
  reference: string;
  method: "mobilemoney" | "card" | "paypal";
  updatedAt: string;
  invoice?: {
    totals?: { ht: number; tva: number; ttc: number; currency: string };
  };
  fullInvoice?: {
    customerName?: string;
    customerEmail?: string;
  };
};

type TaxTotals = { ht: number; tva: number; ttc: number; count: number };

type TaxSummary = {
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

type Expense = {
  id: number;
  label: string;
  category: string;
  amount: number;
  currency: "USD" | "CDF";
  date: string;
  createdAt: string;
};

type AccountantSummary = {
  commerce: {
    confirmedOrdersCount: number;
    pendingPaymentsCount: number;
    quoteRequestsCount: number;
    ordersToQuotesRatio: number | null;
    anonymousConfirmedOrdersCount: number;
    confirmedRevenueByCurrency: Array<[string, number]>;
    averageBasketByCurrency: Array<[string, number]>;
    recentOrders: Array<{
      reference: string;
      customerName: string;
      method: string;
      amount: number;
      currency: string;
      orderStatus: string;
      updatedAt: string;
    }>;
    paymentsByMethod: Array<{
      method: string;
      totalCount: number;
      confirmedCount: number;
      pendingCount: number;
      totalsByCurrency: Array<[string, number]>;
    }>;
    pendingPayments: Array<{
      reference: string;
      method: string;
      updatedAt: string;
      ageDays: number;
    }>;
  };
  clients: {
    rows: Array<{
      key: string;
      label: string;
      orders: number;
      quotes: number;
      deliveries: number;
      sites: number;
      loans: number;
    }>;
    orderingCount: number;
    quotesOnlyCount: number;
  };
  partners: {
    activeProductsCount: number;
    activeServicesCount: number;
    platformProductsCount: number;
    platformServicesCount: number;
    supplierPartnerCount: number;
    technicianPartnerCount: number;
    byRole: Array<{
      role: string;
      label: string;
      count: number;
    }>;
  };
  reports: {
    lines: string[];
    expenseTotalsByCategory: Array<{
      category: string;
      totalsByCurrency: Array<[string, number]>;
    }>;
  };
};

const METHOD_LABELS: Record<string, string> = {
  mobilemoney: "Mobile Money",
  card: "Carte bancaire",
  paypal: "PayPal",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatMoneyEntries(entries: Array<[string, number]>) {
  if (entries.length === 0) return "Aucune donnée";
  return entries
    .map(([currency, amount]) => `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency}`)
    .join(" / ");
}

function toCsvCell(value: string | number) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export default function AccountantPanel() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<AccountantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [busyExpenseId, setBusyExpenseId] = useState<number | null>(null);
  const [newExpense, setNewExpense] = useState({
    label: "",
    category: "Achats",
    amount: "",
    currency: "USD" as "USD" | "CDF",
    date: new Date().toISOString().slice(0, 10),
  });

  const loadAll = async () => {
    try {
      setLoading(true);
      const [ordersRes, taxesRes, expensesRes, summaryRes] = await Promise.all([
        fetch("/api/accountant/orders", { cache: "no-store" }),
        fetch("/api/accountant/taxes", { cache: "no-store" }),
        fetch("/api/accountant/expenses", { cache: "no-store" }),
        fetch("/api/accountant/summary", { cache: "no-store" }),
      ]);
      const ordersData = ordersRes.ok ? await ordersRes.json() : { orders: [] };
      const taxesData = taxesRes.ok ? await taxesRes.json() : null;
      const expensesData = expensesRes.ok ? await expensesRes.json() : { expenses: [] };
      const summaryData = summaryRes.ok ? await summaryRes.json() : null;
      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
      setTaxSummary(taxesData);
      setExpenses(Array.isArray(expensesData.expenses) ? expensesData.expenses : []);
      setSummary(summaryData);
    } catch {
      setOrders([]);
      setTaxSummary(null);
      setExpenses([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const createExpense = async () => {
    if (!newExpense.label.trim() || !newExpense.amount) return;
    try {
      setSavingExpense(true);
      const res = await fetch("/api/accountant/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newExpense),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur création dépense");
      setNewExpense({
        label: "",
        category: "Achats",
        amount: "",
        currency: "USD",
        date: new Date().toISOString().slice(0, 10),
      });
      setBanner({ type: "success", message: "Dépense enregistrée." });
      await loadAll();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setSavingExpense(false);
    }
  };

  const removeExpense = async (id: number) => {
    try {
      setBusyExpenseId(id);
      const res = await fetch(`/api/accountant/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur suppression dépense");
      setBanner({ type: "success", message: "Dépense supprimée." });
      await loadAll();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusyExpenseId(null);
    }
  };

  const exportInvoicesCsv = () => {
    const rows = [
      ["Référence", "Numéro facture", "Méthode", "HT", "TVA", "TTC", "Devise", "Date"],
      ...(taxSummary?.invoices || []).map((inv) => [
        inv.reference,
        inv.invoiceNumber,
        inv.method,
        inv.ht,
        inv.tva,
        inv.ttc,
        inv.currency,
        formatDate(inv.updatedAt),
      ]),
    ];
    const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `factures-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const treasuryByCurrency = useMemo(() => {
    const inflow: Record<string, number> = {};
    for (const [currency, totals] of Object.entries(taxSummary?.totalsByCurrency || {})) {
      inflow[currency] = totals.ttc;
    }
    const outflow: Record<string, number> = {};
    for (const expense of expenses) {
      outflow[expense.currency] = (outflow[expense.currency] || 0) + expense.amount;
    }
    const currencies = new Set([...Object.keys(inflow), ...Object.keys(outflow)]);
    return Array.from(currencies).map((currency) => ({
      currency,
      inflow: inflow[currency] || 0,
      outflow: outflow[currency] || 0,
      net: (inflow[currency] || 0) - (outflow[currency] || 0),
    }));
  }, [taxSummary, expenses]);

  const bannerClassName =
    banner?.type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Comptable</h1>
      <p className="mt-1 text-slate-600">Contrôler les flux financiers.</p>

      {banner && (
        <div className={`mt-3 rounded-lg border p-3 text-sm ${bannerClassName}`}>
          {banner.message}
        </div>
      )}

      <div id="tresorerie" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Trésorerie</h2>
        <p className="mt-1 text-sm text-slate-500">Encaissé confirmé moins dépenses, par devise.</p>
        {treasuryByCurrency.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucune donnée pour le moment.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {treasuryByCurrency.map((row) => (
              <div key={row.currency} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">{row.currency}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Encaissé: {row.inflow.toLocaleString("fr-FR")} {row.currency}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Dépenses: {row.outflow.toLocaleString("fr-FR")} {row.currency}
                </p>
                <p className={`mt-1 text-lg font-bold ${row.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  Solde: {row.net.toLocaleString("fr-FR")} {row.currency}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div id="proformas" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Proformas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Suivi des demandes amont utilisées ici comme base de pré-facturation commerciale.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Demandes de devis</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {summary?.commerce.quoteRequestsCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Commandes confirmées</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {summary?.commerce.confirmedOrdersCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Ratio commandes / devis</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {summary?.commerce.ordersToQuotesRatio ?? "N/A"}{summary?.commerce.ordersToQuotesRatio !== null ? "%" : ""}
            </p>
          </div>
        </div>
      </div>

      <div id="paiements" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Paiements</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {summary?.commerce.paymentsByMethod.length ? (
              summary.commerce.paymentsByMethod.map((row) => (
                <div key={row.method} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{METHOD_LABELS[row.method] || row.method}</p>
                    <p className="text-xs text-slate-500">{row.totalCount} tentative(s)</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Confirmés: {row.confirmedCount} · En attente: {row.pendingCount}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatMoneyEntries(row.totalsByCurrency)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aucun paiement enregistré.
              </p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700">Paiements en attente</h3>
            <div className="mt-3 space-y-3">
              {summary?.commerce.pendingPayments.length ? (
                summary.commerce.pendingPayments.map((payment) => (
                  <div key={payment.reference} className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs text-amber-900">{payment.reference}</p>
                      <p className="text-xs text-amber-700">{payment.ageDays} jour(s)</p>
                    </div>
                    <p className="mt-1 text-amber-800">{METHOD_LABELS[payment.method] || payment.method}</p>
                    <p className="mt-1 text-xs text-amber-700">{formatDate(payment.updatedAt)}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Aucun paiement en attente.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div id="depenses" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Dépenses</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            value={newExpense.label}
            onChange={(e) => setNewExpense((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="Libellé"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newExpense.category}
            onChange={(e) => setNewExpense((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="Catégorie"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={newExpense.amount}
            onChange={(e) => setNewExpense((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="Montant"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={newExpense.currency}
            onChange={(e) => setNewExpense((prev) => ({ ...prev, currency: e.target.value as "USD" | "CDF" }))}
            aria-label="Devise"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
          <input
            type="date"
            value={newExpense.date}
            onChange={(e) => setNewExpense((prev) => ({ ...prev, date: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={createExpense}
          disabled={savingExpense}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {savingExpense ? "Enregistrement…" : "+ Ajouter la dépense"}
        </button>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Libellé</th>
                <th className="py-2 pr-4 font-medium">Catégorie</th>
                <th className="py-2 pr-4 font-medium">Montant</th>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">Aucune dépense enregistrée.</td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-4">{expense.label}</td>
                    <td className="py-3 pr-4">{expense.category}</td>
                    <td className="py-3 pr-4">
                      {expense.amount.toLocaleString("fr-FR")} {expense.currency}
                    </td>
                    <td className="py-3 pr-4">{formatDate(expense.date)}</td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => removeExpense(expense.id)}
                        disabled={busyExpenseId === expense.id}
                        className="rounded-lg border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-600 disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div id="tva" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">TVA</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculée sur toutes les factures confirmées.
          {taxSummary?.vatRate !== null && taxSummary?.vatRate !== undefined && (
            <span> Taux: {taxSummary.vatRate}%.</span>
          )}
        </p>
        {!taxSummary || Object.keys(taxSummary.totalsByCurrency).length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucune facture confirmée.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Object.entries(taxSummary.totalsByCurrency).map(([currency, totals]) => (
              <div key={currency} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">{currency}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Total HT: {totals.ht.toLocaleString("fr-FR")} {currency}
                </p>
                <p className="mt-1 text-lg font-bold text-orange-700">
                  TVA à reverser: {totals.tva.toLocaleString("fr-FR")} {currency}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Total TTC: {totals.ttc.toLocaleString("fr-FR")} {currency} · {totals.count} facture(s)
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div id="clients" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Clients</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Clients facturés</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.clients.orderingCount ?? 0}</p>
            <p className="mt-2 text-xs text-slate-500">
              Commandes sans email: {summary?.commerce.anonymousConfirmedOrdersCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Prospects encore en devis</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.clients.quotesOnlyCount ?? 0}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {summary?.clients.rows.length ? (
            summary.clients.rows.map((client) => (
              <div key={client.key} className="rounded-xl border border-slate-200 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{client.label}</p>
                  <p className="text-slate-500">{client.orders} commande(s)</p>
                </div>
                <p className="mt-1 text-slate-600">
                  {client.quotes} devis · {client.deliveries} livraison(s) · {client.sites} chantier(s) · {client.loans} crédit(s)
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Aucun portefeuille client consolidé.
            </p>
          )}
        </div>
      </div>

      <div id="fournisseurs" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Fournisseurs</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Produits actifs</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.partners.activeProductsCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Services actifs</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.partners.activeServicesCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Fournisseurs observés</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.partners.supplierPartnerCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Techniciens observés</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.partners.technicianPartnerCount ?? 0}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {summary?.partners.byRole.length ? (
            summary.partners.byRole.map((role) => (
              <div key={role.role} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm">
                <span className="text-slate-700">{role.label}</span>
                <span className="font-semibold text-slate-900">{role.count}</span>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Aucun partenaire officiellement affecté.
            </p>
          )}
        </div>
      </div>

      <div id="rapports" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Rapports</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {(summary?.reports.lines || []).map((line) => (
              <div key={line} className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700">
                {line}
              </div>
            ))}
            {!summary?.reports.lines.length && (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aucun rapport consolidé pour le moment.
              </p>
            )}
          </div>
          <div className="space-y-3">
            {summary?.reports.expenseTotalsByCategory.length ? (
              summary.reports.expenseTotalsByCategory.map((row) => (
                <div key={row.category} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <p className="font-medium text-slate-900">{row.category}</p>
                  <p className="mt-1 text-slate-600">{formatMoneyEntries(row.totalsByCurrency)}</p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Aucune dépense catégorisée à reporter.
              </p>
            )}
          </div>
        </div>
      </div>

      <div id="factures" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Factures</h2>
          <button
            type="button"
            onClick={exportInvoicesCsv}
            disabled={!taxSummary?.invoices.length}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
          >
            Export comptable (CSV)
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Référence</th>
                <th className="py-2 pr-4 font-medium">Client</th>
                <th className="py-2 pr-4 font-medium">Méthode</th>
                <th className="py-2 pr-4 font-medium">Montant</th>
                <th className="py-2 pr-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">Chargement…</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">Aucune facture confirmée.</td>
                </tr>
              ) : (
                orders.map((order) => {
                  const totals = order.invoice?.totals;
                  return (
                    <tr key={order.reference} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4 font-mono text-xs">{order.reference}</td>
                      <td className="py-3 pr-4">
                        {order.fullInvoice?.customerName || order.fullInvoice?.customerEmail || "—"}
                      </td>
                      <td className="py-3 pr-4">{METHOD_LABELS[order.method] || order.method}</td>
                      <td className="py-3 pr-4">
                        {totals ? `${totals.ttc.toLocaleString("fr-FR")} ${totals.currency}` : "—"}
                      </td>
                      <td className="py-3 pr-4">{formatDate(order.updatedAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
