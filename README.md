# MonChantier Livraison

## Démarrage rapide

1. Installer les dépendances :
   - `npm install`
2. Démarrer une base PostgreSQL locale (Docker) :
   - `docker compose up -d db`
3. Copier `.env.example` vers `.env.local` et renseigner au minimum `DATABASE_URL` (voir `docker-compose.yml` pour les identifiants par défaut).
4. Appliquer le schéma (idempotent, à rejouer à chaque déploiement) :
   - `npm run db:migrate`
5. Lancer le serveur de développement :
   - `npm run dev`
6. Ouvrir l'application dans le navigateur :
   - `http://localhost:3000`

## Commandes utiles

- Arrêter le serveur : `Ctrl + C`
- Rebuild production : `npm run build`
- Démarrer en production : `npm run start`
- Linter : `npm run lint`
- Tests : `npm test`

## Base de données

Toute la persistance applicative (produits, commandes, prêts, wallet, rôles,
livraisons, etc.) vit dans PostgreSQL (`DATABASE_URL`), voir `db/schema.sql`.
Ce fichier est idempotent et doit être rejoué à chaque déploiement (comme
`backend/schema.sql` dans le dépôt Chantier) : `npm run db:migrate`.

Chaque domaine métier est stocké comme un document JSON dans la table
`kv_store` (une ligne par store, verrouillée avec `SELECT ... FOR UPDATE`
pendant les écritures — voir `lib/storeDb.ts`), ce qui conserve la même
forme de données que l'ancien système de fichiers `data/*.json` tout en la
rendant compatible avec un déploiement serverless ou multi-instance : les
fichiers JSON ne survivaient pas à un redémarrage à froid en serverless et
divergeaient entre plusieurs instances du serveur.

**Note sur le reste de ce document** : les sections ci-dessous mentionnent
encore par endroits `data/<nom>.json` pour décrire où vit chaque donnée —
lire cela comme le nom du store correspondant dans `kv_store` (ex.
`data/wallet-store.json` → clé `wallet-store`), la logique métier étant
inchangée.

## Authentification (Google, Facebook, TikTok, Téléphone)

L'application utilise `NextAuth` avec 5 méthodes de connexion:
- Google OAuth
- Facebook OAuth
- TikTok OAuth
- Apple OAuth
- Numéro de téléphone (OTP)

### Variables d'environnement

Copier `.env.example` vers `.env.local` puis renseigner:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`
- `TIKTOK_CLIENT_ID` / `TIKTOK_CLIENT_SECRET`
- `APPLE_ID` / `APPLE_SECRET`

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
2. Ajouter l'URI de redirection autorisée qui correspond exactement à `NEXTAUTH_URL`:
   - en développement courant: `http://localhost:3001/api/auth/callback/google`
   - en production: `https://votre-domaine.tld/api/auth/callback/google`
3. Renseigner dans `.env.local`:
   - `NEXTAUTH_URL=http://localhost:3001`
   - `NEXTAUTH_SECRET=<une valeur longue et aléatoire>`
   - `GOOGLE_CLIENT_ID=<client id Google>`
   - `GOOGLE_CLIENT_SECRET=<client secret Google>`
4. Redémarrer le serveur (`npm run dev`).

Note: le bouton Google n'apparaît que si `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont définis. Une erreur Google `400` indique généralement que l'URI de redirection déclarée dans Google Cloud ne correspond pas à `NEXTAUTH_URL`.

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

### Dashboards par rôle (RBAC)

L'application distingue 9 rôles de plateforme, chacun avec son propre espace protégé sous `/dashboard/<role>` :

- `client`, `supplier`, `driver`, `site-manager`, `technician`, `accountant`, `director`, `admin`, `ai`

Le rôle `ai` (Centre de contrôle / intelligence opérationnelle) est un squelette : il n'analyse aucune donnée réelle tant que les dashboards métier (stocks, livraisons, ventes) n'en produisent pas.

Fonctionnement :

1. Tout utilisateur connecté a un rôle attaché à sa session (`session.user.role`), stocké dans `data/role-store.json` (par email ou identifiant de connexion). Par défaut : `client`.
2. `middleware.ts` protège `/dashboard/:path*` : un utilisateur non connecté est redirigé vers `/auth/signin`; un utilisateur connecté qui tente d'accéder au dashboard d'un autre rôle est renvoyé vers le sien. Le rôle `admin` peut accéder à tous les dashboards.
3. L'ancienne route `/admin` redirige désormais vers `/dashboard/admin` (même protection qu'avant, basée sur `ADMIN_EMAILS`).
4. Deux dashboards sont pleinement fonctionnels : `admin` (statistiques, gestion des utilisateurs internes, attribution des rôles) et `client` (commandes, factures, devis — voir ci-dessous). Les 6 autres affichent un squelette (menu prévu + message "en construction") en attendant leurs modules métier réels (missions, chantiers, stocks, etc.).

#### Dashboard Client

Accessible sur `/dashboard/client` pour tout utilisateur connecté avec un email (Google/Facebook ou email renseigné à l'achat) :

- **Mes commandes** : historique des paiements (Mobile Money, carte, PayPal) rattachés à l'email du compte, avec statut (en attente/confirmée) et téléchargement de la facture PDF.
- **Mes devis** : historique des demandes de devis envoyées via `/api/contact`, persistées dans `data/quote-store.json`.

Le rattachement se fait par correspondance d'email (le paiement exige toujours un email de facturation, quelle que soit la méthode). Un compte connecté uniquement par téléphone (sans email) ne peut pas voir ses commandes ici tant qu'aucun email n'est associé.

Le PDF de facture est régénéré à la demande via `GET /api/payments/invoice/<reference>/pdf`, à partir d'un snapshot complet de la facture (`fullInvoice`) conservé dans `data/payment-webhook-store.json`. Accès restreint au propriétaire de la facture (email correspondant) ou à un `admin`.

#### Crédit immobilier

Service de crédit interne (pas un partenariat bancaire externe), accessible depuis `/dashboard/client` :

- Le client simule un prêt (`GET /api/loans/quote`) puis dépose une demande (`POST /api/loans`) : objet, devise (USD/CDF), montant, durée en mois. L'échéancier est calculé immédiatement par amortissement à mensualité constante (taux `LOAN_ANNUAL_INTEREST_RATE`, défaut 12%/an).
- Plafonds configurables : `LOAN_MIN_TERM_MONTHS` (défaut 3), `LOAN_MAX_TERM_MONTHS` (défaut 60), `LOAN_MAX_PRINCIPAL_USD` (défaut 20000), `LOAN_MAX_PRINCIPAL_CDF`.
- Un `admin` approuve ou refuse la demande depuis `/dashboard/admin` (ou `POST /api/admin/loans/<id>/decide`). L'approbation décaisse immédiatement le montant dans le porte-monnaie du client (`data/loan-store.json` + `data/wallet-store.json`).
- Le client rembourse échéance par échéance depuis son porte-monnaie (`POST /api/loans/<id>/pay`) ; le prêt passe en `paid_off` une fois la dernière échéance réglée.

Aucune vérification de solvabilité ni garantie n'est implémentée: la décision d'octroi reste entièrement manuelle (admin). Ce module traite un vrai flux d'argent interne à la plateforme — s'assurer de la conformité réglementaire (activité de crédit) avant tout usage en production réelle.

**Statuts et traçabilité** : le dossier suit désormais `submitted → under_review → approved/rejected → active → paid_off`. L'admin peut passer un dossier en analyse (`POST /api/admin/loans/<id>/review`, avec note optionnelle) avant de décider. Chaque événement du cycle de vie (soumission, analyse, décision, décaissement, paiement d'échéance, solde) est journalisé dans `loan.auditLog` (horodaté, avec l'identité de l'acteur), visible côté client (historique dépliable) et côté admin (fiche dossier).

**KYC emprunteur** : la demande capture désormais nom complet, téléphone, situation professionnelle, employeur, revenus/charges mensuels (`loan.borrower`), affichés dans la fiche admin. Aucune vérification automatique de ces données.

**Santé de remboursement** : calculée à la lecture (pas stockée) via `getRepaymentHealth()` — `à jour` / `en retard` / `impayé` selon le nombre de jours de retard sur la prochaine échéance non payée, seuil configurable via `LOAN_LATE_THRESHOLD_DAYS` (défaut 30 jours).

**Rôles crédit dédiés** : `credit-agent` (analyse les dossiers qui lui sont assignés) et `credit-committee` (décide de l'octroi/refus), en plus de `accountant`/`director`/`admin` déjà existants. Attribution via `/dashboard/admin` (section rôles plateforme). Permissions centralisées dans `lib/loanPermissions.ts`, appliquées par chaque route `/api/credit/*` (indépendantes du middleware `/api/admin/*`, qui reste réservé au rôle `admin`) :

- `GET /api/credit/loans` — tous les dossiers (admin/director/accountant/credit-committee) ou dossiers assignés (credit-agent).
- `POST /api/credit/loans/<id>/assign` — assigner un agent (admin).
- `POST /api/credit/loans/<id>/review` — mettre en analyse (admin/credit-agent/credit-committee).
- `POST /api/credit/loans/<id>/decide` — approuver/refuser (admin/credit-committee).
- `POST /api/credit/loans/<id>/collections` — enregistrer une action de recouvrement (admin/accountant/credit-agent).
- `POST/GET /api/credit/loans/<id>/documents[/<documentId>]` — upload et téléchargement de documents (propriétaire du dossier ou staff crédit), stockés sous `data/loan-documents/<loanId>/`, 5 Mo max, PDF/JPG/PNG uniquement.
- `POST /api/credit/loans/<id>/collateral` — déclarer une garantie (propriétaire ou staff crédit).
- `GET /api/credit/portfolio` — KPI agrégés (admin/director/accountant/credit-committee).

Dashboards dédiés : `/dashboard/credit-agent` (dossiers assignés + recouvrement), `/dashboard/credit-committee` (file de décision), `/dashboard/director` (portefeuille : capital décaissé/restant/impayé, taux de remboursement, répartition à jour/en retard/impayé).

**Centre de recouvrement** : pour tout dossier `en retard`/`impayé`, actions tracées dans le journal d'audit (`collection_called`, `collection_notified`, `collection_promise_to_pay`, `collection_escalated`) — disponibles depuis `/dashboard/admin` et `/dashboard/credit-agent`.

**Demande multi-étapes** : le formulaire client (`/dashboard/client`) est un assistant en 7 étapes (type de projet → emprunteur → projet immobilier → financement/simulation → documents → garanties → récapitulatif), avec checklist de documents et déclaration de garanties juste après soumission.

**Documents sur un dossier existant** : l'upload n'est plus limité au flux de création — chaque prêt listé dans "Mes prêts" (client) et dans les fiches dossier (admin, agent crédit) a sa propre section Documents (liste + ajout), via le même `POST/GET /api/credit/loans/<id>/documents[/<documentId>]` déjà en place.

**Décaissement par tranches (liaison Crédit ↔ Chantier minimale)** : à la demande, le client peut choisir "Décaissement par tranches liées à l'avancement du chantier" et définir des tranches (libellé, condition, montant — dont la somme doit égaler le montant demandé). Pas de module chantier complet construit : les tranches sont une liste embarquée sur le prêt (`loan.tranches`), pas un vrai suivi de chantier (budget/matériaux/livraisons/avancement réel). À l'approbation, aucun décaissement automatique n'a lieu pour ces prêts — chaque tranche est libérée individuellement via `POST /api/credit/loans/<id>/tranches/<trancheId>/release` (admin/comptable/comité), créditant uniquement son montant dans le porte-monnaie. Le portefeuille (`totalDisbursed`) ne compte que les tranches réellement libérées.

**Alertes IA sur le portefeuille crédit** (`/dashboard/ai`, `GET /api/credit/alerts`) : détection à base de règles explicites (pas de modèle prédictif/ML réel) sur les données réelles des prêts — taux d'impayés élevé, retard sévère individuel (>60 jours), crédit important sans garantie déclarée, concentration excessive sur un seul dossier, dossiers en analyse prolongée (>7 jours), dossiers soumis sans agent assigné. Chaque alerte inclut une action recommandée et les dossiers concernés. Accessible aux rôles ayant `canViewPortfolio` (admin/director/accountant/credit-committee) ainsi qu'au rôle `ai`.

**Écarts encore ouverts** : un vrai module chantier (projets, budget, matériaux, livraisons, avancement réel) reste à construire si l'on veut que la libération de tranche soit conditionnée à un avancement vérifié plutôt qu'à une décision manuelle ; les alertes restent des règles à seuils fixes, pas un modèle qui apprend des données.

Attribution d'un rôle à un utilisateur :

- Se connecter en tant qu'admin sur `/dashboard/admin`.
- Section "Attribution des rôles plateforme" : saisir l'email (ou l'identifiant `phone:+243...`) et choisir le rôle, puis "Assigner".
- API équivalente : `GET/POST /api/admin/roles` (protégée comme le reste de `/api/admin/*`).

### Protection de /admin et des routes /api/admin/*

Ces pages exposent les statistiques, paiements et la gestion des utilisateurs internes: elles sont protégées par `middleware.ts`.

1. Se connecter au site avec Google (ou Facebook) en utilisant l'email qui doit avoir accès admin.
2. Ajouter cet email dans `.env.local`:
   - `ADMIN_EMAILS=vous@exemple.com,autre-admin@exemple.com`
3. Sans `ADMIN_EMAILS` configuré, l'accès est refusé à tout le monde (comportement sûr par défaut).
4. Un accès direct à `/admin` sans session valide redirige vers `/auth/signin`; un appel à `/api/admin/*` sans autorisation renvoie `403`.

#### Connexion admin par email + mot de passe

En plus de Google/Facebook, `/auth/signin` propose un formulaire dédié "Administrateur" (email + mot de passe), utile quand une connexion OAuth n'est pas pratique.

- Configurer dans `.env.local` :
  - `ADMIN_LOGIN_EMAIL=admin@monchantier.net`
  - `ADMIN_LOGIN_PASSWORD_HASH=<hash Argon2id>` (recommandé en production) ou `ADMIN_LOGIN_PASSWORD=<mot de passe en clair>` (dev uniquement)
  - `ADMIN_TOTP_SECRET=<secret Base32>` (MFA, obligatoire en production)
  - Ajouter aussi cet email dans `ADMIN_EMAILS` pour qu'il obtienne le rôle `admin`.
- Sans identifiants configurés, le formulaire reste affiché mais refuse toute connexion (comportement sûr par défaut).
- Le mot de passe est vérifié par Argon2id (`ADMIN_LOGIN_PASSWORD_HASH`) quand disponible, sinon comparé en clair par hash SHA-256 en temps constant (dev uniquement) ; il n'est jamais stocké ailleurs que dans `.env.local` (non versionné).
- Deux compartiments de rate limiting (par email, par IP) protègent contre le brute-force, partagés entre toutes les instances du serveur si `REDIS_URL` est configuré (repli en mémoire locale sinon).
- Si `TURNSTILE_SECRET_KEY` est configuré, un CAPTCHA Cloudflare Turnstile est aussi requis (no-op sinon).

### Confirmation manuelle de paiement (ops)

`POST /api/payments/confirm` sert à confirmer manuellement un paiement resté bloqué (ex: webhook provider manqué), en dehors de toute UI. Il est protégé par un secret dédié:

1. Définir `ADMIN_API_SECRET` dans `.env.local` (une valeur aléatoire longue).
2. Appeler la route avec l'en-tête `Authorization: Bearer <ADMIN_API_SECRET>`.
3. Sans secret configuré ou avec une valeur incorrecte, la route renvoie `401`.

### Suivi de livraison

Une livraison est créée automatiquement dès qu'un paiement est confirmé avec une adresse de livraison (`deliveryAddress` + `location` déjà capturées au checkout). Statuts : `pending → assigned → picked_up → in_transit → delivered` (ou `cancelled` à tout moment sauf depuis `delivered`), transitions validées côté serveur (`lib/deliveryStore.ts`) — impossible de sauter une étape.

- **Client** (`/dashboard/client`, section "Mes livraisons") : barre de progression + timeline, distance restante jusqu'à l'adresse calculée en direct (Haversine) dès que le livreur partage sa position.
- **Transporteur** (`/dashboard/driver`) : missions assignées + file de missions disponibles (auto-assignation), boutons pour faire avancer le statut, bouton "Partager ma position" (géolocalisation navigateur, envoi ponctuel ou suivi actif toutes les 20s pendant `picked_up`/`in_transit`).
- **Admin** (`/dashboard/admin`, section "Livraisons") : vue de toutes les livraisons, assignation manuelle d'un livreur.

Routes : `GET /api/deliveries` (vue selon le rôle), `POST /api/deliveries/<id>/assign`, `POST /api/deliveries/<id>/status`, `POST /api/deliveries/<id>/position`. La position n'est acceptée que du livreur assigné, et seulement pendant `picked_up`/`in_transit`.

Limite connue : le point de départ est toujours le dépôt de Kolwezi (`lib/drcCities.ts`) — pas de gestion de plusieurs entrepôts/fournisseurs.

### Gestion du catalogue (produits & services) et taxes

Le catalogue public (produits/services affichés sur le site) est maintenant piloté par un store persistant (`lib/productStore.ts`, `lib/serviceStore.ts`), initialisé automatiquement au premier accès à partir du catalogue statique existant (`components/monchantier/constants.ts`) — rien n'est perdu à la migration.

- **Admin** (`/dashboard/admin`, sections "Produits" et "Services") : ajouter un produit/service, modifier son prix (USD/CDF) avec sauvegarde immédiate, l'activer/désactiver (un produit désactivé disparaît du site public sans être supprimé), ou le supprimer définitivement.
- **Site public** : `Products.tsx`/`Services.tsx` chargent désormais le catalogue via `GET /api/catalog/products` et `GET /api/catalog/services` (produits/services actifs uniquement) au lieu d'une liste statique.
- Routes admin (protégées par le middleware `/api/admin/*`) : `GET/POST /api/admin/products`, `PATCH/DELETE /api/admin/products/<id>`, et l'équivalent pour `/api/admin/services`.

**Taxes (TVA à reverser)** (`/dashboard/admin`, section "Taxes") : calculée en temps réel à partir de toutes les factures confirmées (`lib/taxSummary.ts`), regroupée par devise (HT/TVA/TTC + nombre de factures), avec le détail facture par facture. Aucune donnée additionnelle à saisir — réutilise les factures déjà émises par le système de paiement.

#### Prix fixés par les partenaires (fournisseurs & techniciens)

Chaque produit/service porte un `ownerIdentity` optionnel : absent pour le catalogue MonChantier, présent (email) pour un produit/service apporté par un partenaire. Un partenaire ne peut créer et modifier que ses propres articles — vérifié côté serveur à chaque requête (`existing.ownerIdentity !== actor.identity` → `403`).

- **Fournisseur** (`/dashboard/supplier`) : publie ses propres produits et fixe leurs prix (USD/CDF), visibles immédiatement sur le catalogue public au même titre que les produits MonChantier.
- **Technicien** (`/dashboard/technician`) : publie ses propres services et fixe leurs prix (optionnels — laisser vide pour "sur devis").
- Routes dédiées (hors `/api/admin/*`, permissions vérifiées par requête via `lib/sessionIdentity.ts`) : `GET/POST /api/partner/products`, `PATCH /api/partner/products/<id>` (rôle `supplier`, propriétaire uniquement) ; mêmes routes sous `/api/partner/services` pour le rôle `technician`.
- L'admin garde une visibilité et un contrôle total sur tous les articles, y compris ceux des partenaires, via `/api/admin/products` et `/api/admin/services`.
