# MonChantier SaaS V2 — architecture séparée

Cette version ne remplace pas l'application historique. Elle utilise le schéma PostgreSQL `saas` et impose `tenant_id` sur toutes les données métier critiques.

## Règles obligatoires

1. Une route SaaS obtient l'identité, le tenant et le rôle depuis la session vérifiée.
2. Toute requête métier passe par `withTenantTransaction()`.
3. La transaction fixe `app.tenant_id`; PostgreSQL RLS bloque ensuite toute lecture ou écriture d'un autre tenant.
4. Aucun `tenant_id` fourni par le navigateur n'est accepté comme autorité.
5. Les montants sont stockés en unités monétaires mineures entières.
6. Les paramètres extensibles vont dans `settings`/`metadata` JSONB; les relations, états financiers et droits restent relationnels.
7. Les opérations financières sont idempotentes et journalisées dans `audit_events`.

## Domaines couverts

Tenants, adhésions et rôles, clients, produits, services, commandes, lignes de commande, paiements, factures, chantiers, tâches, incidents, livraisons, dépenses, wallets, écritures wallet, crédits, support et audit.

## Déploiement

Exécuter `psql "$DATABASE_URL" -f db/saas-schema.sql` avec un rôle propriétaire, puis utiliser un rôle applicatif non-superuser et non-propriétaire afin que `FORCE ROW LEVEL SECURITY` soit effectif. La version SaaS doit avoir ses propres URLs (`/saas`, `/api/saas`) et ses propres variables d'environnement. Aucun basculement automatique des données historiques n'est effectué.

## Critères avant production

- tests croisés tenant A/B pour chaque domaine;
- tests de rôle par action;
- webhooks et idempotence des paiements;
- rapprochement facture/paiement/commande;
- concurrence wallet, stock et numérotation;
- sauvegarde/restauration et suspension tenant;
- audit des opérations administratives et financières.
