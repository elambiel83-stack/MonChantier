function normalizeIdentity(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeLabel(value = '') {
  return String(value).trim().toLowerCase();
}

export function buildTechnicianReviewKey(input) {
  return [
    normalizeIdentity(input.technicianIdentity),
    normalizeIdentity(input.authorIdentity),
    String(input.orderReference || '').trim(),
    String(input.serviceId || ''),
  ].join('::');
}

export function resolveTechnicianReviewCandidatesForPayment(payment, services) {
  const items = Array.isArray(payment?.fullInvoice?.items) ? payment.fullInvoice.items : [];
  const candidates = [];
  const seen = new Set();

  for (const item of items) {
    const name = normalizeLabel(item?.productName);
    if (!name) continue;

    const matches = services.filter((service) => {
      if (!service?.ownerIdentity) return false;
      return normalizeLabel(service.fr) === name || normalizeLabel(service.en) === name;
    });

    if (matches.length !== 1) continue;

    const match = matches[0];
    const key = `${payment.reference}::${match.ownerIdentity}::${match.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      orderReference: payment.reference,
      serviceId: match.id,
      serviceName: match.fr,
      technicianIdentity: match.ownerIdentity,
      customerName:
        payment.fullInvoice?.customerName || payment.fullInvoice?.customerEmail || payment.invoice?.email || 'Client',
      deliveredAt: payment.updatedAt,
    });
  }

  return candidates;
}

export function listClientTechnicianReviewOpportunities(input) {
  const clientIdentity = normalizeIdentity(input?.clientIdentity);
  const reviewedKeys = new Set(Array.isArray(input?.reviewedKeys) ? input.reviewedKeys : []);
  const payments = Array.isArray(input?.payments) ? input.payments : [];
  const services = Array.isArray(input?.services) ? input.services : [];

  return payments
    .filter((payment) => {
      if (payment?.orderStatus !== 'delivered') return false;
      const paymentClientIdentity = normalizeIdentity(
        payment?.fullInvoice?.customerEmail || payment?.invoice?.email || ''
      );
      return Boolean(clientIdentity) && paymentClientIdentity === clientIdentity;
    })
    .flatMap((payment) => resolveTechnicianReviewCandidatesForPayment(payment, services))
    .filter(
      (candidate) =>
        !reviewedKeys.has(
          buildTechnicianReviewKey({
            technicianIdentity: candidate.technicianIdentity,
            authorIdentity: clientIdentity,
            orderReference: candidate.orderReference,
            serviceId: candidate.serviceId,
          })
        )
    )
    .sort((left, right) => new Date(right.deliveredAt).getTime() - new Date(left.deliveredAt).getTime());
}
