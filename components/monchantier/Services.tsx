"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { CONTACT_INFO, SERVICES_BANNER_URL } from "./constants";
import { Language, Product } from "./types";

interface ServicesProps {
  lang: Language;
  t: (fr: string, en: string) => string;
  onAddToCart: (product: Product) => void;
}

type CatalogService = {
  id: number;
  icon: string;
  fr: string;
  en: string;
  frDesc: string;
  enDesc: string;
  img: string;
  priceUSD: number | null;
  priceCDF: number | null;
};

// Services and products come from independent auto-increment id counters, so a
// large offset keeps a service's cart id from ever colliding with a product id.
const SERVICE_CART_ID_OFFSET = 1_000_000;

function toCartProduct(s: CatalogService): Product {
  let priceLabel: string;
  if (s.priceUSD !== null) {
    priceLabel = `$${s.priceUSD}`;
  } else if (s.priceCDF !== null) {
    priceLabel = `${s.priceCDF.toLocaleString("fr-FR")} FC`;
  } else {
    priceLabel = `$—`;
  }
  return {
    id: SERVICE_CART_ID_OFFSET + s.id,
    fr: s.fr,
    en: s.en,
    price: priceLabel,
    prices: { USD: s.priceUSD, CDF: s.priceCDF },
    unitFr: "prestation",
    unitEn: "service",
    img: s.img,
    fallback: s.img,
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type SortOption = "default" | "price-asc" | "price-desc";

export function Services({ lang, t, onAddToCart }: ServicesProps) {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const deliveryMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT_INFO.address)}`;

  useEffect(() => {
    fetch("/api/catalog/services", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setServices(Array.isArray(data.services) ? data.services : []))
      .catch(() => setServices([]));
  }, []);

  const normalizedQuery = normalize(query.trim());
  const filteredServices = services
    .filter((s) => !normalizedQuery || normalize(lang === "fr" ? s.fr : s.en).includes(normalizedQuery))
    .sort((a, b) => {
      if (sort === "default") return 0;
      const priceA = a.priceUSD ?? a.priceCDF ?? null;
      const priceB = b.priceUSD ?? b.priceCDF ?? null;
      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      return sort === "price-asc" ? priceA - priceB : priceB - priceA;
    });

  return (
    <section id="services" className="bg-white border-y">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative rounded-2xl overflow-hidden ring-1 ring-slate-200 h-56 md:h-64">
          <Image src={SERVICES_BANNER_URL} alt="Nos Services — MonChantier" fill sizes="100vw" className="object-cover object-center" />
        </div>
        <h2 className="mt-8 text-3xl font-extrabold tracking-tight">{t("Nos Services", "Our Services")}</h2>
        <p className="mt-2 text-slate-600">
          {t(
            "De la conception à la finition, nous offrons une gamme complète de services pour vos projets de construction.",
            "From design to finishing, we offer a complete range of services for your construction projects."
          )}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 max-w-md">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Rechercher un service…", "Search a service…")}
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

        {normalizedQuery && filteredServices.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">
            {t("Aucun service ne correspond à votre recherche.", "No service matches your search.")}
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.map((s) => {
            const isDeliveryService = s.fr === "Livraison sur chantier";
            let priceLabel: string | null = null;
            if (s.priceUSD !== null) {
              priceLabel = `$${s.priceUSD}`;
            } else if (s.priceCDF !== null) {
              priceLabel = `${s.priceCDF.toLocaleString("fr-FR")} FC`;
            }
            const quoteHref = `https://wa.me/243999972466?text=${encodeURIComponent(
              `Bonjour MonChantier, je souhaite un devis pour: ${lang === "fr" ? s.fr : s.en}`
            )}`;

            const cardContent = (
              <>
                <div className="relative rounded-xl overflow-hidden ring-1 ring-slate-200 h-36">
                  <Image src={s.img} alt={t(s.fr, s.en)} fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover object-center" />
                </div>
                <div className="text-3xl">{s.icon}</div>
                <h3 className="mt-3 font-semibold text-lg">{t(s.fr, s.en)}</h3>
                <p className="mt-1 text-slate-600 text-sm">{t(s.frDesc, s.enDesc)}</p>
                {priceLabel && <p className="mt-2 text-sm font-bold text-slate-900">{priceLabel}</p>}
                {isDeliveryService && (
                  <a
                    href={deliveryMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-slate-600 hover:text-slate-800 underline"
                  >
                    {t("Voir la zone sur la carte", "View zone on map")}
                  </a>
                )}
              </>
            );

            return (
              <div key={s.id} className="bg-slate-50 rounded-2xl p-6 ring-1 ring-slate-200 hover:shadow-md transition-shadow flex flex-col">
                {cardContent}
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <a
                    href={quoteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                  >
                    {t("Devis", "Quote")}
                  </a>
                  <button
                    type="button"
                    onClick={() => onAddToCart(toCartProduct(s))}
                    className="ml-auto bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition"
                  >
                    {t("Ajouter au panier", "Add to cart")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <a
            href="#contact"
            className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3 rounded-xl shadow transition"
          >
            {t("Demander un devis pour un service", "Request a quote for a service")}
          </a>
        </div>
      </div>
    </section>
  );
}
