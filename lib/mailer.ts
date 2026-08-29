import nodemailer, { Transporter } from 'nodemailer';

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
};

type InvoiceMailPayload = {
  to: string;
  invoiceNumber: string;
  customerName: string;
  text: string;
  pdf?: Buffer;
};

declare global {
  // eslint-disable-next-line no-var
  var __monchantier_mailer__: Transporter | undefined;
}

function getMailerConfig() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secureRaw = process.env.SMTP_SECURE;

  if (!host || !portRaw || !user || !pass) {
    return null;
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port)) {
    throw new Error('SMTP_PORT invalide');
  }

  const secure = secureRaw ? secureRaw === 'true' : port === 465;

  return { host, port, user, pass, secure };
}

export function isMailerConfigured() {
  return Boolean(getMailerConfig());
}

export function getTransporter() {
  const config = getMailerConfig();
  if (!config) {
    throw new Error('Configuration SMTP incomplète');
  }

  const transporter =
    globalThis.__monchantier_mailer__ ??
    nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

  if (!globalThis.__monchantier_mailer__) {
    globalThis.__monchantier_mailer__ = transporter;
  }

  return transporter;
}

async function sendMail(payload: MailPayload) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!from) {
    throw new Error('SMTP_FROM ou SMTP_USER requis pour l\'expéditeur');
  }

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    replyTo: payload.replyTo,
    attachments: payload.attachments,
  });
}

export async function sendContactEmail(payload: MailPayload) {
  await sendMail(payload);
}

export async function sendInvoiceEmail(payload: InvoiceMailPayload) {
  const subject = `Facture ${payload.invoiceNumber} - MonChantier`;
  const text = `Bonjour ${payload.customerName},\n\nVeuillez trouver votre facture ci-dessous.\n\n${payload.text}`;

  await sendMail({
    to: payload.to,
    subject,
    text,
    attachments: payload.pdf
      ? [
          {
            filename: `${payload.invoiceNumber}.pdf`,
            content: payload.pdf,
            contentType: 'application/pdf',
          },
        ]
      : undefined,
  });
}
