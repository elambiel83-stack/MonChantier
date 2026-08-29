#!/usr/bin/env bash
set -euo pipefail

missing=0

check_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[MISSING] $name"
    missing=1
  else
    echo "[OK] $name"
  fi
}

echo "== Stripe =="
check_var "STRIPE_SECRET_KEY"
check_var "STRIPE_WEBHOOK_SECRET"

echo

echo "== PayPal =="
check_var "PAYPAL_CLIENT_ID"
check_var "PAYPAL_CLIENT_SECRET"
check_var "PAYPAL_WEBHOOK_ID"
if [[ -z "${PAYPAL_API_BASE:-}" ]]; then
  echo "[WARN] PAYPAL_API_BASE absent (fallback sandbox par défaut)"
else
  echo "[OK] PAYPAL_API_BASE"
fi

echo

echo "== SMTP factures =="
check_var "SMTP_HOST"
check_var "SMTP_PORT"
check_var "SMTP_USER"
check_var "SMTP_PASS"

if [[ "$missing" -eq 1 ]]; then
  echo
  echo "Etat: pre-requis incomplets"
  exit 1
fi

echo

echo "Etat: pre-requis principaux présents"
