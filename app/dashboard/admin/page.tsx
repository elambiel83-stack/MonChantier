"use client";

import { Fragment, useEffect, useState } from 'react';
import { APP_ROLES, AppRole, ROLE_LABELS } from '@/lib/roles';

type PlatformRoleAssignment = {
  identity: string;
  role: AppRole;
};

type StoredProduct = {
  id: number;
  fr: string;
  en: string;
  unitFr: string;
  unitEn: string;
  priceUSD: number | null;
  priceCDF: number | null;
  img: string;
  active: boolean;
};

type StoredService = {
  id: number;
  icon: string;
  fr: string;
  en: string;
  frDesc: string;
  enDesc: string;
  img: string;
  priceUSD: number | null;
  priceCDF: number | null;
  active: boolean;
};

type PromotionTargetType = 'product' | 'service';

type StoredPromotion = {
  id: number;
  itemType: PromotionTargetType;
  itemId: number;
  label: string;
  discountPercent: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled';

type StoredOrder = {
  reference: string;
  method: 'mobilemoney' | 'card' | 'paypal';
  updatedAt: string;
  orderStatus?: OrderStatus;
  cancelReason?: string;
  invoice?: {
    totals?: { ht: number; tva: number; ttc: number; currency: string };
  };
  fullInvoice?: {
    customerName?: string;
    customerEmail?: string;
  };
};

const ORDER_STATUS_LABELS: Record<OrderStatus, { fr: string; en: string }> = {
  processing: { fr: 'En préparation', en: 'Processing' },
  shipped: { fr: 'Expédiée', en: 'Shipped' },
  delivered: { fr: 'Livrée', en: 'Delivered' },
  cancelled: { fr: 'Annulée', en: 'Cancelled' },
};

const ORDER_STATUS_NEXT: Record<OrderStatus, OrderStatus[]> = {
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

type TaxTotals = { ht: number; tva: number; ttc: number; count: number };

type TaxSummary = {
  vatRate: number | null;
  totalsByCurrency: Record<string, TaxTotals>;
  invoices: Array<{
    reference: string;
    invoiceNumber: string;
    method: string;
    currency: string;
    ht: number;
    tva: number;
    ttc: number;
    updatedAt: string;
  }>;
};

type LoanInstallment = {
  index: number;
  dueDate: string;
  amount: number;
  paid: boolean;
};

type DeliveryStatus = 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

type Delivery = {
  id: string;
  reference: string;
  clientName: string;
  driverIdentity?: string;
  status: DeliveryStatus;
  deliveryAddress: string;
};

type SiteStatus = 'planning' | 'active' | 'paused' | 'completed';

type Site = {
  id: string;
  name: string;
  address: string;
  siteManagerIdentity: string;
  clientIdentity?: string;
  status: SiteStatus;
  budget?: number;
  currency?: 'USD' | 'CDF';
  tasks: Array<{ id: string; done: boolean }>;
  incidents: Array<{ id: string; resolved: boolean }>;
  team: Array<{ identity: string }>;
  updatedAt: string;
};

type LoanBorrower = {
  fullName: string;
  phone: string;
  monthlyIncome?: number;
  monthlyCharges?: number;
  employmentStatus?: string;
  employer?: string;
};

type LoanAuditEntry = {
  id: string;
  at: string;
  by: string;
  action: string;
  note?: string;
};

type LoanStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'active' | 'paid_off';
type RepaymentHealth = 'on_track' | 'late' | 'defaulted' | 'n_a';

type Loan = {
  id: string;
  identity: string;
  borrower: LoanBorrower;
  purpose: string;
  currency: 'USD' | 'CDF';
  principal: number;
  annualInterestRate: number;
  termMonths: number;
  monthlyPayment: number;
  status: LoanStatus;
  repaymentHealth: RepaymentHealth;
  createdAt: string;
  rejectionReason?: string;
  assignedAgentIdentity?: string;
  installments: LoanInstallment[];
  auditLog: LoanAuditEntry[];
  documents: { id: string; category: string; fileName: string; uploadedAt: string }[];
  disbursementMode: 'lump_sum' | 'tranches';
  tranches?: { id: string; label: string; condition: string; amount: number; status: 'pending' | 'released' }[];
};

type AdminEvent = {
  id: string;
  kind: 'contact' | 'partner' | 'payment' | 'user';
  label: string;
  labelFr?: string;
  labelEn?: string;
  details?: string;
  detailsFr?: string;
  detailsEn?: string;
  method?: 'mobilemoney' | 'card' | 'paypal';
  amount?: number;
  currency?: string;
  createdAt: string;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  active: boolean;
  createdAt: string;
};

type AdminStats = {
  summary: {
    contacts: number;
    partners: number;
    payments: number;
    users: number;
    activeUsers: number;
    mobileMoneyPayments: number;
    cardPayments: number;
    paypalPayments: number;
  };
  recent: AdminEvent[];
  generatedAt: string;
};

type SecurityEventRow = {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  identity?: string;
  ip?: string;
  detail?: string;
  createdAt: string;
};

type SecurityRateLimitBucket = {
  key: string;
  count: number;
  max: number;
  remaining: number;
  retryAfterMs: number;
  allowed: boolean;
};

type SecurityRoleAuditEntry = {
  at: string;
  actor: string;
  identity: string;
  action: string;
  role?: AppRole;
};

type AdminSecuritySummary = {
  summary: {
    inactiveUsers: number;
    inactiveAssignments: number;
    privilegedAssignments: number;
    throttledSources: number;
    alerts24h: number;
  };
  authActivity: {
    otpRequested24h: number;
    otpFailures24h: number;
    adminFailures24h: number;
    adminSuccess24h: number;
  };
  throttledBuckets: SecurityRateLimitBucket[];
  recentEvents: SecurityEventRow[];
  recentRoleAudit: SecurityRoleAuditEntry[];
};

const defaultStats: AdminStats = {
  summary: {
    contacts: 0,
    partners: 0,
    payments: 0,
    users: 0,
    activeUsers: 0,
    mobileMoneyPayments: 0,
    cardPayments: 0,
    paypalPayments: 0,
  },
  recent: [],
  generatedAt: '',
};

export default function AdminPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [stats, setStats] = useState<AdminStats>(defaultStats);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [usersApiOnline, setUsersApiOnline] = useState<boolean | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('client');
  const [platformRoles, setPlatformRoles] = useState<PlatformRoleAssignment[]>([]);
  const [roleIdentity, setRoleIdentity] = useState('');
  const [roleToAssign, setRoleToAssign] = useState<AppRole>('client');
  const [savingRole, setSavingRole] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [decidingLoanId, setDecidingLoanId] = useState<string | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [agentAssignInput, setAgentAssignInput] = useState<Record<string, string>>({});
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [busyDeliveryId, setBusyDeliveryId] = useState<string | null>(null);
  const [driverAssignInput, setDriverAssignInput] = useState<Record<string, string>>({});
  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [productEdits, setProductEdits] = useState<Record<number, { priceUSD: string; priceCDF: string }>>({});
  const [busyProductId, setBusyProductId] = useState<number | null>(null);
  const [newProduct, setNewProduct] = useState({
    fr: '',
    en: '',
    unitFr: 'unité',
    unitEn: 'unit',
    priceUSD: '',
    priceCDF: '',
    img: '/images/produits/briques.svg',
  });
  const [savingProduct, setSavingProduct] = useState(false);

  const [services, setServices] = useState<StoredService[]>([]);
  const [serviceEdits, setServiceEdits] = useState<Record<number, { priceUSD: string; priceCDF: string }>>({});
  const [busyServiceId, setBusyServiceId] = useState<number | null>(null);
  const [newService, setNewService] = useState({
    icon: '🔧',
    fr: '',
    en: '',
    frDesc: '',
    enDesc: '',
    img: '/images/services/autres-services.svg',
    priceUSD: '',
    priceCDF: '',
  });
  const [savingService, setSavingService] = useState(false);
  const [promotions, setPromotions] = useState<StoredPromotion[]>([]);
  const [busyPromotionId, setBusyPromotionId] = useState<number | null>(null);
  const [savingPromotion, setSavingPromotion] = useState(false);
  const [newPromotion, setNewPromotion] = useState({
    itemType: 'product' as PromotionTargetType,
    itemId: '',
    label: '',
    discountPercent: '',
    startsAt: '',
    endsAt: '',
  });

  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);

  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [busyOrderRef, setBusyOrderRef] = useState<string | null>(null);
  const [securitySummary, setSecuritySummary] = useState<AdminSecuritySummary | null>(null);
  const [securityApiOnline, setSecurityApiOnline] = useState<boolean | null>(null);

  const t = (fr: string, en: string) => (lang === 'fr' ? fr : en);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString(locale);
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Impossible de charger les utilisateurs');
      }
      const data = (await response.json()) as { users?: AdminUser[] };
      setUsers(Array.isArray(data.users) ? data.users : []);
      setUsersApiOnline(true);
    } catch {
      setUsers([]);
      setUsersApiOnline(false);
    }
  };

  const loadLoans = async () => {
    try {
      const response = await fetch('/api/credit/loans', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les prêts');
      const data = (await response.json()) as { loans?: Loan[] };
      setLoans(Array.isArray(data.loans) ? data.loans : []);
    } catch {
      setLoans([]);
    }
  };

  const assignAgentToLoan = async (loanId: string) => {
    const agentIdentity = (agentAssignInput[loanId] || '').trim();
    if (!agentIdentity) return;
    try {
      setDecidingLoanId(loanId);
      const response = await fetch(`/api/credit/loans/${loanId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentIdentity }),
      });
      if (!response.ok) throw new Error('Erreur assignation');
      setAgentAssignInput((prev) => ({ ...prev, [loanId]: '' }));
      await loadLoans();
    } finally {
      setDecidingLoanId(null);
    }
  };

  const loadDeliveries = async () => {
    try {
      const response = await fetch('/api/deliveries', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les livraisons');
      const data = (await response.json()) as { deliveries?: Delivery[] };
      setDeliveries(Array.isArray(data.deliveries) ? data.deliveries : []);
    } catch {
      setDeliveries([]);
    }
  };

  const loadSites = async () => {
    try {
      const response = await fetch('/api/sites', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les chantiers');
      const data = (await response.json()) as { sites?: Site[] };
      setSites(Array.isArray(data.sites) ? data.sites : []);
    } catch {
      setSites([]);
    }
  };

  const assignDriverToDelivery = async (deliveryId: string) => {
    const driverIdentity = (driverAssignInput[deliveryId] || '').trim();
    if (!driverIdentity) return;
    try {
      setBusyDeliveryId(deliveryId);
      const response = await fetch(`/api/deliveries/${deliveryId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverIdentity }),
      });
      if (!response.ok) throw new Error('Erreur assignation livreur');
      setDriverAssignInput((prev) => ({ ...prev, [deliveryId]: '' }));
      await loadDeliveries();
    } finally {
      setBusyDeliveryId(null);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/admin/products', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les produits');
      const data = (await response.json()) as { products?: StoredProduct[] };
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch {
      setProducts([]);
    }
  };

  const createProduct = async () => {
    if (!newProduct.fr.trim() || !newProduct.unitFr.trim()) return;
    try {
      setSavingProduct(true);
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });
      if (!response.ok) throw new Error('Erreur création produit');
      setNewProduct({ fr: '', en: '', unitFr: 'unité', unitEn: 'unit', priceUSD: '', priceCDF: '', img: '/images/produits/briques.svg' });
      await loadProducts();
    } finally {
      setSavingProduct(false);
    }
  };

  const saveProductPrice = async (id: number) => {
    const edit = productEdits[id];
    if (!edit) return;
    try {
      setBusyProductId(id);
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceUSD: edit.priceUSD === '' ? null : edit.priceUSD,
          priceCDF: edit.priceCDF === '' ? null : edit.priceCDF,
        }),
      });
      if (!response.ok) throw new Error('Erreur mise à jour prix');
      setProductEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadProducts();
    } finally {
      setBusyProductId(null);
    }
  };

  const toggleProductActive = async (product: StoredProduct) => {
    try {
      setBusyProductId(product.id);
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      });
      if (!response.ok) throw new Error('Erreur mise à jour produit');
      await loadProducts();
    } finally {
      setBusyProductId(null);
    }
  };

  const removeProduct = async (id: number) => {
    try {
      setBusyProductId(id);
      const response = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erreur suppression produit');
      await loadProducts();
    } finally {
      setBusyProductId(null);
    }
  };

  const loadServices = async () => {
    try {
      const response = await fetch('/api/admin/services', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les services');
      const data = (await response.json()) as { services?: StoredService[] };
      setServices(Array.isArray(data.services) ? data.services : []);
    } catch {
      setServices([]);
    }
  };

  const createService = async () => {
    if (!newService.fr.trim() || !newService.frDesc.trim()) return;
    try {
      setSavingService(true);
      const response = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService),
      });
      if (!response.ok) throw new Error('Erreur création service');
      setNewService({
        icon: '🔧',
        fr: '',
        en: '',
        frDesc: '',
        enDesc: '',
        img: '/images/services/autres-services.svg',
        priceUSD: '',
        priceCDF: '',
      });
      await loadServices();
    } finally {
      setSavingService(false);
    }
  };

  const saveServicePrice = async (id: number) => {
    const edit = serviceEdits[id];
    if (!edit) return;
    try {
      setBusyServiceId(id);
      const response = await fetch(`/api/admin/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceUSD: edit.priceUSD === '' ? null : edit.priceUSD,
          priceCDF: edit.priceCDF === '' ? null : edit.priceCDF,
        }),
      });
      if (!response.ok) throw new Error('Erreur mise à jour prix');
      setServiceEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadServices();
    } finally {
      setBusyServiceId(null);
    }
  };

  const toggleServiceActive = async (service: StoredService) => {
    try {
      setBusyServiceId(service.id);
      const response = await fetch(`/api/admin/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !service.active }),
      });
      if (!response.ok) throw new Error('Erreur mise à jour service');
      await loadServices();
    } finally {
      setBusyServiceId(null);
    }
  };

  const removeService = async (id: number) => {
    try {
      setBusyServiceId(id);
      const response = await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erreur suppression service');
      await loadServices();
    } finally {
      setBusyServiceId(null);
    }
  };

  const loadTaxes = async () => {
    try {
      const response = await fetch('/api/admin/taxes', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les taxes');
      const data = (await response.json()) as TaxSummary;
      setTaxSummary(data);
    } catch {
      setTaxSummary(null);
    }
  };

  const loadPromotions = async () => {
    try {
      const response = await fetch('/api/admin/promotions', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les promotions');
      const data = (await response.json()) as { promotions?: StoredPromotion[] };
      setPromotions(Array.isArray(data.promotions) ? data.promotions : []);
    } catch {
      setPromotions([]);
    }
  };

  const createPromotion = async () => {
    if (!newPromotion.itemId || !newPromotion.label.trim() || !newPromotion.discountPercent) return;
    try {
      setSavingPromotion(true);
      const response = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: newPromotion.itemType,
          itemId: Number(newPromotion.itemId),
          label: newPromotion.label.trim(),
          discountPercent: Number(newPromotion.discountPercent),
          startsAt: newPromotion.startsAt || null,
          endsAt: newPromotion.endsAt || null,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Erreur création promotion');
      }
      setNewPromotion({
        itemType: 'product',
        itemId: '',
        label: '',
        discountPercent: '',
        startsAt: '',
        endsAt: '',
      });
      await loadPromotions();
    } finally {
      setSavingPromotion(false);
    }
  };

  const togglePromotionActive = async (promotion: StoredPromotion) => {
    try {
      setBusyPromotionId(promotion.id);
      const response = await fetch(`/api/admin/promotions/${promotion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !promotion.active }),
      });
      if (!response.ok) throw new Error('Erreur mise à jour promotion');
      await loadPromotions();
    } finally {
      setBusyPromotionId(null);
    }
  };

  const removePromotion = async (id: number) => {
    try {
      setBusyPromotionId(id);
      const response = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erreur suppression promotion');
      await loadPromotions();
    } finally {
      setBusyPromotionId(null);
    }
  };

  const loadSecurity = async () => {
    try {
      const response = await fetch('/api/admin/security', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger la sécurité');
      const data = (await response.json()) as AdminSecuritySummary;
      setSecuritySummary(data);
      setSecurityApiOnline(true);
    } catch {
      setSecuritySummary(null);
      setSecurityApiOnline(false);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/admin/orders', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les commandes');
      const data = (await response.json()) as { orders?: StoredOrder[] };
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setOrders([]);
    }
  };

  const changeOrderStatus = async (reference: string, orderStatus: OrderStatus) => {
    if (orderStatus === 'cancelled') {
      const confirmed = window.confirm(
        t('Confirmer l\'annulation de cette commande ?', 'Confirm cancellation of this order?')
      );
      if (!confirmed) return;
    }
    try {
      setBusyOrderRef(reference);
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(reference)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Erreur mise à jour commande');
      }
      await loadOrders();
    } finally {
      setBusyOrderRef(null);
    }
  };

  const loadPlatformRoles = async () => {
    try {
      const response = await fetch('/api/admin/roles', { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les rôles');
      const data = (await response.json()) as { roles?: PlatformRoleAssignment[] };
      setPlatformRoles(Array.isArray(data.roles) ? data.roles : []);
    } catch {
      setPlatformRoles([]);
    }
  };

  const assignPlatformRole = async () => {
    if (!roleIdentity.trim()) return;
    try {
      setSavingRole(true);
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: roleIdentity.trim(), role: roleToAssign }),
      });
      if (!response.ok) throw new Error('Erreur assignation rôle');
      setRoleIdentity('');
      await loadPlatformRoles();
    } finally {
      setSavingRole(false);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const response = await fetch('/api/admin/stats', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Impossible de charger les statistiques admin');
      }
      const data = (await response.json()) as Partial<AdminStats>;
      setStats({
        summary: {
          contacts: Number(data?.summary?.contacts ?? 0),
          partners: Number(data?.summary?.partners ?? 0),
          payments: Number(data?.summary?.payments ?? 0),
          users: Number(data?.summary?.users ?? 0),
          activeUsers: Number(data?.summary?.activeUsers ?? 0),
          mobileMoneyPayments: Number(data?.summary?.mobileMoneyPayments ?? 0),
          cardPayments: Number(data?.summary?.cardPayments ?? 0),
          paypalPayments: Number(data?.summary?.paypalPayments ?? 0),
        },
        recent: Array.isArray(data?.recent) ? data.recent : [],
        generatedAt: data?.generatedAt || new Date().toISOString(),
      });
      setApiOnline(true);
    } catch {
      setErrorMessage('Impossible de charger les statistiques pour le moment.');
      setStats(defaultStats);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await Promise.all([
        loadStats(),
        loadUsers(),
        loadPlatformRoles(),
        loadLoans(),
        loadDeliveries(),
        loadSites(),
        loadProducts(),
        loadServices(),
        loadPromotions(),
        loadSecurity(),
        loadTaxes(),
        loadOrders(),
      ]);
    })();
  }, []);

  const generateDemoPayments = async () => {
    try {
      setGenerating(true);
      const response = await fetch('/api/admin/generate-demo', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Erreur génération démo');
      }
      await loadStats();
    } finally {
      setGenerating(false);
    }
  };

  const cards = [
    { title: t('Paiements', 'Payments'), value: stats.summary.payments },
    { title: t('Partenaires', 'Partners'), value: stats.summary.partners },
    { title: t('Messages', 'Messages'), value: stats.summary.contacts },
    {
      title: t('Utilisateurs actifs / total', 'Active users / total'),
      value: `${stats.summary.activeUsers} / ${stats.summary.users}`,
    },
  ];

  const paymentRows = stats.recent.filter((event) => event.kind === 'payment');
  const roleAssignmentsByRole = APP_ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role][lang],
    count: platformRoles.filter((assignment) => assignment.role === role).length,
  }));
  const adminUsersByRole = APP_ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role][lang],
    count: users.filter((user) => user.role === role).length,
    activeCount: users.filter((user) => user.role === role && user.active).length,
  }));
  const clientUsers = adminUsersByRole.find((item) => item.role === 'client');
  const supplierUsers = adminUsersByRole.find((item) => item.role === 'supplier');
  const driverUsers = adminUsersByRole.find((item) => item.role === 'driver');
  const technicianUsers = adminUsersByRole.find((item) => item.role === 'technician');
  const siteManagerUsers = adminUsersByRole.find((item) => item.role === 'site-manager');
  const supportEvents = stats.recent.filter((event) => event.kind === 'contact');
  const partnerEvents = stats.recent.filter((event) => event.kind === 'partner');
  const activeSites = sites.filter((site) => site.status === 'active');
  const configuredProductCount = products.filter((product) => product.priceUSD !== null || product.priceCDF !== null).length;
  const configuredServiceCount = services.filter((service) => service.priceUSD !== null || service.priceCDF !== null).length;
  const isPromotionLive = (promotion: StoredPromotion) => {
    if (!promotion.active) return false;
    const now = Date.now();
    const startsAt = promotion.startsAt ? new Date(promotion.startsAt).getTime() : null;
    const endsAt = promotion.endsAt ? new Date(promotion.endsAt).getTime() : null;
    if (promotion.startsAt && startsAt !== null && Number.isNaN(startsAt)) return false;
    if (promotion.endsAt && endsAt !== null && Number.isNaN(endsAt)) return false;
    if (startsAt !== null && !Number.isNaN(startsAt) && startsAt > now) return false;
    if (endsAt !== null && !Number.isNaN(endsAt) && endsAt < now) return false;
    return true;
  };
  const livePromotions = promotions.filter(isPromotionLive);
  const promotedProductCount = new Set(
    livePromotions
      .filter((promotion) => promotion.itemType === 'product')
      .map((promotion) => promotion.itemId)
  ).size;
  const promotedServiceCount = new Set(
    livePromotions
      .filter((promotion) => promotion.itemType === 'service')
      .map((promotion) => promotion.itemId)
  ).size;
  const promotionTargets =
    newPromotion.itemType === 'product'
      ? products.map((product) => ({ id: product.id, label: product.fr }))
      : services.map((service) => ({ id: service.id, label: service.fr }));
  const getPromotionTargetLabel = (promotion: StoredPromotion) => {
    if (promotion.itemType === 'product') {
      return products.find((product) => product.id === promotion.itemId)?.fr || `Produit #${promotion.itemId}`;
    }
    return services.find((service) => service.id === promotion.itemId)?.fr || `Service #${promotion.itemId}`;
  };
  const deliveryStatusCounts = Object.entries(
    deliveries.reduce<Record<string, number>>((acc, delivery) => {
      acc[delivery.status] = (acc[delivery.status] || 0) + 1;
      return acc;
    }, {})
  );
  const orderStatusCounts = Object.entries(
    orders.reduce<Record<string, number>>((acc, order) => {
      const key = order.orderStatus || 'processing';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  );
  const loanStatusCounts = Object.entries(
    loans.reduce<Record<string, number>>((acc, loan) => {
      acc[loan.status] = (acc[loan.status] || 0) + 1;
      return acc;
    }, {})
  );
  const getEventLabel = (event: AdminEvent) => {
    if (lang === 'fr') return event.labelFr || event.label;
    return event.labelEn || event.label;
  };

  const getRoleLabel = (role?: string) => {
    if (!role) return '-';
    const roleKey = role.toLowerCase();
    if (roleKey in ROLE_LABELS) {
      return ROLE_LABELS[roleKey as AppRole][lang];
    }
    const labels = {
      fr: {
        admin: 'Administrateur',
        manager: 'Gestionnaire',
        agent: 'Agent',
      },
      en: {
        admin: 'Admin',
        manager: 'Manager',
        agent: 'Agent',
      },
    } as const;

    return labels[lang][roleKey as 'admin' | 'manager' | 'agent'] || role;
  };

  const getEventDetails = (event: AdminEvent) => {
    const details = lang === 'fr' ? event.detailsFr || event.details : event.detailsEn || event.details;
    if (!details) return details;

    if (event.kind === 'user' && details.includes('•')) {
      const [role, tail] = details.split('•').map((part) => part.trim());
      if (role && tail) {
        return `${getRoleLabel(role)} • ${tail}`;
      }
    }

    return details;
  };

  const getMethodLabel = (method?: 'mobilemoney' | 'card' | 'paypal') => {
    if (!method) return '-';
    const labels = {
      fr: {
        mobilemoney: 'Mobile Money',
        card: 'Carte bancaire',
        paypal: 'PayPal',
      },
      en: {
        mobilemoney: 'Mobile Money',
        card: 'Card',
        paypal: 'PayPal',
      },
    };

    return labels[lang][method];
  };

  const getSecurityEventLabel = (event: SecurityEventRow) => {
    const labels: Record<string, { fr: string; en: string }> = {
      otp_requested: { fr: 'OTP demandé', en: 'OTP requested' },
      otp_request_rate_limited: { fr: 'OTP limité', en: 'OTP rate-limited' },
      otp_verified: { fr: 'OTP validé', en: 'OTP verified' },
      otp_verify_failed: { fr: 'OTP refusé', en: 'OTP failed' },
      otp_verify_rate_limited: { fr: 'OTP bloqué', en: 'OTP blocked' },
      admin_login_succeeded: { fr: 'Connexion admin réussie', en: 'Admin login succeeded' },
      admin_login_failed: { fr: 'Connexion admin échouée', en: 'Admin login failed' },
      admin_login_rate_limited: { fr: 'Connexion admin bloquée', en: 'Admin login blocked' },
    };
    return labels[event.type]?.[lang] || event.type;
  };

  const getSecuritySeverityClass = (severity: SecurityEventRow['severity']) => {
    if (severity === 'critical') return 'bg-red-100 text-red-700';
    if (severity === 'warning') return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const createUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      return;
    }
    try {
      setSavingUser(true);
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          role: newUserRole,
        }),
      });
      if (!response.ok) {
        throw new Error('Erreur création utilisateur');
      }
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('client');
      await Promise.all([loadUsers(), loadStats()]);
    } finally {
      setSavingUser(false);
    }
  };

  const toggleUser = async (userId: string) => {
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
      return;
    }
    await Promise.all([loadUsers(), loadStats()]);
  };

  return (
    <div>
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('Aperçu administrateur', 'Admin overview')}</h1>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              apiOnline === null
                ? 'bg-slate-100 text-slate-600'
                : apiOnline
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {apiOnline === null
              ? t('API stats: en vérification', 'Stats API: checking')
              : apiOnline
              ? t('API stats: en ligne', 'Stats API: online')
              : t('API stats: hors ligne', 'Stats API: offline')}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              usersApiOnline === null
                ? 'bg-slate-100 text-slate-600'
                : usersApiOnline
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {usersApiOnline === null
              ? t('API utilisateurs: en vérification', 'Users API: checking')
              : usersApiOnline
              ? t('API utilisateurs: en ligne', 'Users API: online')
              : t('API utilisateurs: hors ligne', 'Users API: offline')}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang('fr')}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                lang === 'fr' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                lang === 'en' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300'
              }`}
            >
              EN
            </button>
          </div>
        </div>
        <p className="mt-2 text-slate-600">
          {t(
            'Tableau branché aux APIs de contact, partenaires et paiements.',
            'Dashboard connected to contact, partners and payments APIs.'
          )}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {t('Dernière mise à jour', 'Last update')}: {formatDate(stats.generatedAt)}
        </p>
        {errorMessage ? (
          <p className="mt-2 text-sm text-red-600">{t(errorMessage, 'Unable to load statistics right now.')}</p>
        ) : null}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{card.title}</p>
              <p className="mt-1 text-2xl font-bold">{loading ? '…' : card.value}</p>
            </div>
          ))}
        </div>

        <div id="analytics" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Analytics opérationnels', 'Operational analytics')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">{t('Paiements par canal', 'Payments by channel')}</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>Mobile Money: {stats.summary.mobileMoneyPayments}</p>
                <p>{t('Carte', 'Card')}: {stats.summary.cardPayments}</p>
                <p>PayPal: {stats.summary.paypalPayments}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">{t('Commandes et livraisons', 'Orders and deliveries')}</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {orderStatusCounts.length === 0 ? (
                  <p>{t('Aucune commande confirmée.', 'No confirmed orders.')}</p>
                ) : (
                  orderStatusCounts.map(([status, count]) => <p key={status}>{status}: {count}</p>)
                )}
                {deliveryStatusCounts.map(([status, count]) => <p key={status}>{status}: {count}</p>)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">{t('Crédits et catalogue', 'Loans and catalog')}</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {loanStatusCounts.length === 0 ? (
                  <p>{t('Aucun crédit chargé.', 'No loans loaded.')}</p>
                ) : (
                  loanStatusCounts.map(([status, count]) => <p key={status}>{status}: {count}</p>)
                )}
                <p>{t('Produits tarifés', 'Priced products')}: {configuredProductCount}/{products.length}</p>
                <p>{t('Services tarifés', 'Priced services')}: {configuredServiceCount}/{services.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t('Activité récente', 'Recent activity')}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={generateDemoPayments}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                disabled={generating}
              >
                {generating ? t('Génération…', 'Generating...') : t('Générer paiements test', 'Generate test payments')}
              </button>
              <button
                type="button"
                onClick={loadStats}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
              >
                {t('Actualiser', 'Refresh')}
              </button>
            </div>
          </div>
          <ul className="mt-4 space-y-3">
            {stats.recent.length === 0 ? (
              <li className="text-sm text-slate-500">{t('Aucune activité pour le moment.', 'No activity yet.')}</li>
            ) : (
              stats.recent.map((event) => (
                <li key={event.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium">
                    {event.kind === 'payment' && event.method
                      ? `${getEventLabel(event)} (${getMethodLabel(event.method)})`
                      : getEventLabel(event)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {getEventDetails(event) ? `${getEventDetails(event)} • ` : ''}
                    {formatDate(event.createdAt)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div id="support" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Support', 'Support')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Messages reçus', 'Messages received')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.summary.contacts}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Nouveaux partenaires', 'New partners')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.summary.partners}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Derniers tickets visibles', 'Recent visible tickets')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{supportEvents.length}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {supportEvents.length === 0 ? (
              <p className="text-sm text-slate-500">{t('Aucun message support récent.', 'No recent support messages.')}</p>
            ) : (
              supportEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <p className="font-medium text-slate-900">{getEventLabel(event)}</p>
                  <p className="mt-1 text-slate-500">{getEventDetails(event) || '—'}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div id="paiements" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Paiements récents', 'Recent payments')}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">{t('Date', 'Date')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Méthode', 'Method')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Référence', 'Reference')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Montant', 'Amount')}</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-slate-500">
                      {t('Aucun paiement pour le moment.', 'No payments yet.')}
                    </td>
                  </tr>
                ) : (
                  paymentRows.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4">{formatDate(payment.createdAt)}</td>
                      <td className="py-3 pr-4">{getMethodLabel(payment.method)}</td>
                      <td className="py-3 pr-4">{payment.details || '-'}</td>
                      <td className="py-3 pr-4">
                        {typeof payment.amount === 'number'
                          ? `${payment.amount} ${payment.currency || ''}`.trim()
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="commandes" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Gestion des commandes', 'Order management')}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">{t('Référence', 'Reference')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Client', 'Customer')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Méthode', 'Method')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Montant', 'Amount')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Statut', 'Status')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Action', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-3 text-slate-500">
                      {t('Aucune commande confirmée pour le moment.', 'No confirmed order yet.')}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const status = order.orderStatus || 'processing';
                    const nextOptions = ORDER_STATUS_NEXT[status];
                    const totals = order.invoice?.totals;
                    return (
                      <tr key={order.reference} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-3 pr-4 font-mono text-xs">{order.reference}</td>
                        <td className="py-3 pr-4">
                          {order.fullInvoice?.customerName || order.fullInvoice?.customerEmail || '—'}
                        </td>
                        <td className="py-3 pr-4">{getMethodLabel(order.method)}</td>
                        <td className="py-3 pr-4">
                          {totals ? `${totals.ttc.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${totals.currency}` : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={
                              status === 'delivered'
                                ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700'
                                : status === 'cancelled'
                                ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700'
                                : status === 'shipped'
                                ? 'rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700'
                                : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700'
                            }
                          >
                            {t(ORDER_STATUS_LABELS[status].fr, ORDER_STATUS_LABELS[status].en)}
                          </span>
                          {status === 'cancelled' && order.cancelReason && (
                            <p className="mt-1 text-xs text-slate-400">{order.cancelReason}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {nextOptions.length === 0 ? (
                            '—'
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {nextOptions.map((nextStatus) => (
                                <button
                                  key={nextStatus}
                                  type="button"
                                  disabled={busyOrderRef === order.reference}
                                  onClick={() => changeOrderStatus(order.reference, nextStatus)}
                                  className={
                                    nextStatus === 'cancelled'
                                      ? 'rounded-lg border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 text-xs font-medium disabled:opacity-60'
                                      : 'rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-60'
                                  }
                                >
                                  {t(ORDER_STATUS_LABELS[nextStatus].fr, ORDER_STATUS_LABELS[nextStatus].en)}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="utilisateurs" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Gestion des utilisateurs', 'User management')}</h2>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={newUserName}
              onChange={(event) => setNewUserName(event.target.value)}
              placeholder={t('Nom complet', 'Full name')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="email"
              value={newUserEmail}
              onChange={(event) => setNewUserEmail(event.target.value)}
              placeholder={t('Email', 'Email')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <select
              value={newUserRole}
              onChange={(event) => setNewUserRole(event.target.value as AppRole)}
              aria-label={t('Rôle utilisateur', 'User role')}
              title={t('Rôle utilisateur', 'User role')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {APP_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role][lang]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={createUser}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
              disabled={savingUser}
            >
              {savingUser ? t('Enregistrement…', 'Saving...') : t('Ajouter', 'Add')}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">{t('Nom', 'Name')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Email', 'Email')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Rôle', 'Role')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Statut', 'Status')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Action', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-slate-500">
                      {t('Aucun utilisateur.', 'No users.')}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4">{user.name}</td>
                      <td className="py-3 pr-4">{user.email}</td>
                      <td className="py-3 pr-4">{getRoleLabel(user.role)}</td>
                      <td className="py-3 pr-4">
                        <span className={user.active ? 'text-emerald-700' : 'text-slate-500'}>
                          {user.active ? t('Actif', 'Active') : t('Inactif', 'Inactive')}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => toggleUser(user.id)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                        >
                          {user.active ? t('Désactiver', 'Disable') : t('Activer', 'Enable')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="clients" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Clients', 'Clients')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Utilisateurs admin', 'Admin users')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{clientUsers?.count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Actifs', 'Active')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{clientUsers?.activeCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Rôles plateforme', 'Platform roles')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{roleAssignmentsByRole.find((item) => item.role === 'client')?.count ?? 0}</p>
            </div>
          </div>
        </div>

        <div id="fournisseurs" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Fournisseurs', 'Suppliers')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Utilisateurs admin', 'Admin users')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{supplierUsers?.count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Rôles plateforme', 'Platform roles')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{roleAssignmentsByRole.find((item) => item.role === 'supplier')?.count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Demandes partenaires visibles', 'Visible partner requests')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{partnerEvents.length}</p>
            </div>
          </div>
        </div>

        <div id="transporteurs" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Transporteurs', 'Drivers')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Utilisateurs admin', 'Admin users')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{driverUsers?.count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Rôles plateforme', 'Platform roles')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{roleAssignmentsByRole.find((item) => item.role === 'driver')?.count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Livraisons assignées', 'Assigned deliveries')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{deliveries.filter((delivery) => Boolean(delivery.driverIdentity)).length}</p>
            </div>
          </div>
        </div>

        <div id="professionnels" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Professionnels', 'Professionals')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Techniciens', 'Technicians')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{technicianUsers?.count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Services publiés', 'Published services')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{services.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Services actifs', 'Active services')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{services.filter((service) => service.active).length}</p>
            </div>
          </div>
        </div>

        <div id="configuration" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">
            {t('Attribution des rôles plateforme', 'Platform role assignment')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Associe un email ou un numéro de téléphone connecté à un rôle (client, fournisseur, transporteur, etc.) pour lui donner accès à son tableau de bord.",
              'Links a signed-in email or phone number to a role (client, supplier, driver, etc.) to grant access to its dashboard.'
            )}
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={roleIdentity}
              onChange={(event) => setRoleIdentity(event.target.value)}
              placeholder={t('Email ou téléphone (+243...)', 'Email or phone (+243...)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <select
              value={roleToAssign}
              onChange={(event) => setRoleToAssign(event.target.value as AppRole)}
              aria-label={t('Rôle plateforme', 'Platform role')}
              title={t('Rôle plateforme', 'Platform role')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {APP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role][lang]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={assignPlatformRole}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
              disabled={savingRole}
            >
              {savingRole ? t('Enregistrement…', 'Saving...') : t('Assigner', 'Assign')}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">{t('Identité', 'Identity')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Rôle', 'Role')}</th>
                </tr>
              </thead>
              <tbody>
                {platformRoles.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-3 text-slate-500">
                      {t('Aucun rôle attribué.', 'No role assigned yet.')}
                    </td>
                  </tr>
                ) : (
                  platformRoles.map((assignment) => (
                    <tr key={assignment.identity} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4">{assignment.identity}</td>
                      <td className="py-3 pr-4">{ROLE_LABELS[assignment.role][lang]}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Crédits immobiliers', 'Real estate loans')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'Demandes de prêt des clients. Approuver décaisse le montant dans leur porte-monnaie.',
              "Client loan requests. Approving disburses the amount into their wallet."
            )}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">{t('Dossier', 'Case')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Client', 'Client')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Objet', 'Purpose')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Montant', 'Amount')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Statut', 'Status')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Remboursement', 'Repayment')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Action', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-3 text-slate-500">
                      {t('Aucune demande de prêt.', 'No loan requests.')}
                    </td>
                  </tr>
                ) : (
                  loans.map((loan) => {
                    const expanded = expandedLoanId === loan.id;
                    const healthLabels: Record<RepaymentHealth, string> = {
                      on_track: t('À jour', 'On track'),
                      late: t('En retard', 'Late'),
                      defaulted: t('Impayé', 'Defaulted'),
                      n_a: '-',
                    };
                    return (
                      <Fragment key={loan.id}>
                        <tr className="border-b border-slate-100 last:border-b-0">
                          <td className="py-3 pr-4">
                            <button
                              type="button"
                              onClick={() => setExpandedLoanId(expanded ? null : loan.id)}
                              className="font-mono text-xs text-slate-600 hover:underline"
                            >
                              {loan.id}
                            </button>
                          </td>
                          <td className="py-3 pr-4">
                            {loan.borrower?.fullName || loan.identity}
                          </td>
                          <td className="py-3 pr-4">{loan.purpose}</td>
                          <td className="py-3 pr-4">
                            {loan.principal.toLocaleString('fr-FR')} {loan.currency}
                          </td>
                          <td className="py-3 pr-4">{loan.status}</td>
                          <td className="py-3 pr-4">{healthLabels[loan.repaymentHealth]}</td>
                          <td className="py-3 pr-4">
                            <p className="text-xs text-slate-500">{t('Supervision et attribution uniquement', 'Oversight and assignment only')}</p>
                            {loan.status !== 'rejected' && loan.status !== 'paid_off' && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <input
                                  value={agentAssignInput[loan.id] || ''}
                                  onChange={(e) =>
                                    setAgentAssignInput((prev) => ({ ...prev, [loan.id]: e.target.value }))
                                  }
                                  placeholder={t('Email agent crédit', 'Credit agent email')}
                                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs w-40"
                                />
                                <button
                                  type="button"
                                  onClick={() => assignAgentToLoan(loan.id)}
                                  disabled={decidingLoanId === loan.id}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                                >
                                  {t('Assigner', 'Assign')}
                                </button>
                              </div>
                            )}
                            {loan.assignedAgentIdentity && (
                              <p className="mt-1 text-[11px] text-slate-400">
                                {t('Agent', 'Agent')}: {loan.assignedAgentIdentity}
                              </p>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-slate-100 last:border-b-0 bg-slate-50">
                            <td colSpan={7} className="py-3 px-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    {t('Emprunteur', 'Borrower')}
                                  </p>
                                  <p className="mt-1 text-sm">{loan.borrower?.fullName}</p>
                                  <p className="text-xs text-slate-500">{loan.borrower?.phone}</p>
                                  {loan.borrower?.employmentStatus && (
                                    <p className="text-xs text-slate-500">
                                      {loan.borrower.employmentStatus}
                                      {loan.borrower.employer ? ` · ${loan.borrower.employer}` : ''}
                                    </p>
                                  )}
                                  {(loan.borrower?.monthlyIncome || loan.borrower?.monthlyCharges) && (
                                    <p className="text-xs text-slate-500">
                                      {t('Revenu', 'Income')}: {loan.borrower?.monthlyIncome ?? '-'} ·{' '}
                                      {t('Charges', 'Expenses')}: {loan.borrower?.monthlyCharges ?? '-'}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    {t('Documents', 'Documents')}
                                  </p>
                                  {loan.documents.length === 0 ? (
                                    <p className="mt-1 text-xs text-slate-400">{t('Aucun', 'None')}</p>
                                  ) : (
                                    <ul className="mt-1 space-y-1">
                                      {loan.documents.map((doc) => (
                                        <li key={doc.id} className="text-xs">
                                          <a
                                            href={`/api/credit/loans/${loan.id}/documents/${doc.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-orange-600 hover:text-orange-700 font-medium"
                                          >
                                            {doc.fileName}
                                          </a>{' '}
                                          <span className="text-slate-400">({doc.category})</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    {t('Journal d\'audit', 'Audit log')}
                                  </p>
                                  <ul className="mt-1 space-y-1">
                                    {loan.auditLog.map((entry) => (
                                      <li key={entry.id} className="text-xs text-slate-500">
                                        {formatDate(entry.at)} — {entry.by} — {entry.action}
                                        {entry.note ? ` (${entry.note})` : ''}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              {loan.disbursementMode === 'tranches' && loan.tranches && (
                                <div className="mt-4 pt-3 border-t border-slate-200">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    {t('Décaissement par tranches', 'Tranche disbursement')}
                                  </p>
                                  <ul className="mt-2 space-y-2">
                                    {loan.tranches.map((tranche) => (
                                      <li key={tranche.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <span>
                                          {tranche.label} — {tranche.amount.toLocaleString('fr-FR')} {loan.currency}
                                          {tranche.condition ? ` (${tranche.condition})` : ''}
                                        </span>
                                        {tranche.status === 'released' ? (
                                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                                            {t('Libérée', 'Released')}
                                          </span>
                                        ) : loan.status === 'active' ? (
                                          <span className="text-slate-400">{t('Libération réservée à la comptabilité', 'Release reserved for accounting')}</span>
                                        ) : (
                                          <span className="text-slate-400">{t('En attente', 'Pending')}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(loan.repaymentHealth === 'late' || loan.repaymentHealth === 'defaulted') && (
                                <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
                                  {t('Le recouvrement est traité par la comptabilité ou l’agent crédit assigné.', 'Collections are handled by accounting or the assigned credit agent.')}
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="livraisons" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Livraisons', 'Deliveries')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'Créées automatiquement à la confirmation de paiement (si une adresse a été fournie).',
              'Created automatically once a payment is confirmed (if an address was provided).'
            )}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">{t('Référence', 'Reference')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Client', 'Client')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Adresse', 'Address')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Statut', 'Status')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Livreur', 'Driver')}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-slate-500">
                      {t('Aucune livraison.', 'No deliveries.')}
                    </td>
                  </tr>
                ) : (
                  deliveries.map((delivery) => (
                    <tr key={delivery.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4 font-mono text-xs">{delivery.reference}</td>
                      <td className="py-3 pr-4">{delivery.clientName}</td>
                      <td className="py-3 pr-4">{delivery.deliveryAddress}</td>
                      <td className="py-3 pr-4">{delivery.status}</td>
                      <td className="py-3 pr-4">
                        {delivery.driverIdentity ? (
                          delivery.driverIdentity
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <input
                              value={driverAssignInput[delivery.id] || ''}
                              onChange={(e) =>
                                setDriverAssignInput((prev) => ({ ...prev, [delivery.id]: e.target.value }))
                              }
                              placeholder={t('Email livreur', 'Driver email')}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs w-40"
                            />
                            <button
                              type="button"
                              onClick={() => assignDriverToDelivery(delivery.id)}
                              disabled={busyDeliveryId === delivery.id}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                            >
                              {t('Assigner', 'Assign')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="chantiers" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Chantiers', 'Sites')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Chantiers', 'Sites')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{sites.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Actifs', 'Active')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{activeSites.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Chefs de chantier', 'Site managers')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{siteManagerUsers?.count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Rôles plateforme', 'Platform roles')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{roleAssignmentsByRole.find((item) => item.role === 'site-manager')?.count ?? 0}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {sites.length === 0 ? (
              <p className="text-sm text-slate-500">{t('Aucun chantier chargé.', 'No sites loaded.')}</p>
            ) : (
              sites.slice(0, 8).map((site) => (
                <div key={site.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{site.name}</p>
                    <span className="text-slate-500">{site.status}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{site.address}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {site.team.length} {t('membre(s)', 'member(s)')} · {site.tasks.length} {t('tâche(s)', 'task(s)')} · {site.incidents.filter((incident) => !incident.resolved).length} {t('incident(s) ouverts', 'open incident(s)')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div id="produits" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Produits', 'Products')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'Ajoutez un produit ou modifiez ses prix. Un produit désactivé disparaît du site public.',
              'Add a product or edit its prices. A deactivated product disappears from the public site.'
            )}
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={newProduct.fr}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, fr: e.target.value }))}
              placeholder={t('Nom (FR)', 'Name (FR)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newProduct.en}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, en: e.target.value }))}
              placeholder={t('Nom (EN)', 'Name (EN)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newProduct.unitFr}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, unitFr: e.target.value }))}
              placeholder={t('Unité (FR)', 'Unit (FR)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newProduct.img}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, img: e.target.value }))}
              placeholder={t('Chemin image', 'Image path')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={newProduct.priceUSD}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, priceUSD: e.target.value }))}
              placeholder="Prix USD"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={newProduct.priceCDF}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, priceCDF: e.target.value }))}
              placeholder="Prix CDF"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={createProduct}
              disabled={savingProduct}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60 md:col-span-2"
            >
              {savingProduct ? t('Ajout…', 'Adding...') : t('+ Ajouter le produit', '+ Add product')}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">{t('Nom', 'Name')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Unité', 'Unit')}</th>
                  <th className="py-2 pr-4 font-medium">Prix USD</th>
                  <th className="py-2 pr-4 font-medium">Prix CDF</th>
                  <th className="py-2 pr-4 font-medium">{t('Statut', 'Status')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Action', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-3 text-slate-500">
                      {t('Aucun produit.', 'No products.')}
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const edit = productEdits[product.id] || {
                      priceUSD: product.priceUSD?.toString() || '',
                      priceCDF: product.priceCDF?.toString() || '',
                    };
                    return (
                      <tr key={product.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-3 pr-4">{lang === 'fr' ? product.fr : product.en}</td>
                        <td className="py-3 pr-4">{lang === 'fr' ? product.unitFr : product.unitEn}</td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            value={edit.priceUSD}
                            onChange={(e) =>
                              setProductEdits((prev) => ({
                                ...prev,
                                [product.id]: { ...edit, priceUSD: e.target.value },
                              }))
                            }
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            value={edit.priceCDF}
                            onChange={(e) =>
                              setProductEdits((prev) => ({
                                ...prev,
                                [product.id]: { ...edit, priceCDF: e.target.value },
                              }))
                            }
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <span className={product.active ? 'text-emerald-700' : 'text-slate-400'}>
                            {product.active ? t('Actif', 'Active') : t('Inactif', 'Inactive')}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => saveProductPrice(product.id)}
                              disabled={busyProductId === product.id}
                              className="rounded-lg bg-slate-900 text-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                            >
                              {t('Enregistrer', 'Save')}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleProductActive(product)}
                              disabled={busyProductId === product.id}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                            >
                              {product.active ? t('Désactiver', 'Disable') : t('Activer', 'Enable')}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeProduct(product.id)}
                              disabled={busyProductId === product.id}
                              className="rounded-lg border border-red-300 bg-white text-red-600 px-2 py-1 text-xs font-medium disabled:opacity-60"
                            >
                              {t('Supprimer', 'Delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="services" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Services', 'Services')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'Ajoutez un service ou modifiez ses prix (optionnel: laissez vide pour "sur devis").',
              'Add a service or edit its prices (optional: leave empty for "quote only").'
            )}
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={newService.icon}
              onChange={(e) => setNewService((prev) => ({ ...prev, icon: e.target.value }))}
              placeholder={t('Icône (emoji)', 'Icon (emoji)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newService.fr}
              onChange={(e) => setNewService((prev) => ({ ...prev, fr: e.target.value }))}
              placeholder={t('Nom (FR)', 'Name (FR)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newService.en}
              onChange={(e) => setNewService((prev) => ({ ...prev, en: e.target.value }))}
              placeholder={t('Nom (EN)', 'Name (EN)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newService.img}
              onChange={(e) => setNewService((prev) => ({ ...prev, img: e.target.value }))}
              placeholder={t('Chemin image', 'Image path')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newService.frDesc}
              onChange={(e) => setNewService((prev) => ({ ...prev, frDesc: e.target.value }))}
              placeholder={t('Description (FR)', 'Description (FR)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
            />
            <input
              value={newService.enDesc}
              onChange={(e) => setNewService((prev) => ({ ...prev, enDesc: e.target.value }))}
              placeholder={t('Description (EN)', 'Description (EN)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
            />
            <input
              type="number"
              value={newService.priceUSD}
              onChange={(e) => setNewService((prev) => ({ ...prev, priceUSD: e.target.value }))}
              placeholder={t('Prix USD (optionnel)', 'Price USD (optional)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={newService.priceCDF}
              onChange={(e) => setNewService((prev) => ({ ...prev, priceCDF: e.target.value }))}
              placeholder={t('Prix CDF (optionnel)', 'Price CDF (optional)')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={createService}
              disabled={savingService}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {savingService ? t('Ajout…', 'Adding...') : t('+ Ajouter le service', '+ Add service')}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">{t('Nom', 'Name')}</th>
                  <th className="py-2 pr-4 font-medium">Prix USD</th>
                  <th className="py-2 pr-4 font-medium">Prix CDF</th>
                  <th className="py-2 pr-4 font-medium">{t('Statut', 'Status')}</th>
                  <th className="py-2 pr-4 font-medium">{t('Action', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-slate-500">
                      {t('Aucun service.', 'No services.')}
                    </td>
                  </tr>
                ) : (
                  services.map((service) => {
                    const edit = serviceEdits[service.id] || {
                      priceUSD: service.priceUSD?.toString() || '',
                      priceCDF: service.priceCDF?.toString() || '',
                    };
                    return (
                      <tr key={service.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-3 pr-4">
                          {service.icon} {lang === 'fr' ? service.fr : service.en}
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            value={edit.priceUSD}
                            onChange={(e) =>
                              setServiceEdits((prev) => ({
                                ...prev,
                                [service.id]: { ...edit, priceUSD: e.target.value },
                              }))
                            }
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            value={edit.priceCDF}
                            onChange={(e) =>
                              setServiceEdits((prev) => ({
                                ...prev,
                                [service.id]: { ...edit, priceCDF: e.target.value },
                              }))
                            }
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <span className={service.active ? 'text-emerald-700' : 'text-slate-400'}>
                            {service.active ? t('Actif', 'Active') : t('Inactif', 'Inactive')}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => saveServicePrice(service.id)}
                              disabled={busyServiceId === service.id}
                              className="rounded-lg bg-slate-900 text-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                            >
                              {t('Enregistrer', 'Save')}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleServiceActive(service)}
                              disabled={busyServiceId === service.id}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium disabled:opacity-60"
                            >
                              {service.active ? t('Désactiver', 'Disable') : t('Activer', 'Enable')}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeService(service.id)}
                              disabled={busyServiceId === service.id}
                              className="rounded-lg border border-red-300 bg-white text-red-600 px-2 py-1 text-xs font-medium disabled:opacity-60"
                            >
                              {t('Supprimer', 'Delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="promotions" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Promotions', 'Promotions')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'Créez des remises planifiées sur les produits et services du catalogue public.',
              'Create scheduled discounts on products and services in the public catalog.'
            )}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Promotions actives', 'Live promotions')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{livePromotions.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Produits promus', 'Promoted products')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{promotedProductCount}/{configuredProductCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Services promus', 'Promoted services')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{promotedServiceCount}/{configuredServiceCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Campagnes planifiées', 'Scheduled campaigns')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{promotions.length - livePromotions.length}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-6">
            <select
              value={newPromotion.itemType}
              onChange={(e) => setNewPromotion((prev) => ({ ...prev, itemType: e.target.value as PromotionTargetType, itemId: '' }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="product">{t('Produit', 'Product')}</option>
              <option value="service">{t('Service', 'Service')}</option>
            </select>
            <select
              value={newPromotion.itemId}
              onChange={(e) => setNewPromotion((prev) => ({ ...prev, itemId: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">{t('Sélectionner une cible', 'Select a target')}</option>
              {promotionTargets.map((target) => (
                <option key={`${newPromotion.itemType}-${target.id}`} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newPromotion.label}
              onChange={(e) => setNewPromotion((prev) => ({ ...prev, label: e.target.value }))}
              placeholder={t('Libellé campagne', 'Campaign label')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="1"
              max="99"
              value={newPromotion.discountPercent}
              onChange={(e) => setNewPromotion((prev) => ({ ...prev, discountPercent: e.target.value }))}
              placeholder={t('Remise %', 'Discount %')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={newPromotion.startsAt}
              onChange={(e) => setNewPromotion((prev) => ({ ...prev, startsAt: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={newPromotion.endsAt}
                onChange={(e) => setNewPromotion((prev) => ({ ...prev, endsAt: e.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={createPromotion}
                disabled={savingPromotion}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingPromotion ? t('Enregistrement…', 'Saving...') : t('Créer', 'Create')}
              </button>
            </div>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">{t('Cible', 'Target')}</th>
                  <th className="pb-2 pr-4">{t('Campagne', 'Campaign')}</th>
                  <th className="pb-2 pr-4">{t('Remise', 'Discount')}</th>
                  <th className="pb-2 pr-4">{t('Période', 'Window')}</th>
                  <th className="pb-2 pr-4">{t('Statut', 'Status')}</th>
                  <th className="pb-2">{t('Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {promotions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-slate-500">
                      {t('Aucune promotion configurée.', 'No promotion configured yet.')}
                    </td>
                  </tr>
                ) : (
                  promotions
                    .slice()
                    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
                    .map((promotion) => (
                      <tr key={promotion.id} className="border-t border-slate-100">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-slate-900">{getPromotionTargetLabel(promotion)}</div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">{promotion.itemType}</div>
                        </td>
                        <td className="py-3 pr-4 text-slate-700">{promotion.label}</td>
                        <td className="py-3 pr-4 font-semibold text-slate-900">-{promotion.discountPercent}%</td>
                        <td className="py-3 pr-4 text-slate-600">
                          {[promotion.startsAt ? formatDate(promotion.startsAt) : t('Immédiat', 'Immediate'), promotion.endsAt ? formatDate(promotion.endsAt) : t('Sans fin', 'No end')].join(' → ')}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {isPromotionLive(promotion) ? t('Active', 'Live') : promotion.active ? t('Planifiée / expirée', 'Scheduled / expired') : t('Désactivée', 'Disabled')}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => togglePromotionActive(promotion)}
                              disabled={busyPromotionId === promotion.id}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                            >
                              {promotion.active ? t('Désactiver', 'Disable') : t('Activer', 'Enable')}
                            </button>
                            <button
                              type="button"
                              onClick={() => removePromotion(promotion.id)}
                              disabled={busyPromotionId === promotion.id}
                              className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-600 disabled:opacity-60"
                            >
                              {t('Supprimer', 'Delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="securite" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Sécurité', 'Security')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'Vue consolidée des tentatives de connexion, limitations anti-bruteforce et changements de rôles récents.',
              'Consolidated view of sign-in attempts, brute-force throttling, and recent role changes.'
            )}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Utilisateurs inactifs', 'Inactive users')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{securitySummary?.summary.inactiveUsers ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Affectations inactives', 'Inactive assignments')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{securitySummary?.summary.inactiveAssignments ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Comptes sensibles', 'Privileged accounts')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{securitySummary?.summary.privilegedAssignments ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Sources ralenties', 'Throttled sources')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{securitySummary?.summary.throttledSources ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Alertes 24h', '24h alerts')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{securitySummary?.summary.alerts24h ?? 0}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{t('Activité authentification (24h)', 'Authentication activity (24h)')}</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  [t('OTP demandés', 'OTP requests'), securitySummary?.authActivity.otpRequested24h ?? 0],
                  [t('OTP en erreur', 'OTP failures'), securitySummary?.authActivity.otpFailures24h ?? 0],
                  [t('Échecs admin', 'Admin failures'), securitySummary?.authActivity.adminFailures24h ?? 0],
                  [t('Succès admin', 'Admin successes'), securitySummary?.authActivity.adminSuccess24h ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-slate-100 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{t('Verrous actifs', 'Active throttles')}</h3>
              <div className="mt-4 space-y-3">
                {securitySummary?.throttledBuckets.length ? (
                  securitySummary.throttledBuckets.map((bucket) => (
                    <div key={bucket.key} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm">
                      <p className="font-medium text-amber-900">{bucket.key}</p>
                      <p className="mt-1 text-amber-800">
                        {bucket.count}/{bucket.max} · {t('réinitialisation dans', 'resets in')} {Math.ceil(bucket.retryAfterMs / 1000)}s
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{t('Aucun verrou actif.', 'No active throttle.')}</p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{t('Événements de sécurité récents', 'Recent security events')}</h3>
              <div className="mt-4 space-y-3">
                {securitySummary?.recentEvents.length ? (
                  securitySummary.recentEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{getSecurityEventLabel(event)}</p>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getSecuritySeverityClass(event.severity)}`}>
                          {event.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600">
                        {[event.identity || '—', event.ip || '—', event.detail || '—'].join(' · ')}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{formatDate(event.createdAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{t('Aucun événement sécurité récent.', 'No recent security event.')}</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{t('Audit des rôles récent', 'Recent role audit')}</h3>
              <div className="mt-4 space-y-3">
                {securitySummary?.recentRoleAudit.length ? (
                  securitySummary.recentRoleAudit.map((event) => (
                    <div key={`${event.at}-${event.identity}-${event.action}`} className="rounded-lg border border-slate-100 p-3 text-sm">
                      <p className="font-medium text-slate-900">{event.identity}</p>
                      <p className="mt-1 text-slate-600">
                        {event.action} {event.role ? `· ${getRoleLabel(event.role)}` : ''} · {event.actor}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{formatDate(event.at)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{t('Aucun audit de rôle récent.', 'No recent role audit.')}</p>
                )}
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            {t('API sécurité', 'Security API')}: {securityApiOnline ? t('OK', 'OK') : t('Hors ligne', 'Offline')}
          </p>
        </div>

        <div id="logs" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Logs', 'Logs')}</h2>
          <div className="mt-4 space-y-3">
            {stats.recent.length === 0 ? (
              <p className="text-sm text-slate-500">{t('Aucun événement récent.', 'No recent events.')}</p>
            ) : (
              stats.recent.map((event) => (
                <div key={event.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{getEventLabel(event)}</p>
                    <span className="text-xs uppercase tracking-wide text-slate-400">{event.kind}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{getEventDetails(event) || '—'}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDate(event.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div id="taxes" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Taxes (TVA à reverser)', 'Taxes (VAT payable)')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'Calculée sur toutes les factures confirmées (mobile money, carte, PayPal).',
              'Computed from all confirmed invoices (mobile money, card, PayPal).'
            )}
            {taxSummary?.vatRate !== null && taxSummary?.vatRate !== undefined && (
              <span> {t('Taux', 'Rate')}: {taxSummary.vatRate}%.</span>
            )}
          </p>

          {!taxSummary || Object.keys(taxSummary.totalsByCurrency).length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t('Aucune facture confirmée.', 'No confirmed invoice.')}</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(taxSummary.totalsByCurrency).map(([currency, totals]) => (
                <div key={currency} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-700">{currency}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('Total HT', 'Total excl. tax')}: {totals.ht.toLocaleString('fr-FR')} {currency}
                  </p>
                  <p className="mt-1 text-lg font-bold text-orange-700">
                    {t('TVA à reverser', 'VAT payable')}: {totals.tva.toLocaleString('fr-FR')} {currency}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('Total TTC', 'Total incl. tax')}: {totals.ttc.toLocaleString('fr-FR')} {currency} ·{' '}
                    {totals.count} {t('facture(s)', 'invoice(s)')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {taxSummary && taxSummary.invoices.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">{t('Facture', 'Invoice')}</th>
                    <th className="py-2 pr-4 font-medium">{t('Méthode', 'Method')}</th>
                    <th className="py-2 pr-4 font-medium">{t('HT', 'Excl. tax')}</th>
                    <th className="py-2 pr-4 font-medium">TVA</th>
                    <th className="py-2 pr-4 font-medium">{t('TTC', 'Incl. tax')}</th>
                    <th className="py-2 pr-4 font-medium">{t('Date', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {taxSummary.invoices.slice(0, 20).map((invoice) => (
                    <tr key={invoice.reference} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4 font-mono text-xs">{invoice.invoiceNumber}</td>
                      <td className="py-3 pr-4">{invoice.method}</td>
                      <td className="py-3 pr-4">
                        {invoice.ht.toLocaleString('fr-FR')} {invoice.currency}
                      </td>
                      <td className="py-3 pr-4">
                        {invoice.tva.toLocaleString('fr-FR')} {invoice.currency}
                      </td>
                      <td className="py-3 pr-4">
                        {invoice.ttc.toLocaleString('fr-FR')} {invoice.currency}
                      </td>
                      <td className="py-3 pr-4">{formatDate(invoice.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div id="configuration-details" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{t('Configuration applicative', 'Application configuration')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Rôles avec affectation', 'Roles with assignments')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{roleAssignmentsByRole.filter((item) => item.count > 0).length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Identités affectées', 'Assigned identities')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{platformRoles.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{t('Catalogue global', 'Global catalog')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{products.length + services.length}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
