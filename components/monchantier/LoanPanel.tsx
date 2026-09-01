"use client";

import { useEffect, useState } from "react";

type WalletCurrency = "USD" | "CDF";

type LoanInstallment = {
  index: number;
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
  paid: boolean;
  paidAt?: string;
};

type LoanAuditEntry = { id: string; at: string; by: string; action: string; note?: string };

type LoanDocumentCategory = "identity" | "income" | "project" | "property" | "collateral" | "other";
type LoanDocument = {
  id: string;
  category: LoanDocumentCategory;
  fileName: string;
  uploadedAt: string;
};

type LoanCollateralType = "terrain" | "immeuble" | "vehicule" | "autre";
type LoanCollateral = {
  id: string;
  type: LoanCollateralType;
  description: string;
  estimatedValue: number;
  currency: WalletCurrency;
  owner: string;
};

type LoanStatus = "submitted" | "under_review" | "approved" | "rejected" | "active" | "paid_off";
type RepaymentHealth = "on_track" | "late" | "defaulted" | "n_a";

type LoanTranche = {
  id: string;
  index: number;
  label: string;
  condition: string;
  amount: number;
  status: "pending" | "released";
  releasedAt?: string;
};

type Loan = {
  id: string;
  purpose: string;
  currency: WalletCurrency;
  principal: number;
  annualInterestRate: number;
  termMonths: number;
  monthlyPayment: number;
  totalRepayable: number;
  totalInterest: number;
  status: LoanStatus;
  repaymentHealth: RepaymentHealth;
  createdAt: string;
  rejectionReason?: string;
  installments: LoanInstallment[];
  auditLog: LoanAuditEntry[];
  documents: LoanDocument[];
  collateral: LoanCollateral[];
  disbursementMode: "lump_sum" | "tranches";
  tranches?: LoanTranche[];
};

const STATUS_LABELS: Record<LoanStatus, { label: string; className: string }> = {
  submitted: { label: "Soumis", className: "bg-amber-100 text-amber-700" },
  under_review: { label: "En analyse", className: "bg-sky-100 text-sky-700" },
  approved: { label: "Approuvé", className: "bg-sky-100 text-sky-700" },
  rejected: { label: "Refusé", className: "bg-red-100 text-red-700" },
  active: { label: "Actif", className: "bg-emerald-100 text-emerald-700" },
  paid_off: { label: "Remboursé", className: "bg-slate-200 text-slate-700" },
};

const HEALTH_LABELS: Record<RepaymentHealth, { label: string; className: string } | null> = {
  on_track: { label: "À jour", className: "bg-emerald-100 text-emerald-700" },
  late: { label: "En retard", className: "bg-amber-100 text-amber-700" },
  defaulted: { label: "Impayé", className: "bg-red-100 text-red-700" },
  n_a: null,
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  submitted: "Demande soumise",
  review_started: "Mise en analyse",
  approved: "Prêt approuvé",
  rejected: "Prêt refusé",
  disbursed: "Fonds décaissés",
  installment_paid: "Échéance payée",
  paid_off: "Prêt intégralement remboursé",
  agent_assigned: "Agent assigné",
  document_added: "Document ajouté",
  collateral_added: "Garantie ajoutée",
  collection_called: "Appel effectué",
  collection_notified: "Notification envoyée",
  collection_promise_to_pay: "Promesse de paiement enregistrée",
  collection_escalated: "Dossier escaladé",
};

const PROJECT_TYPES = [
  "Acheter un logement",
  "Construire un logement",
  "Rénover / réhabiliter",
  "Construire un immeuble commercial",
  "Acheter un terrain + construire",
  "Autre projet immobilier",
];

const DOCUMENT_CHECKLIST: { category: LoanDocumentCategory; label: string }[] = [
  { category: "identity", label: "Pièce d'identité" },
  { category: "income", label: "Bulletin de salaire / relevé bancaire" },
  { category: "project", label: "Plan / budget du projet" },
  { category: "property", label: "Titre ou document foncier" },
];

function formatAmount(amount: number, currency: WalletCurrency) {
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

const TOTAL_STEPS = 7;

export default function LoanPanel() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState("");
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);
  const [docsPanelLoanId, setDocsPanelLoanId] = useState<string | null>(null);
  const [docUploadCategory, setDocUploadCategory] = useState<Record<string, LoanDocumentCategory>>({});
  const [docUploadFile, setDocUploadFile] = useState<Record<string, File | null>>({});
  const [uploadingLoanId, setUploadingLoanId] = useState<string | null>(null);

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [formError, setFormError] = useState("");

  const [projectType, setProjectType] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+243");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [monthlyCharges, setMonthlyCharges] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("Salarié");
  const [employer, setEmployer] = useState("");

  const [province, setProvince] = useState("Lualaba");
  const [city, setCity] = useState("Kolwezi");
  const [commune, setCommune] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [budgetTotal, setBudgetTotal] = useState("");
  const [personalContribution, setPersonalContribution] = useState("");

  const [currency, setCurrency] = useState<WalletCurrency>("USD");
  const [principal, setPrincipal] = useState("");
  const [termMonths, setTermMonths] = useState("24");
  const [quote, setQuote] = useState<{ annualInterestRate: number; monthlyPayment: number; totalRepayable: number; totalInterest: number } | null>(null);
  const [applying, setApplying] = useState(false);

  const [useTranches, setUseTranches] = useState(false);
  const [tranches, setTranches] = useState<{ label: string; condition: string; amount: string }[]>([
    { label: "", condition: "", amount: "" },
  ]);
  const trancheTotal = tranches.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const updateTranche = (index: number, field: "label" | "condition" | "amount", value: string) => {
    setTranches((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };
  const addTranche = () => setTranches((prev) => [...prev, { label: "", condition: "", amount: "" }]);
  const removeTranche = (index: number) => setTranches((prev) => prev.filter((_, i) => i !== index));

  const [createdLoan, setCreatedLoan] = useState<Loan | null>(null);
  const [docCategory, setDocCategory] = useState<LoanDocumentCategory>("identity");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [collType, setCollType] = useState<LoanCollateralType>("terrain");
  const [collDescription, setCollDescription] = useState("");
  const [collValue, setCollValue] = useState("");
  const [collOwner, setCollOwner] = useState("");
  const [addingCollateral, setAddingCollateral] = useState(false);

  const loadLoans = async () => {
    try {
      const res = await fetch("/api/loans", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { loans: Loan[] };
      setLoans(data.loans);
    } catch {
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLoans();
  }, []);

  useEffect(() => {
    const amount = Number(principal);
    const term = Number(termMonths);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(term) || term <= 0) {
      setQuote(null);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/loans/quote?currency=${currency}&principal=${amount}&termMonths=${term}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => setQuote(data?.success ? data : null))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [principal, termMonths, currency]);

  const resetWizard = () => {
    setShowWizard(false);
    setStep(1);
    setProjectType("");
    setProjectDescription("");
    setBudgetTotal("");
    setPersonalContribution("");
    setPrincipal("");
    setCreatedLoan(null);
    setFormError("");
  };

  const goNext = () => {
    setFormError("");
    if (step === 1 && !projectType) {
      setFormError("Choisissez le type de projet.");
      return;
    }
    if (step === 2 && (!fullName.trim() || phone.trim().length < 8)) {
      setFormError("Nom complet et téléphone valides requis.");
      return;
    }
    if (step === 3 && !projectDescription.trim()) {
      setFormError("Décrivez brièvement votre projet.");
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => {
    setFormError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmitApplication = async () => {
    setFormError("");
    const amount = Number(principal);
    const term = Number(termMonths);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Montant invalide.");
      return;
    }
    if (useTranches && Math.round(trancheTotal * 100) !== Math.round(amount * 100)) {
      setFormError("Le total des tranches doit être égal au montant demandé.");
      return;
    }

    setApplying(true);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrower: {
            fullName,
            phone,
            monthlyIncome: monthlyIncome ? Number(monthlyIncome) : undefined,
            monthlyCharges: monthlyCharges ? Number(monthlyCharges) : undefined,
            employmentStatus,
            employer,
          },
          project: {
            type: projectType,
            province,
            city,
            commune,
            description: projectDescription,
            budgetTotal: budgetTotal ? Number(budgetTotal) : undefined,
            personalContribution: personalContribution ? Number(personalContribution) : undefined,
          },
          purpose: projectType,
          currency,
          principal: amount,
          termMonths: term,
          tranches: useTranches
            ? tranches.map((t) => ({ label: t.label, condition: t.condition, amount: Number(t.amount) }))
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur lors de la demande");
      setCreatedLoan(data.loan);
      setStep(5);
      await loadLoans();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setApplying(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!createdLoan || !docFile) return;
    setUploading(true);
    setFormError("");
    try {
      const body = new FormData();
      body.append("file", docFile);
      body.append("category", docCategory);
      const res = await fetch(`/api/credit/loans/${createdLoan.id}/documents`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur upload");
      setCreatedLoan(data.loan);
      setDocFile(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setUploading(false);
    }
  };

  const handleAddCollateral = async () => {
    if (!createdLoan) return;
    if (!collDescription.trim() || !collOwner.trim() || !Number(collValue)) {
      setFormError("Description, propriétaire et valeur estimée requis.");
      return;
    }
    setAddingCollateral(true);
    setFormError("");
    try {
      const res = await fetch(`/api/credit/loans/${createdLoan.id}/collateral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: collType,
          description: collDescription,
          estimatedValue: Number(collValue),
          currency,
          owner: collOwner,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur ajout garantie");
      setCreatedLoan(data.loan);
      setCollDescription("");
      setCollValue("");
      setCollOwner("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setAddingCollateral(false);
    }
  };

  const handlePay = async (loanId: string) => {
    setPayingLoanId(loanId);
    try {
      const res = await fetch(`/api/loans/${loanId}/pay`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur de paiement");
      setBanner("Échéance payée avec succès.");
      await loadLoans();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setPayingLoanId(null);
    }
  };

  const handleUploadToExistingLoan = async (loanId: string) => {
    const file = docUploadFile[loanId];
    if (!file) return;
    setUploadingLoanId(loanId);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("category", docUploadCategory[loanId] || "other");
      const res = await fetch(`/api/credit/loans/${loanId}/documents`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur upload");
      setBanner("Document ajouté.");
      setDocUploadFile((prev) => ({ ...prev, [loanId]: null }));
      await loadLoans();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setUploadingLoanId(null);
    }
  };

  return (
    <div id="credit" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Crédit immobilier</h2>
        {!showWizard && (
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-3 py-2"
          >
            + Nouvelle demande
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Financez votre projet immobilier (achat, construction, rénovation). Après approbation, le
        montant est versé dans votre porte-monnaie ; les échéances sont prélevées sur son solde.
      </p>
      <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Service de crédit interne à MonChantier — soumis à analyse et approbation manuelle, pas
        d&apos;engagement avant décision.
      </p>

      {banner && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          {banner}
        </div>
      )}

      {showWizard && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-400">
            Étape {step} / {TOTAL_STEPS}
          </p>

          {step === 1 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700">Quel est votre projet ?</h3>
              <div className="mt-3 space-y-2">
                {PROJECT_TYPES.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="projectType"
                      checked={projectType === option}
                      onChange={() => setProjectType(option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700">Informations personnelles</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Nom complet</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Téléphone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="employment-status" className="text-xs font-semibold text-slate-700">
                    Situation professionnelle
                  </label>
                  <select
                    id="employment-status"
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option>Salarié</option>
                    <option>Indépendant</option>
                    <option>Commerçant</option>
                    <option>Sans emploi</option>
                    <option>Autre</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Employeur (optionnel)</label>
                  <input
                    value={employer}
                    onChange={(e) => setEmployer(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Revenu mensuel</label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Charges mensuelles</label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyCharges}
                    onChange={(e) => setMonthlyCharges(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700">Votre projet</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Province</label>
                  <input
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Ville</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Commune</label>
                  <input
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs font-semibold text-slate-700">Description du projet</label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Budget total du projet</label>
                  <input
                    type="number"
                    min="0"
                    value={budgetTotal}
                    onChange={(e) => setBudgetTotal(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Apport personnel</label>
                  <input
                    type="number"
                    min="0"
                    value={personalContribution}
                    onChange={(e) => setPersonalContribution(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700">Financement souhaité</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Montant demandé</label>
                  <input
                    type="number"
                    min="0"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="loan-currency" className="text-xs font-semibold text-slate-700">
                    Devise
                  </label>
                  <select
                    id="loan-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as WalletCurrency)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Durée (mois)</label>
                  <input
                    type="number"
                    min="1"
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {quote && (
                <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                  <p>Taux d&apos;intérêt annuel : {quote.annualInterestRate}%</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    Mensualité estimée : {formatAmount(quote.monthlyPayment, currency)}
                  </p>
                  <p className="mt-1">
                    Total à rembourser : {formatAmount(quote.totalRepayable, currency)} (dont{" "}
                    {formatAmount(quote.totalInterest, currency)} d&apos;intérêts)
                  </p>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useTranches}
                    onChange={(e) => setUseTranches(e.target.checked)}
                  />
                  Décaissement par tranches liées à l&apos;avancement du chantier
                </label>

                {useTranches && (
                  <div className="mt-3 space-y-2">
                    {tranches.map((tranche, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-[2fr,2fr,1fr,auto] gap-2">
                        <input
                          value={tranche.label}
                          onChange={(e) => updateTranche(index, "label", e.target.value)}
                          placeholder="Étape (ex: Fondations)"
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                        <input
                          value={tranche.condition}
                          onChange={(e) => updateTranche(index, "condition", e.target.value)}
                          placeholder="Condition de libération"
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                        <input
                          type="number"
                          min="0"
                          value={tranche.amount}
                          onChange={(e) => updateTranche(index, "amount", e.target.value)}
                          placeholder="Montant"
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => removeTranche(index)}
                          className="text-xs text-red-600"
                        >
                          Retirer
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addTranche}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                      + Ajouter une tranche
                    </button>
                    <p className="text-xs text-slate-500">
                      Total des tranches : {trancheTotal.toLocaleString("fr-FR")} {currency} — doit être égal
                      au montant demandé ({Number(principal || 0).toLocaleString("fr-FR")} {currency}).
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && createdLoan && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700">Documents</h3>
              <p className="mt-1 text-xs text-slate-500">
                Formats acceptés : PDF, JPG, PNG (5 Mo max). Vous pouvez continuer sans tous les
                documents et les ajouter plus tard.
              </p>

              <ul className="mt-3 space-y-1">
                {DOCUMENT_CHECKLIST.map((item) => {
                  const received = createdLoan.documents.some((doc) => doc.category === item.category);
                  return (
                    <li key={item.category} className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span
                        className={
                          received
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                            : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                        }
                      >
                        {received ? "Reçu" : "Requis"}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="doc-category" className="text-xs font-semibold text-slate-700">
                    Catégorie
                  </label>
                  <select
                    id="doc-category"
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as LoanDocumentCategory)}
                    className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {DOCUMENT_CHECKLIST.map((item) => (
                      <option key={item.category} value={item.category}>
                        {item.label}
                      </option>
                    ))}
                    <option value="other">Autre</option>
                  </select>
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="text-xs"
                />
                <button
                  type="button"
                  onClick={handleUploadDocument}
                  disabled={!docFile || uploading}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2"
                >
                  {uploading ? "Envoi…" : "+ Ajouter un document"}
                </button>
              </div>
            </div>
          )}

          {step === 6 && createdLoan && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700">Garanties proposées</h3>

              {createdLoan.collateral.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {createdLoan.collateral.map((c) => (
                    <li key={c.id} className="text-sm">
                      {c.description} — {formatAmount(c.estimatedValue, c.currency)}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="coll-type" className="text-xs font-semibold text-slate-700">
                    Type
                  </label>
                  <select
                    id="coll-type"
                    value={collType}
                    onChange={(e) => setCollType(e.target.value as LoanCollateralType)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="terrain">Terrain</option>
                    <option value="immeuble">Immeuble</option>
                    <option value="vehicule">Véhicule</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Valeur estimée</label>
                  <input
                    type="number"
                    min="0"
                    value={collValue}
                    onChange={(e) => setCollValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Description</label>
                  <input
                    value={collDescription}
                    onChange={(e) => setCollDescription(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Propriétaire</label>
                  <input
                    value={collOwner}
                    onChange={(e) => setCollOwner(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddCollateral}
                disabled={addingCollateral}
                className="mt-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2"
              >
                {addingCollateral ? "Ajout…" : "+ Ajouter une garantie"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Une garantie n&apos;est pas considérée comme validée simplement parce qu&apos;elle est
                déclarée ici : vérification par l&apos;équipe crédit avant tout décaissement.
              </p>
            </div>
          )}

          {step === 7 && createdLoan && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700">Récapitulatif</h3>
              <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                <p className="font-medium">{createdLoan.purpose}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {formatAmount(createdLoan.principal, createdLoan.currency)} sur{" "}
                  {createdLoan.termMonths} mois · Mensualité{" "}
                  {formatAmount(createdLoan.monthlyPayment, createdLoan.currency)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {createdLoan.documents.length} document(s) · {createdLoan.collateral.length} garantie(s)
                </p>
              </div>
              <p className="mt-3 text-sm text-emerald-700">
                Demande #{createdLoan.id} enregistrée — statut : soumise, en attente d&apos;analyse.
              </p>
              <button
                type="button"
                onClick={resetWizard}
                className="mt-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2"
              >
                Terminé
              </button>
            </div>
          )}

          {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

          {step < 7 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-between">
              <button
                type="button"
                onClick={step === 1 ? resetWizard : goBack}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
              >
                {step === 1 ? "Annuler" : "← Retour"}
              </button>
              {step === 4 ? (
                <button
                  type="button"
                  onClick={handleSubmitApplication}
                  disabled={applying || !quote}
                  className="rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold px-4 py-2 text-sm"
                >
                  {applying ? "Envoi…" : "Soumettre la demande"}
                </button>
              ) : step >= 5 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(s + 1, TOTAL_STEPS))}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 text-sm"
                >
                  Continuer →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 text-sm"
                >
                  Continuer →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-700">Mes prêts</h3>
        <div className="mt-3 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : loans.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune demande de prêt pour le moment.</p>
          ) : (
            loans.map((loan) => {
              const nextInstallment = loan.installments.find((i) => !i.paid);
              const status = STATUS_LABELS[loan.status];
              const health = HEALTH_LABELS[loan.repaymentHealth];
              const expanded = expandedLoanId === loan.id;
              return (
                <div key={loan.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{loan.purpose}</p>
                    <div className="flex items-center gap-2">
                      {health && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${health.className}`}>
                          {health.label}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatAmount(loan.principal, loan.currency)} sur {loan.termMonths} mois à{" "}
                    {loan.annualInterestRate}%/an · Mensualité {formatAmount(loan.monthlyPayment, loan.currency)}
                  </p>
                  {loan.status === "rejected" && loan.rejectionReason && (
                    <p className="mt-1 text-xs text-red-600">Motif : {loan.rejectionReason}</p>
                  )}
                  {loan.status === "active" && nextInstallment && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-slate-600">
                        Prochaine échéance ({formatDate(nextInstallment.dueDate)}) :{" "}
                        {formatAmount(nextInstallment.amount, loan.currency)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handlePay(loan.id)}
                        disabled={payingLoanId === loan.id}
                        className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5"
                      >
                        {payingLoanId === loan.id ? "Paiement…" : "Payer l'échéance"}
                      </button>
                    </div>
                  )}
                  {loan.status === "paid_off" && (
                    <p className="mt-1 text-xs text-emerald-700">Prêt intégralement remboursé.</p>
                  )}

                  {loan.disbursementMode === "tranches" && loan.tranches && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-slate-600">Décaissement par tranches</p>
                      <ul className="mt-1 space-y-0.5">
                        {loan.tranches.map((tranche) => (
                          <li key={tranche.id} className="text-xs text-slate-600 flex items-center gap-2">
                            <span
                              className={
                                tranche.status === "released"
                                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                                  : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                              }
                            >
                              {tranche.status === "released" ? "Libérée" : "En attente"}
                            </span>
                            {tranche.label} — {formatAmount(tranche.amount, loan.currency)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedLoanId(expanded ? null : loan.id)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      {expanded ? "Masquer l'historique ▲" : "Voir l'historique ▼"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocsPanelLoanId(docsPanelLoanId === loan.id ? null : loan.id)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      {docsPanelLoanId === loan.id
                        ? "Masquer les documents ▲"
                        : `Documents (${loan.documents.length}) ▼`}
                    </button>
                  </div>

                  {docsPanelLoanId === loan.id && (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      {loan.documents.length > 0 && (
                        <ul className="space-y-1">
                          {loan.documents.map((doc) => (
                            <li key={doc.id} className="text-xs text-slate-600">
                              <a
                                href={`/api/credit/loans/${loan.id}/documents/${doc.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-600 hover:text-orange-700 font-medium"
                              >
                                {doc.fileName}
                              </a>{" "}
                              <span className="text-slate-400">
                                ({DOCUMENT_CHECKLIST.find((d) => d.category === doc.category)?.label || doc.category}
                                , {formatDate(doc.uploadedAt)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          aria-label="Catégorie du document"
                          value={docUploadCategory[loan.id] || "other"}
                          onChange={(e) =>
                            setDocUploadCategory((prev) => ({
                              ...prev,
                              [loan.id]: e.target.value as LoanDocumentCategory,
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        >
                          {DOCUMENT_CHECKLIST.map((item) => (
                            <option key={item.category} value={item.category}>
                              {item.label}
                            </option>
                          ))}
                          <option value="other">Autre</option>
                        </select>
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          onChange={(e) =>
                            setDocUploadFile((prev) => ({ ...prev, [loan.id]: e.target.files?.[0] || null }))
                          }
                          className="text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleUploadToExistingLoan(loan.id)}
                          disabled={!docUploadFile[loan.id] || uploadingLoanId === loan.id}
                          className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5"
                        >
                          {uploadingLoanId === loan.id ? "Envoi…" : "+ Ajouter"}
                        </button>
                      </div>
                    </div>
                  )}

                  {expanded && (
                    <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                      {loan.auditLog.map((entry) => (
                        <li key={entry.id} className="text-xs text-slate-500">
                          <span className="text-slate-400">{formatDateTime(entry.at)}</span> —{" "}
                          {AUDIT_ACTION_LABELS[entry.action] || entry.action}
                          {entry.note ? ` (${entry.note})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
