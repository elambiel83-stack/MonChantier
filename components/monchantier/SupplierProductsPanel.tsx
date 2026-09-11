"use client";

import { useEffect, useMemo, useState } from "react";

type StoredProduct = {
  id: number;
  fr: string;
  en: string;
  unitFr: string;
  unitEn: string;
  priceUSD: number | null;
  priceCDF: number | null;
  img: string;
  active: boolean;
};

type SupplierSummary = {
  totals: {
    productCount: number;
    activeCount: number;
    matchedOrderCount: number;
    pendingOrderCount: number;
    pricedCount: number;
    revenueByCurrency: Array<[string, number]>;
  };
  categories: Array<{ label: string; count: number; activeCount: number }>;
  stockRows: Array<{
    id: number;
    name: string;
    unit: string;
    active: boolean;
    priced: boolean;
    quantity: number;
    orderCount: number;
    stockStatus: string;
  }>;
  recentOrders: Array<{
    reference: string;
    customer: string;
    updatedAt: string;
    amount: number;
    currency: string;
    status: string;
  }>;
  quoteInfo: { count: number; note: string };
  pricingRows: Array<{
    id: number;
    name: string;
    priceUSD: number | null;
    priceCDF: number | null;
    hasDualPricing: boolean;
  }>;
  paymentsByMethod: Array<{
    method: string;
    count: number;
    totalsByCurrency: Array<[string, number]>;
  }>;
  orderStatus: Array<{ status: string; count: number }>;
  clients: Array<{
    label: string;
    orders: number;
    spendByCurrency: Array<[string, number]>;
  }>;
  analytics: {
    topProducts: Array<{
      id: number;
      name: string;
      unit: string;
      active: boolean;
      priced: boolean;
      quantity: number;
      orderCount: number;
      stockStatus: string;
    }>;
    inactiveWithDemand: Array<{
      id: number;
      name: string;
      unit: string;
      active: boolean;
      priced: boolean;
      quantity: number;
      orderCount: number;
      stockStatus: string;
    }>;
  };
};

const METHOD_LABELS: Record<string, string> = {
  mobilemoney: "Mobile Money",
  card: "Carte bancaire",
  paypal: "PayPal",
};

function formatMoneyEntries(entries: Array<[string, number]>) {
  if (entries.length === 0) return "Aucune donnée";
  return entries
    .map(([currency, amount]) => `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency}`)
    .join(" / ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

export default function SupplierProductsPanel() {
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<number, { priceUSD: string; priceCDF: string }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [newProduct, setNewProduct] = useState({
    fr: "",
    en: "",
    unitFr: "unité",
    unitEn: "unit",
    priceUSD: "",
    priceCDF: "",
    img: "/images/produits/briques.svg",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [productsRes, summaryRes] = await Promise.all([
        fetch("/api/partner/products", { cache: "no-store" }),
        fetch("/api/partner/products/summary", { cache: "no-store" }),
      ]);
      const productsData = productsRes.ok ? await productsRes.json() : { products: [] };
      const summaryData = summaryRes.ok ? await summaryRes.json() : null;
      setProducts(productsRes.ok ? productsData.products || [] : []);
      setSummary(summaryData);
    } catch {
      setProducts([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createProduct = async () => {
    if (!newProduct.fr.trim() || !newProduct.unitFr.trim()) return;
    try {
      setSaving(true);
      const res = await fetch("/api/partner/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur création produit");
      setNewProduct({
        fr: "",
        en: "",
        unitFr: "unité",
        unitEn: "unit",
        priceUSD: "",
        priceCDF: "",
        img: "/images/produits/briques.svg",
      });
      setBanner({ type: "success", message: "Produit ajouté au catalogue public." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setSaving(false);
    }
  };

  const savePrice = async (id: number) => {
    const edit = edits[id];
    if (!edit) return;
    try {
      setBusyId(id);
      const res = await fetch(`/api/partner/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceUSD: edit.priceUSD === "" ? null : edit.priceUSD,
          priceCDF: edit.priceCDF === "" ? null : edit.priceCDF,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Erreur mise à jour prix");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setBanner({ type: "success", message: "Prix mis à jour." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (product: StoredProduct) => {
    try {
      setBusyId(product.id);
      const res = await fetch(`/api/partner/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !product.active }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Erreur mise à jour");
      setBanner({ type: "success", message: product.active ? "Produit désactivé." : "Produit activé." });
      await load();
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setBusyId(null);
    }
  };

  const bannerClassName =
    banner?.type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  const unpricedProducts = useMemo(
    () => products.filter((product) => product.priceUSD === null && product.priceCDF === null),
    [products]
  );

  return (
    <div className="space-y-6">
      <div id="produits">
        <h1 className="text-2xl font-bold tracking-tight">Fournisseur</h1>
        <p className="mt-1 text-slate-600">Gérer ses produits, stocks, commandes et ventes.</p>

        {banner && <div className={`mt-3 rounded-lg border p-3 text-sm ${bannerClassName}`}>{banner.message}</div>}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Produits", summary?.totals.productCount ?? 0],
            ["Actifs", summary?.totals.activeCount ?? 0],
            ["Commandes liées", summary?.totals.matchedOrderCount ?? 0],
            ["En attente", summary?.totals.pendingOrderCount ?? 0],
            ["Avec prix", summary?.totals.pricedCount ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Ajouter un produit</h2>
          <p className="mt-1 text-sm text-slate-500">Votre produit apparaît immédiatement sur le catalogue public.</p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input value={newProduct.fr} onChange={(e) => setNewProduct((prev) => ({ ...prev, fr: e.target.value }))} placeholder="Nom (FR)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newProduct.en} onChange={(e) => setNewProduct((prev) => ({ ...prev, en: e.target.value }))} placeholder="Nom (EN)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newProduct.unitFr} onChange={(e) => setNewProduct((prev) => ({ ...prev, unitFr: e.target.value }))} placeholder="Unité" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newProduct.img} onChange={(e) => setNewProduct((prev) => ({ ...prev, img: e.target.value }))} placeholder="Chemin image" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="number" value={newProduct.priceUSD} onChange={(e) => setNewProduct((prev) => ({ ...prev, priceUSD: e.target.value }))} placeholder="Prix USD" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="number" value={newProduct.priceCDF} onChange={(e) => setNewProduct((prev) => ({ ...prev, priceCDF: e.target.value }))} placeholder="Prix CDF" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="button" onClick={createProduct} disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60 md:col-span-2">
              {saving ? "Ajout…" : "+ Publier ce produit"}
            </button>
          </div>
        </div>
      </div>

      <div id="categories" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Catégories</h2>
        <div className="mt-4 space-y-3">
          {summary?.categories.length ? (
            summary.categories.map((category) => (
              <div key={category.label} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm">
                <span className="text-slate-700">{category.label}</span>
                <span className="text-slate-500">{category.activeCount}/{category.count} actifs</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucune catégorie dérivée pour le moment.</p>
          )}
        </div>
      </div>

      <div id="stocks" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Stocks</h2>
        <p className="mt-1 text-sm text-slate-500">Heuristique basée sur la demande récente, en attendant un vrai stock physique.</p>
        <div className="mt-4 space-y-3">
          {summary?.stockRows.length ? (
            summary.stockRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{row.name}</span>
                  <span className="text-slate-500">{row.stockStatus}</span>
                </div>
                <p className="mt-1 text-slate-600">{row.quantity} unité(s) demandée(s) · {row.orderCount} commande(s) · {row.unit}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucune demande rattachée à vos produits.</p>
          )}
        </div>
      </div>

      <div id="commandes" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Commandes</h2>
        <div className="mt-4 space-y-3">
          {summary?.recentOrders.length ? (
            summary.recentOrders.map((order) => (
              <div key={order.reference} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{order.customer}</span>
                  <span className="text-slate-500">{order.status}</span>
                </div>
                <p className="mt-1 text-slate-600">{order.amount.toLocaleString("fr-FR")} {order.currency}</p>
                <p className="mt-1 text-xs text-slate-400">{order.reference} · {formatDate(order.updatedAt)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucune commande confirmée liée à vos produits.</p>
          )}
        </div>
      </div>

      <div id="devis" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Devis</h2>
        <p className="mt-3 text-sm text-slate-600">{summary?.quoteInfo.note || "Aucune information devis disponible."}</p>
      </div>

      <div id="prix-promotions" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Prix & promotions</h2>
        <p className="mt-1 text-sm text-slate-500">Aucune promotion dédiée n&apos;est encore stockée ; la vue suit donc la couverture tarifaire.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-900">Produits sans aucun prix</p>
            <div className="mt-3 space-y-2">
              {unpricedProducts.length ? unpricedProducts.map((product) => (
                <p key={product.id} className="text-sm text-slate-600">{product.fr}</p>
              )) : <p className="text-sm text-slate-500">Tous vos produits ont au moins un prix.</p>}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-900">Double affichage USD/CDF</p>
            <p className="mt-3 text-sm text-slate-600">
              {summary?.pricingRows.filter((row) => row.hasDualPricing).length ?? 0} produit(s) ont les deux devises renseignées.
            </p>
          </div>
        </div>
      </div>

      <div id="ventes" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Ventes</h2>
        <p className="mt-3 text-sm text-slate-600">
          Revenus détectés: <span className="font-semibold text-slate-900">{formatMoneyEntries(summary?.totals.revenueByCurrency || [])}</span>
        </p>
      </div>

      <div id="paiements" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Paiements</h2>
        <div className="mt-4 space-y-3">
          {summary?.paymentsByMethod.length ? (
            summary.paymentsByMethod.map((row) => (
              <div key={row.method} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{METHOD_LABELS[row.method] || row.method}</span>
                  <span className="text-slate-500">{row.count} transaction(s)</span>
                </div>
                <p className="mt-1 text-slate-600">{formatMoneyEntries(row.totalsByCurrency)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucun paiement rattaché à vos ventes.</p>
          )}
        </div>
      </div>

      <div id="livraisons" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Livraisons</h2>
        <div className="mt-4 space-y-3">
          {summary?.orderStatus.length ? (
            summary.orderStatus.map((row) => (
              <div key={row.status} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm">
                <span className="text-slate-700">{row.status}</span>
                <span className="font-semibold text-slate-900">{row.count}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucun statut logistique détecté sur vos ventes.</p>
          )}
        </div>
      </div>

      <div id="clients" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Clients</h2>
        <div className="mt-4 space-y-3">
          {summary?.clients.length ? (
            summary.clients.map((client) => (
              <div key={client.label} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{client.label}</span>
                  <span className="text-slate-500">{client.orders} commande(s)</span>
                </div>
                <p className="mt-1 text-slate-600">{formatMoneyEntries(client.spendByCurrency)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucun client rattaché à vos ventes pour le moment.</p>
          )}
        </div>
      </div>

      <div id="analytics" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-900">Top produits</p>
            <div className="mt-3 space-y-2">
              {summary?.analytics.topProducts.length ? summary.analytics.topProducts.map((row) => (
                <p key={row.id} className="text-sm text-slate-600">{row.name} · {row.quantity} unité(s) · {row.orderCount} commande(s)</p>
              )) : <p className="text-sm text-slate-500">Aucune donnée de demande.</p>}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-900">Alertes</p>
            <div className="mt-3 space-y-2">
              {summary?.analytics.inactiveWithDemand.length ? summary.analytics.inactiveWithDemand.map((row) => (
                <p key={row.id} className="text-sm text-amber-700">{row.name} a déjà une demande alors qu&apos;il est inactif.</p>
              )) : <p className="text-sm text-slate-500">Aucune alerte produit détectée.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mes produits</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Nom</th>
                <th className="py-2 pr-4 font-medium">Unité</th>
                <th className="py-2 pr-4 font-medium">Prix USD</th>
                <th className="py-2 pr-4 font-medium">Prix CDF</th>
                <th className="py-2 pr-4 font-medium">Statut</th>
                <th className="py-2 pr-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-3 text-slate-500">Chargement…</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="py-3 text-slate-500">Aucun produit publié pour le moment.</td></tr>
              ) : (
                products.map((product) => {
                  const edit = edits[product.id] || {
                    priceUSD: product.priceUSD?.toString() || "",
                    priceCDF: product.priceCDF?.toString() || "",
                  };
                  return (
                    <tr key={product.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4">{product.fr}</td>
                      <td className="py-3 pr-4">{product.unitFr}</td>
                      <td className="py-3 pr-4">
                        <input type="number" value={edit.priceUSD} onChange={(e) => setEdits((prev) => ({ ...prev, [product.id]: { ...edit, priceUSD: e.target.value } }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                      </td>
                      <td className="py-3 pr-4">
                        <input type="number" value={edit.priceCDF} onChange={(e) => setEdits((prev) => ({ ...prev, [product.id]: { ...edit, priceCDF: e.target.value } }))} className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                      </td>
                      <td className="py-3 pr-4"><span className={product.active ? "text-emerald-700" : "text-slate-400"}>{product.active ? "Actif" : "Inactif"}</span></td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => savePrice(product.id)} disabled={busyId === product.id} className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60">Enregistrer</button>
                          <button type="button" onClick={() => toggleActive(product)} disabled={busyId === product.id} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60">{product.active ? "Désactiver" : "Activer"}</button>
                        </div>
                      </td>
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
