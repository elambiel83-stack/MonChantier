"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { PRODUCTS_BANNER_URL } from "./constants";
import { Language, Product } from "./types";
import { facebookShareUrl, productShareUrl, productWhatsAppUrl } from "@/lib/socialCommerce";

interface ProductsProps {
  lang: Language;
  t: (fr: string, en: string) => string;
  onAddToCart: (product: Product) => void;
  onOrderClick: () => void;
}

type CatalogProduct = {
  id: number;
  fr: string;
  en: string;
  unitFr: string;
  unitEn: string;
  priceUSD: number | null;
  priceCDF: number | null;
  img: string;
  fallback: string;
  category: string;
  stock: number | null;
};

function toProduct(p: CatalogProduct, lang: Language): Product {
  const unit = lang === "fr" ? p.unitFr : p.unitEn;
  let priceLabel: string;
  if (p.priceUSD !== null) {
    priceLabel = `$${p.priceUSD} / ${unit}`;
  } else if (p.priceCDF !== null) {
    priceLabel = `${p.priceCDF.toLocaleString("fr-FR")} FC / ${unit}`;
  } else {
    priceLabel = `$— / ${unit}`;
  }
  return {
    id: p.id,
    fr: p.fr,
    en: p.en,
    price: priceLabel,
    prices: { USD: p.priceUSD, CDF: p.priceCDF },
    unitFr: p.unitFr,
    unitEn: p.unitEn,
    img: p.img,
    fallback: p.fallback,
  };
}

type SortOption = "default" | "price-asc" | "price-desc";
type AvailabilityOption = "all" | "priced" | "quote";

const PRODUCT_CATEGORIES: Record<string, [string, string]> = {
  aggregats: ["Agrégats et ciment", "Aggregates and cement"],
  blocs_paves: ["Briques, blocs et pavés", "Bricks, blocks and pavers"],
  acier_metaux: ["Acier et métaux", "Steel and metals"],
  bois_menuiserie: ["Bois et menuiserie", "Timber and carpentry"],
  toiture_etancheite: ["Toiture et étanchéité", "Roofing and waterproofing"],
  revetements_finitions: ["Revêtements et finitions", "Finishes and coverings"],
  plomberie_sanitaire: ["Plomberie et sanitaire", "Plumbing and sanitary"],
  electricite_energie: ["Électricité et énergie", "Electrical and energy"],
  securite: ["Sécurité et protection", "Safety and protection"],
  routes_assainissement: ["Routes et assainissement", "Roads and sanitation"],
  outillage_engins: ["Outillage et engins", "Tools and equipment"],
};

const PAGE_SIZE = 24;

export function Products({ lang, t, onAddToCart, onOrderClick }: ProductsProps) {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const [category, setCategory] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityOption>("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});
  const [copiedProductId, setCopiedProductId] = useState<number | null>(null);

  const copyTikTokLink = async (product: Product) => {
    await navigator.clipboard.writeText(productShareUrl(product.id, "tiktok", window.location.origin));
    setCopiedProductId(product.id);
    window.setTimeout(() => setCopiedProductId(null), 1800);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        category,
        availability,
        sort,
      });
      if (debouncedQuery) params.set("q", debouncedQuery);

      try {
        const response = await fetch(`/api/catalog/products?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || t("Chargement impossible.", "Unable to load products."));
        setCatalog(Array.isArray(data.products) ? data.products : []);
        if (data.pagination) setPagination(data.pagination);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setCatalog([]);
        setError(requestError instanceof Error ? requestError.message : t("Chargement impossible.", "Unable to load products."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCatalog();
    return () => controller.abort();
  }, [debouncedQuery, category, availability, sort, page, t]);

  const products = catalog.map((p) => toProduct(p, lang));

  return (
    <section id="produits" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="relative rounded-2xl overflow-hidden ring-1 ring-slate-200 h-56 md:h-64">
        <Image src={PRODUCTS_BANNER_URL} alt="Nos Produits — MonChantier" fill sizes="100vw" className="object-cover object-center" />
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-[1fr_auto] items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">{t("Nos Produits", "Our Products")}</h2>
          <p className="mt-2 text-slate-600">
            {t("Briques, moellons, sable, carreaux, faïences et plus encore.", "Bricks, rubble stones, sand, tiles, ceramics and more.")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          <div className="relative w-24 sm:w-28 md:w-36 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-slate-100 aspect-[4/3] self-start">
            <Image src="/images/produits/briques.svg" alt="Produits MonChantier" fill sizes="144px" className="object-cover" />
          </div>
          <button
            type="button"
            onClick={onOrderClick}
            className="inline-flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow"
          >
            {t("Passer la commande", "Place order")}
          </button>
          <a href="#contact" className="hidden sm:inline-block text-sm font-semibold text-orange-700 hover:text-orange-800">
            {t("Besoin d'un devis ?", "Need a quote?")}
          </a>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Rechercher un produit…", "Search a product…")}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">{t("Toutes les catégories", "All categories")}</option>
          {Object.entries(PRODUCT_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{t(label[0], label[1])}</option>)}
        </select>
        <select
          value={availability}
          onChange={(e) => { setAvailability(e.target.value as AvailabilityOption); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">{t("Toute disponibilité", "All availability")}</option>
          <option value="priced">{t("Prix disponible", "Price available")}</option>
          <option value="quote">{t("Sur devis", "Quote only")}</option>
        </select>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="default">{t("Tri par défaut", "Default sort")}</option>
          <option value="price-asc">{t("Prix croissant", "Price: low to high")}</option>
          <option value="price-desc">{t("Prix décroissant", "Price: high to low")}</option>
        </select>
      </div>

      {loading && <p className="mt-6 text-sm text-slate-500">{t("Chargement des produits…", "Loading products…")}</p>}
      {error && <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          {t("Aucun produit ne correspond à votre recherche.", "No product matches your search.")}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => {
          const hasPrice = Boolean(p.prices?.USD || p.prices?.CDF);
          return (
          <div key={p.id} className="group bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden hover:shadow-md transition flex flex-col">
            <div className="relative w-full aspect-[16/10] overflow-hidden bg-slate-100">
              <Image
                src={imgFailed[p.id] && p.fallback ? p.fallback : p.img}
                alt={p.fr}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
                onError={() => setImgFailed((prev) => ({ ...prev, [p.id]: true }))}
              />
            </div>

            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-semibold text-lg leading-snug">{t(p.fr, p.en)}</h3>
              <p className="text-slate-600 text-sm mt-1">
                {t("Qualité contrôlée. Livraison rapide.", "Quality controlled. Fast delivery.")}
              </p>

              <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                <span className="text-slate-900 font-bold whitespace-nowrap">{p.price}</span>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <a
                    href={productWhatsAppUrl(p, lang, typeof window === "undefined" ? undefined : window.location.origin)}
                    target="_blank"
                    className="text-sm font-semibold text-green-700 hover:text-green-800"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={facebookShareUrl(p, typeof window === "undefined" ? undefined : window.location.origin)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                    aria-label={t(`Partager ${p.fr} sur Facebook`, `Share ${p.en} on Facebook`)}
                  >
                    Facebook
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyTikTokLink(p)}
                    className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                    title={t("Copier le lien pour TikTok", "Copy link for TikTok")}
                  >
                    {copiedProductId === p.id ? t("Lien copié", "Link copied") : "TikTok"}
                  </button>
                  {hasPrice && (
                    <button
                      type="button"
                      onClick={() => onAddToCart(p)}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition"
                    >
                      {t("Ajouter au panier", "Add to cart")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      {pagination.total > 0 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-xl border border-orange-600 px-4 py-2 text-sm font-semibold text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("Précédent", "Previous")}
          </button>
          <span className="text-sm text-slate-600">
            {t(`Page ${pagination.page} sur ${pagination.totalPages}`, `Page ${pagination.page} of ${pagination.totalPages}`)}
          </span>
          <button
            type="button"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-xl border border-orange-600 px-4 py-2 text-sm font-semibold text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("Suivant", "Next")}
          </button>
        </div>
      )}
    </section>
  );
}
