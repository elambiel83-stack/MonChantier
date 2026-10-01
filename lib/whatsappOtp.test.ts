import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendWhatsAppOtp } from './whatsappOtp';

describe('WhatsApp OTP', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses an approved authentication template without a leading plus sign', async () => {
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '12345');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendWhatsAppOtp({ to: '+243963985553', code: '123456' })).resolves.toEqual({ messageId: 'wamid.1' });
    const [, request] = fetchMock.mock.calls[0];
    const payload = JSON.parse(request.body);
    expect(payload.to).toBe('243963985553');
    expect(payload.template.name).toBe('monchantier_otp');
    expect(payload.template.components[0].parameters[0].text).toBe('123456');
  });
});
