// Intégration Mobile Money côté serveur — remplace l'ancienne simulation qui
// confirmait un paiement instantanément à partir de données 100% fournies
// par le client (voir MonChantier: faille critique corrigée). Deux modes,
// choisis par MOBILE_MONEY_PROVIDER (voir .env.example) :
//  - "flutterwave" : API Flutterwave v3 (mobile_money_franco), documentée
//    publiquement, avec vérification par tx_ref avant toute confirmation.
//  - "generic" (défaut) : contrat REST simple, pour brancher n'importe quel
//    agrégateur derrière MOBILE_MONEY_API_URL / MOBILE_MONEY_VERIFY_URL.
//
// Principe de sécurité : initiateMobileMoneyCharge() ne renvoie jamais un
// statut "confirmé" — seul verifyMobileMoneyTransaction(), appelé depuis une
// route /check dédiée, peut faire passer un paiement à "successful", et
// toute réponse ambiguë ou inattendue du prestataire est traitée comme
// "pending" (jamais comme un succès implicite).

export type MobileMoneyChargeArgs = {
  amount: number;
  currency: string;
  phone: string;
  network?: string;
  email?: string;
  fullname?: string;
  txRef: string;
  redirectUrl?: string;
};

export type MobileMoneyChargeResult =
  | { status: 'pending'; providerReference?: string; redirectUrl?: string }
  | { status: 'failed' };

export type MobileMoneyVerifyResult =
  | { status: 'successful'; amount: number; currency: string }
  | { status: 'failed' }
  | { status: 'pending' };

function getProviderMode(): 'generic' | 'flutterwave' {
  return (process.env.MOBILE_MONEY_PROVIDER || '').trim().toLowerCase() === 'flutterwave'
    ? 'flutterwave'
    : 'generic';
}

export function isMobileMoneyConfigured(): boolean {
  const apiKey = process.env.MOBILE_MONEY_API_KEY;
  if (!apiKey) return false;
  if (getProviderMode() === 'flutterwave') return true;
  return Boolean(process.env.MOBILE_MONEY_API_URL && process.env.MOBILE_MONEY_VERIFY_URL);
}

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function initiateMobileMoneyCharge(args: MobileMoneyChargeArgs): Promise<MobileMoneyChargeResult> {
  const apiKey = process.env.MOBILE_MONEY_API_KEY;
  if (!apiKey) throw new Error('MOBILE_MONEY_API_KEY manquant');

  if (getProviderMode() === 'flutterwave') {
    const response = await fetch('https://api.flutterwave.com/v3/charges?type=mobile_money_franco', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: args.txRef,
        amount: args.amount,
        currency: args.currency,
        email: args.email || 'client@monchantier.cd',
        phone_number: args.phone,
        fullname: args.fullname || 'Client MonChantier',
        redirect_url: args.redirectUrl,
      }),
    });
    const data = await safeJson(response);
    if (!response.ok || !data || data.status !== 'success') {
      return { status: 'failed' };
    }
    const chargeData = (data.data as Record<string, unknown> | undefined) || {};
    const providerReference = chargeData.id !== undefined ? String(chargeData.id) : undefined;
    const meta = chargeData.meta as Record<string, unknown> | undefined;
    const authorization = meta?.authorization as Record<string, unknown> | undefined;
    const redirectUrl = typeof authorization?.redirect === 'string' ? authorization.redirect : undefined;
    // Flutterwave répond "success" pour dire que la charge a bien été
    // initiée, pas que l'argent est encaissé : le client doit encore valider
    // sur son téléphone. Seul /verify_by_reference fait foi.
    return { status: 'pending', providerReference, redirectUrl };
  }

  const apiUrl = process.env.MOBILE_MONEY_API_URL;
  if (!apiUrl) throw new Error('MOBILE_MONEY_API_URL manquant (mode generic)');

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: args.amount,
      currency: args.currency,
      phone: args.phone,
      network: args.network,
      reference: args.txRef,
    }),
  });
  const data = await safeJson(response);
  if (!response.ok || !data) return { status: 'failed' };
  const status = String(data.status || '').toLowerCase();
  if (status === 'pending' || status === 'success') {
    return {
      status: 'pending',
      providerReference: typeof data.providerReference === 'string' ? data.providerReference : undefined,
      redirectUrl: typeof data.redirectUrl === 'string' ? data.redirectUrl : undefined,
    };
  }
  return { status: 'failed' };
}

export async function verifyMobileMoneyTransaction(txRef: string): Promise<MobileMoneyVerifyResult> {
  const apiKey = process.env.MOBILE_MONEY_API_KEY;
  if (!apiKey) throw new Error('MOBILE_MONEY_API_KEY manquant');

  if (getProviderMode() === 'flutterwave') {
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const data = await safeJson(response);
    const txData = data?.data as Record<string, unknown> | undefined;
    if (!response.ok || !data || data.status !== 'success' || !txData) {
      return { status: 'pending' };
    }
    const providerStatus = String(txData.status || '').toLowerCase();
    if (providerStatus === 'successful') {
      return {
        status: 'successful',
        amount: Number(txData.amount),
        currency: String(txData.currency || ''),
      };
    }
    if (providerStatus === 'failed' || providerStatus === 'cancelled') {
      return { status: 'failed' };
    }
    return { status: 'pending' };
  }

  const verifyUrl = process.env.MOBILE_MONEY_VERIFY_URL;
  if (!verifyUrl) throw new Error('MOBILE_MONEY_VERIFY_URL manquant (mode generic)');

  const response = await fetch(`${verifyUrl}?reference=${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await safeJson(response);
  if (!response.ok || !data) return { status: 'pending' };
  const status = String(data.status || '').toLowerCase();
  if (status === 'successful' || status === 'success') {
    return { status: 'successful', amount: Number(data.amount), currency: String(data.currency || '') };
  }
  if (status === 'failed') return { status: 'failed' };
  return { status: 'pending' };
}
