'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';

type ConfirmationState = {
  loading: boolean;
  message: string;
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const amount = searchParams.get('amount');
  const product = searchParams.get('product') || searchParams.get('items');
  const sessionId = searchParams.get('session_id') || searchParams.get('paypal_order_id');
  const reference = searchParams.get('reference');
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    loading: false,
    message: '',
  });

  useEffect(() => {
    if (!reference) {
      setConfirmation({
        loading: false,
        message: 'Référence absente. Vérifiez le retour de paiement du provider.',
      });
      return;
    }

    let isCancelled = false;
    let attempts = 0;
    const maxAttempts = 15;

    const pollStatus = async () => {
      attempts += 1;

      try {
        setConfirmation({
          loading: true,
          message: 'En attente de validation provider (webhook Stripe/PayPal)...',
        });

        const res = await fetch(`/api/payments/status?reference=${encodeURIComponent(reference)}`);

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Consultation statut impossible');
        }

        if (data?.state === 'confirmed') {
          const invoiceNumber = data?.invoice?.number;
          if (!isCancelled) {
            setConfirmation({
              loading: false,
              message: invoiceNumber
                ? `Paiement validé par webhook provider. Facture émise: ${invoiceNumber}`
                : 'Paiement validé par webhook provider. Facture émise.',
            });
          }
          return;
        }

        if (attempts >= maxAttempts) {
          if (!isCancelled) {
            setConfirmation({
              loading: false,
              message:
                'Paiement reçu, validation provider toujours en cours. Revenez dans quelques instants.',
            });
          }
          return;
        }

        if (!isCancelled) {
          setTimeout(() => {
            void pollStatus();
          }, 2000);
        }
      } catch (error: unknown) {
        if (!isCancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Échec du suivi de validation provider.';
          setConfirmation({
            loading: false,
            message,
          });
        }
      }
    };

    void pollStatus();

    return () => {
      isCancelled = true;
    };
  }, [reference]);

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
        {(confirmation.loading || confirmation.message) && (
          <div className="bg-emerald-50 text-emerald-800 rounded-xl p-3 text-sm mb-6">
            {confirmation.loading ? 'Validation de la commande et émission de la facture…' : confirmation.message}
          </div>
        )}
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
          Retour à l&apos;accueil
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
