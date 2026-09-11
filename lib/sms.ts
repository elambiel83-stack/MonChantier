export function isSmsConfigured() {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  if (!username || !apiKey) return false;
  if (username === 'sandbox' && process.env.ALLOW_SMS_SANDBOX !== 'true') return false;
  return true;
}

function getBaseUrl() {
  const username = process.env.AFRICASTALKING_USERNAME;
  return username === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';
}

export async function sendSms(args: { to: string; message: string }) {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const senderId = process.env.AFRICASTALKING_SENDER_ID;

  if (!username || !apiKey) {
    throw new Error('AFRICASTALKING_USERNAME/AFRICASTALKING_API_KEY manquants');
  }
  if (username === 'sandbox' && process.env.ALLOW_SMS_SANDBOX !== 'true') {
    throw new Error("Africa's Talking sandbox désactivé sur cet environnement");
  }

  const params = new URLSearchParams({
    username,
    to: args.to,
    message: args.message,
  });
  if (senderId) params.set('from', senderId);

  const response = await fetch(getBaseUrl(), {
    method: 'POST',
    headers: {
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Africa's Talking: échec HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    SMSMessageData?: {
      Recipients?: Array<{ status?: string; statusCode?: number; number?: string }>;
    };
  };

  const recipient = data.SMSMessageData?.Recipients?.[0];
  if (!recipient || recipient.status !== 'Success') {
    throw new Error(`Africa's Talking: envoi refusé (${recipient?.status || 'réponse invalide'})`);
  }

  return recipient;
}
