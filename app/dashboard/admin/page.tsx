"use client";

import { Fragment, useEffect, useState } from 'react';
import { APP_ROLES, AppRole, ROLE_LABELS } from '@/lib/roles';

type PlatformRoleAssignment = {
  identity: string;
  role: AppRole;
};

type LoanInstallment = {
  index: number;
  dueDate: string;
  amount: number;
  paid: boolean;
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
  role: 'admin' | 'manager' | 'agent';
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
  const [newUserRole, setNewUserRole] = useState<'admin' | 'manager' | 'agent'>('agent');
  const [platformRoles, setPlatformRoles] = useState<PlatformRoleAssignment[]>([]);
  const [roleIdentity, setRoleIdentity] = useState('');
  const [roleToAssign, setRoleToAssign] = useState<AppRole>('client');
  const [savingRole, setSavingRole] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [decidingLoanId, setDecidingLoanId] = useState<string | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [agentAssignInput, setAgentAssignInput] = useState<Record<string, string>>({});

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

  const reviewLoan = async (loanId: string) => {
    try {
      setDecidingLoanId(loanId);
      const response = await fetch(`/api/credit/loans/${loanId}/review`, { method: 'POST' });
      if (!response.ok) throw new Error('Erreur mise en analyse');
      await loadLoans();
    } finally {
      setDecidingLoanId(null);
    }
  };

  const decideLoan = async (loanId: string, decision: 'approved' | 'rejected') => {
    try {
      setDecidingLoanId(loanId);
      const response = await fetch(`/api/credit/loans/${loanId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) throw new Error('Erreur décision prêt');
      await loadLoans();
    } finally {
      setDecidingLoanId(null);
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

  const logCollectionAction = async (
    loanId: string,
    type: 'called' | 'notified' | 'promise_to_pay' | 'escalated'
  ) => {
    try {
      setDecidingLoanId(loanId);
      const response = await fetch(`/api/credit/loans/${loanId}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!response.ok) throw new Error('Erreur action recouvrement');
      await loadLoans();
    } finally {
      setDecidingLoanId(null);
    }
  };

  const releaseTranche = async (loanId: string, trancheId: string) => {
    try {
      setDecidingLoanId(loanId);
      const response = await fetch(`/api/credit/loans/${loanId}/tranches/${trancheId}/release`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Erreur libération tranche');
      await loadLoans();
    } finally {
      setDecidingLoanId(null);
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
      await Promise.all([loadStats(), loadUsers(), loadPlatformRoles(), loadLoans()]);
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
  const getEventLabel = (event: AdminEvent) => {
    if (lang === 'fr') return event.labelFr || event.label;
    return event.labelEn || event.label;
  };

  const getRoleLabel = (role?: string) => {
    if (!role) return '-';
    const roleKey = role.toLowerCase();
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
      setNewUserRole('agent');
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

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
              onChange={(event) => setNewUserRole(event.target.value as 'admin' | 'manager' | 'agent')}
              aria-label={t('Rôle utilisateur', 'User role')}
              title={t('Rôle utilisateur', 'User role')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="agent">{getRoleLabel('agent')}</option>
              <option value="manager">{getRoleLabel('manager')}</option>
              <option value="admin">{getRoleLabel('admin')}</option>
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

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                            <div className="flex flex-wrap gap-2">
                              {loan.status === 'submitted' && (
                                <button
                                  type="button"
                                  onClick={() => reviewLoan(loan.id)}
                                  disabled={decidingLoanId === loan.id}
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                                >
                                  {t('Examiner', 'Review')}
                                </button>
                              )}
                              {(loan.status === 'submitted' || loan.status === 'under_review') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => decideLoan(loan.id, 'approved')}
                                    disabled={decidingLoanId === loan.id}
                                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3 py-1.5 text-xs font-medium"
                                  >
                                    {t('Approuver', 'Approve')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => decideLoan(loan.id, 'rejected')}
                                    disabled={decidingLoanId === loan.id}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                                  >
                                    {t('Refuser', 'Reject')}
                                  </button>
                                </>
                              )}
                              {loan.status !== 'submitted' && loan.status !== 'under_review' && '-'}
                            </div>
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
                                          <button
                                            type="button"
                                            onClick={() => releaseTranche(loan.id, tranche.id)}
                                            disabled={decidingLoanId === loan.id}
                                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-2 py-1 font-medium"
                                          >
                                            {t('Libérer', 'Release')}
                                          </button>
                                        ) : (
                                          <span className="text-slate-400">{t('En attente', 'Pending')}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(loan.repaymentHealth === 'late' || loan.repaymentHealth === 'defaulted') && (
                                <div className="mt-4 pt-3 border-t border-slate-200">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500">
                                    {t('Recouvrement', 'Collections')}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => logCollectionAction(loan.id, 'called')}
                                      disabled={decidingLoanId === loan.id}
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                                    >
                                      {t('Appeler', 'Call')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => logCollectionAction(loan.id, 'notified')}
                                      disabled={decidingLoanId === loan.id}
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                                    >
                                      {t('Notifier', 'Notify')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => logCollectionAction(loan.id, 'promise_to_pay')}
                                      disabled={decidingLoanId === loan.id}
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                                    >
                                      {t('Promesse de paiement', 'Promise to pay')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => logCollectionAction(loan.id, 'escalated')}
                                      disabled={decidingLoanId === loan.id}
                                      className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-3 py-1.5 text-xs font-medium"
                                    >
                                      {t('Escalader', 'Escalate')}
                                    </button>
                                  </div>
                                </div>
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
      </section>
    </div>
  );
}