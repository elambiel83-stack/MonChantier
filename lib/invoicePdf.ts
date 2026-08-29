import { PDFDocument, StandardFonts } from 'pdf-lib';
import { InvoiceData } from '@/lib/invoice';

function formatMoney(value: number, currency: string) {
  return `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export async function buildInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 40;
  const left = 40;
  const lineHeight = 15;

  const write = (text: string, bold = false, size = 10) => {
    page.drawText(text, {
      x: left,
      y,
      size,
      font: bold ? fontBold : fontRegular,
    });
    y -= lineHeight;
  };

  const spacer = (lines = 1) => {
    y -= lineHeight * lines;
  };

  write('MONCHANTIER - FACTURE NORMALISEE RDC', true, 13);
  write(`Norme: ${invoice.standard}`);
  write(`Base legale: ${invoice.legalReference}`);
  spacer();

  write(`Facture: ${invoice.invoiceNumber}`, true);
  write(`Date: ${new Date(invoice.issuedAt).toLocaleString('fr-FR')}`);
  write(`Reference paiement: ${invoice.reference}`);
  write(`Client: ${invoice.customerName}`);
  write(`Email: ${invoice.customerEmail || '-'}`);
  spacer();

  write('Vendeur', true);
  write(invoice.seller.companyName);
  write(`${invoice.seller.address}, ${invoice.seller.city}, ${invoice.seller.country}`);
  if (invoice.seller.phone) write(`Tel: ${invoice.seller.phone}`);
  if (invoice.seller.email) write(`Email: ${invoice.seller.email}`);
  if (invoice.seller.nif) write(`NIF: ${invoice.seller.nif}`);
  if (invoice.seller.rccm) write(`RCCM: ${invoice.seller.rccm}`);
  if (invoice.seller.idNat) write(`ID.NAT: ${invoice.seller.idNat}`);
  if (invoice.seller.taxNumber) write(`Numero impot: ${invoice.seller.taxNumber}`);
  if (invoice.seller.vatNumber) write(`Numero TVA: ${invoice.seller.vatNumber}`);
  spacer();

  write('Articles', true);
  if (invoice.items.length === 0) {
    write('- Aucun article detaille');
  } else {
    invoice.items.forEach((item) => {
      const unit = item.unitPrice !== undefined ? formatMoney(item.unitPrice, invoice.currency) : '-';
      write(
        `- ${item.productName} x${item.quantity} | PU: ${unit} | Total: ${formatMoney(
          item.lineTotal,
          invoice.currency
        )}`
      );
    });
  }
  spacer();

  write(`Total HT: ${formatMoney(invoice.totalHT, invoice.currency)}`, true);
  write(`TVA (${invoice.taxRate}%): ${formatMoney(invoice.totalTVA, invoice.currency)}`, true);
  write(`TOTAL TTC: ${formatMoney(invoice.totalTTC, invoice.currency)}`, true);
  spacer();

  write('Facture emise automatiquement apres validation du paiement.', false, 9);

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
