import React from "react";
import { products, PRODUCTS_BANNER_URL } from "./constants";
import { Language, Product } from "./types";

interface ProductsProps {
  lang: Language;
  t: (fr: string, en: string) => string;
  onAddToCart: (product: Product) => void;
  onOrderClick: () => void;
}

export function Products({ lang, t, onAddToCart, onOrderClick }: ProductsProps) {
  return (
    <section id="produits" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="rounded-2xl overflow-hidden ring-1 ring-slate-200">
        <img src={PRODUCTS_BANNER_URL} alt="Nos Produits — MonChantier" className="w-full h-56 md:h-64 object-cover object-center" />
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-[1fr_auto] items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">{t("Nos Produits", "Our Products")}</h2>
          <p className="mt-2 text-slate-600">
            {t("Briques, moellons, sable, carreaux, faïences et plus encore.", "Bricks, rubble stones, sand, tiles, ceramics and more.")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          <div className="w-24 sm:w-28 md:w-36 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-slate-100 aspect-[4/3] self-start">
            <img src="/images/produits/briques.svg" alt="Produits MonChantier" className="w-full h-full object-cover" />
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
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <div key={p.id} className="group bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden hover:shadow-md transition flex flex-col">
            <div className="relative w-full aspect-[16/10] overflow-hidden bg-slate-100">
              <img
                src={p.img}
                alt={p.fr}
                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (p.fallback && img.src.indexOf(p.fallback) === -1) img.src = p.fallback;
                }}
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
                    href={`https://wa.me/243999972466?text=${encodeURIComponent(`Bonjour MonChantier, je souhaite un devis pour: ${lang === 'fr' ? p.fr : p.en}`)}`}
                    target="_blank"
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                    rel="noreferrer"
                  >
                    {t("Devis", "Quote")}
                  </a>
                  <button
                    type="button"
                    onClick={() => onAddToCart(p)}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition"
                  >
                    {t("Ajouter au panier", "Add to cart")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
