export type WalletCurrency = 'USD' | 'CDF';

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// Même taux de référence que /api/fx/usd-cdf (source BCC).
export function getBccUsdToCdfRate(): number {
  const raw = process.env.BCC_USD_CDF_RATE;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 2850;
}

// Petite marge appliquée par MonChantier sur chaque opération de change du
// porte-monnaie, de part et d'autre du taux BCC (revenu de change).
export function getWalletExchangeMarginPercent(): number {
  const raw = process.env.WALLET_EXCHANGE_MARGIN_PERCENT;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 20) return parsed;
  return 1.5;
}

export type ExchangeQuote = {
  bccRate: number;
  marginPercent: number;
  appliedRate: number;
  convertedAmount: number;
};

export function quoteExchange(
  from: WalletCurrency,
  to: WalletCurrency,
  amount: number
): ExchangeQuote {
  if (from === to) {
    throw new Error('Les devises source et cible doivent être différentes');
  }
  if (!(amount > 0)) {
    throw new Error('Montant invalide pour le change');
  }

  const bccRate = getBccUsdToCdfRate();
  const marginPercent = getWalletExchangeMarginPercent();

  // Le porte-monnaie applique toujours un taux légèrement défavorable au
  // client par rapport au taux BCC brut (marge conservée par MonChantier),
  // quel que soit le sens de l'opération.
  if (from === 'USD' && to === 'CDF') {
    const appliedRate = bccRate * (1 - marginPercent / 100);
    return { bccRate, marginPercent, appliedRate, convertedAmount: round2(amount * appliedRate) };
  }

  const appliedRate = bccRate * (1 + marginPercent / 100);
  return { bccRate, marginPercent, appliedRate, convertedAmount: round2(amount / appliedRate) };
}
