import React from "react";

interface AboutProps {
  t: (fr: string, en: string) => string;
}

export function About({ t }: AboutProps) {
  return (
    <section id="apropos" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">{t("À propos de MonChantier", "About MonChantier")}</h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            {t(
              "Entreprise de construction et e‑commerce de matériaux basée à Kolwezi. Nous fournissons briques, moellons, sable, carreaux, faïences et plus, avec un haut niveau d'exigence HSE.",
              "Construction company and e‑commerce based in Kolwezi. We supply bricks, rubble stones, sand, tiles, ceramics and more, with strong HSE commitment."
            )}
          </p>
          <ul className="mt-6 space-y-2 text-slate-700">
            <li>• {t("Délais respectés", "On-time delivery")}</li>
            <li>• {t("Prix transparents", "Transparent pricing")}</li>
            <li>• {t("Partenariats durables", "Long-term partnerships")}</li>
          </ul>
        </div>
        <div className="rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-sm bg-slate-100 aspect-[4/3]">
          <img src="/images/banners/apropos.svg" alt="À propos MonChantier" className="w-full h-full object-cover" />
        </div>
      </div>
    </section>
  );
}
