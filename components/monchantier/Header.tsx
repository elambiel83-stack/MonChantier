import React, { useRef, useState } from "react";
import { LOGO_URL } from "./constants";
import { AuthControls } from "./AuthControls";
import { Language } from "./types";

interface HeaderProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (fr: string, en: string) => string;
  cartItemCount?: number;
  onCartClick?: () => void;
}

interface NavLink {
  href: string;
  label: string;
}

function LiquidNav({ links }: { links: NavLink[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const moveTo = (el: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setPill({
      left: rect.left - containerRect.left,
      width: rect.width,
      opacity: 1,
    });
  };

  return (
    <nav
      ref={containerRef}
      onMouseLeave={() => setPill((p) => ({ ...p, opacity: 0 }))}
      className="hidden md:flex items-center gap-1 text-sm font-medium relative rounded-full bg-white/40 backdrop-blur-md ring-1 ring-white/60 shadow-inner px-1.5 py-1.5"
    >
      <span
        className="absolute top-1.5 bottom-1.5 rounded-full bg-white/80 shadow-[0_2px_10px_rgba(234,88,12,0.25)] ring-1 ring-orange-200/70 pointer-events-none"
        style={{
          left: pill.left,
          width: pill.width,
          opacity: pill.opacity,
          transition:
            "left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease",
        }}
      />
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          onMouseEnter={(e) => moveTo(e.currentTarget)}
          onFocus={(e) => moveTo(e.currentTarget)}
          className="relative z-10 px-4 py-2 rounded-full text-slate-700 hover:text-orange-700 transition-colors"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

export function Header({ lang, setLang, t, cartItemCount = 0, onCartClick }: HeaderProps) {
  const links: NavLink[] = [
    { href: "#hero", label: t("Accueil", "Home") },
    { href: "#produits", label: t("Produits", "Products") },
    { href: "#services", label: t("Services", "Services") },
    { href: "#partenaires", label: t("Partenaires", "Partners") },
    { href: "#apropos", label: t("À propos", "About") },
    { href: "#contact", label: t("Contact", "Contact") },
  ];

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
        <LiquidNav links={links} />
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
          <AuthControls t={t} />
        </div>
      </div>
    </header>
  );
}
