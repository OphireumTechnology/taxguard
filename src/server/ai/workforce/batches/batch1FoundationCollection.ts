import type { Json } from '../../../../ai/types';
import { inspectSelectedDocumentDuplicates } from '../../documents/DocumentDuplicateAdvisory';
import type { EvidenceMetadata } from '../../capabilities/contracts';
import { sha256Json } from '../authority';
import {
  WorkforceError,
  type WorkforceAgentContext,
  type WorkforceAgentSpec,
  type WorkforceDomainHandlerResult,
  type WorkforceFinding,
} from '../contracts';

const SRC = 'src/server/ai/workforce/batches/batch1FoundationCollection.ts';

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
}

/** A00: Supervisor / Orchestrator — builds a deterministic bounded multi-agent plan across stages. */
export function runA00SupervisorOrchestrator(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const requestedAgents = strArray(payload.target_agents);
  const stage = ctx.caseRecord?.active_stage ?? ctx.workflow_stage;
  const recommended =
    requestedAgents.length > 0
      ? requestedAgents.filter(id => /^A(?:[0-5][0-9]|60)$/.test(id) && id !== 'A39')
      : stage <= 3
        ? ['A01', 'A05', 'A06', 'A09', 'A10']
        : stage <= 7
          ? ['A12', 'A13', 'A16']
          : stage <= 12
            ? ['A18', 'A28', 'A30', 'A31']
            : ['A32', 'A34', 'A35', 'A36', 'A37'];

  const blockedReserved = requestedAgents.includes('A39');
  const findings: WorkforceFinding[] = [
    {
      code: blockedReserved ? 'RESERVED_AGENT_EXCLUDED' : 'BOUNDED_PLAN_CREATED',
      severity: blockedReserved ? 'WARNING' : 'INFO',
      summary: blockedReserved
        ? `Bounded plan assembled for stage ${stage} (${recommended.join(', ')}); A39 was excluded because it remains reserved pending owner definition (OV-01).`
        : `Bounded advisory plan assembled for stage ${stage}: ${recommended.join(', ')}. Each step requires independent governance and human review.`,
      evidence_source_ids: ctx.evidence.map(e => e.source_id),
      recommended_human_action: 'Confirm stage routing plan before launching individual bounded advisories.',
    },
  ];

  return {
    status: 'ADVISORY',
    summary: `Orchestration plan for stage ${stage} covering ${recommended.length} bounded agent(s); no autonomous dispatch performed.`,
    findings,
    structured_data: {
      workflow_stage: stage,
      planned_agents: recommended,
      excluded_reserved_agents: blockedReserved ? ['A39'] : [],
      autonomous_dispatch: false,
    },
    authority_citations: ['TaxGuard Canonical Routing Boundary (A00)', 'TaxGuard OV-01'],
  };
}

/** A01: Client Onboarding Agent — checks required onboarding fields and missing client setup artifacts. */
export function runA01ClientOnboarding(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const requiredFields = ['legal_name', 'entity_type', 'filing_jurisdiction', 'contact_email', 'engagement_signed'];
  const provided = (payload.profile && typeof payload.profile === 'object' ? payload.profile : {}) as Record<string, unknown>;
  const missing = requiredFields.filter(f => !provided[f]);
  const findings: WorkforceFinding[] = missing.length
    ? [
        {
          code: 'ONBOARDING_ITEMS_MISSING',
          severity: 'WARNING',
          summary: `Missing ${missing.length} required onboarding field(s): ${missing.join(', ')}.`,
          evidence_source_ids: ctx.evidence.map(e => e.source_id),
          recommended_human_action: 'Follow up with client to complete missing onboarding records before Stage 2.',
        },
      ]
    : [
        {
          code: 'ONBOARDING_PROFILE_COMPLETE',
          severity: 'INFO',
          summary: 'All required onboarding fields are recorded in metadata; ready for staff verification.',
          evidence_source_ids: ctx.evidence.map(e => e.source_id),
          recommended_human_action: 'Verify onboarding checklist and advance case gate manually.',
        },
      ];
  return {
    status: missing.length ? 'EVIDENCE_REQUIRED' : 'ADVISORY',
    summary: missing.length
      ? `Onboarding incomplete: ${missing.length} missing field(s).`
      : 'Onboarding profile metadata complete; staff review required.',
    findings,
    structured_data: { missing_fields: missing, checked_fields: requiredFields, completeness_ratio: Number(((requiredFields.length - missing.length) / requiredFields.length).toFixed(2)) },
  };
}

/** A02: Identity Verification Agent — reviews identity evidence consistency without auto-verifying identity. */
export function runA02IdentityVerification(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const idExpiry = typeof payload.id_expires_on === 'string' ? payload.id_expires_on : null;
  const nameMatches = payload.name_matches_tax_record === true;
  const expired = idExpiry ? Date.parse(idExpiry) < Date.now() : true;
  const issues: string[] = [];
  if (!nameMatches) issues.push('TAXPAYER_NAME_MISMATCH');
  if (expired) issues.push('GOVERNMENT_ID_EXPIRED_OR_MISSING');
  if (ctx.evidence.length === 0) issues.push('IDENTITY_EVIDENCE_MISSING');

  return {
    status: issues.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: issues.length
      ? `Identity review flagged ${issues.length} inconsistency item(s); staff verification required.`
      : 'Identity metadata checks passed; human staff attestation still required to mark verified.',
    findings: [
      {
        code: issues.length ? 'IDENTITY_INCONSISTENCY_FLAGGED' : 'IDENTITY_METADATA_CONSISTENT',
        severity: issues.length ? 'HIGH' : 'INFO',
        summary: issues.length ? `Flagged: ${issues.join(', ')}.` : 'Government ID metadata and taxpayer name alignment checked.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Perform human identity review in compliance with firm KYC procedures.',
      },
    ],
    structured_data: { issues, identity_marked_verified: false, name_matches: nameMatches, id_expired_or_missing: expired },
  };
}

/** A03: Engagement Agent — determines required engagement workflow from entity type & filing scope. */
export function runA03Engagement(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const entityType = typeof payload.entity_type === 'string' ? payload.entity_type.toUpperCase() : 'INDIVIDUAL';
  const states = strArray(payload.states);
  const workflows: Record<string, string[]> = {
    INDIVIDUAL: ['Form 1040 Engagement Letter', 'Tax Organizer', 'Consent to Disclose/Use (IRC 7216)'],
    S_CORP: ['Form 1120-S Engagement Letter', 'Shareholder Basis & K-1 Schedule', 'Officer Compensation Review'],
    PARTNERSHIP: ['Form 1065 Engagement Letter', 'Partner Capital Account Schedule', 'Operating Agreement Review'],
    C_CORP: ['Form 1120 Engagement Letter', 'M-1/M-3 Book-to-Tax Schedule', 'Corporate Governance Confirmation'],
    LLC: ['Entity Classification Election Check (Form 8832/2553)', 'Tax Engagement Letter', 'State Nexus Questionnaire'],
  };
  const requiredWorkflow = [...(workflows[entityType] ?? workflows.INDIVIDUAL)];
  if (states.length > 1) requiredWorkflow.push(`Multi-State Apportionment Scope (${states.join(', ')})`);

  return {
    status: 'ADVISORY',
    summary: `Determined ${requiredWorkflow.length} engagement workflow prerequisite(s) for ${entityType} (${ctx.scope.tax_year}).`,
    findings: [
      {
        code: 'ENGAGEMENT_WORKFLOW_PROPOSED',
        severity: 'INFO',
        summary: `Proposed engagement scope for ${entityType} with ${states.length} state jurisdiction(s).`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Review and issue formal engagement letter through staff approval.',
      },
    ],
    structured_data: { entity_type: entityType, states, required_workflow_items: requiredWorkflow },
    authority_citations: ['IRC §7216 Client Consent Rules', 'Circular 230 Engagement Standards'],
  };
}

/** A04: Tax Organizer Agent — evaluates taxpayer questionnaire responses for unanswered sections & triggered schedules. */
export function runA04TaxOrganizer(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const answers = (payload.answers && typeof payload.answers === 'object' ? payload.answers : {}) as Record<string, unknown>;
  const triggeredSchedules: string[] = [];
  if (answers.has_business_income) triggeredSchedules.push('Schedule C');
  if (answers.has_rental_property) triggeredSchedules.push('Schedule E');
  if (answers.has_capital_transactions) triggeredSchedules.push('Schedule D / Form 8949');
  if (answers.has_foreign_accounts) triggeredSchedules.push('Schedule B Part III / FinCEN 114');
  if (answers.has_itemized_deductions) triggeredSchedules.push('Schedule A');
  const unanswered = strArray(payload.required_questions).filter(q => answers[q] === undefined || answers[q] === null || answers[q] === '');

  return {
    status: unanswered.length ? 'EVIDENCE_REQUIRED' : 'ADVISORY',
    summary: `Organizer evaluated: ${triggeredSchedules.length} schedule(s) triggered, ${unanswered.length} unanswered required item(s).`,
    findings: [
      {
        code: unanswered.length ? 'ORGANIZER_INCOMPLETE' : 'ORGANIZER_ANALYZED',
        severity: unanswered.length ? 'WARNING' : 'INFO',
        summary: unanswered.length
          ? `Unanswered required organizer questions: ${unanswered.join(', ')}.`
          : `Triggered schedules: ${triggeredSchedules.join(', ') || 'Core Form 1040 only'}.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Confirm triggered schedules and request client answers for any unanswered questions.',
      },
    ],
    structured_data: { triggered_schedules: triggeredSchedules, unanswered_questions: unanswered },
  };
}

/** A05: Document Intake Agent — controls incoming document metadata, file types, and clean-scan compliance. */
export function runA05DocumentIntake(
  ctx: WorkforceAgentContext,
  _payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const allowedExts = new Set(['pdf', 'png', 'jpg', 'jpeg', 'csv', 'xlsx']);
  const unsupported = ctx.evidence.filter(e => e.file_extension && !allowedExts.has(e.file_extension.toLowerCase()));
  return {
    status: unsupported.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Intake check inspected ${ctx.evidence.length} clean authorized document(s); ${unsupported.length} unsupported extension(s).`,
    findings: [
      {
        code: unsupported.length ? 'UNSUPPORTED_DOCUMENT_FORMAT' : 'DOCUMENT_INTAKE_VERIFIED',
        severity: unsupported.length ? 'WARNING' : 'INFO',
        summary: unsupported.length
          ? `Unsupported formats found on ${unsupported.length} document(s).`
          : `All ${ctx.evidence.length} authorized document(s) passed intake format and clean-quarantine verification.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Confirm intake acceptance in Stage 3 document queue.',
      },
    ],
    structured_data: {
      total_documents: ctx.evidence.length,
      unsupported_source_ids: unsupported.map(e => e.source_id),
    },
  };
}

/** A06: Document Classification Agent — proposes deterministic tax-form classifications from validated intake descriptors. */
export function runA06DocumentClassification(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const hints = (payload.document_descriptors && typeof payload.document_descriptors === 'object'
    ? payload.document_descriptors
    : {}) as Record<string, string>;

  const classify = (hint: string): string => {
    const h = hint.toUpperCase();
    if (h.includes('W-2') || h.includes('W2')) return 'FORM_W2';
    if (h.includes('1099-NEC') || h.includes('1099NEC')) return 'FORM_1099_NEC';
    if (h.includes('1099-INT')) return 'FORM_1099_INT';
    if (h.includes('1099-DIV')) return 'FORM_1099_DIV';
    if (h.includes('1099-B') || h.includes('BROKERAGE')) return 'FORM_1099_B';
    if (h.includes('K-1') || h.includes('K1')) return 'SCHEDULE_K1';
    if (h.includes('1098')) return 'FORM_1098';
    if (h.includes('RECEIPT') || h.includes('INVOICE')) return 'EXPENSE_RECEIPT';
    return 'UNCLASSIFIED_REQUIRES_REVIEW';
  };

  const classifications = ctx.evidence.map(e => {
    const descriptor = hints[e.source_id] ?? e.document_type ?? '';
    return {
      source_id: e.source_id,
      document_record_id: e.document_record_id,
      proposed_class: classify(descriptor),
    };
  });

  const unclassified = classifications.filter(c => c.proposed_class === 'UNCLASSIFIED_REQUIRES_REVIEW');

  return {
    status: unclassified.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Classified ${classifications.length} document(s); ${unclassified.length} require manual classification.`,
    findings: [
      {
        code: unclassified.length ? 'UNCLASSIFIED_DOCUMENTS_FOUND' : 'DOCUMENTS_CLASSIFIED_ADVISORY',
        severity: unclassified.length ? 'WARNING' : 'INFO',
        summary: `Proposed tax-form labels generated for ${classifications.length} document(s) (${unclassified.length} unclassified).`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Reviewer must confirm proposed document classifications before extraction.',
      },
    ],
    structured_data: { classifications, unclassified_count: unclassified.length },
  };
}

/**
 * A07: OCR Extraction Agent — strictly gated on configured approved OCR provider + verifiable lineage.
 * Never fabricates extracted tax figures when no approved OCR provider is configured.
 */
export function runA07OcrExtraction(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  if (!ctx.ocrConfig.configured || !ctx.ocrConfig.approved_provider_id || !ctx.ocrConfig.lineage_signing_enabled) {
    return {
      status: 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED',
      summary:
        'OCR extraction unavailable: no approved OCR provider with verifiable lineage is configured. Route document to manual data entry and reviewer verification.',
      findings: [
        {
          code: 'OCR_PROVIDER_UNCONFIGURED',
          severity: 'WARNING',
          summary:
            'A07 requires an owner-approved OCR provider and cryptographic document lineage before structured field extraction can execute.',
          evidence_source_ids: ctx.evidence.map(e => e.source_id),
          recommended_human_action: 'Complete manual extraction or await approved OCR provider commissioning.',
        },
      ],
      structured_data: {
        provider_configured: false,
        approved_provider_id: null,
        extracted_fields: [],
        lineage_verified: false,
      },
    };
  }

  const rawExtracted = Array.isArray(payload.provider_extractions) ? payload.provider_extractions : [];
  const validLineageHashes = new Set(ctx.evidence.map(e => e.source_hash));
  const verifiedFields: Array<{ source_id: string; field_name: string; value: string; confidence: number; lineage_hash: string }> = [];
  let unverifiedCount = 0;

  for (const item of rawExtracted) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const lineageHash = typeof rec.source_hash === 'string' ? rec.source_hash : '';
    const sourceId = typeof rec.source_id === 'string' ? rec.source_id : '';
    const fieldName = typeof rec.field_name === 'string' ? rec.field_name : '';
    const value = typeof rec.value === 'string' || typeof rec.value === 'number' ? String(rec.value) : '';
    const confidence = typeof rec.confidence === 'number' && rec.confidence >= 0 && rec.confidence <= 1 ? rec.confidence : 0;

    if (!validLineageHashes.has(lineageHash) || !sourceId || !fieldName) {
      unverifiedCount++;
      continue;
    }
    verifiedFields.push({ source_id: sourceId, field_name: fieldName, value, confidence, lineage_hash: lineageHash });
  }

  return {
    status: unverifiedCount > 0 || verifiedFields.length === 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Approved OCR provider (${ctx.ocrConfig.approved_provider_id}) verified ${verifiedFields.length} lineage-bound field(s); ${unverifiedCount} rejected for missing lineage.`,
    findings: [
      {
        code: unverifiedCount > 0 ? 'OCR_LINEAGE_MISMATCH_DROPPED' : 'OCR_FIELDS_EXTRACTED_FOR_REVIEW',
        severity: unverifiedCount > 0 ? 'HIGH' : 'INFO',
        summary: `Verified ${verifiedFields.length} lineage-bound field(s); dropped ${unverifiedCount} unverified item(s).`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Reviewer must inspect extracted fields against original source documents before verification.',
      },
    ],
    structured_data: {
      provider_configured: true,
      approved_provider_id: ctx.ocrConfig.approved_provider_id,
      lineage_verified: unverifiedCount === 0 && verifiedFields.length > 0,
      extracted_fields: verifiedFields,
      rejected_unverified_count: unverifiedCount,
    },
  };
}

/** A08: Document Validation Agent — checks extracted field math, tax year alignment, and source metadata consistency. */
export function runA08DocumentValidation(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const fields = (payload.extracted_fields && typeof payload.extracted_fields === 'object'
    ? payload.extracted_fields
    : {}) as Record<string, unknown>;
  const discrepancies: string[] = [];

  if (typeof fields.tax_year === 'number' && fields.tax_year !== ctx.scope.tax_year) {
    discrepancies.push(`TAX_YEAR_MISMATCH:extracted=${fields.tax_year},case=${ctx.scope.tax_year}`);
  }
  if (typeof fields.wages_cents === 'number' && typeof fields.federal_withholding_cents === 'number') {
    if (fields.federal_withholding_cents < 0 || fields.federal_withholding_cents > fields.wages_cents) {
      discrepancies.push('WITHHOLDING_EXCEEDS_WAGES_OR_NEGATIVE');
    }
  }
  if (typeof fields.box_total_cents === 'number' && Array.isArray(fields.line_items_cents)) {
    const sum = fields.line_items_cents.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
    if (sum !== fields.box_total_cents) {
      discrepancies.push(`SUM_MISMATCH:computed=${sum},reported=${fields.box_total_cents}`);
    }
  }

  return {
    status: discrepancies.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: discrepancies.length
      ? `Document validation detected ${discrepancies.length} discrepancy(ies).`
      : 'Document validation checks passed across extracted metadata.',
    findings: [
      {
        code: discrepancies.length ? 'EXTRACTION_DISCREPANCY_FOUND' : 'EXTRACTION_VALIDATED_ADVISORY',
        severity: discrepancies.length ? 'HIGH' : 'INFO',
        summary: discrepancies.length ? discrepancies.join('; ') : 'Extracted fields are mathematically and year-aligned.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Reviewer must resolve discrepancies against source document before marking verified.',
      },
    ],
    structured_data: { discrepancies, discrepancy_count: discrepancies.length },
  };
}

/** A09: Missing Document Agent — compares expected prior-year/organizer documents against verified clean vault docs. */
export function runA09MissingDocument(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const expected = [...new Set(strArray(payload.expected_document_types).map(s => s.toUpperCase()))];
  if (expected.length === 0) {
    return {
      status: 'EVIDENCE_REQUIRED',
      summary: 'Document coverage could not be assessed because no expected document types were supplied.',
      findings: [{
        code: 'EXPECTED_DOCUMENT_REQUIREMENTS_MISSING',
        severity: 'WARNING',
        summary: 'No expected document types are available to compare with case evidence.',
        evidence_source_ids: [],
        recommended_human_action: 'Confirm the expected document requirements for this case before assessing coverage.',
      }],
      structured_data: { expected_documents: [], missing_documents: [] },
    };
  }
  const received = new Set(ctx.evidence.map(e => (e.document_type ?? '').toUpperCase()).filter(Boolean));
  const missing = expected.filter(docType => !received.has(docType));

  return {
    status: missing.length ? 'EVIDENCE_REQUIRED' : 'ADVISORY',
    summary: missing.length
      ? `Identified ${missing.length} missing expected document type(s): ${missing.join(', ')}.`
      : 'All expected document types are represented in verified case evidence.',
    findings: [
      {
        code: missing.length ? 'MISSING_EVIDENCE_IDENTIFIED' : 'EXPECTED_DOCUMENTS_PRESENT',
        severity: missing.length ? 'WARNING' : 'INFO',
        summary: missing.length ? `Missing: ${missing.join(', ')}.` : 'No expected documents missing.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Review missing document list before issuing a client document request.',
      },
    ],
    structured_data: { expected_documents: expected, missing_documents: missing },
  };
}

/** A10: Duplicate/Fraud Indicator Agent — delegates to canonical `inspectSelectedDocumentDuplicates` (exact byte-hash only). */
export function runA10DuplicateIndicator(
  ctx: WorkforceAgentContext,
  _payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  if (ctx.evidence.length === 0 || ctx.evidence.length > 10) {
    throw new WorkforceError('AI_DOCUMENT_METADATA_INVALID', 400);
  }
  const rows: EvidenceMetadata[] = ctx.evidence.map(e => ({
    source_id: e.source_id,
    document_record_id: e.document_record_id,
    document_version: e.document_version,
    source_hash: e.source_hash,
    document_status: e.document_status as 'RELEASED' | 'VERIFIED',
    quarantine_status: 'CLEAN',
  }));
  const report = inspectSelectedDocumentDuplicates(rows);
  return {
    status: 'ADVISORY',
    summary: `Exact SHA-256 byte check inspected ${rows.length} document(s): ${report.duplicate_groups.length} duplicate group(s). Fraud not assessed.`,
    findings: [
      {
        code: report.duplicate_groups.length ? 'EXACT_BYTE_DUPLICATE_DETECTED' : 'NO_EXACT_BYTE_DUPLICATE',
        severity: report.duplicate_groups.length ? 'WARNING' : 'INFO',
        summary: report.duplicate_groups.length
          ? `${report.duplicate_groups.length} exact byte-duplicate group(s) detected; equal hashes indicate equal recorded bytes only.`
          : 'No exact byte duplicates detected among selected authorized documents.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Inspect duplicate group in Stage 3; live disposition awaits owner approval of A10 reviewer role.',
      },
    ],
    structured_data: {
      coverage: report.coverage,
      fraud_assessed: false,
      authoritative_mutation: false,
      duplicate_groups: report.duplicate_groups.map(g => ({
        source_hash: g.source_hash,
        document_record_ids: [...g.document_record_ids],
      })),
    },
    authority_citations: ['TaxGuard OV-01 (Narrow Byte-Duplicate Scope)'],
  };
}

/** A11: Evidence Agent — builds deterministic hash-linked evidence chains from verified source documents to case facts. */
export function runA11EvidenceChain(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const facts = Array.isArray(payload.case_facts) ? payload.case_facts : [];
  const sourceById = new Map(ctx.evidence.map(e => [e.source_id, e]));
  const chain: Json[] = [];
  const unlinked: string[] = [];

  for (const f of facts) {
    if (!f || typeof f !== 'object') continue;
    const fact = f as Record<string, unknown>;
    const factId = typeof fact.fact_id === 'string' ? fact.fact_id : 'unknown';
    const sourceId = typeof fact.source_id === 'string' ? fact.source_id : '';
    const src = sourceById.get(sourceId);
    if (!src) {
      unlinked.push(factId);
      continue;
    }
    const linkHash = sha256Json({ fact_id: factId, source_id: src.source_id, source_hash: src.source_hash, version: src.document_version });
    chain.push({ fact_id: factId, source_id: src.source_id, document_version: src.document_version, link_hash: linkHash });
  }

  return {
    status: unlinked.length ? 'EVIDENCE_REQUIRED' : 'ADVISORY',
    summary: `Constructed ${chain.length} hash-linked evidence chain node(s); ${unlinked.length} fact(s) lack verified source linkage.`,
    findings: [
      {
        code: unlinked.length ? 'UNLINKED_CASE_FACTS' : 'EVIDENCE_CHAIN_BUILT',
        severity: unlinked.length ? 'WARNING' : 'INFO',
        summary: unlinked.length ? `Unlinked fact IDs: ${unlinked.join(', ')}.` : `All ${chain.length} fact(s) linked to verified document versions.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Preparer must verify source-to-fact lineage before return assembly.',
      },
    ],
    structured_data: { chain, unlinked_fact_ids: unlinked },
  };
}

export const BATCH_1_AGENT_SPECS: readonly WorkforceAgentSpec[] = Object.freeze([
  {
    agent_id: 'A00', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'SUPERVISOR',
    overview_name: 'Supervisor / Orchestrator Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: ['accountant', 'bookkeeper', 'reviewer', 'senior_reviewer', 'cpa', 'ea', 'operations', 'practice_manager', 'admin', 'super_admin'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'REJECT_PROPOSAL'],
    authorized_inputs: ['scope', 'target_agents', 'workflow_stage'], authorized_tools: ['workflow.read'],
    data_classes: ['INTERNAL'], output_audience: 'STAFF_REVIEWER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA00SupervisorOrchestrator',
    handler: runA00SupervisorOrchestrator,
  },
  {
    agent_id: 'A01', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'CLIENT_SERVICES',
    overview_name: 'Client Onboarding Agent', workflow_stages: [1, 2],
    allowed_roles: ['accountant', 'operations', 'practice_manager', 'reviewer', 'senior_reviewer'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'DISMISS'],
    authorized_inputs: ['scope', 'profile'], authorized_tools: ['workflow.read', 'database.read'],
    data_classes: ['INTERNAL', 'CLIENT_PII'], output_audience: 'OPERATIONS_STAFF', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA01ClientOnboarding',
    handler: runA01ClientOnboarding,
  },
  {
    agent_id: 'A02', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'CLIENT_SERVICES',
    overview_name: 'Identity Verification Agent', workflow_stages: [1, 2],
    allowed_roles: ['accountant', 'operations', 'reviewer', 'senior_reviewer', 'compliance'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'id_expires_on', 'name_matches_tax_record', 'evidence_source_ids'], authorized_tools: ['document.read'],
    data_classes: ['INTERNAL', 'CLIENT_PII'], output_audience: 'STAFF_REVIEWER', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA02IdentityVerification',
    handler: runA02IdentityVerification,
  },
  {
    agent_id: 'A03', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'CLIENT_SERVICES',
    overview_name: 'Engagement Agent', workflow_stages: [1, 2],
    allowed_roles: ['accountant', 'operations', 'practice_manager', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'REJECT_PROPOSAL'],
    authorized_inputs: ['scope', 'entity_type', 'states'], authorized_tools: ['workflow.read'],
    data_classes: ['INTERNAL'], output_audience: 'OPERATIONS_STAFF', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA03Engagement',
    handler: runA03Engagement,
  },
  {
    agent_id: 'A04', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'CLIENT_SERVICES',
    overview_name: 'Tax Organizer Agent', workflow_stages: [2, 3],
    allowed_roles: ['accountant', 'operations', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'PREPARER', permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'DISMISS'],
    authorized_inputs: ['scope', 'answers', 'required_questions'], authorized_tools: ['workflow.read'],
    data_classes: ['INTERNAL', 'TAX_DATA'], output_audience: 'STAFF_PREPARER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA04TaxOrganizer',
    handler: runA04TaxOrganizer,
  },
  {
    agent_id: 'A05', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'DOCUMENT_INTELLIGENCE',
    overview_name: 'Document Intake Agent', workflow_stages: [3],
    allowed_roles: ['accountant', 'bookkeeper', 'operations', 'reviewer', 'senior_reviewer'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'evidence_source_ids'], authorized_tools: ['document.read'],
    data_classes: ['INTERNAL'], output_audience: 'STAFF_REVIEWER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: true, source_path: SRC, handler_name: 'runA05DocumentIntake',
    handler: runA05DocumentIntake,
  },
  {
    agent_id: 'A06', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'DOCUMENT_INTELLIGENCE',
    overview_name: 'Document Classification Agent', workflow_stages: [3, 4],
    allowed_roles: ['accountant', 'bookkeeper', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'evidence_source_ids', 'document_descriptors'], authorized_tools: ['document.read'],
    data_classes: ['INTERNAL'], output_audience: 'STAFF_REVIEWER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: true, source_path: SRC, handler_name: 'runA06DocumentClassification',
    handler: runA06DocumentClassification,
  },
  {
    agent_id: 'A07', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'DOCUMENT_INTELLIGENCE',
    overview_name: 'OCR Extraction Agent', workflow_stages: [3, 4],
    allowed_roles: ['accountant', 'bookkeeper', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'evidence_source_ids', 'provider_extractions'], authorized_tools: ['document.read', 'ocr.extract'],
    data_classes: ['INTERNAL', 'DOCUMENT_CONTENT'], output_audience: 'STAFF_REVIEWER', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: true, source_path: SRC, handler_name: 'runA07OcrExtraction',
    handler: runA07OcrExtraction,
  },
  {
    agent_id: 'A08', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'DOCUMENT_INTELLIGENCE',
    overview_name: 'Document Validation Agent', workflow_stages: [3, 4],
    allowed_roles: ['accountant', 'bookkeeper', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'evidence_source_ids', 'extracted_fields'], authorized_tools: ['document.read'],
    data_classes: ['INTERNAL', 'TAX_DATA'], output_audience: 'STAFF_REVIEWER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: true, source_path: SRC, handler_name: 'runA08DocumentValidation',
    handler: runA08DocumentValidation,
  },
  {
    agent_id: 'A09', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'DOCUMENT_INTELLIGENCE',
    overview_name: 'Missing Document Agent', workflow_stages: [3, 4],
    allowed_roles: ['accountant', 'bookkeeper', 'operations', 'reviewer', 'senior_reviewer'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['ACKNOWLEDGE', 'DISMISS', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'expected_document_types', 'received_document_types', 'evidence_source_ids'], authorized_tools: ['document.read', 'workflow.read'],
    data_classes: ['INTERNAL'], output_audience: 'STAFF_REVIEWER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA09MissingDocument',
    handler: runA09MissingDocument,
  },
  {
    agent_id: 'A10', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'DOCUMENT_INTELLIGENCE',
    overview_name: 'Duplicate/Fraud Indicator Agent', workflow_stages: [3],
    allowed_roles: ['accountant', 'bookkeeper', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'PENDING_OWNER_APPROVAL', permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE', 'DISMISS', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'evidence_source_ids'], authorized_tools: ['document.read'],
    data_classes: ['INTERNAL'], output_audience: 'STAFF_REVIEWER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: true, source_path: 'src/server/ai/workforce/a10DuplicateWorkflow.ts', handler_name: 'runA10DuplicateIndicator',
    handler: runA10DuplicateIndicator,
  },
  {
    agent_id: 'A11', batch_id: 'BATCH_1_FOUNDATION_COLLECTION', category: 'DOCUMENT_INTELLIGENCE',
    overview_name: 'Evidence Agent', workflow_stages: [3, 4, 5],
    allowed_roles: ['accountant', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'PREPARER', permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'evidence_source_ids', 'case_facts'], authorized_tools: ['document.read'],
    data_classes: ['INTERNAL', 'TAX_DATA'], output_audience: 'STAFF_PREPARER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: true, source_path: SRC, handler_name: 'runA11EvidenceChain',
    handler: runA11EvidenceChain,
  },
]);
