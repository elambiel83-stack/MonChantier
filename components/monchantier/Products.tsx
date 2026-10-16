"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PRODUCTS_BANNER_URL } from "./constants";
import type { Language, Product } from "./types";
import { facebookShareUrl, productShareUrl, productWhatsAppUrl } from "@/lib/socialCommerce";
import { productTechnicalDetails } from "@/lib/productTechnicalDetails";

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
    priceLabel = lang === "fr" ? "Sur devis" : "Request a quote";
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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
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

function productPriceValue(p: Product): number | null {
  return p.prices?.USD ?? p.prices?.CDF ?? null;
}

export function Products({ lang, t, onAddToCart, onOrderClick }: ProductsProps) {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const [category, setCategory] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityOption>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});
  const [copiedProductId, setCopiedProductId] = useState<number | null>(null);

  const copyTikTokLink = async (product: Product) => {
    await navigator.clipboard.writeText(productShareUrl(product.id, "tiktok", window.location.origin));
    setCopiedProductId(product.id);
    window.setTimeout(() => setCopiedProductId(null), 1800);
  };

  useEffect(() => {
    fetch("/api/catalog/products", { cache: "no-store" })
      .then((res) => { if (!res.ok) throw new Error("Catalogue indisponible"); return res.json(); })
      .then((data) => setCatalog(Array.isArray(data.products) ? data.products : []))
      .catch(() => { setCatalog([]); setLoadError(true); })
      .finally(() => setLoading(false));
  }, []);

  const normalizedQuery = normalize(query.trim());
  const filteredCatalog = catalog
    .filter((p) => category === "all" || p.category === category)
    .filter((p) => availability === "all" || (availability === "priced" ? p.priceUSD !== null || p.priceCDF !== null : p.priceUSD === null && p.priceCDF === null))
    .filter((p) => !normalizedQuery || normalize(t(p.fr, p.en)).includes(normalizedQuery));
  const products = filteredCatalog
    .map((p) => toProduct(p, lang))
    .sort((a, b) => {
      if (sort === "default") return 0;
      const priceA = productPriceValue(a);
      const priceB = productPriceValue(b);
      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      return sort === "price-asc" ? priceA - priceB : priceB - priceA;
    });
  const visibleProducts = products.slice(0, visibleCount);

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
            className="inline-flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm"
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
            onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
            aria-label={t("Rechercher un produit", "Search products")}
            placeholder={t("Rechercher un produit…", "Search a product…")}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
        </div>
        <select
          aria-label={t("Catégorie de produit", "Product category")}
          value={category}
          onChange={(e) => { setCategory(e.target.value); setVisibleCount(PAGE_SIZE); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">{t("Toutes les catégories", "All categories")}</option>
          {Object.entries(PRODUCT_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{t(label[0], label[1])}</option>)}
        </select>
        <select
          aria-label={t("Disponibilité du prix", "Price availability")}
          value={availability}
          onChange={(e) => { setAvailability(e.target.value as AvailabilityOption); setVisibleCount(PAGE_SIZE); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">{t("Toute disponibilité", "All availability")}</option>
          <option value="priced">{t("Prix disponible", "Price available")}</option>
          <option value="quote">{t("Sur devis", "Quote only")}</option>
        </select>
        <select
          aria-label={t("Trier les produits", "Sort products")}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500"
        >
          <option value="default">{t("Tri par défaut", "Default sort")}</option>
          <option value="price-asc">{t("Prix croissant", "Price: low to high")}</option>
          <option value="price-desc">{t("Prix décroissant", "Price: high to low")}</option>
        </select>
      </div>

      <p className="mt-5 text-sm text-slate-500" role="status">
        {loading ? t("Chargement du catalogue…", "Loading catalogue…") : t(`${products.length} produits · sélection pour vos chantiers`, `${products.length} products · selected for your projects`)}
      </p>
      {loadError && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t("Le catalogue est momentanément indisponible. Réessayez plus tard ou contactez-nous pour un devis.", "The catalogue is temporarily unavailable. Try again later or contact us for a quote.")}</p>}
      {!loading && !loadError && products.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          {t("Aucun produit ne correspond à votre recherche.", "No product matches your search.")}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy={loading}>
        {loading && ['one', 'two', 'three', 'four', 'five', 'six'].map(key => <div key={key} className="product-placeholder h-96 rounded-2xl bg-slate-100" aria-hidden="true" />)}
        {visibleProducts.map((p, index) => {
          const source = catalog.find(item => item.id === p.id);
          if (!source) return null;
          const details = productTechnicalDetails(source, lang);
          const hasPrice = (p.prices?.USD ?? p.prices?.CDF ?? 0) > 0;
          const outOfStock = source.stock !== null && source.stock <= 0;
          const categoryLabel = PRODUCT_CATEGORIES[source.category];
          return (
          <article key={p.id} className="product-card group bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
            <div className="relative w-full aspect-[16/10] overflow-hidden bg-slate-100">
              <Image
                src={imgFailed[p.id] && p.fallback ? p.fallback : p.img}
                alt={t(p.fr, p.en)}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="product-card-image object-cover object-center"
                onError={() => setImgFailed((prev) => ({ ...prev, [p.id]: true }))}
              />
              <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow-xs">{categoryLabel ? t(...categoryLabel) : t("Matériau", "Material")}</span>
              {(imgFailed[p.id] ? p.fallback : p.img).endsWith('.svg') && <span className="absolute bottom-3 right-3 rounded-md bg-slate-900/75 px-2 py-1 text-[10px] text-white">{t("Illustration", "Illustration")}</span>}
            </div>

            <div className="p-5 flex flex-col flex-1">
              <p className="text-[11px] font-medium tracking-wider text-slate-400">MC · {String(p.id).padStart(4, '0')}</p>
              <h3 className="mt-1 font-bold text-xl leading-snug text-slate-900">{t(p.fr, p.en)}</h3>
              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                <div><dt className="text-xs text-slate-500">{t("Unité de vente", "Sales unit")}</dt><dd className="mt-1 font-semibold text-slate-800">{details.unit}</dd></div>
                <div><dt className="text-xs text-slate-500">{details.measurement ? t("Indication catalogue", "Catalogue specification") : t("Stock", "Stock")}</dt><dd className="mt-1 font-semibold text-slate-800">{details.measurement || (source.stock === null ? t("À confirmer", "To confirm") : `${source.stock} ${details.unit}`)}</dd></div>
              </dl>
              <details className="product-specs mt-4 border-b border-slate-100 pb-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">{t("Détails techniques", "Technical details")}</summary>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{t("À préciser sur le devis fournisseur :", "To confirm on the supplier quote:")} {details.toConfirm}.</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{t("Les résistances, normes et performances doivent être confirmées par la fiche du fabricant.", "Strength, standards and performance must be confirmed in the manufacturer's data sheet.")}</p>
              </details>

              <div className="mt-auto pt-4">
                <p className="text-xl font-extrabold tracking-tight text-slate-900">{p.price}</p>
                {outOfStock && <p className="mt-1 text-xs font-medium text-amber-800">{t("Stock épuisé · contactez-nous", "Out of stock · contact us")}</p>}
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <a
                    href={productWhatsAppUrl(p, lang, typeof window === "undefined" ? undefined : window.location.origin)}
                    target="_blank"
                    className="text-sm font-semibold text-green-700 hover:text-green-800"
                    rel="noreferrer"
                  >
                    {hasPrice ? "WhatsApp" : t("Demander un devis", "Request a quote")}
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
                  {hasPrice && !outOfStock && (
                    <button
                      type="button"
                      onClick={() => onAddToCart(p)}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
                    >
                      {t("Ajouter au panier", "Add to cart")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </article>
          );
        })}
      </div>
      {visibleCount < products.length && (
        <div className="mt-8 text-center">
          <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="rounded-xl border border-orange-600 px-5 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-50">
            {t(`Afficher plus (${products.length - visibleCount})`, `Show more (${products.length - visibleCount})`)}
          </button>
        </div>
      )}
    </section>
  );
}
