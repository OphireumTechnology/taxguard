import type { Json } from '../../../../ai/types';
import {
  type WorkforceAgentContext,
  type WorkforceAgentSpec,
  type WorkforceDomainHandlerResult,
} from '../contracts';

const SRC = 'src/server/ai/workforce/batches/batch6AdminGovernance.ts';

function intOr(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isSafeInteger(v) ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
}

/** A51: Audit Trail Agent — inspects tenant audit event sequences for missing correlation IDs or gaps. */
export function runA51AuditTrail(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const totalEvents = intOr(payload.audit_event_count, 0);
  const missingCorrelation = intOr(payload.events_missing_correlation, 0);
  const unlinkedDecisions = intOr(payload.unlinked_decision_count, 0);
  const anomalies = missingCorrelation + unlinkedDecisions;

  return {
    status: anomalies > 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Audit trail inspection over ${totalEvents} event(s): ${anomalies} integrity anomaly(ies) detected.`,
    findings: [
      {
        code: anomalies > 0 ? 'AUDIT_TRAIL_INTEGRITY_ANOMALY' : 'AUDIT_TRAIL_CONTINUOUS',
        severity: anomalies > 0 ? 'HIGH' : 'INFO',
        summary: anomalies > 0
          ? `Missing correlation IDs: ${missingCorrelation}; unlinked decisions: ${unlinkedDecisions}.`
          : `All ${totalEvents} tenant audit events are correlated and linked.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Compliance officer reviews audit log continuity; historical audit rows are never rewritten.',
      },
    ],
    structured_data: { total_events: totalEvents, missing_correlation: missingCorrelation, unlinked_decisions: unlinkedDecisions },
  };
}

/** A52: Compliance Agent — evaluates maker-checker, stage-gate, and Circular 230 workflow policy compliance. */
export function runA52Compliance(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const selfReviews = intOr(payload.maker_checker_violations, 0);
  const skippedGates = intOr(payload.skipped_stage_gates, 0);
  const unreviewedDisclosures = intOr(payload.unreviewed_disclosures, 0);
  const violations = selfReviews + skippedGates + unreviewedDisclosures;

  return {
    status: violations > 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Compliance policy check: ${violations} policy deviation(s) detected across tenant workflow records.`,
    findings: [
      {
        code: violations > 0 ? 'WORKFLOW_POLICY_DEVIATIONS' : 'WORKFLOW_POLICY_COMPLIANT_ADVISORY',
        severity: violations > 0 ? 'CRITICAL' : 'INFO',
        summary: `Maker-checker violations: ${selfReviews}, skipped stage gates: ${skippedGates}, unreviewed disclosures: ${unreviewedDisclosures}.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['Circular 230 §10.36 (Procedures to Ensure Compliance)'],
        recommended_human_action: 'Compliance officer investigates deviations and documents corrective governance actions.',
      },
    ],
    structured_data: { violations, maker_checker_violations: selfReviews, skipped_stage_gates: skippedGates },
    authority_citations: ['Circular 230 §10.36'],
  };
}

/** A53: Privacy Agent — inspects metadata descriptors for unredacted PII/secret exposure risks without logging raw PII. */
export function runA53Privacy(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const flaggedFields = strArray(payload.unmasked_pii_field_names);
  const nonEncryptedChannels = intOr(payload.unencrypted_export_attempts, 0);
  const totalIssues = flaggedFields.length + nonEncryptedChannels;

  return {
    status: totalIssues > 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Privacy boundary inspection: ${totalIssues} sensitive-data handling finding(s) (no raw PII logged).`,
    findings: [
      {
        code: totalIssues > 0 ? 'PRIVACY_BOUNDARY_ALERT' : 'PRIVACY_BOUNDARY_CLEAN_ADVISORY',
        severity: totalIssues > 0 ? 'CRITICAL' : 'INFO',
        summary: totalIssues > 0
          ? `Flagged metadata field names: ${flaggedFields.join(', ') || 'none'}; unencrypted export attempts: ${nonEncryptedChannels}.`
          : 'No unmasked PII metadata fields or unauthorized export attempts detected.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §7216', 'FTC Safeguards Rule (16 CFR Part 314)'],
        recommended_human_action: 'Security/privacy administrator reviews DLP controls and revokes any non-compliant export path.',
      },
    ],
    structured_data: { flagged_field_count: flaggedFields.length, unencrypted_export_attempts: nonEncryptedChannels, raw_pii_logged: false },
    authority_citations: ['IRC §7216', '16 CFR Part 314'],
  };
}

/** A54: Security Agent — evaluates auth denials, cross-tenant probes, and brute-force/session anomalies. */
export function runA54Security(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const crossTenantAttempts = intOr(payload.cross_tenant_attempts_24h, 0);
  const failedLogins = intOr(payload.failed_auth_events_24h, 0);
  const promptInjectionFlags = intOr(payload.prompt_injection_events_24h, 0);
  const critical = crossTenantAttempts > 0 || promptInjectionFlags > 0 || failedLogins >= 25;

  return {
    status: critical ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Security telemetry (24h): ${crossTenantAttempts} cross-tenant probe(s), ${promptInjectionFlags} prompt-injection flag(s), ${failedLogins} auth failure(s).`,
    findings: [
      {
        code: critical ? 'SECURITY_ANOMALY_ESCALATION' : 'SECURITY_POSTURE_NOMINAL_ADVISORY',
        severity: critical ? 'CRITICAL' : 'INFO',
        summary: critical
          ? 'Elevated security anomaly counters require immediate security administrator review.'
          : 'No critical security anomalies detected in the 24h window.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Security administrator inspects Security Events log and evaluates session revocation or kill switch.',
      },
    ],
    structured_data: {
      cross_tenant_attempts_24h: crossTenantAttempts,
      failed_auth_events_24h: failedLogins,
      prompt_injection_events_24h: promptInjectionFlags,
      automated_lockout_executed: false,
    },
  };
}

/** A55: Access-Control Agent — reviews RBAC/RLS anomalies, expired credentials, and stale staff assignments. */
export function runA55AccessControl(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const expiredCredentials = intOr(payload.expired_staff_credentials, 0);
  const orphanedAssignments = intOr(payload.inactive_staff_with_active_cases, 0);
  const mfaUnenrolled = intOr(payload.staff_without_mfa, 0);
  const total = expiredCredentials + orphanedAssignments + mfaUnenrolled;

  return {
    status: total > 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `RBAC/RLS review: ${total} access hygiene finding(s) (${expiredCredentials} expired credentials, ${orphanedAssignments} orphaned case assignments, ${mfaUnenrolled} MFA gaps).`,
    findings: [
      {
        code: total > 0 ? 'ACCESS_CONTROL_ANOMALIES_FOUND' : 'ACCESS_CONTROL_VERIFIED_ADVISORY',
        severity: mfaUnenrolled > 0 || orphanedAssignments > 0 ? 'CRITICAL' : total > 0 ? 'HIGH' : 'INFO',
        summary: `Identified ${total} RBAC/RLS remediation item(s). Agent never modifies permissions autonomously.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Administrator updates staff roles/assignments via Staff Access Management.',
      },
    ],
    structured_data: {
      expired_staff_credentials: expiredCredentials,
      inactive_staff_with_active_cases: orphanedAssignments,
      staff_without_mfa: mfaUnenrolled,
      permissions_mutated: false,
    },
  };
}

/** A56: AI Governance Agent — audits model approvals, prompt versions, kill switches, and DRAFT boundary adherence. */
export function runA56AiGovernance(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const activeKillSwitches = intOr(payload.active_kill_switches, 0);
  const unapprovedModelAttempts = intOr(payload.unapproved_model_attempts, 0);
  const budgetBreaches = intOr(payload.budget_breaches, 0);
  const issues = unapprovedModelAttempts + budgetBreaches;

  return {
    status: issues > 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `AI governance audit: ${activeKillSwitches} active kill switch(es), ${unapprovedModelAttempts} unapproved model attempt(s), ${budgetBreaches} budget breach(es).`,
    findings: [
      {
        code: issues > 0 ? 'AI_GOVERNANCE_POLICY_BREACH' : 'AI_GOVERNANCE_BOUNDARIES_INTACT',
        severity: issues > 0 ? 'HIGH' : 'INFO',
        summary: `Monitored AI gateway & registry boundaries; no agent commissioning state changed.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Governance administrator reviews AI Control Center and Kill Switch status.',
      },
    ],
    structured_data: {
      active_kill_switches: activeKillSwitches,
      unapproved_model_attempts: unapprovedModelAttempts,
      budget_breaches: budgetBreaches,
      commissioning_changed: false,
    },
  };
}

/** A57: Hallucination/Verification Agent — challenges AI conclusions lacking verified evidence IDs or authority citations. */
export function runA57HallucinationVerification(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const claims = Array.isArray(payload.claims) ? payload.claims : [];
  const unsupported: Json[] = [];
  let supportedCount = 0;

  for (const claim of claims) {
    if (!claim || typeof claim !== 'object') continue;
    const c = claim as Record<string, unknown>;
    const claimId = typeof c.claim_id === 'string' ? c.claim_id : 'unknown';
    const evIds = strArray(c.evidence_source_ids);
    const citations = strArray(c.authority_citations);
    if (evIds.length === 0 && citations.length === 0) {
      unsupported.push({ claim_id: claimId, reason: 'NO_EVIDENCE_OR_AUTHORITY_CITATION' });
    } else {
      supportedCount++;
    }
  }

  return {
    status: unsupported.length > 0 ? 'EVIDENCE_REQUIRED' : 'ADVISORY',
    summary: `Verification challenge inspected ${claims.length} AI claim(s): ${supportedCount} backed by evidence/authority, ${unsupported.length} unsupported claim(s) flagged.`,
    findings: [
      {
        code: unsupported.length > 0 ? 'UNSUPPORTED_AI_CLAIMS_FLAGGED' : 'AI_CLAIMS_GROUNDED_ADVISORY',
        severity: unsupported.length > 0 ? 'HIGH' : 'INFO',
        summary: unsupported.length > 0
          ? `Flagged ${unsupported.length} unsupported conclusion(s) lacking evidence or primary authority.`
          : `All ${supportedCount} claim(s) reference evidence or primary authority.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Human reviewer must reject or substantiate every flagged claim before use.',
      },
    ],
    structured_data: { supported_count: supportedCount, unsupported_claims: unsupported },
  };
}

/** A58: System Health Agent — analyzes backend readiness probes, DB schema verification, and job queue backlog. */
export function runA58SystemHealth(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const dbReady = payload.database_ready === true;
  const authReady = payload.auth_ready === true;
  const failedJobs = intOr(payload.failed_jobs_count, 0);
  const error5xx = intOr(payload.http_5xx_count_1h, 0);
  const degraded = !dbReady || !authReady || failedJobs > 0 || error5xx > 0;

  return {
    status: degraded ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: degraded
      ? `System health DEGRADED: db=${dbReady}, auth=${authReady}, failed_jobs=${failedJobs}, 5xx_1h=${error5xx}.`
      : 'System health probes nominal across database, auth, and worker queue.',
    findings: [
      {
        code: degraded ? 'SYSTEM_HEALTH_DEGRADED' : 'SYSTEM_HEALTH_NOMINAL',
        severity: !dbReady || !authReady ? 'CRITICAL' : degraded ? 'WARNING' : 'INFO',
        summary: `Database ready: ${dbReady}; Auth ready: ${authReady}; Failed jobs: ${failedJobs}; 5xx (1h): ${error5xx}.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Operations administrator investigates degraded probes or failed worker jobs.',
      },
    ],
    structured_data: { database_ready: dbReady, auth_ready: authReady, failed_jobs: failedJobs, http_5xx_1h: error5xx },
  };
}

/** A59: Provider Integration Agent — inspects external provider readiness without exposing secrets or keys. */
export function runA59ProviderIntegration(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const providers = Array.isArray(payload.providers) ? payload.providers : [];
  const unavailable: string[] = [];
  const configured: string[] = [];

  for (const p of providers) {
    if (!p || typeof p !== 'object') continue;
    const rec = p as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name : 'UNKNOWN';
    if (rec.operational === true) configured.push(name);
    else unavailable.push(name);
  }

  return {
    status: unavailable.length > 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Provider connectivity status: ${configured.length} operational, ${unavailable.length} unavailable/unconfigured (${unavailable.join(', ') || 'none'}).`,
    findings: [
      {
        code: unavailable.length > 0 ? 'PROVIDERS_UNAVAILABLE_OR_UNCONFIGURED' : 'PROVIDERS_OPERATIONAL',
        severity: unavailable.length > 0 ? 'WARNING' : 'INFO',
        summary: `Operational: ${configured.join(', ') || 'none'}; Unavailable: ${unavailable.join(', ') || 'none'}. No credentials exposed.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Administrator configures approved providers via server environment controls.',
      },
    ],
    structured_data: { operational_providers: configured, unavailable_providers: unavailable, credentials_exposed: false },
  };
}

/** A60: Practice Intelligence Agent — computes deterministic tenant workload distribution and bottleneck stage metrics. */
export function runA60PracticeIntelligence(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const stageCounts = (payload.cases_by_stage && typeof payload.cases_by_stage === 'object'
    ? payload.cases_by_stage
    : {}) as Record<string, unknown>;
  let totalCases = 0;
  let bottleneckStage: string | null = null;
  let maxStageCount = 0;

  for (const [stage, count] of Object.entries(stageCounts)) {
    const n = intOr(count, 0);
    totalCases += n;
    if (n > maxStageCount) {
      maxStageCount = n;
      bottleneckStage = stage;
    }
  }

  return {
    status: 'ADVISORY',
    summary: `Practice workload analytics across ${totalCases} active case(s): primary bottleneck stage ${bottleneckStage ?? 'none'} (${maxStageCount} case(s)).`,
    findings: [
      {
        code: 'PRACTICE_WORKLOAD_SUMMARIZED',
        severity: 'INFO',
        summary: `Computed exact tenant workload distribution from recorded case counts; zero synthetic/estimated metrics.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Practice manager reviews staffing allocation and reassignment queue.',
      },
    ],
    structured_data: { total_cases: totalCases, bottleneck_stage: bottleneckStage, bottleneck_case_count: maxStageCount },
  };
}

const ADMIN_GOV_ROLES = ['admin', 'super_admin', 'compliance', 'practice_manager', 'senior_reviewer'] as const;

export const BATCH_6_AGENT_SPECS: readonly WorkforceAgentSpec[] = Object.freeze([
  {
    agent_id: 'A51', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'Audit Trail Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['compliance', 'admin', 'super_admin'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE'],
    authorized_inputs: ['scope', 'audit_event_count', 'events_missing_correlation', 'unlinked_decision_count'],
    authorized_tools: ['database.read'], data_classes: ['INTERNAL', 'AUDIT_DATA'],
    output_audience: 'COMPLIANCE_SECURITY_ADMIN', risk_level: 'HIGH',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA51AuditTrail',
    handler: runA51AuditTrail,
  },
  {
    agent_id: 'A52', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'Compliance Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['compliance', 'admin', 'super_admin'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE'],
    authorized_inputs: ['scope', 'maker_checker_violations', 'skipped_stage_gates', 'unreviewed_disclosures'],
    authorized_tools: ['database.read', 'workflow.read'], data_classes: ['INTERNAL', 'AUDIT_DATA'],
    output_audience: 'COMPLIANCE_SECURITY_ADMIN', risk_level: 'HIGH',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA52Compliance',
    handler: runA52Compliance,
  },
  {
    agent_id: 'A53', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'Privacy Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['compliance', 'admin', 'super_admin'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE'],
    authorized_inputs: ['scope', 'unmasked_pii_field_names', 'unencrypted_export_attempts'],
    authorized_tools: ['database.read'], data_classes: ['INTERNAL', 'AUDIT_DATA'],
    output_audience: 'COMPLIANCE_SECURITY_ADMIN', risk_level: 'CRITICAL',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA53Privacy',
    handler: runA53Privacy,
  },
  {
    agent_id: 'A54', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'Security Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['admin', 'super_admin', 'compliance'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE'],
    authorized_inputs: ['scope', 'cross_tenant_attempts_24h', 'failed_auth_events_24h', 'prompt_injection_events_24h'],
    authorized_tools: ['database.read'], data_classes: ['INTERNAL', 'AUDIT_DATA'],
    output_audience: 'COMPLIANCE_SECURITY_ADMIN', risk_level: 'CRITICAL',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA54Security',
    handler: runA54Security,
  },
  {
    agent_id: 'A55', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'Access-Control Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['admin', 'super_admin'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE'],
    authorized_inputs: ['scope', 'expired_staff_credentials', 'inactive_staff_with_active_cases', 'staff_without_mfa'],
    authorized_tools: ['database.read'], data_classes: ['INTERNAL', 'AUDIT_DATA'],
    output_audience: 'COMPLIANCE_SECURITY_ADMIN', risk_level: 'CRITICAL',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA55AccessControl',
    handler: runA55AccessControl,
  },
  {
    agent_id: 'A56', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'AI Governance Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['admin', 'super_admin', 'compliance'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE'],
    authorized_inputs: ['scope', 'active_kill_switches', 'unapproved_model_attempts', 'budget_breaches'],
    authorized_tools: ['database.read'], data_classes: ['INTERNAL', 'AUDIT_DATA'],
    output_audience: 'COMPLIANCE_SECURITY_ADMIN', risk_level: 'HIGH',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA56AiGovernance',
    handler: runA56AiGovernance,
  },
  {
    agent_id: 'A57', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'Hallucination/Verification Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['reviewer', 'senior_reviewer', 'cpa', 'ea', 'compliance', 'admin', 'super_admin'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'claims'], authorized_tools: ['workflow.read'],
    data_classes: ['INTERNAL', 'AUDIT_DATA'], output_audience: 'STAFF_REVIEWER', risk_level: 'HIGH',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA57HallucinationVerification',
    handler: runA57HallucinationVerification,
  },
  {
    agent_id: 'A58', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'System Health Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['admin', 'super_admin'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE'],
    authorized_inputs: ['scope', 'database_ready', 'auth_ready', 'failed_jobs_count', 'http_5xx_count_1h'],
    authorized_tools: ['database.read'], data_classes: ['INTERNAL'],
    output_audience: 'COMPLIANCE_SECURITY_ADMIN', risk_level: 'MATERIAL',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA58SystemHealth',
    handler: runA58SystemHealth,
  },
  {
    agent_id: 'A59', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'Provider Integration Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['admin', 'super_admin'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE'],
    authorized_inputs: ['scope', 'providers'], authorized_tools: ['database.read'],
    data_classes: ['INTERNAL'], output_audience: 'COMPLIANCE_SECURITY_ADMIN', risk_level: 'MATERIAL',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA59ProviderIntegration',
    handler: runA59ProviderIntegration,
  },
  {
    agent_id: 'A60', batch_id: 'BATCH_6_ADMIN_GOVERNANCE', category: 'GOVERNANCE_SECURITY_PLATFORM',
    overview_name: 'Practice Intelligence Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ADMIN_GOV_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'DISMISS'],
    authorized_inputs: ['scope', 'cases_by_stage'], authorized_tools: ['database.read'],
    data_classes: ['INTERNAL'], output_audience: 'PRACTICE_MANAGER', risk_level: 'LOW',
    requires_case_scope: false, requires_evidence: false, source_path: SRC, handler_name: 'runA60PracticeIntelligence',
    handler: runA60PracticeIntelligence,
  },
]);
