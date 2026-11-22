import type { Json } from '../../../../ai/types';
import { sha256Json } from '../authority';
import {
  WorkforceError,
  type WorkforceAgentContext,
  type WorkforceAgentSpec,
  type WorkforceDomainHandlerResult,
} from '../contracts';

const SRC = 'src/server/ai/workforce/batches/batch4ReviewRelease.ts';

function intOr(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isSafeInteger(v) ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
}

/** A32: Exception Agent — classifies open case exceptions and routes to responsible human reviewer role. */
export function runA32Exception(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const items = Array.isArray(payload.exceptions) ? payload.exceptions : [];
  const routed: Json[] = [];
  let criticalCount = 0;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const code = typeof rec.code === 'string' ? rec.code : 'UNSPECIFIED_EXCEPTION';
    const sev = typeof rec.severity === 'string' ? rec.severity.toUpperCase() : 'WARNING';
    if (sev === 'CRITICAL' || sev === 'HIGH') criticalCount++;
    routed.push({
      code,
      severity: sev,
      routed_to_role: sev === 'CRITICAL' ? 'CPA_EA' : 'REVIEWER',
      auto_resolved: false,
    });
  }

  return {
    status: criticalCount > 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Classified and routed ${routed.length} exception(s) (${criticalCount} high/critical). No exceptions auto-cleared.`,
    findings: [
      {
        code: criticalCount > 0 ? 'CRITICAL_EXCEPTIONS_ROUTED' : 'EXCEPTIONS_ROUTED_ADVISORY',
        severity: criticalCount > 0 ? 'HIGH' : 'INFO',
        summary: `Routed ${routed.length} exception(s) for human resolution.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Reviewer/CPA must investigate and record documented resolution evidence.',
      },
    ],
    structured_data: { routed_exceptions: routed, critical_count: criticalCount },
  };
}

/** A33: Risk & Materiality Agent — deterministic materiality scoring; NEVER authorizes automatic approval (OV-09). */
export function runA33RiskMateriality(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const grossIncome = intOr(payload.gross_income_cents, 0);
  const disputedAmount = intOr(payload.disputed_position_cents, 0);
  const openExceptions = intOr(payload.open_exceptions, 0);
  const hasForeignReporting = payload.has_foreign_reporting === true;

  let score = 0;
  if (grossIncome >= 50_000_000) score += 25; // >= $500k
  if (disputedAmount >= 500_000) score += 35; // >= $5,000
  if (openExceptions > 0) score += Math.min(30, openExceptions * 10);
  if (hasForeignReporting) score += 25;
  score = Math.min(100, score);
  const tier = score >= 60 ? 'CRITICAL' : score >= 30 ? 'HIGH' : 'MATERIAL';

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Materiality risk score ${score}/100 (${tier}). Per OV-09, human review is ALWAYS required regardless of risk score.`,
    findings: [
      {
        code: `RISK_TIER_${tier}`,
        severity: tier === 'CRITICAL' ? 'CRITICAL' : tier === 'HIGH' ? 'HIGH' : 'INFO',
        summary: `Computed risk score ${score}/100; automatic approval is strictly prohibited (OV-09).`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['TaxGuard OV-09 (Always Human Review)'],
        recommended_human_action: 'CPA/EA must evaluate material tax positions and document risk sign-off.',
      },
    ],
    structured_data: {
      risk_score: score,
      risk_tier: tier,
      auto_approval_permitted: false,
      human_review_required: true,
    },
    authority_citations: ['TaxGuard OV-09'],
  };
}

/** A34: Reviewer Agent — AI-assisted second-level review questions & evidence completeness (extends canonical A34). */
export function runA34ReviewerSupport(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const openQuestions = strArray(payload.review_questions);
  const workpapersComplete = payload.workpapers_complete === true;
  const unresolvedDiagnostics = intOr(payload.unresolved_diagnostics, 0);

  const generatedQuestions: string[] = [...openQuestions];
  if (!workpapersComplete) generatedQuestions.push('Confirm all supporting workpapers are linked to verified source documents.');
  if (unresolvedDiagnostics > 0) generatedQuestions.push(`Resolve ${unresolvedDiagnostics} open return diagnostic(s) before final QC.`);
  if (ctx.evidence.length === 0) generatedQuestions.push('Attach at least one clean verified evidence record to this review.');

  return {
    status: generatedQuestions.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Second-level review support generated ${generatedQuestions.length} review question(s); maker-checker separation preserved.`,
    findings: [
      {
        code: generatedQuestions.length ? 'REVIEW_QUESTIONS_IDENTIFIED' : 'REVIEW_SUPPORT_COMPLETE',
        severity: unresolvedDiagnostics > 0 ? 'HIGH' : 'INFO',
        summary: generatedQuestions.join(' ') || 'No additional review questions identified.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Independent reviewer (distinct from preparer) must complete Stage 13/14 attestation.',
      },
    ],
    structured_data: {
      review_questions: generatedQuestions,
      workpapers_complete: workpapersComplete,
      unresolved_diagnostics: unresolvedDiagnostics,
      workflow_advanced: false,
    },
  };
}

/** A35: Quality-Control Agent — independent final QC checklist audit prior to signature/release. */
export function runA35QualityControl(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const checks = {
    second_level_review_signed: payload.second_level_review_signed === true,
    zero_critical_diagnostics: intOr(payload.critical_diagnostics, 0) === 0,
    reconciliations_tied: payload.reconciliations_tied === true,
    citations_verified: payload.citations_verified === true,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);

  return {
    status: failed.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: failed.length
      ? `Independent QC failed ${failed.length} gate(s): ${failed.join(', ')}.`
      : 'Independent QC checklist satisfied; awaiting CPA/EA formal release attestation.',
    findings: [
      {
        code: failed.length ? 'QC_CHECKLIST_GAPS' : 'QC_CHECKLIST_SATISFIED',
        severity: failed.length ? 'HIGH' : 'INFO',
        summary: failed.length ? `Unmet QC gates: ${failed.join(', ')}.` : 'All QC checklist items confirmed.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'CPA/EA completes formal QC sign-off in Quality Control Queue.',
      },
    ],
    structured_data: { checks, failed_checks: failed, qc_approved: false },
  };
}

/** A36: Signature Readiness Agent — verifies Form 8879/8878 prerequisites before taxpayer signature; never signs. */
export function runA36SignatureReadiness(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const checks = {
    qc_approved: payload.qc_approved === true,
    taxpayer_identity_verified: payload.taxpayer_identity_verified === true,
    zero_open_exceptions: intOr(payload.open_exceptions, 0) === 0,
    final_return_locked: payload.final_return_locked === true,
  };
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);

  return {
    status: missing.length ? 'EVIDENCE_REQUIRED' : 'ADVISORY',
    summary: missing.length
      ? `Signature readiness blocked by ${missing.length} unmet prerequisite(s): ${missing.join(', ')}.`
      : 'Signature prerequisites satisfied; staff may route Form 8879 to taxpayer for human signature.',
    findings: [
      {
        code: missing.length ? 'SIGNATURE_PREREQUISITES_UNMET' : 'SIGNATURE_PREREQUISITES_MET',
        severity: missing.length ? 'WARNING' : 'INFO',
        summary: missing.length ? `Missing: ${missing.join(', ')}.` : 'All Form 8879 prerequisites met.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRS Form 8879 e-File Signature Authorization'],
        recommended_human_action: 'Authorized staff initiates taxpayer signature request; AI never signs.',
      },
    ],
    structured_data: { checks, unmet_prerequisites: missing, signature_applied: false },
    authority_citations: ['IRS Form 8879'],
  };
}

/** A37: Filing Readiness Agent — checks whether all pre-filing gates are met; never submits or files. */
export function runA37FilingReadiness(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const checks = {
    form_8879_signed: payload.form_8879_signed === true,
    cpa_release_recorded: payload.cpa_release_recorded === true,
    zero_blocking_diagnostics: intOr(payload.blocking_diagnostics, 0) === 0,
    filing_authorization_confirmed: payload.filing_authorization_confirmed === true,
  };
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);

  return {
    status: missing.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: missing.length
      ? `Filing readiness NOT MET (${missing.join(', ')}). Live e-file remains disabled.`
      : 'Filing readiness prerequisites verified; explicit human filer authorization required before any submission.',
    findings: [
      {
        code: missing.length ? 'FILING_GATES_UNMET' : 'FILING_GATES_VERIFIED_ADVISORY',
        severity: missing.length ? 'HIGH' : 'INFO',
        summary: missing.length ? `Unmet filing gates: ${missing.join(', ')}.` : 'All pre-filing checks met.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Authorized human filer reviews final authorization queue.',
      },
    ],
    structured_data: { checks, unmet_gates: missing, filing_transmitted: false },
  };
}

/** A38: Filing Agent — builds submission package manifest & checksums ONLY; live transmission stays blocked (OV-10). */
export function runA38FilingManifest(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const forms = strArray(payload.included_forms);
  if (forms.length === 0) throw new WorkforceError('FILING_PACKAGE_FORMS_REQUIRED', 400);
  const manifestHash = sha256Json({ scope: ctx.scope, forms: [...forms].sort() });

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Prepared advisory filing manifest (${forms.length} form(s), checksum ${manifestHash.slice(0, 12)}...). Live IRS/state transmission is strictly disabled per OV-10.`,
    findings: [
      {
        code: 'FILING_MANIFEST_PREPARED_TRANSMISSION_BLOCKED',
        severity: 'INFO',
        summary: 'Package manifest assembled for authorized human filer inspection; no external transmission occurred.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['TaxGuard OV-10 (Live Filing Disabled)'],
        recommended_human_action: 'Authorized human filer verifies manifest checksum; live e-file requires separate owner cutover.',
      },
    ],
    structured_data: {
      included_forms: forms,
      manifest_sha256: manifestHash,
      live_transmission_performed: false,
      external_submission_allowed: false,
    },
    authority_citations: ['TaxGuard OV-10'],
  };
}

/**
 * A39: Government Response Agent — RESERVED / UNASSIGNED per owner decision OV-01.
 * Fails closed until the owner supplies a formal responsibility definition and reviewer role.
 */
export function runA39GovernmentResponseReserved(): never {
  throw new WorkforceError('AI_AGENT_RESERVED_PENDING_OWNER_DEFINITION', 503, {
    agent_id: 'A39',
    owner_decision: 'OV-01',
  });
}

/** A40: Rejection Resolution Agent — diagnoses IRS/state MeF rejection codes and proposes corrective workpapers. */
export function runA40RejectionResolution(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const rejectionCode = typeof payload.rejection_code === 'string' ? payload.rejection_code.trim().toUpperCase() : '';
  if (!rejectionCode) throw new WorkforceError('REJECTION_CODE_REQUIRED', 400);

  const catalog: Record<string, { category: string; remediation: string }> = {
    'IND-031-04': { category: 'PRIOR_YEAR_AGI_MISMATCH', remediation: 'Verify prior-year Form 1040 Line 11 AGI or IRS IP PIN with taxpayer.' },
    'R0000-500-01': { category: 'PRIMARY_SSN_NAME_MISMATCH', remediation: 'Verify primary taxpayer last name against Social Security card.' },
    'F8962-070': { category: 'MISSING_FORM_8962', remediation: 'Obtain Form 1095-A from taxpayer and complete Form 8962 reconciliation.' },
  };
  const match = catalog[rejectionCode] ?? {
    category: 'UNMAPPED_MEF_RULE',
    remediation: 'Inspect official IRS/state MeF business rule specification and verify affected return fields manually.',
  };

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Diagnosed rejection ${rejectionCode} (${match.category}). Proposed remediation ready for preparer; return not altered.`,
    findings: [
      {
        code: `REJECTION_${match.category}`,
        severity: 'HIGH',
        summary: `${rejectionCode}: ${match.remediation}`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Preparer must correct underlying workpaper and route corrected return through review & re-authorization.',
      },
    ],
    structured_data: { rejection_code: rejectionCode, diagnosis_category: match.category, recommended_remediation: match.remediation, return_modified: false },
  };
}

/** A41: Tax Notice Agent — classifies IRS/state notices (CP2000, CP14, LTR) and calculates response window for CPA/EA. */
export function runA41TaxNotice(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const noticeCode = typeof payload.notice_code === 'string' ? payload.notice_code.trim().toUpperCase() : '';
  const noticeDate = typeof payload.notice_date === 'string' ? payload.notice_date : '';
  if (!noticeCode || !noticeDate || Number.isNaN(Date.parse(noticeDate))) {
    throw new WorkforceError('TAX_NOTICE_INVALID_INPUT', 400);
  }
  const responseDays = noticeCode.startsWith('CP2000') ? 30 : noticeCode.startsWith('CP3219') ? 90 : 30;
  const dueDate = new Date(Date.parse(noticeDate) + responseDays * 86_400_000).toISOString().slice(0, 10);

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Classified government notice ${noticeCode} (dated ${noticeDate}): statutory response window ${responseDays} days (target ${dueDate}). Routed to CPA/EA.`,
    findings: [
      {
        code: 'GOVERNMENT_NOTICE_CLASSIFIED',
        severity: noticeCode.startsWith('CP3219') ? 'CRITICAL' : 'HIGH',
        summary: `Notice ${noticeCode} requires CPA/EA review before response due date ${dueDate}.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'CPA/EA must verify notice authenticity, Power of Attorney (Form 2848), and draft formal response.',
      },
    ],
    structured_data: { notice_code: noticeCode, notice_date: noticeDate, response_window_days: responseDays, calculated_due_date: dueDate },
  };
}

/** A42: Amendment Agent — computes original vs. corrected line variances & Form 1040-X/1120-X workflow items. */
export function runA42Amendment(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const originalTax = intOr(payload.original_tax_cents, -1);
  const correctedTax = intOr(payload.corrected_tax_cents, -1);
  const reason = typeof payload.amendment_reason === 'string' ? payload.amendment_reason.trim() : '';
  if (originalTax < 0 || correctedTax < 0 || reason.length < 5) {
    throw new WorkforceError('AMENDMENT_INVALID_INPUT', 400);
  }
  const netChange = correctedTax - originalTax;

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Amendment analysis: tax delta ${netChange} cents (${originalTax} → ${correctedTax}). CPA/EA review required before preparing amended return.`,
    findings: [
      {
        code: 'AMENDMENT_WORKFLOW_IDENTIFIED',
        severity: 'HIGH',
        summary: `Net tax change of ${netChange} cents (${netChange > 0 ? 'additional tax due' : netChange < 0 ? 'refund claim' : 'no tax change'}). Reason: ${reason}.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §6511 (Refund Statute of Limitations)', 'Form 1040-X / 1120-X Instructions'],
        recommended_human_action: 'CPA/EA must verify statute of limitations and authorize formal amended return engagement.',
      },
    ],
    structured_data: { original_tax_cents: originalTax, corrected_tax_cents: correctedTax, net_change_cents: netChange, amendment_filed: false },
    authority_citations: ['IRC §6511'],
  };
}

const REVIEW_ROLES = ['accountant', 'reviewer', 'senior_reviewer', 'cpa', 'ea'] as const;

export const BATCH_4_AGENT_SPECS: readonly WorkforceAgentSpec[] = Object.freeze([
  {
    agent_id: 'A32', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'RISK_QC',
    overview_name: 'Exception Agent', workflow_stages: [11, 12, 13],
    allowed_roles: REVIEW_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'exceptions'], authorized_tools: ['workflow.read'],
    data_classes: ['INTERNAL', 'TAX_DATA'], output_audience: 'STAFF_REVIEWER', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA32Exception',
    handler: runA32Exception,
  },
  {
    agent_id: 'A33', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'RISK_QC',
    overview_name: 'Risk & Materiality Agent', workflow_stages: [12, 13, 14],
    allowed_roles: REVIEW_ROLES, required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'gross_income_cents', 'disputed_position_cents', 'open_exceptions', 'has_foreign_reporting'],
    authorized_tools: ['workflow.read'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA33RiskMateriality',
    handler: runA33RiskMateriality,
  },
  {
    agent_id: 'A34', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'RISK_QC',
    overview_name: 'Reviewer Agent', workflow_stages: [12, 13, 14],
    allowed_roles: ['reviewer', 'senior_reviewer', 'cpa', 'ea'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'REJECT_PROPOSAL'],
    authorized_inputs: ['scope', 'review_questions', 'workpapers_complete', 'unresolved_diagnostics', 'evidence_source_ids'],
    authorized_tools: ['workflow.read'], data_classes: ['INTERNAL'],
    output_audience: 'STAFF_REVIEWER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA34ReviewerSupport',
    handler: runA34ReviewerSupport,
  },
  {
    agent_id: 'A35', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'RISK_QC',
    overview_name: 'Quality-Control Agent', workflow_stages: [14, 15],
    allowed_roles: ['reviewer', 'senior_reviewer', 'cpa', 'ea'], required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'second_level_review_signed', 'critical_diagnostics', 'reconciliations_tied', 'citations_verified'],
    authorized_tools: ['workflow.read'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA35QualityControl',
    handler: runA35QualityControl,
  },
  {
    agent_id: 'A36', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'SIGN_FILE_RESOLVE',
    overview_name: 'Signature Readiness Agent', workflow_stages: [15, 16],
    allowed_roles: ['accountant', 'operations', 'reviewer', 'senior_reviewer', 'cpa', 'ea'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'qc_approved', 'taxpayer_identity_verified', 'open_exceptions', 'final_return_locked'],
    authorized_tools: ['workflow.read'], data_classes: ['INTERNAL'],
    output_audience: 'STAFF_REVIEWER', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA36SignatureReadiness',
    handler: runA36SignatureReadiness,
  },
  {
    agent_id: 'A37', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'SIGN_FILE_RESOLVE',
    overview_name: 'Filing Readiness Agent', workflow_stages: [16, 17],
    allowed_roles: ['reviewer', 'senior_reviewer', 'cpa', 'ea'], required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'form_8879_signed', 'cpa_release_recorded', 'blocking_diagnostics', 'filing_authorization_confirmed'],
    authorized_tools: ['workflow.read'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'CPA_EA', risk_level: 'CRITICAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA37FilingReadiness',
    handler: runA37FilingReadiness,
  },
  {
    agent_id: 'A38', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'SIGN_FILE_RESOLVE',
    overview_name: 'Filing Agent', workflow_stages: [17],
    allowed_roles: ['cpa', 'ea', 'senior_reviewer'], required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['ACKNOWLEDGE', 'REJECT_PROPOSAL'],
    authorized_inputs: ['scope', 'included_forms'], authorized_tools: ['filing.prepare'],
    data_classes: ['INTERNAL', 'TAX_DATA'], output_audience: 'CPA_EA', risk_level: 'CRITICAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA38FilingManifest',
    handler: runA38FilingManifest,
  },
  {
    agent_id: 'A39', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'SIGN_FILE_RESOLVE',
    overview_name: 'Government Response Agent (Reserved — OV-01)', workflow_stages: [],
    allowed_roles: [], required_reviewer_role: 'UNASSIGNED',
    permitted_decisions: [],
    authorized_inputs: [], authorized_tools: [],
    data_classes: ['INTERNAL'], output_audience: 'CPA_EA', risk_level: 'CRITICAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA39GovernmentResponseReserved',
    handler: runA39GovernmentResponseReserved,
  },
  {
    agent_id: 'A40', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'SIGN_FILE_RESOLVE',
    overview_name: 'Rejection Resolution Agent', workflow_stages: [17, 18],
    allowed_roles: REVIEW_ROLES, required_reviewer_role: 'PREPARER',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'rejection_code'], authorized_tools: ['workflow.read'],
    data_classes: ['INTERNAL', 'TAX_DATA'], output_audience: 'STAFF_PREPARER', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA40RejectionResolution',
    handler: runA40RejectionResolution,
  },
  {
    agent_id: 'A41', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'SIGN_FILE_RESOLVE',
    overview_name: 'Tax Notice Agent', workflow_stages: [18],
    allowed_roles: REVIEW_ROLES, required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'notice_code', 'notice_date'], authorized_tools: ['workflow.read', 'tax_authority.search'],
    data_classes: ['INTERNAL', 'TAX_DATA'], output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA41TaxNotice',
    handler: runA41TaxNotice,
  },
  {
    agent_id: 'A42', batch_id: 'BATCH_4_REVIEW_RELEASE', category: 'SIGN_FILE_RESOLVE',
    overview_name: 'Amendment Agent', workflow_stages: [18],
    allowed_roles: REVIEW_ROLES, required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'ESCALATE'],
    authorized_inputs: ['scope', 'original_tax_cents', 'corrected_tax_cents', 'amendment_reason'],
    authorized_tools: ['workflow.read', 'calculation.execute'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA42Amendment',
    handler: runA42Amendment,
  },
]);
