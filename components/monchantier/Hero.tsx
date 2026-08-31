"use client";

import React, { useEffect, useState } from "react";
import { BANNER_URL } from "./constants";
import { findNearestCity, getCity, haversineDistanceKm } from "@/lib/drcCities";

interface HeroProps {
  t: (fr: string, en: string) => string;
}

type LocationState =
  | { status: "idle" | "detecting" | "denied" | "unsupported" | "error" }
  | { status: "found"; cityName: string; distanceFromBaseKm: number };

export function Hero({ t }: HeroProps) {
  const [location, setLocation] = useState<LocationState>({ status: "idle" });

  const detectLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocation({ status: "unsupported" });
      return;
    }

    setLocation({ status: "detecting" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const { city } = findNearestCity(latitude, longitude);
        const kolwezi = getCity("Kolwezi");
        const distanceFromBaseKm = Math.round(
          haversineDistanceKm(latitude, longitude, kolwezi.lat, kolwezi.lng)
        );
        setLocation({ status: "found", cityName: city.name, distanceFromBaseKm });
      },
      (error) => {
        setLocation({ status: error.code === error.PERMISSION_DENIED ? "denied" : "error" });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="hero" className="relative isolate overflow-hidden scroll-mt-24 bg-slate-100">
      <div className="absolute inset-0 z-0">
        <img
          src={BANNER_URL}
          alt="MonChantier banner"
          className="w-full h-full object-cover object-center"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/images/produits/moellons.svg";
          }}
        />
        <div className="absolute inset-0 bg-slate-900/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/90 to-white/60 lg:to-transparent" />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28 min-h-[62vh] flex items-center">
        <div className="max-w-2xl bg-white/75 backdrop-blur-sm rounded-2xl p-5 sm:p-8 border border-white/70 shadow">
          <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-700 px-3 py-1 text-xs sm:text-sm font-bold tracking-wide uppercase">
            {t("Livraison rapide partout en RDC", "Fast delivery across DRC")}
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-slate-900">
            {t("Bienvenue sur MonChantier", "Welcome to MonChantier")}
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-slate-700 max-w-xl">
            {t(
              "Votre partenaire construction — livraison rapide, qualité garantie et service client à l'écoute.",
              "Your construction partner — fast delivery, guaranteed quality, and attentive support."
            )}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#produits" className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-md transition-transform hover:-translate-y-0.5">
              {t("Acheter maintenant", "Shop now")}
            </a>
            <a href="#services" className="px-6 py-3.5 rounded-xl border-2 border-slate-300 hover:border-slate-500 text-slate-800 font-bold bg-white/80">
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
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">
                  {t("Zones de livraison", "Delivery areas")}
                </h3>

                {location.status === "found" ? (
                  <p className="text-sm text-slate-600 mt-1">
                    {t(
                      `Vous êtes localisé près de ${location.cityName}, à environ ${location.distanceFromBaseKm} km de notre base à Kolwezi. Livraison disponible dans votre zone — délais variables selon la destination.`,
                      `You're located near ${location.cityName}, about ${location.distanceFromBaseKm} km from our Kolwezi base. Delivery available in your area — times vary by destination.`
                    )}
                  </p>
                ) : location.status === "detecting" ? (
                  <p className="text-sm text-slate-500 mt-1 italic">
                    {t("Détection de votre position…", "Detecting your location…")}
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 mt-1">
                      {t(
                        "Livraison dans toute la RDC : Kinshasa, Lubumbashi, Kolwezi, Goma, Bukavu, Kisangani, Kananga, Mbuji-Mayi et toutes les provinces. Délais variables selon la destination.",
                        "Delivery across the entire DRC: Kinshasa, Lubumbashi, Kolwezi, Goma, Bukavu, Kisangani, Kananga, Mbuji-Mayi and all provinces. Delivery times vary by destination."
                      )}
                    </p>
                    {(location.status === "denied" || location.status === "error") && (
                      <button
                        type="button"
                        onClick={detectLocation}
                        className="mt-2 text-xs font-semibold text-orange-700 hover:text-orange-800 underline"
                      >
                        {t("Activer la localisation pour voir votre zone", "Enable location to see your area")}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
