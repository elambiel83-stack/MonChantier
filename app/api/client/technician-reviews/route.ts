import { NextResponse } from 'next/server';
import { getStoredPaymentStatus, listPaymentStatuses } from '@/lib/paymentStore';
import { getSessionActor } from '@/lib/sessionIdentity';
import { listServices } from '@/lib/serviceStore';
import { addTechnicianReview, hasTechnicianReview, listTechnicianReviewKeysByAuthor } from '@/lib/technicianStore';
import {
  listClientTechnicianReviewOpportunities,
  resolveTechnicianReviewCandidatesForPayment,
} from '@/lib/technicianReviewWorkflow';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'client') {
    return NextResponse.json({ message: 'Accès non autorisé' }, { status: 403 });
  }

  const [payments, services, reviewedKeys] = await Promise.all([
    listPaymentStatuses(),
    listServices(),
    listTechnicianReviewKeysByAuthor(actor.identity),
  ]);

  const opportunities = listClientTechnicianReviewOpportunities({
    clientIdentity: actor.identity,
    payments,
    services,
    reviewedKeys,
  });

  return NextResponse.json({ opportunities });
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'client') {
    return NextResponse.json({ message: 'Accès non autorisé' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const orderReference = String(body?.orderReference || '').trim();
    const technicianIdentity = String(body?.technicianIdentity || '').trim().toLowerCase();
    const serviceId = Number(body?.serviceId);
    const rating = Number(body?.rating);
    const comment = String(body?.comment || '').trim() || undefined;

    if (!orderReference || !technicianIdentity || !Number.isFinite(serviceId) || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ message: 'Évaluation invalide' }, { status: 400 });
    }

    const payment = await getStoredPaymentStatus(orderReference);
    const paymentClientIdentity = (
      payment?.fullInvoice?.customerEmail || payment?.invoice?.email || ''
    )
      .trim()
      .toLowerCase();

    if (!payment || payment.state !== 'confirmed' || payment.orderStatus !== 'delivered' || paymentClientIdentity !== actor.identity) {
      return NextResponse.json({ message: 'Commande non éligible à une évaluation' }, { status: 400 });
    }

    const services = await listServices();
    const candidate = resolveTechnicianReviewCandidatesForPayment(payment, services).find(
      (entry) => entry.technicianIdentity === technicianIdentity && entry.serviceId === serviceId
    );

    if (!candidate) {
      return NextResponse.json({ message: 'Service technicien introuvable pour cette commande' }, { status: 400 });
    }

    const alreadyReviewed = await hasTechnicianReview(technicianIdentity, {
      authorIdentity: actor.identity,
      orderReference,
      serviceId,
    });
    if (alreadyReviewed) {
      return NextResponse.json({ message: 'Cette intervention a déjà été évaluée' }, { status: 409 });
    }

    const profile = await addTechnicianReview(technicianIdentity, {
      authorIdentity: actor.identity,
      authorName: payment.fullInvoice?.customerName || actor.identity,
      rating,
      comment,
      orderReference,
      serviceId,
      serviceName: candidate.serviceName,
      verified: true,
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Erreur avis technicien:', error);
    return NextResponse.json({ message: "Erreur lors de l'envoi de l'évaluation" }, { status: 500 });
  }
}
