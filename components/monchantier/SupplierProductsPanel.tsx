"use client";

import { useEffect, useState } from "react";

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

export default function SupplierProductsPanel() {
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<number, { priceUSD: string; priceCDF: string }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [banner, setBanner] = useState("");

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
      const res = await fetch("/api/partner/products", { cache: "no-store" });
      const data = await res.json();
      setProducts(res.ok ? data.products || [] : []);
    } catch {
      setProducts([]);
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
      setNewProduct({ fr: "", en: "", unitFr: "unité", unitEn: "unit", priceUSD: "", priceCDF: "", img: "/images/produits/briques.svg" });
      setBanner("Produit ajouté au catalogue public.");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
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
      if (!res.ok) throw new Error("Erreur mise à jour prix");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setBanner("Prix mis à jour.");
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
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
      if (!res.ok) throw new Error("Erreur mise à jour");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Fournisseur</h1>
      <p className="mt-1 text-slate-600">Gérer ses produits, stocks, commandes et ventes.</p>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Ajouter un produit</h2>
        <p className="mt-1 text-sm text-slate-500">
          Votre produit apparaît immédiatement sur le catalogue public de MonChantier.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={newProduct.fr}
            onChange={(e) => setNewProduct((prev) => ({ ...prev, fr: e.target.value }))}
            placeholder="Nom (FR)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newProduct.en}
            onChange={(e) => setNewProduct((prev) => ({ ...prev, en: e.target.value }))}
            placeholder="Nom (EN)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newProduct.unitFr}
            onChange={(e) => setNewProduct((prev) => ({ ...prev, unitFr: e.target.value }))}
            placeholder="Unité (ex: m³, sac, unité)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newProduct.img}
            onChange={(e) => setNewProduct((prev) => ({ ...prev, img: e.target.value }))}
            placeholder="Chemin image"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={newProduct.priceUSD}
            onChange={(e) => setNewProduct((prev) => ({ ...prev, priceUSD: e.target.value }))}
            placeholder="Prix USD"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={newProduct.priceCDF}
            onChange={(e) => setNewProduct((prev) => ({ ...prev, priceCDF: e.target.value }))}
            placeholder="Prix CDF"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createProduct}
            disabled={saving}
            className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60 md:col-span-2"
          >
            {saving ? "Ajout…" : "+ Publier ce produit"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                <tr>
                  <td colSpan={6} className="py-3 text-slate-500">Chargement…</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-slate-500">Aucun produit publié pour le moment.</td>
                </tr>
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
                        <input
                          type="number"
                          value={edit.priceUSD}
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [product.id]: { ...edit, priceUSD: e.target.value } }))
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          value={edit.priceCDF}
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [product.id]: { ...edit, priceCDF: e.target.value } }))
                          }
                          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <span className={product.active ? "text-emerald-700" : "text-slate-400"}>
                          {product.active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => savePrice(product.id)}
                            disabled={busyId === product.id}
                            className="rounded-lg bg-slate-900 text-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(product)}
                            disabled={busyId === product.id}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                          >
                            {product.active ? "Désactiver" : "Activer"}
                          </button>
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
