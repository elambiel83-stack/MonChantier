import React from "react";
import { CONTACT_INFO, services, SERVICES_BANNER_URL } from "./constants";
import { Language } from "./types";

interface ServicesProps {
  t: (fr: string, en: string) => string;
}

export function Services({ t }: ServicesProps) {
  const deliveryMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT_INFO.address)}`;

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
          {services.map((s, i) => {
            const isDeliveryService = s.fr === "Livraison sur chantier";

            if (isDeliveryService) {
              return (
                <a
                  key={i}
                  href={deliveryMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-50 rounded-2xl p-6 ring-1 ring-slate-200 hover:shadow-md transition-shadow block"
                >
                  <div className="text-3xl">{s.icon}</div>
                  <h3 className="mt-3 font-semibold text-lg">{t(s.fr, s.en)}</h3>
                  <p className="mt-1 text-slate-600 text-sm">{t(s.frDesc, s.enDesc)}</p>
                </a>
              );
            }

            return (
              <div key={i} className="bg-slate-50 rounded-2xl p-6 ring-1 ring-slate-200 hover:shadow-md transition-shadow">
                <div className="text-3xl">{s.icon}</div>
                <h3 className="mt-3 font-semibold text-lg">{t(s.fr, s.en)}</h3>
                <p className="mt-1 text-slate-600 text-sm">{t(s.frDesc, s.enDesc)}</p>
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
