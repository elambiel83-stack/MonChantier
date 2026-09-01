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
    <div id="favoris" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Favoris</h2>

      <div className="mt-3 flex gap-2">
        {(["favoris", "produits", "services"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              tab === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
            }`}
          >
            {key === "favoris" ? "Mes favoris" : key === "produits" ? "Parcourir les produits" : "Parcourir les services"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Chargement…</p>
      ) : tab === "favoris" ? (
        favoriteProducts.length === 0 && favoriteServices.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucun favori pour le moment.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {favoriteProducts.map((p) => (
              <li key={`p-${p.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                <span>{p.fr}</span>
                <button
                  type="button"
                  onClick={() => toggleFavorite("product", p.id)}
                  disabled={busy === `product-${p.id}`}
                  className="rounded-lg border border-red-300 bg-white text-red-600 px-2 py-1 text-xs font-medium disabled:opacity-60"
                >
                  Retirer
                </button>
              </li>
            ))}
            {favoriteServices.map((s) => (
              <li key={`s-${s.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                <span>{s.icon} {s.fr}</span>
                <button
                  type="button"
                  onClick={() => toggleFavorite("service", s.id)}
                  disabled={busy === `service-${s.id}`}
                  className="rounded-lg border border-red-300 bg-white text-red-600 px-2 py-1 text-xs font-medium disabled:opacity-60"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )
      ) : tab === "produits" ? (
        <ul className="mt-4 space-y-2">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
              <span>{p.fr}</span>
              <button
                type="button"
                onClick={() => toggleFavorite("product", p.id)}
                disabled={busy === `product-${p.id}`}
                className={`rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-60 ${
                  isFavorite("product", p.id) ? "border-orange-400 bg-orange-50 text-orange-700" : "border-slate-300 bg-white"
                }`}
              >
                {isFavorite("product", p.id) ? "★ Favori" : "☆ Ajouter"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 space-y-2">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
              <span>{s.icon} {s.fr}</span>
              <button
                type="button"
                onClick={() => toggleFavorite("service", s.id)}
                disabled={busy === `service-${s.id}`}
                className={`rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-60 ${
                  isFavorite("service", s.id) ? "border-orange-400 bg-orange-50 text-orange-700" : "border-slate-300 bg-white"
                }`}
              >
                {isFavorite("service", s.id) ? "★ Favori" : "☆ Ajouter"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
