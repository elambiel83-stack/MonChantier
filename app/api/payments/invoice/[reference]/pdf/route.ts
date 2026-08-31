import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { buildInvoicePdf } from '@/lib/invoicePdf';
import { getStoredPaymentStatus } from '@/lib/paymentStore';

export async function GET(
  request: NextRequest,
  { params }: { params: { reference: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Authentification requise' }, { status: 401 });
  }

  const status = await getStoredPaymentStatus(params.reference);
  if (!status?.fullInvoice) {
    return NextResponse.json({ message: 'Facture introuvable' }, { status: 404 });
  }

  const sessionEmail = session.user.email?.toLowerCase();
  const invoiceEmail = status.fullInvoice.customerEmail?.toLowerCase();
  const isOwner = Boolean(sessionEmail && invoiceEmail && sessionEmail === invoiceEmail);
  const isAdmin = session.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
  }

  const pdf = await buildInvoicePdf(status.fullInvoice);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${status.fullInvoice.invoiceNumber}.pdf"`,
    },
  });
}
