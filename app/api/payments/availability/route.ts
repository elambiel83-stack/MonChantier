import { NextResponse } from 'next/server';
import { isLivePaymentEnabled } from '@/lib/paymentAvailability';
import { isStripeConfigured } from '@/lib/stripe';
import { isPayPalConfigured } from '@/lib/paypal';
import { isMobileMoneyConfigured } from '@/lib/mobileMoney';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    methods: {
      card: isLivePaymentEnabled('card') && isStripeConfigured(),
      paypal: isLivePaymentEnabled('paypal') && isPayPalConfigured(),
      mobilemoney: isLivePaymentEnabled('mobilemoney') && isMobileMoneyConfigured(),
    },
    fallback: 'whatsapp',
  });
}
