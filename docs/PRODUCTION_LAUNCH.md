# Mise en production Web — 27 septembre 2026

## Périmètre autorisé

- catalogue, recherche et panier ;
- commande via WhatsApp ;
- partage Facebook et copie de lien TikTok ;
- comptes, dashboards et administration du catalogue ;
- PostgreSQL et suivi de livraison par statuts.

Les paiements carte, PayPal et Mobile Money restent désactivés jusqu'à validation séparée d'une transaction réelle, du webhook signé, de l'idempotence et du rapprochement.

## Ordre de fusion

1. PR #2 — sécurité et architecture ;
2. PR #3 — Social Commerce ;
3. PR #4 — garde-fous du lancement ;
4. PR de préparation de la préproduction.

Ne pas fusionner avant d'avoir confirmé si `main` déclenche automatiquement un déploiement.

## Préproduction

1. Créer PostgreSQL et conserver `DATABASE_URL` dans les secrets de l'hébergeur.
2. Exécuter `npm run db:migrate`.
3. Configurer l'ensemble des variables sans les copier dans GitHub ou dans un ticket.
4. Exécuter `npm run prod:check` dans l'environnement de préproduction.
5. Déployer la branche de release puis vérifier `/`, `/auth/signin`, `/api/catalog/products` et `/api/payments/availability`.
6. Confirmer que toutes les méthodes retournées par `methods` valent `false`.

## Tests Go/No-Go

- catalogue visible sur ordinateur et Android ;
- recherche et panier fonctionnels ;
- message WhatsApp contenant produits, quantités et total ;
- partage Facebook et copie TikTok ;
- connexion administrateur avec MFA ;
- séparation des rôles client, fournisseur, chauffeur et administrateur ;
- création et progression d'une livraison de test par statuts ;
- route `/api/admin/generate-demo` inaccessible en production ;
- sauvegarde PostgreSQL réalisée et restauration vérifiée ;
- version ou commit précédent identifié pour le rollback.

Tout échec sur PostgreSQL, authentification, rôles, commande WhatsApp, sauvegarde ou rollback impose un NO-GO.
