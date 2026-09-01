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

const METHOD_LABELS: Record<string, string> = {
  mobilemoney: "Mobile Money",
  card: "Carte bancaire",
  paypal: "PayPal",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

function toCsvCell(value: string | number) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export default function AccountantPanel() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState("");
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
      const [ordersRes, taxesRes, expensesRes] = await Promise.all([
        fetch("/api/accountant/orders", { cache: "no-store" }),
        fetch("/api/accountant/taxes", { cache: "no-store" }),
        fetch("/api/accountant/expenses", { cache: "no-store" }),
      ]);
      const ordersData = ordersRes.ok ? await ordersRes.json() : { orders: [] };
      const taxesData = taxesRes.ok ? await taxesRes.json() : null;
      const expensesData = expensesRes.ok ? await expensesRes.json() : { expenses: [] };
      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
      setTaxSummary(taxesData);
      setExpenses(Array.isArray(expensesData.expenses) ? expensesData.expenses : []);
    } catch {
      setOrders([]);
      setTaxSummary(null);
      setExpenses([]);
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
      setNewExpense({ label: "", category: "Achats", amount: "", currency: "USD", date: new Date().toISOString().slice(0, 10) });
      setBanner("Dépense enregistrée.");
      await loadAll();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingExpense(false);
    }
  };

  const removeExpense = async (id: number) => {
    try {
      setBusyExpenseId(id);
      const res = await fetch(`/api/accountant/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur suppression dépense");
      await loadAll();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
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

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Comptable</h1>
      <p className="mt-1 text-slate-600">Contrôler les flux financiers.</p>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      <div id="tresorerie" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Trésorerie</h2>
        <p className="mt-1 text-sm text-slate-500">Encaissé (factures confirmées) moins dépenses, par devise.</p>
        {treasuryByCurrency.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucune donnée pour le moment.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div id="depenses" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Dépenses</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
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
          className="mt-3 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
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
                        className="rounded-lg border border-red-300 bg-white text-red-600 px-2 py-1 text-xs font-medium disabled:opacity-60"
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
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(taxSummary.totalsByCurrency).map(([currency, totals]) => (
              <div key={currency} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">{currency}</p>
                <p className="mt-1 text-xs text-slate-500">Total HT: {totals.ht.toLocaleString("fr-FR")} {currency}</p>
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
