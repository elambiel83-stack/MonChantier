"use client";

import { useEffect, useState } from "react";

type TenantSeller = { companyName: string; address: string; city: string; country: string };
type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  plan: "starter" | "pro" | "enterprise";
  subscriptionStatus: "none" | "trialing" | "active" | "past_due" | "canceled";
  seller: TenantSeller;
};

type TenantProduct = {
  id: number;
  name: string;
  priceCents: number;
  currency: string;
  stock: number | null;
  active: boolean;
};

const PLAN_LABEL: Record<Tenant["plan"], string> = { starter: "Starter", pro: "Pro", enterprise: "Enterprise" };

export default function OrgDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantRole, setTenantRole] = useState<string | null>(null);
  const [products, setProducts] = useState<TenantProduct[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", currency: "USD", stock: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const meRes = await fetch("/api/tenants/me", { cache: "no-store" });
      if (meRes.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!meRes.ok) throw new Error("Impossible de charger votre organisation");
      const meData = await meRes.json();
      setTenant(meData.tenant);
      setTenantRole(meData.tenantRole);

      const productsRes = await fetch("/api/tenants/me/products", { cache: "no-store" });
      const productsData = await productsRes.json();
      setProducts(Array.isArray(productsData.products) ? productsData.products : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const canManage = tenantRole === "owner" || tenantRole === "admin";

  const addProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tenants/me/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProduct.name.trim(),
          priceCents: Math.round(Number(newProduct.price) * 100),
          currency: newProduct.currency,
          stock: newProduct.stock ? Number(newProduct.stock) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur lors de l'ajout");
      setNewProduct({ name: "", price: "", currency: newProduct.currency, stock: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (id: number) => {
    setSaving(true);
    try {
      await fetch(`/api/tenants/me/products/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-slate-500">Chargement…</div>;
  }

  if (unauthorized) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-lg font-semibold">Espace organisation</h1>
        <p className="mt-2 text-sm text-slate-600">
          Connectez-vous avec un compte membre d&apos;une organisation, ou{" "}
          <a href="/org/signup" className="text-orange-600 underline">
            créez-en une
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant?.name}</h1>
          <p className="text-sm text-slate-500">
            Plan {tenant ? PLAN_LABEL[tenant.plan] : "—"} · {tenant?.status === "active" ? "Actif" : "Suspendu"}
          </p>
        </div>
        <a href="/org/billing" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
          Facturation
        </a>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Catalogue</h2>

        {canManage && (
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={newProduct.name}
              onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nom du produit"
              className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={newProduct.price}
              onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
              placeholder="Prix"
              type="number"
              step="0.01"
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={newProduct.currency}
              onChange={(e) => setNewProduct((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
              placeholder="USD"
              maxLength={3}
              className="w-16 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={newProduct.stock}
              onChange={(e) => setNewProduct((p) => ({ ...p, stock: e.target.value }))}
              placeholder="Stock (opt.)"
              type="number"
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addProduct}
              disabled={saving}
              className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              Ajouter
            </button>
          </div>
        )}

        <ul className="mt-4 divide-y divide-slate-100">
          {products.length === 0 ? (
            <li className="py-3 text-sm text-slate-500">Aucun produit pour le moment.</li>
          ) : (
            products.map((product) => (
              <li key={product.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-slate-500">
                    {(product.priceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                    {product.currency}
                    {product.stock !== null ? ` · stock: ${product.stock}` : ""}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => removeProduct(product.id)}
                    disabled={saving}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Supprimer
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
