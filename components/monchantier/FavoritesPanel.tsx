"use client";

import { useEffect, useMemo, useState } from "react";

type FavoriteItemType = "product" | "service";
type Favorite = { itemType: FavoriteItemType; itemId: number };

type CatalogProduct = { id: number; fr: string; unitFr: string; priceUSD: number | null; priceCDF: number | null };
type CatalogService = { id: number; icon: string; fr: string; priceUSD: number | null; priceCDF: number | null };

export default function FavoritesPanel() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"favoris" | "produits" | "services">("favoris");

  const load = async () => {
    try {
      setLoading(true);
      const [favRes, prodRes, servRes] = await Promise.all([
        fetch("/api/client/favorites", { cache: "no-store" }),
        fetch("/api/catalog/products", { cache: "no-store" }),
        fetch("/api/catalog/services", { cache: "no-store" }),
      ]);
      const favData = favRes.ok ? await favRes.json() : { favorites: [] };
      const prodData = prodRes.ok ? await prodRes.json() : { products: [] };
      const servData = servRes.ok ? await servRes.json() : { services: [] };
      setFavorites(Array.isArray(favData.favorites) ? favData.favorites : []);
      setProducts(Array.isArray(prodData.products) ? prodData.products : []);
      setServices(Array.isArray(servData.services) ? servData.services : []);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const isFavorite = (itemType: FavoriteItemType, itemId: number) =>
    favorites.some((f) => f.itemType === itemType && f.itemId === itemId);

  const toggleFavorite = async (itemType: FavoriteItemType, itemId: number) => {
    const key = `${itemType}-${itemId}`;
    try {
      setBusy(key);
      const method = isFavorite(itemType, itemId) ? "DELETE" : "POST";
      const res = await fetch("/api/client/favorites", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur");
      setFavorites(Array.isArray(data.favorites) ? data.favorites : []);
    } finally {
      setBusy(null);
    }
  };

  const favoriteProducts = useMemo(
    () => products.filter((p) => isFavorite("product", p.id)),
    [products, favorites]
  );
  const favoriteServices = useMemo(
    () => services.filter((s) => isFavorite("service", s.id)),
    [services, favorites]
  );

  return (
    <div id="favoris" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h2 className="text-lg font-semibold">Favoris</h2>

      <div className="mt-3 flex gap-2">
        {(["favoris", "produits", "services"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              tab ==…46872 tokens truncated…    />
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

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
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
                    priceUSD: product.submittedPriceUSD?.toString() || "",
                    priceCDF: product.submittedPriceCDF?.toString() || "",
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
                          {product.pricingStatus === 'pending' ? 'En attente de validation' : product.pricingStatus === 'approved' ? `Approuvé · commission ${product.platformFeePercent}%` : 'Rejeté / à corriger'}
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
