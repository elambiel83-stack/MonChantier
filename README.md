# MonChantier Livraison

## Démarrage rapide (après redémarrage du PC)

1. Ouvrir un terminal dans le dossier du projet :
   - `/home/erick-lambi/Musique/MonChantier_Livraison`
2. Installer les dépendances (si nécessaire) :
   - `npm install`
3. Lancer le serveur de développement :
   - `npm run dev`
4. Ouvrir l’application dans le navigateur :
   - `http://localhost:3000`

## Commandes utiles

- Arrêter le serveur : `Ctrl + C`
- Rebuild production : `npm run build`
- Démarrer en production : `npm run start`
- Linter : `npm run lint`

## Authentification (Google, Facebook, TikTok, Téléphone)

L'application utilise `NextAuth` avec 4 méthodes de connexion:
- Google OAuth
- Facebook OAuth
- TikTok OAuth
- Numéro de téléphone (OTP)

### Variables d'environnement

Copier `.env.example` vers `.env.local` puis renseigner:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`
- `TIKTOK_CLIENT_ID` / `TIKTOK_CLIENT_SECRET`

### Email de devis (SMTP)

Pour activer l'envoi email réel des demandes de devis (`POST /api/contact`), ajoutez dans `.env.local`:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_TO` (email qui reçoit les demandes de devis)
- `QUOTE_REQUEST_TO` (optionnel, prioritaire sur `SMTP_TO` pour les devis)
- `SMTP_FROM` (optionnel, défaut: `SMTP_USER`)
- `SMTP_SECURE` (optionnel: `true`/`false`, auto selon le port sinon)

### Facturation automatique normalisée RDC (paiements)

Les commandes émettent maintenant une facture normalisée RDC après validation du paiement.

Flux actuel:

- Mobile Money: validation simulée immédiate dans `POST /api/payments/mobilemoney/initiate`.
- Carte/PayPal: création du checkout via les endpoints ci-dessous, puis émission de la facture via webhook provider (Stripe/PayPal). La page succès consulte l'état sur `GET /api/payments/status`.

Endpoints concernés:

- `POST /api/payments/mobilemoney/initiate`
- `POST /api/payments/card/create-checkout`
- `POST /api/payments/paypal/create-order`
- `POST /api/payments/confirm`
- `GET /api/payments/status?reference=<paymentReference>`
- `POST /api/webhooks/stripe`
- `POST /api/webhooks/paypal`

Les réponses de validation incluent un objet `invoice` avec:

- `invoice.number`: numéro de facture généré
- `invoice.sent`: `true` si l'email a été envoyé, sinon `false`
- `invoice.email`: email client ciblé
- `invoice.standard`: norme de facturation (`RDC-NORMALISEE-2026`)
- `invoice.totals`: ventilation `ht`, `tva`, `ttc`, `currency`

Chaque facture envoyée par email est jointe en PDF (`<numero_facture>.pdf`).

### Webhooks provider-side (validation 100% Stripe/PayPal)

Variables Stripe (`.env.local`):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Variables PayPal (`.env.local`):

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_API_BASE` (optionnel, défaut sandbox: `https://api-m.sandbox.paypal.com`)

Notes d'intégration:

- Stripe: envoyer `invoice_payload` dans `metadata` de la session checkout.
- PayPal: envoyer `invoice_payload` dans `custom_id` (idéalement `purchase_units[0].custom_id`).
- Le serveur valide la signature webhook, puis confirme le paiement et émet la facture normalisée.
- Si les clés provider sont absentes, les routes checkout/order restent en mode démo (fallback local).

Commandes de test Stripe CLI (local):

1. Se connecter:
   - `stripe login`
2. Forward des webhooks vers l'app locale:
   - `stripe listen --events checkout.session.completed --forward-to http://localhost:3000/api/webhooks/stripe`
3. Récupérer le secret affiché (`whsec_...`) et le mettre dans `.env.local`:
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
4. Redémarrer l'application après mise à jour des variables.

Test PayPal Sandbox (local):

1. Configurer:
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `PAYPAL_WEBHOOK_ID`
   - `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`
2. Créer un webhook PayPal pointant vers:
   - `http://localhost:3000/api/webhooks/paypal` (ou URL tunnel HTTPS type ngrok en local réel)
3. Événements recommandés:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`

Anti-replay webhook:

- Le serveur persiste les `event_id` Stripe/PayPal déjà traités dans `data/payment-webhook-store.json`.
- Un même événement webhook ne déclenche pas deux fois la confirmation/facture, même après redémarrage serveur.

Checklist go-live (paiements + factures):

1. Configurer les secrets Stripe/PayPal/SMTP dans `.env.local` ou variables serveur.
2. Exécuter le script de vérification:
   - `bash scripts/check-payment-env.sh`
3. Ouvrir un tunnel HTTPS local (si test depuis providers cloud):
   - `npx localtunnel --port 3000`
4. Déclarer les webhooks providers:
   - Stripe: `https://<votre-url-tunnel>/api/webhooks/stripe`
   - PayPal: `https://<votre-url-tunnel>/api/webhooks/paypal`
5. Vérifier le flux:
   - Créer checkout/order
   - Confirmer `pending` via `GET /api/payments/status`
   - Finaliser paiement provider
   - Vérifier `confirmed` + facture normalisée
6. Vérifier anti-replay:
   - Rejouer un même webhook event ID
   - Attendre `duplicate: true`

Configurer les mentions légales dans `.env.local`:

- `RDC_VAT_RATE` (défaut: `16`)
- `BILLING_COMPANY_NAME`
- `BILLING_COMPANY_ADDRESS`
- `BILLING_COMPANY_CITY`
- `BILLING_COMPANY_COUNTRY`
- `BILLING_COMPANY_PHONE`
- `BILLING_COMPANY_EMAIL`
- `BILLING_COMPANY_NIF`
- `BILLING_COMPANY_RCCM`
- `BILLING_COMPANY_ID_NAT`
- `BILLING_COMPANY_TAX_NUMBER`
- `BILLING_COMPANY_VAT_NUMBER`

L'envoi de facture utilise la même configuration SMTP que les emails de devis.

### Activer Google OAuth (effectif)

1. Créer un client OAuth 2.0 Web dans Google Cloud Console.
2. Ajouter l'URI de redirection autorisée suivante:
   - `http://localhost:3000/api/auth/callback/google`
3. Renseigner dans `.env.local`:
   - `NEXTAUTH_URL=http://localhost:3000`
   - `NEXTAUTH_SECRET=<une valeur longue et aléatoire>`
   - `GOOGLE_CLIENT_ID=<client id Google>`
   - `GOOGLE_CLIENT_SECRET=<client secret Google>`
4. Redémarrer le serveur (`npm run dev`).

Note: le bouton Google n'apparaît que si `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont définis.

### OTP téléphone (mode dev)

En développement, l'API OTP retourne le code dans le message pour test rapide.
Route: `POST /api/auth/phone/request-code` avec `{ "phone": "+243..." }`.

Les OTP sont persistés côté serveur dans `data/phone-otp-store.json` (codes expirés nettoyés automatiquement).

### Envoi SMS du code OTP (Africa's Talking)

Sans configuration, le code OTP n'est jamais envoyé par SMS en production (seul le mode dev l'affiche). Pour activer l'envoi réel:

1. Créer un compte sur https://africastalking.com puis une application (Sandbox pour tester, Live pour la prod).
2. Récupérer le nom d'utilisateur (`sandbox` en mode test) et la clé API.
3. Renseigner dans `.env.local`:
   - `AFRICASTALKING_USERNAME`
   - `AFRICASTALKING_API_KEY`
   - `AFRICASTALKING_SENDER_ID` (optionnel: expéditeur/shortcode approuvé)
4. En mode `sandbox`, seuls les numéros de test enregistrés dans le simulateur Africa's Talking reçoivent réellement le SMS.

### Protection de /admin et des routes /api/admin/*

Ces pages exposent les statistiques, paiements et la gestion des utilisateurs internes: elles sont protégées par `middleware.ts`.

1. Se connecter au site avec Google (ou Facebook) en utilisant l'email qui doit avoir accès admin.
2. Ajouter cet email dans `.env.local`:
   - `ADMIN_EMAILS=vous@exemple.com,autre-admin@exemple.com`
3. Sans `ADMIN_EMAILS` configuré, l'accès est refusé à tout le monde (comportement sûr par défaut).
4. Un accès direct à `/admin` sans session valide redirige vers `/auth/signin`; un appel à `/api/admin/*` sans autorisation renvoie `403`.

### Confirmation manuelle de paiement (ops)

`POST /api/payments/confirm` sert à confirmer manuellement un paiement resté bloqué (ex: webhook provider manqué), en dehors de toute UI. Il est protégé par un secret dédié:

1. Définir `ADMIN_API_SECRET` dans `.env.local` (une valeur aléatoire longue).
2. Appeler la route avec l'en-tête `Authorization: Bearer <ADMIN_API_SECRET>`.
3. Sans secret configuré ou avec une valeur incorrecte, la route renvoie `401`.
