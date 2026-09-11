export const APP_ROLES = [
  "client",
  "supplier",
  "driver",
  "site-manager",
  "technician",
  "accountant",
  "director",
  "admin",
  "ai",
  "credit-agent",
  "credit-committee",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const DEFAULT_ROLE: AppRole = "client";

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<AppRole, { fr: string; en: string }> = {
  client: { fr: "Client", en: "Client" },
  supplier: { fr: "Fournisseur", en: "Supplier" },
  driver: { fr: "Transporteur / Livreur", en: "Driver" },
  "site-manager": { fr: "Chef de chantier", en: "Site manager" },
  technician: { fr: "Technicien / Professionnel", en: "Technician" },
  accountant: { fr: "Comptable", en: "Accountant" },
  director: { fr: "Directeur", en: "Director" },
  admin: { fr: "Administrateur", en: "Administrator" },
  ai: { fr: "IA / Centre de contrôle", en: "AI / Control Center" },
  "credit-agent": { fr: "Agent crédit", en: "Credit agent" },
  "credit-committee": { fr: "Comité de crédit", en: "Credit committee" },
};

export const ROLE_OBJECTIVES: Record<AppRole, { fr: string; en: string }> = {
  client: {
    fr: "Acheter, suivre et gérer ses projets.",
    en: "Buy, track and manage your projects.",
  },
  supplier: {
    fr: "Gérer ses produits, stocks, commandes et ventes.",
    en: "Manage products, stock, orders and sales.",
  },
  driver: {
    fr: "Accepter et exécuter les missions de livraison.",
    en: "Accept and carry out delivery missions.",
  },
  "site-manager": {
    fr: "Piloter l'exécution du chantier.",
    en: "Manage on-site execution.",
  },
  technician: {
    fr: "Gérer ses interventions et missions.",
    en: "Manage interventions and missions.",
  },
  accountant: {
    fr: "Contrôler les flux financiers.",
    en: "Control financial flows.",
  },
  director: {
    fr: "Piloter la stratégie et la performance globale.",
    en: "Drive strategy and overall performance.",
  },
  admin: {
    fr: "Contrôler l'ensemble de la plateforme.",
    en: "Control the whole platform.",
  },
  ai: {
    fr: "Analyser les données des autres dashboards pour générer alertes et recommandations.",
    en: "Analyze data from other dashboards to generate alerts and recommendations.",
  },
  "credit-agent": {
    fr: "Analyser les dossiers de crédit qui lui sont assignés.",
    en: "Analyze credit files assigned to them.",
  },
  "credit-committee": {
    fr: "Décider de l'octroi ou du refus des crédits soumis.",
    en: "Decide on granting or rejecting submitted loans.",
  },
};

export type RoleMenuItem = { fr: string; en: string; anchor?: string };

export const ROLE_MENUS: Record<AppRole, RoleMenuItem[]> = {
  client: [
    { fr: "Mes commandes", en: "My orders", anchor: "commandes" },
    { fr: "Mes devis", en: "My quotes", anchor: "devis" },
    { fr: "Mes factures", en: "My invoices", anchor: "factures" },
    { fr: "Mes paiements", en: "My payments", anchor: "paiements" },
    { fr: "Mes livraisons", en: "My deliveries", anchor: "livraisons" },
    { fr: "Mon porte-monnaie", en: "My wallet", anchor: "porte-monnaie" },
    { fr: "Mon crédit", en: "My loan", anchor: "credit" },
    { fr: "Favoris", en: "Favorites", anchor: "favoris" },
    { fr: "Mes adresses", en: "My addresses", anchor: "adresses" },
    { fr: "Mes projets", en: "My projects", anchor: "projets" },
    { fr: "Support", en: "Support", anchor: "support" },
  ],
  supplier: [
    { fr: "Produits", en: "Products", anchor: "produits" },
    { fr: "Catégories", en: "Categories", anchor: "categories" },
    { fr: "Stocks", en: "Stock", anchor: "stocks" },
    { fr: "Commandes", en: "Orders", anchor: "commandes" },
    { fr: "Devis", en: "Quotes", anchor: "devis" },
    { fr: "Prix & promotions", en: "Pricing & promotions", anchor: "prix-promotions" },
    { fr: "Ventes", en: "Sales", anchor: "ventes" },
    { fr: "Paiements", en: "Payments", anchor: "paiements" },
    { fr: "Livraisons", en: "Deliveries", anchor: "livraisons" },
    { fr: "Clients", en: "Clients", anchor: "clients" },
    { fr: "Analytics", en: "Analytics", anchor: "analytics" },
  ],
  driver: [
    { fr: "Mes missions", en: "My missions", anchor: "mes-missions" },
    { fr: "Carte GPS", en: "GPS map", anchor: "carte-gps" },
    { fr: "Livraisons", en: "Deliveries", anchor: "livraisons" },
    { fr: "Historique", en: "History", anchor: "historique" },
    { fr: "Revenus", en: "Earnings", anchor: "revenus" },
    { fr: "Véhicule", en: "Vehicle", anchor: "vehicule" },
    { fr: "Documents", en: "Documents", anchor: "documents" },
    { fr: "Support", en: "Support", anchor: "support" },
  ],
  "site-manager": [
    { fr: "Mes chantiers", en: "My sites", anchor: "chantiers" },
    { fr: "Planning", en: "Schedule", anchor: "planning" },
    { fr: "Tâches", en: "Tasks", anchor: "taches" },
    { fr: "Équipe", en: "Team", anchor: "equipe" },
    { fr: "Matériaux", en: "Materials", anchor: "materiaux" },
    { fr: "Commandes", en: "Orders", anchor: "commandes" },
    { fr: "Livraisons", en: "Deliveries", anchor: "livraisons" },
    { fr: "Dépenses", en: "Expenses", anchor: "depenses" },
    { fr: "Incidents", en: "Incidents", anchor: "incidents" },
    { fr: "Photos", en: "Photos", anchor: "photos" },
    { fr: "Documents", en: "Documents", anchor: "documents" },
    { fr: "Rapports", en: "Reports", anchor: "rapports" },
  ],
  technician: [
    { fr: "Catalogue de services", en: "Services catalog", anchor: "mes-services" },
    { fr: "Mes interventions", en: "My interventions", anchor: "interventions" },
    { fr: "Missions", en: "Missions", anchor: "missions" },
    { fr: "Planning", en: "Schedule", anchor: "planning" },
    { fr: "Clients", en: "Clients", anchor: "clients" },
    { fr: "Devis", en: "Quotes", anchor: "devis" },
    { fr: "Rapports", en: "Reports", anchor: "rapports" },
    { fr: "Photos", en: "Photos", anchor: "photos" },
    { fr: "Matériel", en: "Equipment", anchor: "materiel" },
    { fr: "Paiements", en: "Payments", anchor: "paiements" },
    { fr: "Évaluations", en: "Reviews", anchor: "evaluations" },
  ],
  accountant: [
    { fr: "Factures", en: "Invoices", anchor: "factures" },
    { fr: "Proformas", en: "Proformas", anchor: "proformas" },
    { fr: "Paiements", en: "Payments", anchor: "paiements" },
    { fr: "Dépenses", en: "Expenses", anchor: "depenses" },
    { fr: "TVA", en: "VAT", anchor: "tva" },
    { fr: "Clients", en: "Clients", anchor: "clients" },
    { fr: "Fournisseurs", en: "Suppliers", anchor: "fournisseurs" },
    { fr: "Trésorerie", en: "Treasury", anchor: "tresorerie" },
    { fr: "Rapports", en: "Reports", anchor: "rapports" },
    { fr: "Export comptable", en: "Accounting export", anchor: "factures" },
  ],
  director: [
    { fr: "Vue générale", en: "Overview", anchor: "vue-generale" },
    { fr: "Finance", en: "Finance", anchor: "finance" },
    { fr: "Ventes", en: "Sales", anchor: "ventes" },
    { fr: "Clients", en: "Clients", anchor: "clients" },
    { fr: "Fournisseurs", en: "Suppliers", anchor: "fournisseurs" },
    { fr: "Logistique", en: "Logistics", anchor: "logistique" },
    { fr: "Chantiers", en: "Sites", anchor: "chantiers" },
    { fr: "Ressources humaines", en: "Human resources", anchor: "ressources-humaines" },
    { fr: "Performance", en: "Performance", anchor: "performance" },
    { fr: "Analytics", en: "Analytics", anchor: "analytics" },
    { fr: "Rapports", en: "Reports", anchor: "rapports" },
  ],
  admin: [
    { fr: "Utilisateurs", en: "Users", anchor: "utilisateurs" },
    { fr: "Clients", en: "Clients" },
    { fr: "Fournisseurs", en: "Suppliers" },
    { fr: "Transporteurs", en: "Drivers" },
    { fr: "Professionnels", en: "Professionals" },
    { fr: "Produits", en: "Products", anchor: "produits" },
    { fr: "Commandes", en: "Orders", anchor: "commandes" },
    { fr: "Paiements", en: "Payments", anchor: "paiements" },
    { fr: "Livraisons", en: "Deliveries", anchor: "livraisons" },
    { fr: "Chantiers", en: "Sites" },
    { fr: "Promotions", en: "Promotions" },
    { fr: "Support", en: "Support" },
    { fr: "Sécurité", en: "Security" },
    { fr: "Logs", en: "Logs" },
    { fr: "Configuration", en: "Configuration" },
    { fr: "Analytics", en: "Analytics" },
  ],
  ai: [
    { fr: "Alertes", en: "Alerts", anchor: "alertes" },
    { fr: "Prédiction ruptures de stock", en: "Stock shortage prediction", anchor: "ruptures-stock" },
    { fr: "Détection anomalies de prix", en: "Price anomaly detection", anchor: "anomalies-prix" },
    { fr: "Prévision des ventes", en: "Sales forecast", anchor: "prevision-ventes" },
    { fr: "Optimisation des itinéraires", en: "Route optimization", anchor: "itineraires" },
    { fr: "Détection des retards", en: "Delay detection", anchor: "retards" },
    { fr: "Analyse de rentabilité", en: "Profitability analysis", anchor: "rentabilite" },
    { fr: "Recommandations d'approvisionnement", en: "Procurement recommendations", anchor: "approvisionnement" },
  ],
  "credit-agent": [
    { fr: "Dossiers assignés", en: "Assigned files", anchor: "dossiers-assignes" },
    { fr: "Analyse", en: "Analysis", anchor: "dossiers-assignes" },
    { fr: "Recouvrement", en: "Collections", anchor: "dossiers-assignes" },
  ],
  "credit-committee": [
    { fr: "Dossiers à décider", en: "Files to decide", anchor: "dossiers-a-decider" },
    { fr: "Historique des décisions", en: "Decision history", anchor: "historique-decisions" },
  ],
};

export function roleDashboardPath(role: AppRole): string {
  return `/dashboard/${role}`;
}
