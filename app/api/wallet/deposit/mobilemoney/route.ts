import { NextRequest, NextResponse } from 'next/server';
import { getWalletIdentity } from '@/lib/walletAuth';
import { confirmDeposit, registerPendingDeposit } from '@/lib/walletStore';
import { WalletCurrency } from '@/lib/walletExchange';
import { isMobileMoneyConfigured, initiateMobileMoneyCharge } from '@/lib/mobileMoney';

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
    const phone = String(body?.phone || '').trim();
    const network = String(body?.network || '').trim();

    if (!parsedAmount || phone.length < 8) {
      return NextResponse.json(
        { message: 'Montant et numéro de téléphone valides requis' },
        { status: 400 }
      );
    }

    if (isMobileMoneyConfigured()) {
      const reference = `WALLET-MM-${Date.now()}`;
      const charge = await initiateMobileMoneyCharge({
        amount: parsedAmount,
        currency,
        phone,
        network: network || undefined,
        email: identity.includes('@') ? identity : undefined,
        txRef: reference,
      });

      if (charge.status !== 'pending') {
        return NextResponse.json({ message: 'Le prestataire Mobile Money a refusé la demande.' }, { status: 502 });
      }

      // Rien n'est crédité ici : seule la vérification côté serveur via
      // /api/wallet/deposit/mobilemoney/check (après validation du client
      // sur son téléphone) peut créditer le porte-monnaie.
      await registerPendingDeposit({ identity, reference, method: 'mobilemoney', currency, amount: parsedAmount });

      return NextResponse.json({
        success: true,
        status: 'pending',
        reference,
        message: 'Demande envoyée. Veuillez confirmer sur votre téléphone.',
        redirectUrl: charge.redirectUrl,
      });
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          message:
            'Recharge Mobile Money indisponible : MOBILE_MONEY_API_KEY (et MOBILE_MONEY_API_URL/MOBILE_MONEY_VERIFY_URL en mode generic) non configurés.',
        },
        { status: 503 }
      );
    }

    // Mode démo (dev/local uniquement, sans prestataire configuré) :
    // confirmation immédiate locale pour pouvoir tester le parcours.
    const reference = `WALLET-MM-DEMO-${Date.now()}`;
    const { wallet } = await confirmDeposit({
      identity,
      reference,
      method: 'mobilemoney',
      currency,
      amount: parsedAmount,
    });

    return NextResponse.json({ success: true, status: 'confirmed', reference, wallet });
  } catch (error) {
    console.error('Erreur recharge Mobile Money:', error);
    return NextResponse.json(
      { message: 'Erreur lors de la recharge du porte-monnaie' },
      { status: 500 }
    );
  }
}
