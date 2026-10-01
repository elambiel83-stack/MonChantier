export type WhatsAppOtpResult = { messageId: string };

export function isWhatsAppOtpConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendWhatsAppOtp(args: { to: string; code: string }): Promise<WhatsAppOtpResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error('WhatsApp Cloud API non configurée');

  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'monchantier_otp';
  const languageCode = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'fr';
  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: args.to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: args.code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: args.code }] },
        ],
      },
    }),
  });

  const data = (await response.json().catch(() => null)) as { messages?: Array<{ id?: string }>; error?: { message?: string } } | null;
  const messageId = data?.messages?.[0]?.id;
  if (!response.ok || !messageId) {
    throw new Error(`WhatsApp Cloud API: ${data?.error?.message || `échec HTTP ${response.status}`}`);
  }
  return { messageId };
}
