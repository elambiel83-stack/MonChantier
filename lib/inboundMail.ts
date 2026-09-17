import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { addTicketMessage, createTicket, getTicketById } from './supportStore';

// Ingestion email des tickets support : un client peut écrire directement à
// l'adresse support (sans jamais se connecter au site) et ça crée un ticket
// ; une réponse à un email de notification existant ("Re: ... [TCK-xxx]")
// est ajoutée au fil du ticket correspondant au lieu d'en créer un nouveau.
//
// Fonctionne par polling IMAP (voir pollInboundSupportMail, déclenché par
// /api/support/inbound-poll) plutôt que par un webhook de prestataire
// spécifique (Mailgun/Postmark/SendGrid...) : ça reste compatible avec
// n'importe quelle boîte mail générique (Gmail, Zoho, hébergeur...), y
// compris la même boîte déjà utilisée pour l'envoi SMTP sortant.

function getImapConfig() {
  const host = process.env.SUPPORT_IMAP_HOST || process.env.SMTP_HOST;
  const user = process.env.SUPPORT_IMAP_USER || process.env.SMTP_USER;
  const pass = process.env.SUPPORT_IMAP_PASSWORD || process.env.SMTP_PASS;
  const portRaw = process.env.SUPPORT_IMAP_PORT;

  if (!host || !user || !pass) return null;

  const port = portRaw ? Number(portRaw) : 993;
  if (!Number.isFinite(port)) return null;

  const secure = process.env.SUPPORT_IMAP_SECURE ? process.env.SUPPORT_IMAP_SECURE !== 'false' : true;

  return { host, port, user, pass, secure };
}

export function isInboundMailConfigured(): boolean {
  return getImapConfig() !== null;
}

// Un email de notification sortant lié à un ticket inclut ce tag dans son
// sujet (voir lib/mailer.ts) : une réponse le préserve généralement
// ("Re: ... [TCK-xxx]"), ce qui permet de l'apparier au bon ticket.
const TICKET_TAG_RE = /\[(TCK-[A-Za-z0-9-]+)\]/;

export function extractTicketId(subject: string): string | null {
  const match = subject.match(TICKET_TAG_RE);
  return match ? match[1] : null;
}

function stripTicketTag(subject: string): string {
  return subject.replace(TICKET_TAG_RE, '').replace(/^\s*(re|fwd?)\s*:\s*/i, '').trim();
}

/**
 * Écarte le courrier automatisé (accusés de réception, absences du bureau,
 * notifications de rebond) : sans ce filtre, notre propre email de
 * notification staff pourrait générer un accusé de réception qui atterrit
 * dans la même boîte et serait pris pour un nouveau ticket — boucle infinie.
 */
export function looksAutomated(parsed: Pick<ParsedMail, 'subject' | 'headers'>): boolean {
  const autoSubmitted = parsed.headers.get('auto-submitted');
  if (typeof autoSubmitted === 'string' && autoSubmitted.toLowerCase() !== 'no') return true;
  if (parsed.headers.has('x-autoreply') || parsed.headers.has('x-autorespond')) return true;

  const subject = (parsed.subject || '').toLowerCase();
  if (/undeliverable|mail delivery|delivery status notification|automatic reply|out of office|absence/i.test(subject)) {
    return true;
  }
  return false;
}

export type InboundMailStats = {
  processed: number;
  ticketsCreated: number;
  repliesAdded: number;
  skipped: number;
};

/**
 * Se connecte à la boîte support, traite chaque message non lu une seule
 * fois (marqué \Seen immédiatement après traitement, y compris en cas
 * d'ignorance délibérée), puis se déconnecte. Conçu pour être appelé par un
 * déclencheur externe (cron) via /api/support/inbound-poll — voir ce
 * fichier pour le détail de sécurité.
 */
export async function pollInboundSupportMail(): Promise<InboundMailStats> {
  const config = getImapConfig();
  if (!config) {
    throw new Error('Ingestion email non configurée (SUPPORT_IMAP_HOST/USER/PASSWORD ou SMTP_* manquants)');
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  const stats: InboundMailStats = { processed: 0, ticketsCreated: 0, repliesAdded: 0, skipped: 0 };

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const message of client.fetch({ seen: false }, { source: true, uid: true })) {
        stats.processed += 1;
        try {
          await processMessage(message.source, stats);
        } catch (error) {
          console.error('Erreur traitement email entrant support:', error);
        } finally {
          // Marqué lu dans tous les cas (traité ou ignoré) pour ne jamais le
          // retraiter au prochain passage, même en cas d'erreur de parsing.
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return stats;
}

async function processMessage(source: Buffer | undefined, stats: InboundMailStats): Promise<void> {
  if (!source) {
    stats.skipped += 1;
    return;
  }

  const parsed = await simpleParser(source);
  const fromAddress = parsed.from?.value?.[0]?.address?.trim().toLowerCase();

  if (!fromAddress || looksAutomated(parsed)) {
    stats.skipped += 1;
    return;
  }

  const subject = parsed.subject || '(sans objet)';
  const bodyText = (parsed.text || '').trim() || '(message vide)';
  const existingTicketId = extractTicketId(subject);
  const isAdminSender = getAdminEmails().includes(fromAddress);

  if (existingTicketId) {
    const ticket = await getTicketById(existingTicketId);
    if (ticket) {
      // Le staff (ADMIN_EMAILS) peut répondre par email à n'importe quel
      // ticket ; un client ne peut répondre qu'au sien — un tag
      // deviné/copié dans le sujet par quelqu'un d'autre ne doit pas
      // permettre d'écrire dans le fil d'un tiers.
      if (isAdminSender || ticket.identity === fromAddress) {
        const result = await addTicketMessage({
          id: ticket.id,
          from: isAdminSender ? 'staff' : 'client',
          authorIdentity: fromAddress,
          message: bodyText,
        });
        if (result.success) {
          stats.repliesAdded += 1;
          return;
        }
      }
    }
  }

  // Un email du staff sans tag de ticket reconnu n'a pas de contexte : on
  // l'ignore plutôt que de créer un ticket fantôme attribué à un membre du
  // staff comme s'il était client.
  if (isAdminSender) {
    stats.skipped += 1;
    return;
  }

  await createTicket({
    identity: fromAddress,
    subject: stripTicketTag(subject) || '(sans objet)',
    message: bodyText,
    channel: 'email',
  });
  stats.ticketsCreated += 1;
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
