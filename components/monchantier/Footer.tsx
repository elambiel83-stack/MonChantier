import React from "react";
import { CONTACT_INFO } from "./constants";

interface FooterProps {
  t: (fr: string, en: string) => string;
}

export function Footer({ t }: FooterProps) {
  return (
    <>
      {/* Floating WhatsApp button */}
      <a
        href={`https://wa.me/${CONTACT_INFO.whatsapp.replace(/[^0-9]/g, '')}`}
        target="_blank"
        className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-lg"
      >
        <span className="sr-only">WhatsApp</span>
        <span className="text-2xl">💬</span>
      </a>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} MonChantier. {t("Tous droits réservés.", "All rights reserved.")}
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <a href="#" className="hover:text-slate-900">
              {t("Mentions légales", "Legal")}
            </a>
            <a href="#" className="hover:text-slate-900">
              {t("Confidentialité", "Privacy")}
            </a>
            <a href="#" className="hover:text-slate-900">
              {t("Conditions", "Terms")}
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
