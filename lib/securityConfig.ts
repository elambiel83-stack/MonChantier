export type SecurityConfigSeverity = 'warning' | 'critical';

export type SecurityConfigIssue = {
  id: string;
  area: 'auth' | 'otp' | 'payments' | 'webhooks' | 'operations';
  severity: SecurityConfigSeverity;
  message: string;
};

export type SecurityConfigSummary = {
  environment: string;
  issues: SecurityConfigIssue[];
};

function isTruthy(value: string | undefined) {
  return value === '1' || value === 'true' || value === 'yes';
}

function getEnvironmentLabel() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
}

function isProductionLike() {
  const environment = getEnvironmentLabel();
  return environment === 'production' || environment === 'preview';
}

function isMissing(value: string | undefined) {
  return !value || !value.trim();
}

export function buildSecurityConfigSummary(): SecurityConfigSummary {
  const issues: SecurityConfigIssue[] = [];
  const productionLike = isProductionLike();

  const addIssue = (
    id: string,
    area: SecurityConfigIssue['area'],
    severity: SecurityConfigSeverity,
    message: string
  ) => {
    issues.push({ id, area, severity, message });
  };

  if (isMissing(process.env.NEXTAUTH_SECRET)) {
    addIssue('nextauth-secret-missing', 'auth', 'critical', 'NEXTAUTH_SECRET manquant');
  }
  if (isMissing(process.env.ADMIN_LOGIN_EMAIL) || isMissing(process.env.ADMIN_LOGIN_PASSWORD)) {
    addIssue(
      'admin-credentials-missing',
      'auth',
      'critical',
      'ADMIN_LOGIN_EMAIL ou ADMIN_LOGIN_PASSWORD manquant'
    );
  }
  if (isMissing(process.env.ADMIN_TOTP_SECRET)) {
    addIssue('admin-totp-missing', 'auth', 'critical', 'ADMIN_TOTP_SECRET manquant');
  }
  if (isMissing(process.env.ADMIN_API_SECRET)) {
    addIssue('admin-api-secret-missing', 'operations', 'critical', 'ADMIN_API_SECRET manquant');
  }

  if (isTruthy(process.env.ALLOW_OTP_DEBUG_CODE)) {
    addIssue(
      'otp-debug-enabled',
      'otp',
      productionLike ? 'critical' : 'warning',
      'ALLOW_OTP_DEBUG_CODE actif'
    );
  }
  if (isTruthy(process.env.ALLOW_SMS_SANDBOX)) {
    addIssue(
      'sms-sandbox-enabled',
      'otp',
      productionLike ? 'critical' : 'warning',
      'ALLOW_SMS_SANDBOX actif'
    );
  }
  if (process.env.AFRICASTALKING_USERNAME === 'sandbox') {
    addIssue(
      'sms-sandbox-username',
      'otp',
      productionLike ? 'critical' : 'warning',
      "Africa's Talking sandbox configuré"
    );
  }
  if (isMissing(process.env.AFRICASTALKING_USERNAME) || isMissing(process.env.AFRICASTALKING_API_KEY)) {
    addIssue(
      'sms-provider-missing',
      'otp',
      productionLike ? 'critical' : 'warning',
      "Configuration SMS Africa's Talking incomplète"
    );
  }

  if (isMissing(process.env.STRIPE_SECRET_KEY)) {
    addIssue('stripe-secret-missing', 'payments', 'critical', 'STRIPE_SECRET_KEY manquant');
  }
  if (isMissing(process.env.STRIPE_WEBHOOK_SECRET)) {
    addIssue('stripe-webhook-missing', 'webhooks', 'critical', 'STRIPE_WEBHOOK_SECRET manquant');
  }
  if (isMissing(process.env.PAYPAL_CLIENT_ID) || isMissing(process.env.PAYPAL_CLIENT_SECRET)) {
    addIssue('paypal-credentials-missing', 'payments', 'critical', 'Credentials PayPal manquants');
  }
  if (isMissing(process.env.PAYPAL_WEBHOOK_ID)) {
    addIssue('paypal-webhook-missing', 'webhooks', 'critical', 'PAYPAL_WEBHOOK_ID manquant');
  }
  if ((process.env.PAYPAL_API_BASE || '').includes('sandbox')) {
    addIssue(
      'paypal-sandbox-base',
      'payments',
      productionLike ? 'critical' : 'warning',
      'PayPal sandbox encore configuré'
    );
  }
  if (isMissing(process.env.MOBILE_MONEY_API_KEY)) {
    addIssue(
      'mobile-money-api-key-missing',
      'payments',
      'critical',
      'MOBILE_MONEY_API_KEY manquant'
    );
  }
  if (isMissing(process.env.MOBILE_MONEY_WEBHOOK_SECRET)) {
    addIssue(
      'mobile-money-webhook-secret-missing',
      'webhooks',
      'critical',
      'MOBILE_MONEY_WEBHOOK_SECRET manquant'
    );
  }

  return {
    environment: getEnvironmentLabel(),
    issues,
  };
}
