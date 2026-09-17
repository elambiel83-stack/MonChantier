-- Schéma PostgreSQL de MonChantier.
--
-- Remplace l'ancienne persistance en fichiers JSON (data/*.json) par une vraie
-- base de données : les fichiers JSON ne survivaient pas à un déploiement
-- serverless (filesystem éphémère/lecture seule) et divergeaient entre
-- plusieurs instances/replicas. La table kv_store ci-dessous garde
-- volontairement la même forme "un blob JSON par domaine métier" que les
-- anciens stores (voir lib/storeDb.ts), pour migrer sans réécrire toute la
-- logique métier ni les routes API — mais avec de vraies transactions et un
-- verrouillage de ligne (SELECT ... FOR UPDATE) qui fonctionne correctement
-- avec plusieurs instances du serveur.
--
-- Idempotent : à rejouer à chaque déploiement, comme backend/schema.sql dans
-- le dépôt Chantier.

CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
