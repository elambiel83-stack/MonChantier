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
    { fr: "Catégories", en: "Categories" },
    { fr: "Stocks", en: "Stock" },
    { fr: "Commandes", en: "Orders" },
    { fr: "Devis", en: "Quotes" },
    { fr: "Prix & promotions", en: "Pricing & promotions" },
    { fr: "Ventes", en: "Sales" },
    { fr: "Paiements", en: "Payments" },
    { fr: "Livraisons", en: "Deliveries" },
    { fr: "Clients", en: "Clients" },
    { fr: "Analytics", en: "Analytics" },
  ],
  driver: [
    { fr: "Mes missions", en: "My missions", anchor: "mes-missions" },
    { fr: "Carte GPS", en: "GPS map" },
    { fr: "Livraisons", en: "Deliveries" },
    { fr: "Historique", en: "History" },
    { fr: "Revenus", en: "Earnings" },
    { fr: "Véhicule", en: "Vehicle" },
    { fr: "Documents", en: "Documents" },
    { fr: "Support", en: "Support" },
  ],
  "site-manager": [
    { fr: "Mes chantiers", en: "My sites", anchor: "chantiers" },
    { fr: "Planning", en: "Schedule" },
    { fr: "Tâches", en: "Tasks", anchor: "taches" },
    { fr: "Équipe", en: "Team", anchor: "equipe" },
    { fr: "Matériaux", en: "Materials" },
    { fr: "Commandes", en: "Orders" },
    { fr: "Livraisons", en: "Deliveries" },
    { fr: "Dépenses", en: "Expenses" },
    { fr: "Incidents", en: "Incidents", anchor: "incidents" },
    { fr: "Photos", en: "Photos" },
    { fr: "Documents", en: "Documents" },
    { fr: "Rapports", en: "Reports" },
  ],
  technician: [
    { fr: "Catalogue de services", en: "Services catalog", anchor: "mes-services" },
    { fr: "Mes interventions", en: "My interventions" },
    { fr: "Missions", en: "Missions" },
    { fr: "Planning", en: "Schedule" },
    { fr: "Clients", en: "Clients" },
    { fr: "Devis", en: "Quotes" },
    { fr: "Rapports", en: "Reports" },
    { fr: "Photos", en: "Photos" },
    { fr: "Matériel", en: "Equipment" },
    { fr: "Paiements", en: "Payments" },
    { fr: "Évaluations", en: "Reviews" },
  ],
  accountant: [
    { fr: "Factures", en: "Invoices", anchor: "factures" },
    { fr: "Proformas", en: "Proformas" },
    { fr: "Paiements", en: "Payments" },
    { fr: "Dépenses", en: "Expenses", anchor: "depenses" },
    { fr: "TVA", en: "VAT", anchor: "tva" },
    { fr: "Clients", en: "Clients" },
    { fr: "Fournisseurs", en: "Suppliers" },
    { fr: "Trésorerie", en: "Treasury", anchor: "tresorerie" },
    { fr: "Rapports", en: "Reports" },
    { fr: "Export comptable", en: "Accounting export", anchor: "factures" },
  ],
  director: [
    { fr: "Vue générale", en: "Overview", anchor: "vue-generale" },
    { fr: "Finance", en: "Finance", anchor: "finance" },
    { fr: "Ventes", en: "Sales" },
    { fr: "Clients", en: "Clients" },
    { fr: "Fournisseurs", en: "Suppliers" },
    { fr: "Logistique", en: "Logistics" },
    { fr: "Chantiers", en: "Sites" },
    { fr: "Ressources humaines", en: "Human resources" },
    { fr: "Performance", en: "Performance", anchor: "performance" },
    { fr: "Analytics", en: "Analytics" },
    { fr: "Rapports", en: "Reports" },
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
    { fr: "Prédiction ruptures de stock", en: "Stock shortage prediction" },
    { fr: "Détection anomalies de prix", en: "Price anomaly detection" },
    { fr: "Prévision des ventes", en: "Sales forecast" },
    { fr: "Optimisation des itinéraires", en: "Route optimization" },
    { fr: "Détection des retards", en: "Delay detection", anchor: "alertes" },
    { fr: "Analyse de rentabilité", en: "Profitability analysis" },
    { fr: "Recommandations d'approvisionnement", en: "Procurement recommendations" },
  ],
  "credit-agent": [
    { fr: "Dossiers assignés", en: "Assigned files", anchor: "dossiers-assignes" },
    { fr: "Analyse", en: "Analysis", anchor: "dossiers-assignes" },
    { fr: "Recouvrement", en: "Collections", anchor: "dossiers-assignes" },
  ],
  "credit-committee": [
    { fr: "Dossiers à décider", en: "Files to decide", anchor: "dossiers-a-decider" },
    { fr: "Historique des décisions", en: "Decision history" },
  ],
};

export function roleDashboardPath(role: AppRole): string {
  return `/dashboard/${role}`;
}
