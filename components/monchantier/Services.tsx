"use client";

import React, { useEffect, useState } from "react";
import { CONTACT_INFO, SERVICES_BANNER_URL } from "./constants";

interface ServicesProps {
  t: (fr: string, en: string) => string;
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

export function Services({ t }: ServicesProps) {
  const [services, setServices] = useState<CatalogService[]>([]);
  const deliveryMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT_INFO.address)}`;

  useEffect(() => {
    fetch("/api/catalog/services", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setServices(Array.isArray(data.services) ? data.services : []))
      .catch(() => setServices([]));
  }, []);

  return (
    <section id="services" className="bg-white border-y">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-2xl overflow-hidden ring-1 ring-slate-200">
          <img src={SERVICES_BANNER_URL} alt="Nos Services — MonChantier" className="w-full h-56 md:h-64 object-cover object-center" />
        </div>
        <h2 className="mt-8 text-3xl font-extrabold tracking-tight">{t("Nos Services", "Our Services")}</h2>
        <p className="mt-2 text-slate-600">
          {t(
            "De la conception à la finition, nous offrons une gamme complète de services pour vos projets de construction.",
            "From design to finishing, we offer a complete range of services for your construction projects."
          )}
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {services.map((s) => {
            const isDeliveryService = s.fr === "Livraison sur chantier";
            const priceLabel = s.priceUSD !== null ? `$${s.priceUSD}` : null;

            const cardContent = (
              <>
                <div className="rounded-xl overflow-hidden ring-1 ring-slate-200">
                  <img src={s.img} alt={t(s.fr, s.en)} className="w-full h-36 object-cover object-center" />
                </div>
                <div className="text-3xl">{s.icon}</div>
                <h3 className="mt-3 font-semibold text-lg">{t(s.fr, s.en)}</h3>
                <p className="mt-1 text-slate-600 text-sm">{t(s.frDesc, s.enDesc)}</p>
                {priceLabel && <p className="mt-2 text-sm font-bold text-slate-900">{priceLabel}</p>}
              </>
            );

            if (isDeliveryService) {
              return (
                <a
                  key={s.id}
                  href={deliveryMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-50 rounded-2xl p-6 ring-1 ring-slate-200 hover:shadow-md transition-shadow block"
                >
                  {cardContent}
                </a>
              );
            }

            return (
              <div key={s.id} className="bg-slate-50 rounded-2xl p-6 ring-1 ring-slate-200 hover:shadow-md transition-shadow">
                {cardContent}
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
