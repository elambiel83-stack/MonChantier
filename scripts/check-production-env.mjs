const errors = [];
const warnings = [];

const value = (name) => (process.env[name] || '').trim();
const requireValue = (name, message) => {
  if (!value(name)) errors.push(`${name}: ${message}`);
};

requireValue('DATABASE_URL', 'connexion PostgreSQL obligatoire');
if (value('DATABASE_URL') && !/^postgres(ql)?:\/\//i.test(value('DATABASE_URL'))) {
  errors.push('DATABASE_URL: doit utiliser PostgreSQL');
}

requireValue('NEXTAUTH_URL', 'URL HTTPS publique obligatoire');
requireValue('NEXT_PUBLIC_APP_URL', 'URL canonique publique obligatoire');
for (const name of ['NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL']) {
  if (value(name) && !value(name).startsWith('https://')) errors.push(`${name}: HTTPS obligatoire`);
}
if (value('NEXTAUTH_URL') && value('NEXT_PUBLIC_APP_URL') && value('NEXTAUTH_URL').replace(/\/$/, '') !== value('NEXT_PUBLIC_APP_URL').replace(/\/$/, '')) {
  errors.push('NEXTAUTH_URL et NEXT_PUBLIC_APP_URL doivent désigner la même origine');
}

requireValue('NEXTAUTH_SECRET', 'secret de session obligatoire');
if (value('NEXTAUTH_SECRET') && value('NEXTAUTH_SECRET').length < 32) errors.push('NEXTAUTH_SECRET: minimum 32 caractères');
requireValue('ADMIN_EMAILS', 'au moins un administrateur obligatoire');
requireValue('ADMIN_TOTP_SECRET', 'MFA administrateur obligatoire');
if (!value('ADMIN_LOGIN_PASSWORD_HASH') && !(value('GOOGLE_CLIENT_ID') && value('GOOGLE_CLIENT_SECRET'))) {
  errors.push('Authentification admin: configurer ADMIN_LOGIN_PASSWORD_HASH ou Google OAuth');
}

if (value('LIVE_PAYMENTS_ENABLED').toLowerCase() === 'true') {
  errors.push('LIVE_PAYMENTS_ENABLED doit rester false pour le lancement Catalogue + WhatsApp');
}
for (const name of ['LIVE_CARD_ENABLED', 'LIVE_PAYPAL_ENABLED', 'LIVE_MOBILE_MONEY_ENABLED']) {
  if (value(name).toLowerCase() === 'true') errors.push(`${name} doit rester false avant validation réelle du prestataire`);
}

if (!value('REDIS_URL')) warnings.push('REDIS_URL absent : le rate limiting ne sera pas partagé entre plusieurs instances');
if (!value('TURNSTILE_SECRET_KEY')) warnings.push('TURNSTILE_SECRET_KEY absent : protection anti-bot inactive');
if (!value('SMTP_HOST')) warnings.push('SMTP non configuré : emails et factures automatiques indisponibles');

console.log('MonChantier — contrôle de configuration production');
for (const warning of warnings) console.log(`AVERTISSEMENT — ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`BLOCAGE — ${error}`);
  console.error(`NO-GO — ${errors.length} blocage(s), ${warnings.length} avertissement(s)`);
  process.exit(1);
}
console.log(`GO CONFIGURATION — 0 blocage, ${warnings.length} avertissement(s)`);
