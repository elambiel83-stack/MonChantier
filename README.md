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
