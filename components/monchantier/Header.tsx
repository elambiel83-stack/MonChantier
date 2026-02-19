import React from "react";
import { LOGO_URL } from "./constants";
import { Language } from "./types";

interface HeaderProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (fr: string, en: string) => string;
  cartItemCount?: number;
  onCartClick?: () => void;
}

export function Header({ lang, setLang, t, cartItemCount = 0, onCartClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/70 border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-md bg-white ring-1 ring-slate-200 grid place-items-center shadow-sm overflow-hidden">
            <img src={LOGO_URL} alt="MonChantier" className="h-full w-full object-contain p-1" />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight text-xl">MonChantier</div>
            <div className="text-xs text-slate-500">{t("Vente d'agrégats en ligne", "Online aggregates store")}</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a href="#produits" className="hover:text-orange-600">{t("Produits", "Products")}</a>
          <a href="#services" className="hover:text-orange-600">{t("Services", "Services")}</a>
          <a href="#partenaires" className="hover:text-orange-600">{t("Partenaires", "Partners")}</a>
          <a href="#apropos" className="hover:text-orange-600">{t("À propos", "About")}</a>
          <a href="#contact" className="hover:text-orange-600">{t("Contact", "Contact")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => setLang("fr")} className={`px-2 py-1 rounded text-xs border ${lang === "fr" ? "bg-slate-900 text-white" : "bg-white"}`}>
            FR
          </button>
          <button onClick={() => setLang("en")} className={`px-2 py-1 rounded text-xs border ${lang === "en" ? "bg-slate-900 text-white" : "bg-white"}`}>
            EN
          </button>
          <button
            onClick={onCartClick}
            className="relative ml-3 p-2 rounded-lg hover:bg-slate-100 transition-colors"
            title={t("Panier", "Cart")}
          >
            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </button>
          <a href="#contact" className="ml-3 hidden sm:inline-block bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow">
            {t("Demander un devis", "Request a quote")}
          </a>
        </div>
      </div>
    </header>
  );
}
