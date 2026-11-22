import type { Json } from '../../../../ai/types';
import {
  WorkforceError,
  type WorkforceAgentContext,
  type WorkforceAgentSpec,
  type WorkforceDomainHandlerResult,
} from '../contracts';

const SRC = 'src/server/ai/workforce/batches/batch3TaxPreparation.ts';

function intOr(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isSafeInteger(v) ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
}

/** Deterministic standard deduction lookup (2024/2025/2026 IRS Rev. Proc. reference constants, integer cents). */
const STANDARD_DEDUCTION_CENTS: Record<number, Record<string, number>> = {
  2024: { SINGLE: 1_460_000, MFJ: 2_920_000, MFS: 1_460_000, HOH: 2_190_000 },
  2025: { SINGLE: 1_500_000, MFJ: 3_000_000, MFS: 1_500_000, HOH: 2_250_000 },
  2026: { SINGLE: 1_540_000, MFJ: 3_080_000, MFS: 1_540_000, HOH: 2_310_000 },
};

/** A17: Tax Research Agent — verifies versioned authority citations & routes missing/ambiguous authority to CPA/EA. */
export function runA17TaxResearch(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const issue = typeof payload.tax_issue === 'string' ? payload.tax_issue.trim() : '';
  const authorities = strArray(payload.authority_citations);
  if (!issue) throw new WorkforceError('TAX_RESEARCH_ISSUE_REQUIRED', 400);
  const missingAuthority = authorities.length === 0;

  return {
    status: missingAuthority ? 'EVIDENCE_REQUIRED' : 'REVIEW_REQUIRED',
    summary: missingAuthority
      ? `Tax research issue "${issue.slice(0, 80)}" has no approved versioned authority attached; routed to CPA/EA.`
      : `Tax research package compiled with ${authorities.length} versioned authority citation(s) for CPA/EA sign-off.`,
    findings: [
      {
        code: missingAuthority ? 'AUTHORITY_CITATION_REQUIRED' : 'RESEARCH_MEMO_READY_FOR_CPA_REVIEW',
        severity: missingAuthority ? 'HIGH' : 'INFO',
        summary: missingAuthority
          ? 'No primary IRC/Treasury/IRS authority was supplied; TaxGuard never invents tax positions without verified authority.'
          : `Attached authorities: ${authorities.join('; ')}.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: authorities,
        recommended_human_action: 'CPA/EA must evaluate primary tax authority and record the formal tax position.',
      },
    ],
    structured_data: { tax_issue: issue, authority_count: authorities.length, authorities, position_approved: false },
    authority_citations: authorities,
  };
}

/** A18: Federal Tax Agent — analyzes federal gross income, AGI, deduction comparison, and taxable income deterministically. */
export function runA18FederalTax(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const filingStatus = typeof payload.filing_status === 'string' ? payload.filing_status.toUpperCase() : 'SINGLE';
  const grossIncome = intOr(payload.gross_income_cents, -1);
  if (grossIncome < 0) throw new WorkforceError('FEDERAL_TAX_INVALID_INCOME', 400);
  const adjustments = intOr(payload.above_the_line_adjustments_cents, 0);
  const itemized = intOr(payload.itemized_deductions_cents, 0);
  const yearTable = STANDARD_DEDUCTION_CENTS[ctx.scope.tax_year];
  if (!yearTable || !yearTable[filingStatus]) {
    return {
      status: 'REVIEW_REQUIRED',
      summary: `Federal authority table unavailable for tax year ${ctx.scope.tax_year} / filing status ${filingStatus}; routed to CPA/EA.`,
      findings: [
        {
          code: 'MISSING_FEDERAL_YEAR_AUTHORITY',
          severity: 'HIGH',
          summary: `No verified standard deduction authority table loaded for ${ctx.scope.tax_year} (${filingStatus}).`,
          evidence_source_ids: ctx.evidence.map(e => e.source_id),
          recommended_human_action: 'CPA/EA must supply authoritative IRS inflation-adjusted figures for this tax year.',
        },
      ],
      structured_data: { tax_year: ctx.scope.tax_year, filing_status: filingStatus, authority_missing: true },
    };
  }
  const stdDed = yearTable[filingStatus];
  const agi = Math.max(0, grossIncome - adjustments);
  const chosenDeduction = Math.max(stdDed, itemized);
  const deductionMethod = itemized > stdDed ? 'ITEMIZED' : 'STANDARD';
  const taxableIncome = Math.max(0, agi - chosenDeduction);

  return {
    status: 'ADVISORY',
    summary: `Federal analysis (${ctx.scope.tax_year}, ${filingStatus}): AGI ${agi} cents, ${deductionMethod} deduction ${chosenDeduction} cents, taxable income ${taxableIncome} cents.`,
    findings: [
      {
        code: 'FEDERAL_TREATMENT_ANALYZED',
        severity: 'INFO',
        summary: `Deterministic federal computation recommends ${deductionMethod} deduction (${chosenDeduction} cents) yielding ${taxableIncome} cents taxable income.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: [`IRC §63 (${ctx.scope.tax_year} Standard vs. Itemized Deduction)`],
        recommended_human_action: 'Preparer/CPA must confirm federal filing status and verify against deterministic tax engine run.',
      },
    ],
    structured_data: {
      filing_status: filingStatus,
      gross_income_cents: grossIncome,
      agi_cents: agi,
      standard_deduction_cents: stdDed,
      itemized_deductions_cents: itemized,
      recommended_method: deductionMethod,
      taxable_income_cents: taxableIncome,
    },
    authority_citations: ['IRC §61', 'IRC §62', 'IRC §63'],
  };
}

/** A19: State Tax Agent — determines multi-state residency, nexus flags, and conformity review points. */
export function runA19StateTax(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const residentState = typeof payload.resident_state === 'string' ? payload.resident_state.toUpperCase() : '';
  const sourceStates = strArray(payload.income_source_states).map(s => s.toUpperCase());
  const nonResidentStates = sourceStates.filter(s => s !== residentState);
  const missingState = !residentState;

  return {
    status: missingState || nonResidentStates.length > 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: missingState
      ? 'Resident state not specified; routed to human preparer/CPA.'
      : `State scope: resident ${residentState}, ${nonResidentStates.length} non-resident filing state(s) (${nonResidentStates.join(', ') || 'none'}).`,
    findings: [
      {
        code: missingState ? 'STATE_RESIDENCY_MISSING' : nonResidentStates.length ? 'MULTI_STATE_NEXUS_REVIEW' : 'SINGLE_STATE_RESIDENT_SCOPE',
        severity: missingState ? 'HIGH' : nonResidentStates.length ? 'WARNING' : 'INFO',
        summary: missingState
          ? 'Taxpayer domicile/resident state is required for state return determination.'
          : `Evaluate resident credit for taxes paid to ${nonResidentStates.join(', ') || 'no other states'}.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Preparer/CPA must verify state nexus thresholds and state-specific federal conformity adjustments.',
      },
    ],
    structured_data: { resident_state: residentState || null, non_resident_states: nonResidentStates },
    authority_citations: ['State Domicile & Nexus Standards'],
  };
}

/** A20: Entity Tax Agent — evaluates LLC, Partnership (1065), S-Corp (1120-S), and C-Corp (1120) structural checks. */
export function runA20EntityTax(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const entityType = typeof payload.entity_type === 'string' ? payload.entity_type.toUpperCase() : 'UNKNOWN';
  const shareholderCount = intOr(payload.owner_count, 0);
  const issues: string[] = [];
  if (entityType === 'S_CORP' && shareholderCount > 100) issues.push('IRC_1361_SHAREHOLDER_LIMIT_EXCEEDED');
  if (entityType === 'S_CORP' && payload.officer_compensation_cents === 0 && intOr(payload.distributions_cents, 0) > 0) {
    issues.push('REASONABLE_COMPENSATION_REVIEW_REQUIRED');
  }
  if (entityType === 'PARTNERSHIP' && shareholderCount < 2) issues.push('PARTNERSHIP_REQUIRES_AT_LEAST_TWO_PARTNERS');
  if (!['LLC', 'PARTNERSHIP', 'S_CORP', 'C_CORP'].includes(entityType)) issues.push('ENTITY_CLASSIFICATION_AMBIGUOUS');

  return {
    status: issues.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Entity analysis (${entityType}, ${shareholderCount} owner(s)): ${issues.length} structural issue(s) flagged for CPA/EA.`,
    findings: [
      {
        code: issues.length ? 'ENTITY_COMPLIANCE_ISSUE_FLAGGED' : 'ENTITY_STRUCTURE_CHECKED',
        severity: issues.length ? 'HIGH' : 'INFO',
        summary: issues.length ? `Flagged: ${issues.join(', ')}.` : `Entity classification (${entityType}) passed baseline structural checks.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §1361 (S-Corp Eligibility)', 'IRC §701 (Partnerships)', 'Treas. Reg. §301.7701-3'],
        recommended_human_action: 'CPA/EA must review entity elections, K-1 allocations, and basis schedules.',
      },
    ],
    structured_data: { entity_type: entityType, owner_count: shareholderCount, issues },
    authority_citations: ['IRC §1361', 'IRC §701', 'Treas. Reg. §301.7701-3'],
  };
}

/** A21: Individual Tax Agent — evaluates Form 1040 income streams, filing status dependencies, and required schedules. */
export function runA21IndividualTax(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const wages = intOr(payload.w2_wages_cents, 0);
  const selfEmp = intOr(payload.schedule_c_net_cents, 0);
  const investment = intOr(payload.investment_income_cents, 0);
  const totalIncome = wages + selfEmp + investment;
  const seTaxReview = selfEmp >= 40_000; // $400 statutory SE tax threshold in cents

  return {
    status: seTaxReview ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Individual return analysis: total income ${totalIncome} cents; Schedule SE ${seTaxReview ? 'required (>= $400 net SE)' : 'not triggered'}.`,
    findings: [
      {
        code: seTaxReview ? 'SCHEDULE_SE_TRIGGERED' : 'INDIVIDUAL_INCOME_SUMMARIZED',
        severity: seTaxReview ? 'WARNING' : 'INFO',
        summary: `W-2 ${wages}, Schedule C ${selfEmp}, Investment ${investment} cents.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §1401 (Self-Employment Tax)', 'Form 1040 Instructions'],
        recommended_human_action: 'Preparer must reconcile all income forms against IRS transcripts and client organizer.',
      },
    ],
    structured_data: { total_income_cents: totalIncome, schedule_se_required: seTaxReview },
    authority_citations: ['IRC §1401', 'Form 1040 Instructions'],
  };
}

/** A22: Deduction Agent — identifies potential above-the-line and itemized deductions with statutory caps (e.g., SALT). */
export function runA22Deduction(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const saltPaid = intOr(payload.state_local_tax_paid_cents, 0);
  const filingStatus = typeof payload.filing_status === 'string' ? payload.filing_status.toUpperCase() : 'SINGLE';
  const saltCap = filingStatus === 'MFS' ? 500_000 : 1_000_000; // $5,000 MFS / $10,000 standard IRC §164(b)(6) cap
  const allowableSalt = Math.min(saltPaid, saltCap);
  const mortgageInterest = intOr(payload.mortgage_interest_cents, 0);
  const charitable = intOr(payload.charitable_contributions_cents, 0);
  const totalItemized = allowableSalt + mortgageInterest + charitable;

  return {
    status: 'ADVISORY',
    summary: `Deduction analysis: SALT capped at ${allowableSalt} of ${saltPaid} cents; total advisory itemized deductions ${totalItemized} cents.`,
    findings: [
      {
        code: saltPaid > saltCap ? 'SALT_CAP_APPLIED' : 'DEDUCTIONS_EVALUATED',
        severity: 'INFO',
        summary: `Allowable SALT ${allowableSalt} cents, mortgage interest ${mortgageInterest} cents, charitable ${charitable} cents.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §164(b)(6) (SALT Cap)', 'IRC §163(h)', 'IRC §170'],
        recommended_human_action: 'Preparer must confirm written acknowledgments for charitable gifts >= $250 and Form 1098 substantiation.',
      },
    ],
    structured_data: { salt_paid_cents: saltPaid, allowable_salt_cents: allowableSalt, total_itemized_cents: totalItemized },
    authority_citations: ['IRC §164(b)(6)', 'IRC §163(h)', 'IRC §170'],
  };
}

/** A23: Credit Agent — screens qualifying dependent/child & education credit eligibility against AGI phaseouts. */
export function runA23Credit(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const qualifyingChildren = intOr(payload.qualifying_children_under_17, 0);
  const agi = intOr(payload.agi_cents, 0);
  const filingStatus = typeof payload.filing_status === 'string' ? payload.filing_status.toUpperCase() : 'SINGLE';
  const phaseoutStart = filingStatus === 'MFJ' ? 40_000_000 : 20_000_000;
  const maxCtc = qualifyingChildren * 200_000; // $2,000 per child baseline IRC §24
  const excessUnits = agi > phaseoutStart ? Math.ceil((agi - phaseoutStart) / 100_000) : 0;
  const advisoryCtc = Math.max(0, maxCtc - excessUnits * 5_000);

  return {
    status: 'ADVISORY',
    summary: `Credit screening: ${qualifyingChildren} qualifying child(ren) → advisory Child Tax Credit ${advisoryCtc} cents (phaseout reduction ${maxCtc - advisoryCtc} cents).`,
    findings: [
      {
        code: 'TAX_CREDITS_SCREENED',
        severity: 'INFO',
        summary: `Baseline IRC §24 computation: max ${maxCtc} cents, phaseout-adjusted ${advisoryCtc} cents. Due diligence Form 8867 required if applicable.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §24 (Child Tax Credit)', 'IRC §6695(g) (Paid Preparer Due Diligence)'],
        recommended_human_action: 'Preparer must complete statutory due-diligence checklist and verify SSNs.',
      },
    ],
    structured_data: { qualifying_children: qualifyingChildren, advisory_ctc_cents: advisoryCtc, form_8867_due_diligence_required: qualifyingChildren > 0 },
    authority_citations: ['IRC §24', 'IRC §6695(g)'],
  };
}

/** A24: Depreciation Agent — validates asset basis, placed-in-service date, recovery period, and straight-line/MACRS check. */
export function runA24Depreciation(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const costBasis = intOr(payload.cost_basis_cents, -1);
  const recoveryYears = intOr(payload.recovery_period_years, 0);
  if (costBasis < 0 || recoveryYears <= 0 || recoveryYears > 40) {
    throw new WorkforceError('DEPRECIATION_INVALID_ASSET_PARAMS', 400);
  }
  const annualStraightLine = Math.round(costBasis / recoveryYears);
  return {
    status: 'REVIEW_REQUIRED',
    summary: `Asset depreciation advisory: basis ${costBasis} cents over ${recoveryYears} yr → straight-line baseline ${annualStraightLine} cents/yr (verify MACRS convention & §179/bonus eligibility).`,
    findings: [
      {
        code: 'DEPRECIATION_SCHEDULE_PROPOSED',
        severity: 'INFO',
        summary: `Straight-line reference ${annualStraightLine} cents/yr. Confirm placed-in-service convention (HY/MQ/MM) and §179 limits.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §168 (MACRS)', 'IRC §179', 'IRS Pub. 946'],
        recommended_human_action: 'Preparer must confirm MACRS table convention and Form 4562 elections.',
      },
    ],
    structured_data: { cost_basis_cents: costBasis, recovery_period_years: recoveryYears, annual_straight_line_cents: annualStraightLine },
    authority_citations: ['IRC §168', 'IRC §179', 'IRS Pub. 946'],
  };
}

/** A25: Payroll Tax Agent — reconciles Form 941 quarterly wages vs. Form W-3/W-2 totals in integer cents. */
export function runA25PayrollTax(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const form941Wages = intOr(payload.form_941_total_wages_cents, -1);
  const w3Wages = intOr(payload.form_w3_total_wages_cents, -1);
  if (form941Wages < 0 || w3Wages < 0) throw new WorkforceError('PAYROLL_INVALID_WAGE_TOTALS', 400);
  const variance = form941Wages - w3Wages;
  return {
    status: variance !== 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: variance !== 0
      ? `Payroll reconciliation discrepancy: 941 total (${form941Wages}) differs from W-3 (${w3Wages}) by ${variance} cents.`
      : `Form 941 total wages tie exactly to Form W-3 (${form941Wages} cents).`,
    findings: [
      {
        code: variance !== 0 ? 'PAYROLL_941_W3_VARIANCE' : 'PAYROLL_RECONCILED_ADVISORY',
        severity: variance !== 0 ? 'HIGH' : 'INFO',
        summary: variance !== 0 ? `Variance of ${variance} cents between 941 and W-3.` : '941 and W-3 wages agree.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['Form 941 Instructions', 'Form W-2/W-3 General Instructions'],
        recommended_human_action: 'Tax professional must resolve any 941-to-W-3 discrepancy before filing.',
      },
    ],
    structured_data: { form_941_wages_cents: form941Wages, form_w3_wages_cents: w3Wages, variance_cents: variance },
    authority_citations: ['Form 941 Instructions'],
  };
}

/** A26: Estimated Tax Agent — projects IRC §6654 safe-harbor quarterly estimated tax installments. */
export function runA26EstimatedTax(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const priorYearTax = intOr(payload.prior_year_tax_cents, 0);
  const priorYearAgi = intOr(payload.prior_year_agi_cents, 0);
  const currentYearProjectedTax = intOr(payload.projected_current_tax_cents, 0);
  const withholding = intOr(payload.expected_withholding_cents, 0);

  const priorSafeHarborPct = priorYearAgi > 15_000_000 ? 1.1 : 1.0; // 110% over $150k AGI per IRC §6654(d)(1)(C)
  const safeHarborPrior = Math.round(priorYearTax * priorSafeHarborPct);
  const safeHarborCurrent = Math.round(currentYearProjectedTax * 0.9);
  const targetAnnual = Math.min(safeHarborPrior || safeHarborCurrent, safeHarborCurrent || safeHarborPrior);
  const remainingDue = Math.max(0, targetAnnual - withholding);
  const quarterlyVoucher = Math.ceil(remainingDue / 4);

  return {
    status: 'ADVISORY',
    summary: `Safe-harbor projection: annual target ${targetAnnual} cents, remaining after withholding ${remainingDue} cents (${quarterlyVoucher} cents/quarter).`,
    findings: [
      {
        code: 'ESTIMATED_TAX_VOUCHERS_PROPOSED',
        severity: 'INFO',
        summary: `Applied ${priorSafeHarborPct * 100}% prior-year / 90% current-year IRC §6654 safe harbor.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §6654(d) (Safe Harbor Estimated Payments)'],
        recommended_human_action: 'Tax professional must review cash-flow timing before approving Form 1040-ES vouchers.',
      },
    ],
    structured_data: {
      safe_harbor_target_cents: targetAnnual,
      remaining_due_cents: remainingDue,
      quarterly_installment_cents: quarterlyVoucher,
    },
    authority_citations: ['IRC §6654(d)'],
  };
}

/** A27: Tax Planning Agent — compares deterministic baseline vs. scenario tax outcomes for CPA/EA advisory. */
export function runA27TaxPlanning(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const baselineTax = intOr(payload.baseline_tax_cents, -1);
  const scenarioTax = intOr(payload.scenario_tax_cents, -1);
  const strategyName = typeof payload.strategy_name === 'string' ? payload.strategy_name.trim() : 'Unnamed Strategy';
  if (baselineTax < 0 || scenarioTax < 0) throw new WorkforceError('TAX_PLANNING_INVALID_SCENARIO', 400);
  const delta = baselineTax - scenarioTax;

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Scenario "${strategyName}": baseline ${baselineTax} cents vs. scenario ${scenarioTax} cents (estimated delta ${delta} cents). CPA/EA review required.`,
    findings: [
      {
        code: 'PLANNING_SCENARIO_COMPARED',
        severity: 'INFO',
        summary: `Estimated tax reduction of ${delta} cents under "${strategyName}"; projection is advisory only.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'CPA/EA must evaluate economic substance, phaseouts, and multi-year impact before presenting to client.',
      },
    ],
    structured_data: { strategy_name: strategyName, baseline_tax_cents: baselineTax, scenario_tax_cents: scenarioTax, estimated_savings_cents: delta },
  };
}

/** A28: Tax Calculation Verification Agent — independently verifies deterministic tax calculation engine sums & invariants. */
export function runA28CalculationVerification(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const computedTax = intOr(payload.computed_total_tax_cents, -1);
  const paymentsAndCredits = intOr(payload.total_payments_and_credits_cents, -1);
  const reportedBalanceDue = intOr(payload.reported_balance_due_cents, 0);
  const reportedRefund = intOr(payload.reported_refund_cents, 0);
  if (computedTax < 0 || paymentsAndCredits < 0) throw new WorkforceError('CALC_VERIFICATION_INVALID_INPUTS', 400);

  const expectedBalanceDue = Math.max(0, computedTax - paymentsAndCredits);
  const expectedRefund = Math.max(0, paymentsAndCredits - computedTax);
  const mismatch = expectedBalanceDue !== reportedBalanceDue || expectedRefund !== reportedRefund;

  return {
    status: mismatch ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: mismatch
      ? `Calculation verification MISMATCH: expected due=${expectedBalanceDue}/refund=${expectedRefund} vs. reported due=${reportedBalanceDue}/refund=${reportedRefund}.`
      : `Deterministic calculation verification passed: total tax ${computedTax}, payments ${paymentsAndCredits}, due ${expectedBalanceDue}, refund ${expectedRefund}.`,
    findings: [
      {
        code: mismatch ? 'CALCULATION_VERIFICATION_MISMATCH' : 'CALCULATION_VERIFIED_ADVISORY',
        severity: mismatch ? 'CRITICAL' : 'INFO',
        summary: mismatch ? 'Reported balance due/refund does not tie to deterministic calculation engine totals.' : 'Tax engine totals verified to the cent.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Reviewer must inspect calculation run inputs and approve or reject the run.',
      },
    ],
    structured_data: {
      verified_tie_out: !mismatch,
      expected_balance_due_cents: expectedBalanceDue,
      expected_refund_cents: expectedRefund,
    },
  };
}

/** A29: Return Preparation Agent — checks assembly prerequisites (verified facts, calc run, mapped schedules) without writing return. */
export function runA29ReturnPreparation(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const checks = {
    verified_facts_complete: payload.verified_facts_complete === true,
    approved_calculation_run: payload.approved_calculation_run === true,
    form_mapping_complete: payload.form_mapping_complete === true,
    open_blocking_exceptions: intOr(payload.open_blocking_exceptions, 0) === 0,
  };
  const unmet = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);

  return {
    status: unmet.length ? 'EVIDENCE_REQUIRED' : 'ADVISORY',
    summary: unmet.length
      ? `Return assembly incomplete: ${unmet.length} unmet prerequisite(s) (${unmet.join(', ')}).`
      : 'All return assembly prerequisites met; ready for human preparer assembly.',
    findings: [
      {
        code: unmet.length ? 'RETURN_ASSEMBLY_PREREQUISITES_UNMET' : 'RETURN_ASSEMBLY_READY',
        severity: unmet.length ? 'WARNING' : 'INFO',
        summary: unmet.length ? `Unmet: ${unmet.join(', ')}.` : 'All assembly prerequisites verified.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Preparer coordinates final return assembly in workspace; agent never writes return data.',
      },
    ],
    structured_data: { checks, unmet_prerequisites: unmet, return_written: false },
  };
}

/** A30: Form Mapping Agent — maps validated case facts to canonical IRS form lines with explicit schema verification. */
export function runA30FormMapping(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const formId = typeof payload.form_id === 'string' ? payload.form_id.trim() : 'FORM_1040';
  const entries = (payload.fact_values && typeof payload.fact_values === 'object'
    ? payload.fact_values
    : {}) as Record<string, unknown>;
  const lineMap: Record<string, string> = {
    w2_wages_cents: 'Line 1a (Wages, salaries, tips)',
    taxable_interest_cents: 'Line 2b (Taxable interest)',
    ordinary_dividends_cents: 'Line 3b (Ordinary dividends)',
    agi_cents: 'Line 11 (Adjusted gross income)',
    deduction_cents: 'Line 12 (Standard or itemized deduction)',
    taxable_income_cents: 'Line 15 (Taxable income)',
    total_tax_cents: 'Line 24 (Total tax)',
  };

  const mapped: Json[] = [];
  const unmappedKeys: string[] = [];
  for (const [k, v] of Object.entries(entries)) {
    if (lineMap[k]) {
      mapped.push({ fact_key: k, form_line: lineMap[k], value: typeof v === 'number' || typeof v === 'string' ? v : null });
    } else {
      unmappedKeys.push(k);
    }
  }

  return {
    status: unmappedKeys.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Mapped ${mapped.length} field(s) to ${formId}; ${unmappedKeys.length} unmapped key(s) require preparer review.`,
    findings: [
      {
        code: unmappedKeys.length ? 'UNMAPPED_FORM_FIELDS' : 'FORM_MAPPING_PROPOSED',
        severity: unmappedKeys.length ? 'WARNING' : 'INFO',
        summary: unmappedKeys.length ? `Unmapped keys: ${unmappedKeys.join(', ')}.` : `Proposed ${mapped.length} line mappings for ${formId}.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Preparer must inspect and apply line mappings via authoritative form mapping panel.',
      },
    ],
    structured_data: { form_id: formId, mapped_lines: mapped, unmapped_keys: unmappedKeys, return_mutated: false },
  };
}

/** A31: Return Diagnostics Agent — detects incomplete/inconsistent return fields, missing schedules, and cross-form mismatches. */
export function runA31ReturnDiagnostics(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const issues: Array<{ code: string; severity: 'WARNING' | 'CRITICAL'; message: string }> = [];
  if (payload.has_schedule_c_income && !payload.schedule_c_attached) {
    issues.push({ code: 'DIAG_MISSING_SCHEDULE_C', severity: 'CRITICAL', message: 'Business income reported without Schedule C attached.' });
  }
  if (payload.has_w2_withholding && intOr(payload.w2_count, 0) === 0) {
    issues.push({ code: 'DIAG_WITHHOLDING_WITHOUT_W2', severity: 'CRITICAL', message: 'Federal W-2 withholding present with zero W-2 source records.' });
  }
  if (payload.filing_status === 'MFJ' && !payload.spouse_present) {
    issues.push({ code: 'DIAG_MFJ_MISSING_SPOUSE', severity: 'CRITICAL', message: 'Married Filing Jointly selected without spouse record.' });
  }
  if (intOr(payload.taxable_income_cents, 0) > 0 && intOr(payload.total_tax_cents, 0) === 0) {
    issues.push({ code: 'DIAG_ZERO_TAX_ON_POSITIVE_INCOME', severity: 'WARNING', message: 'Positive taxable income shows zero computed tax; verify credits/capital-gains worksheets.' });
  }

  const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
  return {
    status: issues.length ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: issues.length
      ? `Return diagnostics found ${issues.length} issue(s) (${criticalCount} blocking/critical).`
      : 'Return diagnostics passed baseline consistency checks; reviewer confirmation required.',
    findings: issues.length
      ? issues.map(i => ({
          code: i.code,
          severity: i.severity,
          summary: i.message,
          evidence_source_ids: ctx.evidence.map(e => e.source_id),
          recommended_human_action: 'Resolve diagnostic finding before advancing to reviewer sign-off.',
        }))
      : [
          {
            code: 'DIAGNOSTICS_CLEAR_ADVISORY',
            severity: 'INFO',
            summary: 'No baseline return diagnostic errors detected.',
            evidence_source_ids: ctx.evidence.map(e => e.source_id),
            recommended_human_action: 'Proceed to human reviewer inspection.',
          },
        ],
    structured_data: { diagnostic_count: issues.length, blocking_count: criticalCount, diagnostics: issues },
  };
}

const TAX_ROLES = ['accountant', 'reviewer', 'senior_reviewer', 'cpa', 'ea'] as const;

export const BATCH_3_AGENT_SPECS: readonly WorkforceAgentSpec[] = Object.freeze([
  {
    agent_id: 'A17', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Tax Research Agent', workflow_stages: [7, 8, 9, 10],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'tax_issue', 'authority_citations'], authorized_tools: ['tax_authority.search'],
    data_classes: ['INTERNAL', 'TAX_DATA'], output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA17TaxResearch',
    handler: runA17TaxResearch,
  },
  {
    agent_id: 'A18', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Federal Tax Agent', workflow_stages: [8, 9, 10],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'filing_status', 'gross_income_cents', 'above_the_line_adjustments_cents', 'itemized_deductions_cents'],
    authorized_tools: ['tax_authority.search', 'calculation.execute'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA18FederalTax',
    handler: runA18FederalTax,
  },
  {
    agent_id: 'A19', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'State Tax Agent', workflow_stages: [8, 9, 10],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'resident_state', 'income_source_states'],
    authorized_tools: ['tax_authority.search'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA19StateTax',
    handler: runA19StateTax,
  },
  {
    agent_id: 'A20', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Entity Tax Agent', workflow_stages: [8, 9, 10],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'ESCALATE'],
    authorized_inputs: ['scope', 'entity_type', 'owner_count', 'officer_compensation_cents', 'distributions_cents'],
    authorized_tools: ['tax_authority.search'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA20EntityTax',
    handler: runA20EntityTax,
  },
  {
    agent_id: 'A21', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Individual Tax Agent', workflow_stages: [8, 9, 10],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'PREPARER',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'w2_wages_cents', 'schedule_c_net_cents', 'investment_income_cents'],
    authorized_tools: ['calculation.execute'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'STAFF_PREPARER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA21IndividualTax',
    handler: runA21IndividualTax,
  },
  {
    agent_id: 'A22', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Deduction Agent', workflow_stages: [8, 9, 10],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'PREPARER',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'filing_status', 'state_local_tax_paid_cents', 'mortgage_interest_cents', 'charitable_contributions_cents'],
    authorized_tools: ['tax_authority.search'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'STAFF_PREPARER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA22Deduction',
    handler: runA22Deduction,
  },
  {
    agent_id: 'A23', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Credit Agent', workflow_stages: [8, 9, 10],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'PREPARER',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'qualifying_children_under_17', 'agi_cents', 'filing_status'],
    authorized_tools: ['tax_authority.search', 'calculation.execute'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'STAFF_PREPARER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA23Credit',
    handler: runA23Credit,
  },
  {
    agent_id: 'A24', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Depreciation Agent', workflow_stages: [8, 9, 10],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'PREPARER',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'cost_basis_cents', 'recovery_period_years'],
    authorized_tools: ['calculation.execute'], data_classes: ['INTERNAL', 'TAX_DATA', 'FINANCIAL_DATA'],
    output_audience: 'STAFF_PREPARER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA24Depreciation',
    handler: runA24Depreciation,
  },
  {
    agent_id: 'A25', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Payroll Tax Agent', workflow_stages: [8, 9, 10],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'form_941_total_wages_cents', 'form_w3_total_wages_cents'],
    authorized_tools: ['database.read'], data_classes: ['INTERNAL', 'TAX_DATA', 'FINANCIAL_DATA'],
    output_audience: 'STAFF_REVIEWER', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA25PayrollTax',
    handler: runA25PayrollTax,
  },
  {
    agent_id: 'A26', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Estimated Tax Agent', workflow_stages: [9, 10, 11],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'REJECT_PROPOSAL'],
    authorized_inputs: ['scope', 'prior_year_tax_cents', 'prior_year_agi_cents', 'projected_current_tax_cents', 'expected_withholding_cents'],
    authorized_tools: ['calculation.execute'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'STAFF_REVIEWER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA26EstimatedTax',
    handler: runA26EstimatedTax,
  },
  {
    agent_id: 'A27', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Tax Planning Agent', workflow_stages: [9, 10, 11],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'CPA_EA',
    permitted_decisions: ['ACKNOWLEDGE', 'APPROVE_PROPOSAL', 'REJECT_PROPOSAL'],
    authorized_inputs: ['scope', 'strategy_name', 'baseline_tax_cents', 'scenario_tax_cents'],
    authorized_tools: ['calculation.execute', 'tax_authority.search'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA27TaxPlanning',
    handler: runA27TaxPlanning,
  },
  {
    agent_id: 'A28', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Tax Calculation Verification Agent', workflow_stages: [10, 11, 12],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'computed_total_tax_cents', 'total_payments_and_credits_cents', 'reported_balance_due_cents', 'reported_refund_cents'],
    authorized_tools: ['calculation.execute'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'STAFF_REVIEWER', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA28CalculationVerification',
    handler: runA28CalculationVerification,
  },
  {
    agent_id: 'A29', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Return Preparation Agent', workflow_stages: [10, 11],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'PREPARER',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'verified_facts_complete', 'approved_calculation_run', 'form_mapping_complete', 'open_blocking_exceptions'],
    authorized_tools: ['workflow.read'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'STAFF_PREPARER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA29ReturnPreparation',
    handler: runA29ReturnPreparation,
  },
  {
    agent_id: 'A30', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Form Mapping Agent', workflow_stages: [10, 11],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'PREPARER',
    permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'form_id', 'fact_values'],
    authorized_tools: ['workflow.read', 'workflow.propose'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'STAFF_PREPARER', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA30FormMapping',
    handler: runA30FormMapping,
  },
  {
    agent_id: 'A31', batch_id: 'BATCH_3_TAX_PREPARATION', category: 'TAX_INTELLIGENCE',
    overview_name: 'Return Diagnostics Agent', workflow_stages: [11, 12],
    allowed_roles: TAX_ROLES, required_reviewer_role: 'REVIEWER',
    permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'has_schedule_c_income', 'schedule_c_attached', 'has_w2_withholding', 'w2_count', 'filing_status', 'spouse_present', 'taxable_income_cents', 'total_tax_cents'],
    authorized_tools: ['workflow.read'], data_classes: ['INTERNAL', 'TAX_DATA'],
    output_audience: 'STAFF_REVIEWER', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA31ReturnDiagnostics',
    handler: runA31ReturnDiagnostics,
  },
]);
