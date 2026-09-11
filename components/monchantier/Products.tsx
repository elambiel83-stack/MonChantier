"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { PRODUCTS_BANNER_URL } from "./constants";
import { Language, Product } from "./types";

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
  promotionLabel?: string | null;
  promotionDiscountPercent?: number | null;
  originalPriceUSD?: number | null;
  originalPriceCDF?: number | null;
};

function toProduct(p: CatalogProduct, lang: Language): Product {
  const unit = lang === "fr" ? p.unitFr : p.unitEn;
  const amounts = [
    p.priceUSD !== null ? `$${p.priceUSD}` : null,
    p.priceCDF !== null ? `${p.priceCDF.toLocaleString("fr-FR")} FC` : null,
  ].filter(Boolean);
  const priceLabel = amounts.length ? `${amounts.join(" / ")} / ${unit}` : `$— / ${unit}`;
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

function productPriceValue(p: CatalogProduct): number | null {
  return p.priceUSD ?? p.priceCDF ?? null;
}

function formatOriginalPrice(p: CatalogProduct, lang: Language): string | null {
  const unit = lang === "fr" ? p.unitFr : p.unitEn;
  const amounts = [
    p.originalPriceUSD !== null && p.originalPriceUSD !== undefined ? `$${p.originalPriceUSD}` : null,
    p.originalPriceCDF !== null && p.originalPriceCDF !== undefined ? `${p.originalPriceCDF.toLocaleString("fr-FR")} FC` : null,
  ].filter(Boolean);
  return amounts.length ? `${amounts.join(" / ")} / ${unit}` : null;
}

export function Products({ lang, t, onAddToCart, onOrderClick }: ProductsProps) {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch("/api/catalog/products", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setCatalog(Array.isArray(data.products) ? data.products : []))
      .catch(() => setCatalog([]));
  }, []);

  const normalizedQuery = normalize(query.trim());
  const products = catalog
    .filter((p) => !normalizedQuery || normalize(t(p.fr, p.en)).includes(normalizedQuery))
    .sort((a, b) => {
      if (sort === "default") return 0;
      const priceA = productPriceValue(a);
      const priceB = productPriceValue(b);
      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      return sort === "price-asc" ? priceA - priceB : priceB - priceA;
    });

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

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
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
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="default">{t("Tri par défaut", "Default sort")}</option>
          <option value="price-asc">{t("Prix croissant", "Price: low to high")}</option>
          <option value="price-desc">{t("Prix décroissant", "Price: high to low")}</option>
        </select>
      </div>

      {normalizedQuery && products.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          {t("Aucun produit ne correspond à votre recherche.", "No product matches your search.")}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((rawProduct) => {
          const p = toProduct(rawProduct, lang);
          const hasPrice = Boolean(p.prices?.USD || p.prices?.CDF);
          const originalPriceLabel = formatOriginalPrice(rawProduct, lang);
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
              {rawProduct.promotionDiscountPercent ? (
                <span className="mb-2 inline-flex w-fit rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {rawProduct.promotionLabel || `-${rawProduct.promotionDiscountPercent}%`}
                </span>
              ) : null}
              <h3 className="font-semibold text-lg leading-snug">{t(p.fr, p.en)}</h3>
              <p className="text-slate-600 text-sm mt-1">
                {t("Qualité contrôlée. Livraison rapide.", "Quality controlled. Fast delivery.")}
              </p>

              <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-slate-900 font-bold whitespace-nowrap">{p.price}</span>
                  {rawProduct.promotionDiscountPercent && originalPriceLabel ? <span className="text-xs text-slate-400 line-through">{originalPriceLabel}</span> : null}
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <a
                    href={`https://wa.me/243999972466?text=${encodeURIComponent(`Bonjour MonChantier, je souhaite un devis pour: ${lang === 'fr' ? p.fr : p.en}`)}`}
                    target="_blank"
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                    rel="noreferrer"
                  >
                    {t("Devis", "Quote")}
                  </a>
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
    </section>
  );
}
