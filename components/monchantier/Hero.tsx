import React from "react";
import { BANNER_URL } from "./constants";
import { Language } from "./types";

interface HeroProps {
  t: (fr: string, en: string) => string;
}

export function Hero({ t }: HeroProps) {
  return (
    <section className="relative">
      <div className="absolute inset-0 -z-10">
        <img
          src={BANNER_URL}
          alt="MonChantier banner"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            {t("Bienvenue sur MonChantier", "Welcome to MonChantier")}
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            {t(
              "Votre partenaire construction — livraison rapide, qualité garantie et service client à l'écoute.",
              "Your construction partner — fast delivery, guaranteed quality, and attentive support."
            )}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="#produits" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-3 rounded-xl shadow">
              {t("Acheter maintenant", "Shop now")}
            </a>
            <a href="#services" className="px-5 py-3 rounded-xl border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold">
              {t("Découvrir nos services", "Explore services")}
            </a>
          </div>
          
          <div className="mt-8 p-4 bg-white/90 backdrop-blur rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  {t("Zones de livraison", "Delivery areas")}
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  {t(
                    "Livraison dans toute la RDC : Kinshasa, Lubumbashi, Kolwezi, Goma, Bukavu, Kisangani, Kananga, Mbuji-Mayi et toutes les provinces. Délais variables selon la destination.",
                    "Delivery across the entire DRC: Kinshasa, Lubumbashi, Kolwezi, Goma, Bukavu, Kisangani, Kananga, Mbuji-Mayi and all provinces. Delivery times vary by destination."
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
