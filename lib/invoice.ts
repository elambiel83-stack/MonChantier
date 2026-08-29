export type InvoicePaymentMethod = 'mobilemoney' | 'card' | 'paypal';

export type InvoiceLineItem = {
  productName: string;
  quantity: number;
  unitPrice?: number;
};

export type InvoiceData = {
  standard: 'RDC-NORMALISEE-2026';
  legalReference: string;
  invoiceNumber: string;
  issuedAt: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  method: InvoicePaymentMethod;
  amount: number;
  currency: string;
  taxRate: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  seller: {
    companyName: string;
    address: string;
    city: string;
    country: string;
    phone?: string;
    email?: string;
    nif?: string;
    rccm?: string;
    idNat?: string;
    taxNumber?: string;
    vatNumber?: string;
  };
  items: Array<InvoiceLineItem & { lineTotal: number }>;
  deliveryAddress?: string;
  location?: { lat?: number; lng?: number } | null;
};

type CreateInvoiceInput = {
  reference: string;
  customerName: string;
  customerEmail: string;
  method: InvoicePaymentMethod;
  amount: number;
  currency?: string;
  items?: InvoiceLineItem[];
  deliveryAddress?: string;
  location?: { lat?: number; lng?: number } | null;
};

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getRdcVatRate() {
  const raw = process.env.RDC_VAT_RATE;
  const parsed = toNumber(raw, 16);
  if (parsed < 0 || parsed > 100) return 16;
  return parsed;
}

function getSellerIdentity() {
  return {
    companyName: process.env.BILLING_COMPANY_NAME || 'MonChantier SARL',
    address: process.env.BILLING_COMPANY_ADDRESS || 'Kinshasa, RDC',
    city: process.env.BILLING_COMPANY_CITY || 'Kinshasa',
    country: process.env.BILLING_COMPANY_COUNTRY || 'RDC',
    phone: process.env.BILLING_COMPANY_PHONE || undefined,
    email: process.env.BILLING_COMPANY_EMAIL || undefined,
    nif: process.env.BILLING_COMPANY_NIF || undefined,
    rccm: process.env.BILLING_COMPANY_RCCM || undefined,
    idNat: process.env.BILLING_COMPANY_ID_NAT || undefined,
    taxNumber: process.env.BILLING_COMPANY_TAX_NUMBER || undefined,
    vatNumber: process.env.BILLING_COMPANY_VAT_NUMBER || undefined,
  };
}

function generateInvoiceNumber() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FAC-${stamp}-${rand}`;
}

function methodLabelFr(method: InvoicePaymentMethod) {
  if (method === 'mobilemoney') return 'Mobile Money';
  if (method === 'card') return 'Carte bancaire';
  return 'PayPal';
}

function formatAmount(amount: number, currency: string) {
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function createInvoice(input: CreateInvoiceInput): InvoiceData {
  const vatRate = getRdcVatRate();
  const vatMultiplier = 1 + vatRate / 100;

  const normalizedItems = (Array.isArray(input.items) ? input.items : []).map((item) => {
    const quantity = Math.max(1, toNumber(item.quantity, 1));
    const unitPrice = item.unitPrice !== undefined ? toNumber(item.unitPrice) : undefined;
    const lineTotal = unitPrice !== undefined ? unitPrice * quantity : 0;

    return {
      productName: item.productName || 'Produit',
      quantity,
      unitPrice,
      lineTotal,
    };
  });

  const computedTotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const declaredAmount = toNumber(input.amount);
  const totalTTC = round2(declaredAmount > 0 ? declaredAmount : computedTotal);
  const totalHT = round2(totalTTC / vatMultiplier);
  const totalTVA = round2(totalTTC - totalHT);

  const seller = getSellerIdentity();

  return {
    standard: 'RDC-NORMALISEE-2026',
    legalReference: 'Facture normalisée (mentions fiscales RDC)',
    invoiceNumber: generateInvoiceNumber(),
    issuedAt: new Date().toISOString(),
    reference: input.reference,
    customerName: input.customerName || 'Client MonChantier',
    customerEmail: input.customerEmail,
    method: input.method,
    amount: totalTTC,
    currency: input.currency || 'CDF',
    taxRate: vatRate,
    totalHT,
    totalTVA,
    totalTTC,
    seller,
    items: normalizedItems,
    deliveryAddress: input.deliveryAddress,
    location: input.location,
  };
}

export function buildInvoiceText(invoice: InvoiceData) {
  const lines: string[] = [];

  lines.push('MONCHANTIER - FACTURE NORMALISEE RDC');
  lines.push('----------------------------------------');
  lines.push(`Norme: ${invoice.standard}`);
  lines.push(`Base legale: ${invoice.legalReference}`);
  lines.push(`Facture: ${invoice.invoiceNumber}`);
  lines.push(`Date: ${new Date(invoice.issuedAt).toLocaleString('fr-FR')}`);
  lines.push(`Reference paiement: ${invoice.reference}`);
  lines.push(`Mode de paiement: ${methodLabelFr(invoice.method)}`);
  lines.push('');
  lines.push('Vendeur:');
  lines.push(`${invoice.seller.companyName}`);
  lines.push(`${invoice.seller.address}, ${invoice.seller.city}, ${invoice.seller.country}`);

  if (invoice.seller.phone) lines.push(`Tel: ${invoice.seller.phone}`);
  if (invoice.seller.email) lines.push(`Email: ${invoice.seller.email}`);
  if (invoice.seller.nif) lines.push(`NIF: ${invoice.seller.nif}`);
  if (invoice.seller.rccm) lines.push(`RCCM: ${invoice.seller.rccm}`);
  if (invoice.seller.idNat) lines.push(`ID.NAT: ${invoice.seller.idNat}`);
  if (invoice.seller.taxNumber) lines.push(`Numero impot: ${invoice.seller.taxNumber}`);
  if (invoice.seller.vatNumber) lines.push(`Numero TVA: ${invoice.seller.vatNumber}`);

  lines.push('');
  lines.push('Acheteur:');
  lines.push(`Client: ${invoice.customerName}`);
  lines.push(`Email: ${invoice.customerEmail}`);

  if (invoice.deliveryAddress) {
    lines.push(`Adresse de livraison: ${invoice.deliveryAddress}`);
  }

  if (invoice.location?.lat && invoice.location?.lng) {
    lines.push(`Localisation: ${invoice.location.lat}, ${invoice.location.lng}`);
  }

  lines.push('');
  lines.push('Articles:');

  if (invoice.items.length === 0) {
    lines.push('- Aucun article detaille');
  } else {
    invoice.items.forEach((item) => {
      if (item.unitPrice !== undefined) {
        lines.push(
          `- ${item.productName} x${item.quantity} | ${formatAmount(item.unitPrice, invoice.currency)} | Sous-total: ${formatAmount(item.lineTotal, invoice.currency)}`
        );
      } else {
        lines.push(`- ${item.productName} x${item.quantity}`);
      }
    });
  }

  lines.push('');
  lines.push(`Total HT: ${formatAmount(invoice.totalHT, invoice.currency)}`);
  lines.push(`TVA (${invoice.taxRate}%): ${formatAmount(invoice.totalTVA, invoice.currency)}`);
  lines.push(`TOTAL TTC: ${formatAmount(invoice.totalTTC, invoice.currency)}`);
  lines.push('----------------------------------------');
  lines.push('Facture emise automatiquement apres validation du paiement.');
  lines.push('Merci pour votre confiance.');

  return lines.join('\n');
}
