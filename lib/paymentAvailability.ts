export type LivePaymentMethod = 'card' | 'paypal' | 'mobilemoney';

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/**
 * Double verrou de production : le paiement global ET la méthode doivent être
 * explicitement activés. Une clé prestataire présente par erreur ne suffit pas.
 */
export function isLivePaymentEnabled(method: LivePaymentMethod): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (!enabled(process.env.LIVE_PAYMENTS_ENABLED)) return false;
  const flags: Record<LivePaymentMethod, string | undefined> = {
    card: process.env.LIVE_CARD_ENABLED,
    paypal: process.env.LIVE_PAYPAL_ENABLED,
    mobilemoney: process.env.LIVE_MOBILE_MONEY_ENABLED,
  };
  return enabled(flags[method]);
}

export function paymentDisabledResponseMessage(method: LivePaymentMethod): string {
  const labels: Record<LivePaymentMethod, string> = {
    card: 'carte bancaire',
    paypal: 'PayPal',
    mobilemoney: 'Mobile Money',
  };
  return `Le paiement ${labels[method]} n’est pas encore activé. Utilisez la commande WhatsApp.`;
}
