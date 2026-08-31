import { NextRequest, NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { confirmDeposit, registerPendingDeposit } from '@/lib/walletStore';
import { createPayPalOrder, isPayPalConfigured } from '@/lib/paypal';
import { encodeWalletDepositPayload } from '@/lib/walletPayloadCodec';
import { WalletCurrency } from '@/lib/walletExchange';

function parsePositiveAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function sanitizeCurrency(value: unknown): WalletCurrency {
  return value === 'USD' ? 'USD' : 'CDF';
}

export async function POST(request: NextRequest) {
  try {
    const identity = await getWalletIdentity();
    if (!identity) {
      return NextResponse.json({ message: 'Connexion avec email requise' }, { status: 401 });
    }

    const body = await request.json();
    const parsedAmount = parsePositiveAmount(body?.amount);
    const currency = sanitizeCurrency(body?.currency);
    const returnUrl = String(body?.returnUrl || '');
    const cancelUrl = String(body?.cancelUrl || '');

    if (!parsedAmount || !returnUrl || !cancelUrl) {
      return NextResponse.json(
        { message: 'Montant et URLs de redirection requis' },
        { status: 400 }
      );
    }

    if (isPayPalConfigured()) {
      if (currency !== 'USD') {
        return NextResponse.json(
          { message: 'PayPal ne prend en charge que le USD pour la recharge du porte-monnaie.' },
          { status: 400 }
        );
      }

      const reference = `WALLET-PAYPAL-${Date.now()}`;
      const walletPayload = encodeWalletDepositPayload({
        identity,
        reference,
        method: 'paypal',
        currency,
        amount: parsedAmount,
      });

      const order = await createPayPalOrder({
        amount: parsedAmount,
        currency,
        productSummary: 'Recharge porte-monnaie MonChantier',
        returnUrl: `${returnUrl}?wallet_reference=${encodeURIComponent(reference)}`,
        cancelUrl,
        customId: walletPayload,
      });

      await registerPendingDeposit({
        identity,
        reference,
        method: 'paypal',
        currency,
        amount: parsedAmount,
      });

      return NextResponse.json({ success: true, approveUrl: order.approveUrl, reference });
    }

    // Pas de credentials PayPal: mode démo, confirmation immédiate locale.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const reference = `WALLET-PAYPAL-DEMO-${Date.now()}`;
    const { wallet } = await confirmDeposit({
      identity,
      reference,
      method: 'paypal',
      currency,
      amount: parsedAmount,
    });

    return NextResponse.json({
      success: true,
      approveUrl: `${returnUrl}?wallet_reference=${encodeURIComponent(reference)}`,
      reference,
      wallet,
    });
  } catch (error) {
    console.error('Erreur recharge PayPal:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la recharge du porte-monnaie' },
      { status: 500 }
    );
  }
}
