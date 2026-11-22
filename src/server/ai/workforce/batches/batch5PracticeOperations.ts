import type { Json } from '../../../../ai/types';
import {
  WorkforceError,
  type WorkforceAgentContext,
  type WorkforceAgentSpec,
  type WorkforceDomainHandlerResult,
} from '../contracts';

const SRC = 'src/server/ai/workforce/batches/batch5PracticeOperations.ts';

function intOr(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isSafeInteger(v) ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
}

/** A43: Client Communication Agent — drafts structured client outreach; NEVER sends external messages. */
export function runA43ClientCommunication(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const topic = typeof payload.topic === 'string' ? payload.topic.trim() : '';
  const items = strArray(payload.requested_items);
  if (!topic) throw new WorkforceError('COMMUNICATION_TOPIC_REQUIRED', 400);

  const draftBody = [
    `Subject: TaxGuard Case Update (${ctx.scope.tax_year}) — ${topic}`,
    '',
    'Hello,',
    items.length
      ? `To continue preparing your ${ctx.scope.tax_year} engagement, please upload the following item(s) through the secure Client Portal: ${items.join(', ')}.`
      : `We are writing with an update regarding your ${ctx.scope.tax_year} engagement (${topic}).`,
    'Please do not send sensitive tax documents by regular email.',
  ].join('\n');

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Drafted client communication for "${topic}". Outbound transmission is blocked pending staff authorization.`,
    findings: [
      {
        code: 'CLIENT_MESSAGE_DRAFT_CREATED',
        severity: 'INFO',
        summary: 'Draft message ready for staff review; external messaging remains strictly human-authorized.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Staff must review, edit if necessary, and send via the authorized Communications module.',
      },
    ],
    structured_data: {
      topic,
      draft_message: draftBody,
      outbound_sent: false,
      external_submission_allowed: false,
    },
  };
}

/** A44: Appointment Agent — proposes scheduling slots & agenda; enforces OV-05 (staff approves, never client). */
export function runA44Appointment(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const preferredSlots = strArray(payload.preferred_slots_iso);
  const purpose = typeof payload.meeting_purpose === 'string' ? payload.meeting_purpose.trim() : 'Tax Review Consultation';
  if (preferredSlots.length === 0) throw new WorkforceError('APPOINTMENT_SLOTS_REQUIRED', 400);

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Proposed ${preferredSlots.length} appointment option(s) for "${purpose}". Per OV-05, staff confirmation is required.`,
    findings: [
      {
        code: 'APPOINTMENT_PROPOSAL_CREATED',
        severity: 'INFO',
        summary: `Candidate slots: ${preferredSlots.join(', ')}. Calendar booking requires staff authorization (OV-05).`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['TaxGuard OV-05 (Staff Review Required; Client Cannot Approve AI Work)'],
        recommended_human_action: 'Staff confirms calendar availability and books appointment via Scheduling.',
      },
    ],
    structured_data: {
      meeting_purpose: purpose,
      candidate_slots: preferredSlots,
      calendar_booked: false,
    },
    authority_citations: ['TaxGuard OV-05'],
  };
}

/** A45: Task Agent — proposes policy-controlled workflow tasks without mutating task store autonomously. */
export function runA45TaskProposal(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const title = typeof payload.task_title === 'string' ? payload.task_title.trim() : '';
  const dueDate = typeof payload.due_date === 'string' ? payload.due_date : null;
  const assigneeRole = typeof payload.assignee_role === 'string' ? payload.assignee_role : 'accountant';
  if (title.length < 3) throw new WorkforceError('TASK_TITLE_REQUIRED', 400);

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Proposed workflow task "${title}" for role ${assigneeRole}. Policy-controlled human confirmation required.`,
    findings: [
      {
        code: 'WORKFLOW_TASK_PROPOSED',
        severity: 'INFO',
        summary: `Draft task "${title}" (due ${dueDate ?? 'unscheduled'}) queued for staff confirmation.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Staff/manager approves and creates task in Practice Operations.',
      },
    ],
    structured_data: {
      task_title: title,
      assignee_role: assigneeRole,
      due_date: dueDate,
      task_persisted_authoritatively: false,
    },
  };
}

/** A46: Deadline Agent — computes statutory federal filing/extension deadlines and days-remaining SLA alerts. */
export function runA46Deadline(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const entityType = typeof payload.entity_type === 'string' ? payload.entity_type.toUpperCase() : 'INDIVIDUAL';
  const filingYear = ctx.scope.tax_year + 1;
  const isPassThrough = entityType === 'S_CORP' || entityType === 'PARTNERSHIP';
  const primaryDeadline = isPassThrough ? `${filingYear}-03-15` : `${filingYear}-04-15`;
  const extensionDeadline = isPassThrough ? `${filingYear}-09-15` : `${filingYear}-10-15`;
  const referenceDate = typeof payload.as_of_date === 'string' && !Number.isNaN(Date.parse(payload.as_of_date))
    ? Date.parse(payload.as_of_date)
    : Date.now();
  const daysRemaining = Math.ceil((Date.parse(primaryDeadline) - referenceDate) / 86_400_000);
  const urgent = daysRemaining <= 14;

  return {
    status: urgent ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Statutory deadline (${entityType}, TY ${ctx.scope.tax_year}): primary ${primaryDeadline} (${daysRemaining}d remaining), extended ${extensionDeadline}.`,
    findings: [
      {
        code: urgent ? 'DEADLINE_ESCALATION_WINDOW' : 'DEADLINE_TRACKED_ADVISORY',
        severity: urgent ? 'HIGH' : 'INFO',
        summary: urgent
          ? `Within 14-day escalation window (${daysRemaining} days to ${primaryDeadline}); evaluate Form 4868/7004 extension.`
          : `Primary filing deadline ${primaryDeadline}; extension deadline ${extensionDeadline}.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §6072 (Time for Filing Income Tax Returns)'],
        recommended_human_action: 'Staff confirms statutory weekend/holiday adjustments and extension filing authorizations.',
      },
    ],
    structured_data: {
      entity_type: entityType,
      primary_deadline: primaryDeadline,
      extension_deadline: extensionDeadline,
      days_remaining: daysRemaining,
      escalation_triggered: urgent,
    },
    authority_citations: ['IRC §6072'],
  };
}

/** A47: Billing Agent — computes invoice fee summary in integer cents; NEVER issues invoices or charges payments (OV-10). */
export function runA47Billing(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
  if (lineItems.length === 0) throw new WorkforceError('BILLING_LINE_ITEMS_REQUIRED', 400);

  let subtotalCents = 0;
  const normalized: Json[] = [];
  for (const item of lineItems) {
    if (!item || typeof item !== 'object') throw new WorkforceError('BILLING_INVALID_LINE_ITEM', 400);
    const rec = item as Record<string, unknown>;
    const desc = typeof rec.description === 'string' && rec.description.trim() ? rec.description.trim() : null;
    const amountCents = intOr(rec.amount_cents, -1);
    if (!desc || amountCents < 0) throw new WorkforceError('BILLING_INVALID_LINE_ITEM', 400);
    subtotalCents += amountCents;
    normalized.push({ description: desc, amount_cents: amountCents });
  }

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Drafted billing summary of ${subtotalCents} cents across ${normalized.length} line item(s). Invoice issuance and payment collection remain blocked behind authorized staff approval.`,
    findings: [
      {
        code: 'INVOICE_DRAFT_PREPARED',
        severity: 'INFO',
        summary: `Draft invoice total ${subtotalCents} cents prepared; no charge or external payment triggered (OV-10).`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['TaxGuard OV-10 (Live Payments Disabled)'],
        recommended_human_action: 'Authorized billing staff reviews engagement fee terms before issuing invoice.',
      },
    ],
    structured_data: {
      line_items: normalized,
      subtotal_cents: subtotalCents,
      invoice_issued: false,
      payment_charged: false,
    },
    authority_citations: ['TaxGuard OV-10'],
  };
}

/** A48: Payment Reconciliation Agent — matches recorded payment receipts to invoice balances in integer cents. */
export function runA48PaymentReconciliation(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const invoiceTotal = intOr(payload.invoice_total_cents, -1);
  const paymentsReceived = intOr(payload.payments_received_cents, -1);
  if (invoiceTotal < 0 || paymentsReceived < 0) throw new WorkforceError('PAYMENT_RECON_INVALID_AMOUNTS', 400);
  const balance = invoiceTotal - paymentsReceived;
  const state = balance === 0 ? 'PAID_IN_FULL' : balance > 0 ? 'BALANCE_OPEN' : 'OVERPAYMENT_CREDIT_REVIEW';

  return {
    status: balance !== 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Payment match (${state}): invoice ${invoiceTotal} cents vs. payments ${paymentsReceived} cents (difference ${balance} cents).`,
    findings: [
      {
        code: `PAYMENT_STATUS_${state}`,
        severity: balance < 0 ? 'HIGH' : 'INFO',
        summary: `Invoice balance ${balance} cents (${state}). Accounting confirmation required before applying credits/refunds.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Accounting staff verifies receipt settlement and posts reconciliation.',
      },
    ],
    structured_data: {
      invoice_total_cents: invoiceTotal,
      payments_received_cents: paymentsReceived,
      remaining_balance_cents: balance,
      reconciliation_state: state,
      refund_or_adjustment_posted: false,
    },
  };
}

/** A49: Archive Agent — checks statutory retention package completeness before case archival. */
export function runA49Archive(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const required = {
    signed_engagement_letter: payload.signed_engagement_letter === true,
    final_return_copy: payload.final_return_copy === true,
    signed_form_8879: payload.signed_form_8879 === true,
    workpaper_index_complete: payload.workpaper_index_complete === true,
    audit_trail_sealed: payload.audit_trail_sealed === true,
  };
  const missing = Object.entries(required).filter(([, ok]) => !ok).map(([k]) => k);

  return {
    status: missing.length ? 'EVIDENCE_REQUIRED' : 'ADVISORY',
    summary: missing.length
      ? `Archival completeness blocked: missing ${missing.join(', ')}.`
      : 'All archival retention checklist items present; staff may complete archival lock.',
    findings: [
      {
        code: missing.length ? 'ARCHIVE_PACKAGE_INCOMPLETE' : 'ARCHIVE_PACKAGE_READY',
        severity: missing.length ? 'WARNING' : 'INFO',
        summary: missing.length ? `Missing retention artifacts: ${missing.join(', ')}.` : 'Retention package complete.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §6107(b) (Preparer Record Retention)'],
        recommended_human_action: 'Staff confirms retention lock; archival never deletes source audit records.',
      },
    ],
    structured_data: { checks: required, missing_artifacts: missing, case_archived: false },
    authority_citations: ['IRC §6107(b)'],
  };
}

/** A50: Renewal Agent — prepares next-tax-year engagement rollover checklist & carryover tracking items. */
export function runA50Renewal(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const nextYear = ctx.scope.tax_year + 1;
  const carryovers = strArray(payload.carryover_items);
  const recurringDocs = strArray(payload.prior_year_document_types);

  return {
    status: 'ADVISORY',
    summary: `Prepared TY ${nextYear} engagement renewal checklist (${carryovers.length} carryover item(s), ${recurringDocs.length} recurring document expectation(s)).`,
    findings: [
      {
        code: 'RENEWAL_ROLLOVER_PREPARED',
        severity: 'INFO',
        summary: `Rollover draft prepared for tax year ${nextYear}; no engagement created until staff approves.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Staff reviews carryover items and initiates next-year engagement letter manually.',
      },
    ],
    structured_data: {
      next_tax_year: nextYear,
      carryover_items: carryovers,
      recurring_document_checklist: recurringDocs,
      renewal_engagement_created: false,
    },
  };
}

const OPS_ROLES = ['operations', 'practice_manager', 'accountant', 'reviewer', 'senior_reviewer', 'cpa', 'ea', 'admin', 'super_admin'] as const;

export const BATCH_5_AGENT_SPECS: readonly WorkforceAgentSpec[] = Object.freeze([
  {
    agent_id: 'A43', batch_id: 'BATCH_5_PRACTICE_OPERATIONS', category: 'PRACTICE_OPERATIONS',
    overview_name: 'Client Communication Agent', workflow_stages: [1, 2, 3, 4, 15, 18],
    allowed_roles: OPS_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'topic', 'requested_items'], authorized_tools: ['message.draft'],
    data_classes: ['INTERNAL'], output_audience: 'CLIENT_DRAFT_FOR_STAFF_APPROVAL', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA43ClientCommunication',
    handler: runA43ClientCommunication,
  },
  {
    agent_id: 'A44', batch_id: 'BATCH_5_PRACTICE_OPERATIONS', category: 'PRACTICE_OPERATIONS',
    overview_name: 'Appointment Agent', workflow_stages: [1, 2, 15, 18],
    allowed_roles: OPS_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL'],
    authorized_inputs: ['scope', 'preferred_slots_iso', 'meeting_purpose'], authorized_tools: ['calendar.read'],
    data_classes: ['INTERNAL'], output_audience: 'OPERATIONS_STAFF', risk_level: 'LOW',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA44Appointment',
    handler: runA44Appointment,
  },
  {
    agent_id: 'A45', batch_id: 'BATCH_5_PRACTICE_OPERATIONS', category: 'PRACTICE_OPERATIONS',
    overview_name: 'Task Agent', workflow_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    allowed_roles: OPS_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL'],
    authorized_inputs: ['scope', 'task_title', 'due_date', 'assignee_role'], authorized_tools: ['workflow.propose'],
    data_classes: ['INTERNAL'], output_audience: 'OPERATIONS_STAFF', risk_level: 'LOW',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA45TaskProposal',
    handler: runA45TaskProposal,
  },
  {
    agent_id: 'A46', batch_id: 'BATCH_5_PRACTICE_OPERATIONS', category: 'PRACTICE_OPERATIONS',
    overview_name: 'Deadline Agent', workflow_stages: [1, 2, 3, 10, 15, 16, 17],
    allowed_roles: OPS_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'ESCALATE'],
    authorized_inputs: ['scope', 'entity_type', 'as_of_date'], authorized_tools: ['calendar.read', 'workflow.read'],
    data_classes: ['INTERNAL'], output_audience: 'PRACTICE_MANAGER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA46Deadline',
    handler: runA46Deadline,
  },
  {
    agent_id: 'A47', batch_id: 'BATCH_5_PRACTICE_OPERATIONS', category: 'PRACTICE_OPERATIONS',
    overview_name: 'Billing Agent', workflow_stages: [2, 15, 18],
    allowed_roles: ['operations', 'practice_manager', 'accountant', 'admin', 'super_admin'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'line_items'], authorized_tools: ['billing.read'],
    data_classes: ['INTERNAL', 'FINANCIAL_DATA'], output_audience: 'OPERATIONS_STAFF', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA47Billing',
    handler: runA47Billing,
  },
  {
    agent_id: 'A48', batch_id: 'BATCH_5_PRACTICE_OPERATIONS', category: 'PRACTICE_OPERATIONS',
    overview_name: 'Payment Reconciliation Agent', workflow_stages: [15, 18],
    allowed_roles: ['accountant', 'bookkeeper', 'practice_manager', 'admin', 'super_admin'], required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'invoice_total_cents', 'payments_received_cents'], authorized_tools: ['billing.read'],
    data_classes: ['INTERNAL', 'FINANCIAL_DATA'], output_audience: 'ACCOUNTANT', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA48PaymentReconciliation',
    handler: runA48PaymentReconciliation,
  },
  {
    agent_id: 'A49', batch_id: 'BATCH_5_PRACTICE_OPERATIONS', category: 'PRACTICE_OPERATIONS',
    overview_name: 'Archive Agent', workflow_stages: [18],
    allowed_roles: OPS_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'signed_engagement_letter', 'final_return_copy', 'signed_form_8879', 'workpaper_index_complete', 'audit_trail_sealed'],
    authorized_tools: ['workflow.read'], data_classes: ['INTERNAL'],
    output_audience: 'OPERATIONS_STAFF', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA49Archive',
    handler: runA49Archive,
  },
  {
    agent_id: 'A50', batch_id: 'BATCH_5_PRACTICE_OPERATIONS', category: 'PRACTICE_OPERATIONS',
    overview_name: 'Renewal Agent', workflow_stages: [18],
    allowed_roles: OPS_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'DISMISS'],
    authorized_inputs: ['scope', 'carryover_items', 'prior_year_document_types'], authorized_tools: ['workflow.read'],
    data_classes: ['INTERNAL'], output_audience: 'OPERATIONS_STAFF', risk_level: 'LOW',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA50Renewal',
    handler: runA50Renewal,
  },
]);
