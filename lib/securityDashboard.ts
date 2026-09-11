import { listUsers } from '@/lib/adminStore';
import { listRateLimitBuckets } from '@/lib/rateLimit';
import { listStoredRoles, listRoleAudit, isAssignmentActive } from '@/lib/roleStore';
import { listSecurityEvents } from '@/lib/securityStore';

const DAY_MS = 24 * 60 * 60 * 1000;

function isRecent(value: string, thresholdMs: number) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= thresholdMs;
}

export async function buildSecurityDashboardSummary() {
  const [securityEvents, roleAssignments, roleAudit] = await Promise.all([
    listSecurityEvents(),
    listStoredRoles(),
    listRoleAudit(),
  ]);

  const users = listUsers();
  const rateLimitBuckets = listRateLimitBuckets(['otp-request:', 'otp-verify:', 'admin-login:']);
  const throttledBuckets = rateLimitBuckets.filter((bucket) => !bucket.allowed);
  const sortedSecurityEvents = [...securityEvents].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
  const sortedRoleAudit = [...roleAudit].sort(
    (left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()
  );
  const recentEvents24h = sortedSecurityEvents.filter((event) => isRecent(event.createdAt, DAY_MS));
  const inactiveAssignments = Object.values(roleAssignments).filter((assignment) => !isAssignmentActive(assignment));
  const privilegedAssignments = Object.values(roleAssignments).filter(
    (assignment) =>
      isAssignmentActive(assignment) &&
      ['admin', 'director', 'accountant', 'credit-agent', 'credit-committee'].includes(assignment.role)
  );

  return {
    summary: {
      inactiveUsers: users.filter((user) => !user.active).length,
      inactiveAssignments: inactiveAssignments.length,
      privilegedAssignments: privilegedAssignments.length,
      throttledSources: throttledBuckets.length,
      alerts24h: recentEvents24h.filter((event) => event.severity !== 'info').length,
    },
    authActivity: {
      otpRequested24h: recentEvents24h.filter((event) => event.type === 'otp_requested').length,
      otpFailures24h: recentEvents24h.filter((event) =>
        event.type === 'otp_verify_failed' || event.type === 'otp_verify_rate_limited'
      ).length,
      adminFailures24h: recentEvents24h.filter((event) =>
        event.type === 'admin_login_failed' || event.type === 'admin_login_rate_limited'
      ).length,
      adminSuccess24h: recentEvents24h.filter((event) => event.type === 'admin_login_succeeded').length,
    },
    throttledBuckets: throttledBuckets.slice(0, 10),
    recentEvents: sortedSecurityEvents.slice(0, 30),
    recentRoleAudit: sortedRoleAudit.slice(0, 10),
  };
}
