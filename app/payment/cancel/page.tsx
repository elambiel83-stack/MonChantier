'use client';

import Link from 'next/link';

export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✕</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-4">Paiement annulé</h1>
        <p className="text-slate-600 mb-6">
          Vous avez annulé le paiement. Aucun montant n'a été débité de votre compte.
        </p>
        <div className="space-y-3">
          <Link 
            href="/"
            className="block w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3 rounded-xl shadow"
          >
            Retour à l'accueil
          </Link>
          <Link 
            href="/#produits"
            className="block w-full border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold px-6 py-3 rounded-xl"
          >
            Voir les produits
          </Link>
        </div>
        <p className="text-xs text-slate-500 mt-6">
          Besoin d'aide ? Contactez-nous sur WhatsApp: +243 999 972 466
        </p>
      </div>
    </div>
  );
}
