import { getDaysLate, getRepaymentHealth, Loan } from '@/lib/loanStore';

export type PortfolioAlertSeverity = 'critical' | 'warning' | 'info';

export type PortfolioAlert = {
  id: string;
  severity: PortfolioAlertSeverity;
  title: string;
  description: string;
  recommendedAction: string;
  affectedLoanIds: string[];
};

const SEVERITY_ORDER: Record<PortfolioAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

const SEVERE_DELAY_DAYS = 60;
const STALE_REVIEW_DAYS = 7;
const HIGH_VALUE_THRESHOLD = 5000;
const DEFAULT_RATE_WARNING = 0.15;
const CONCENTRATION_THRESHOLD = 0.3;

// Détection d'anomalies à base de règles explicites sur les données réelles
// du portefeuille crédit — ce n'est pas un modèle prédictif entraîné, juste
// des seuils métier appliqués aux prêts existants (pas d'IA/ML réelle).
export function detectPortfolioAlerts(loans: Loan[]): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];
  const activeLoans = loans.filter((loan) => loan.status === 'active');

  const defaultedLoans = activeLoans.filter((loan) => getRepaymentHealth(loan) === 'defaulted');
  const lateLoans = activeLoans.filter((loan) => getRepaymentHealth(loan) === 'late');

  if (activeLoans.length > 0) {
    const defaultRate = defaultedLoans.length / activeLoans.length;
    if (defaultRate > DEFAULT_RATE_WARNING) {
      alerts.push({
        id: 'default-rate-high',
        severity: 'critical',
        title: "Taux d'impayés élevé sur le portefeuille",
        description: `${defaultedLoans.length} crédit(s) actif(s) sur ${activeLoans.length} (${Math.round(
          defaultRate * 100
        )}%) sont en situation d'impayé.`,
        recommendedAction: 'Prioriser le recouvrement sur les dossiers concernés.',
        affectedLoanIds: defaultedLoans.map((loan) => loan.id),
      });
    }
  }

  for (const loan of defaultedLoans) {
    const daysLate = getDaysLate(loan);
    if (daysLate > SEVERE_DELAY_DAYS) {
      const next = loan.installments.find((installment) => !installment.paid);
      alerts.push({
        id: `severe-delay-${loan.id}`,
        severity: 'critical',
        title: `Retard sévère — ${loan.borrower.fullName || loan.identity}`,
        description: `Dossier ${loan.id}: ${daysLate} jours de retard sur l'échéance courante${
          next ? ` (${next.amount.toLocaleString('fr-FR')} ${loan.currency} à risque)` : ''
        }.`,
        recommendedAction: 'Escalader le dossier et examiner les garanties disponibles.',
        affectedLoanIds: [loan.id],
      });
    }
  }

  const highValueNoCollateral = activeLoans.filter(
    (loan) => loan.principal > HIGH_VALUE_THRESHOLD && loan.collateral.length === 0
  );
  if (highValueNoCollateral.length > 0) {
    alerts.push({
      id: 'no-collateral-high-value',
      severity: 'warning',
      title: 'Crédits importants sans garantie déclarée',
      description: `${highValueNoCollateral.length} crédit(s) actif(s) de plus de ${HIGH_VALUE_THRESHOLD.toLocaleString(
        'fr-FR'
      )} sans garantie enregistrée au dossier.`,
      recommendedAction: 'Demander une déclaration de garantie complémentaire.',
      affectedLoanIds: highValueNoCollateral.map((loan) => loan.id),
    });
  }

  const totalActivePrincipal = activeLoans.reduce((sum, loan) => sum + loan.principal, 0);
  if (totalActivePrincipal > 0) {
    const concentrated = activeLoans.filter(
      (loan) => loan.principal / totalActivePrincipal > CONCENTRATION_THRESHOLD
    );
    if (concentrated.length > 0) {
      alerts.push({
        id: 'concentration-risk',
        severity: 'warning',
        title: 'Concentration excessive sur un dossier',
        description: `${concentrated.length} crédit(s) représentent chacun plus de ${Math.round(
          CONCENTRATION_THRESHOLD * 100
        )}% du capital actif total du portefeuille.`,
        recommendedAction: 'Diversifier les octrois à venir, surveiller ces dossiers de près.',
        affectedLoanIds: concentrated.map((loan) => loan.id),
      });
    }
  }

  const staleUnderReview = loans.filter((loan) => {
    if (loan.status !== 'under_review') return false;
    const since = loan.reviewedAt ? new Date(loan.reviewedAt).getTime() : new Date(loan.createdAt).getTime();
    return (Date.now() - since) / (1000 * 60 * 60 * 24) > STALE_REVIEW_DAYS;
  });
  if (staleUnderReview.length > 0) {
    alerts.push({
      id: 'stale-review',
      severity: 'warning',
      title: 'Dossiers en analyse prolongée',
      description: `${staleUnderReview.length} dossier(s) en analyse depuis plus de ${STALE_REVIEW_DAYS} jours sans décision.`,
      recommendedAction: "Relancer l'agent ou le comité assigné.",
      affectedLoanIds: staleUnderReview.map((loan) => loan.id),
    });
  }

  if (lateLoans.length > 0) {
    alerts.push({
      id: 'late-loans',
      severity: 'info',
      title: `${lateLoans.length} crédit(s) en retard`,
      description: "En dessous du seuil d'impayé mais à surveiller avant dégradation.",
      recommendedAction: 'Envoyer un rappel de paiement préventif.',
      affectedLoanIds: lateLoans.map((loan) => loan.id),
    });
  }

  const unassignedSubmitted = loans.filter(
    (loan) => loan.status === 'submitted' && !loan.assignedAgentIdentity
  );
  if (unassignedSubmitted.length > 0) {
    alerts.push({
      id: 'unassigned-submitted',
      severity: 'info',
      title: 'Dossiers soumis sans agent assigné',
      description: `${unassignedSubmitted.length} nouvelle(s) demande(s) n'ont pas encore d'agent crédit assigné.`,
      recommendedAction: 'Assigner un agent pour démarrer l\'analyse.',
      affectedLoanIds: unassignedSubmitted.map((loan) => loan.id),
    });
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
