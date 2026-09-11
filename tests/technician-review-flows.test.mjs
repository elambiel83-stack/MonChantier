import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTechnicianReviewKey,
  listClientTechnicianReviewOpportunities,
  resolveTechnicianReviewCandidatesForPayment,
} from '../lib/technicianReviewWorkflow.js';

test('review opportunities resolve only unambiguous technician services from delivered client orders', () => {
  const services = [
    { id: 1, fr: 'Plomberie', en: 'Plumbing', ownerIdentity: 'tech@example.com' },
    { id: 2, fr: 'Peinture', en: 'Painting', ownerIdentity: 'paint@example.com' },
    { id: 3, fr: 'Peinture', en: 'Painting', ownerIdentity: 'other@example.com' },
  ];
  const payment = {
    reference: 'PAY-1',
    state: 'confirmed',
    orderStatus: 'delivered',
    updatedAt: '2026-09-11T00:00:00.000Z',
    fullInvoice: {
      customerName: 'Client Test',
      customerEmail: 'client@example.com',
      items: [{ productName: 'Plomberie' }, { productName: 'Peinture' }, { productName: 'Plomberie' }],
    },
  };

  assert.deepEqual(resolveTechnicianReviewCandidatesForPayment(payment, services), [
    {
      orderReference: 'PAY-1',
      serviceId: 1,
      serviceName: 'Plomberie',
      technicianIdentity: 'tech@example.com',
      customerName: 'Client Test',
      deliveredAt: '2026-09-11T00:00:00.000Z',
    },
  ]);
});

test('client review opportunities exclude already-reviewed interventions and non-delivered orders', () => {
  const services = [{ id: 1, fr: 'Plomberie', en: 'Plumbing', ownerIdentity: 'tech@example.com' }];
  const payments = [
    {
      reference: 'PAY-1',
      state: 'confirmed',
      orderStatus: 'delivered',
      updatedAt: '2026-09-11T00:00:00.000Z',
      fullInvoice: {
        customerName: 'Client Test',
        customerEmail: 'client@example.com',
        items: [{ productName: 'Plomberie' }],
      },
    },
    {
      reference: 'PAY-2',
      state: 'confirmed',
      orderStatus: 'processing',
      updatedAt: '2026-09-11T00:00:00.000Z',
      fullInvoice: {
        customerName: 'Client Test',
        customerEmail: 'client@example.com',
        items: [{ productName: 'Plomberie' }],
      },
    },
  ];

  const reviewedKey = buildTechnicianReviewKey({
    technicianIdentity: 'tech@example.com',
    authorIdentity: 'client@example.com',
    orderReference: 'PAY-1',
    serviceId: 1,
  });

  assert.deepEqual(
    listClientTechnicianReviewOpportunities({
      clientIdentity: 'client@example.com',
      payments,
      services,
      reviewedKeys: [reviewedKey],
    }),
    []
  );
});
