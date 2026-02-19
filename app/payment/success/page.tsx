'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const amount = searchParams.get('amount');
  const product = searchParams.get('product');
  const sessionId = searchParams.get('session_id') || searchParams.get('paypal_order_id');

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✓</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-4">Paiement réussi !</h1>
        <p className="text-slate-600 mb-6">
          Votre paiement a été traité avec succès. Nous vous enverrons une confirmation par email.
        </p>
        {product && (
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <div className="text-sm text-slate-600 mb-1">Produit</div>
            <div className="font-semibold text-slate-900">{decodeURIComponent(product)}</div>
            {amount && (
              <>
                <div className="text-sm text-slate-600 mt-3 mb-1">Montant</div>
                <div className="font-semibold text-slate-900">{amount}</div>
              </>
            )}
            {sessionId && (
              <>
                <div className="text-sm text-slate-600 mt-3 mb-1">Transaction ID</div>
                <div className="font-mono text-xs text-slate-700">{sessionId}</div>
              </>
            )}
          </div>
        )}
        <Link 
          href="/"
          className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3 rounded-xl shadow"
        >
          Retour à l'accueil
        </Link>
        <p className="text-xs text-slate-500 mt-4">
          Pour toute question, contactez-nous sur WhatsApp: +243 999 972 466
        </p>
      </div>
    </div>
  );
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-slate-600">Chargement...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
