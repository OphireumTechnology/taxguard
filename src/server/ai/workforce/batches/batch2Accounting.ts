import type { Json } from '../../../../ai/types';
import {
  WorkforceError,
  type WorkforceAgentContext,
  type WorkforceAgentSpec,
  type WorkforceDomainHandlerResult,
} from '../contracts';

const SRC = 'src/server/ai/workforce/batches/batch2Accounting.ts';

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v);
}

/** A12: Bookkeeping Agent — suggests chart-of-accounts classifications; never posts to ledger. */
export function runA12Bookkeeping(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const txns = Array.isArray(payload.transactions) ? payload.transactions : [];
  if (txns.length === 0) {
    return {
      status: 'EVIDENCE_REQUIRED',
      summary: 'No transaction lines provided for classification.',
      findings: [
        {
          code: 'NO_TRANSACTIONS_SUPPLIED',
          severity: 'INFO',
          summary: 'Provide transaction descriptors and integer-cent amounts for classification proposals.',
          evidence_source_ids: ctx.evidence.map(e => e.source_id),
          recommended_human_action: 'Select uncategorized ledger lines before running bookkeeping classification.',
        },
      ],
      structured_data: { proposals: [], ledger_posted: false },
    };
  }

  const classifyAccount = (desc: string, amountCents: number): { account_code: string; account_name: string; category: string } => {
    const d = desc.toUpperCase();
    if (amountCents > 0 && (d.includes('CLIENT') || d.includes('INVOICE') || d.includes('REVENUE') || d.includes('DEPOSIT'))) {
      return { account_code: '4000', account_name: 'Service Revenue', category: 'INCOME' };
    }
    if (d.includes('PAYROLL') || d.includes('ADP') || d.includes('GUSTO')) {
      return { account_code: '6100', account_name: 'Payroll & Wages Expense', category: 'EXPENSE' };
    }
    if (d.includes('RENT') || d.includes('LEASE')) {
      return { account_code: '6200', account_name: 'Rent Expense', category: 'EXPENSE' };
    }
    if (d.includes('MEAL') || d.includes('RESTAURANT') || d.includes('CAFE')) {
      return { account_code: '6410', account_name: 'Business Meals (50% Limit Review)', category: 'EXPENSE' };
    }
    if (d.includes('SOFTWARE') || d.includes('SAAS') || d.includes('CLOUD')) {
      return { account_code: '6300', account_name: 'Software & Subscriptions', category: 'EXPENSE' };
    }
    return { account_code: '6999', account_name: 'Uncategorized — Accountant Review Required', category: 'SUSPENSE' };
  };

  const proposals: Json[] = [];
  let suspenseCount = 0;

  for (const t of txns) {
    if (!t || typeof t !== 'object') continue;
    const rec = t as Record<string, unknown>;
    const id = typeof rec.transaction_id === 'string' ? rec.transaction_id : '';
    const desc = typeof rec.description === 'string' ? rec.description : '';
    const amountCents = isInt(rec.amount_cents) ? rec.amount_cents : 0;
    if (!id) continue;
    const suggestion = classifyAccount(desc, amountCents);
    if (suggestion.category === 'SUSPENSE') suspenseCount++;
    proposals.push({
      transaction_id: id,
      amount_cents: amountCents,
      ...suggestion,
      ledger_posted: false,
    });
  }

  return {
    status: suspenseCount > 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary: `Generated ${proposals.length} classification proposal(s) (${suspenseCount} routed to suspense for accountant judgment). No ledger entries posted.`,
    findings: [
      {
        code: suspenseCount > 0 ? 'SUSPENSE_TRANSACTIONS_REQUIRE_ACCOUNTANT' : 'BOOKKEEPING_CLASSIFICATIONS_PROPOSED',
        severity: suspenseCount > 0 ? 'WARNING' : 'INFO',
        summary: `Proposed ${proposals.length} classifications; ${suspenseCount} require direct accountant categorization.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Accountant must review and post approved classifications via authoritative ledger service.',
      },
    ],
    structured_data: { proposals, suspense_count: suspenseCount, ledger_posted: false },
  };
}

/** A13: Reconciliation Agent — computes exact integer-cent variances and unmatched bank vs. ledger lines. */
export function runA13Reconciliation(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const bankEnding = payload.bank_ending_balance_cents;
  const ledgerEnding = payload.ledger_ending_balance_cents;
  if (!isInt(bankEnding) || !isInt(ledgerEnding)) {
    throw new WorkforceError('ACCOUNTING_INVALID_CENT_AMOUNTS', 400);
  }
  const depositsInTransit = isInt(payload.deposits_in_transit_cents) ? payload.deposits_in_transit_cents : 0;
  const outstandingChecks = isInt(payload.outstanding_checks_cents) ? payload.outstanding_checks_cents : 0;
  const adjustedBank = bankEnding + depositsInTransit - outstandingChecks;
  const varianceCents = adjustedBank - ledgerEnding;

  return {
    status: varianceCents !== 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary:
      varianceCents === 0
        ? `Reconciliation balanced to the cent (adjusted balance ${adjustedBank} cents). Accountant sign-off required.`
        : `Reconciliation out of balance by ${varianceCents} cents (adjusted bank ${adjustedBank} vs. ledger ${ledgerEnding}).`,
    findings: [
      {
        code: varianceCents !== 0 ? 'RECONCILIATION_VARIANCE_DETECTED' : 'RECONCILIATION_BALANCED_ADVISORY',
        severity: varianceCents !== 0 ? 'HIGH' : 'INFO',
        summary:
          varianceCents !== 0
            ? `Unreconciled variance of ${varianceCents} cents requires accountant investigation.`
            : 'Adjusted bank balance equals ledger balance with zero cent variance.',
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Accountant must investigate variance or formally close the reconciliation period.',
      },
    ],
    structured_data: {
      bank_ending_balance_cents: bankEnding,
      ledger_ending_balance_cents: ledgerEnding,
      deposits_in_transit_cents: depositsInTransit,
      outstanding_checks_cents: outstandingChecks,
      adjusted_bank_cents: adjustedBank,
      variance_cents: varianceCents,
      period_closed: false,
    },
  };
}

/** A14: Journal Entry Agent — proposes strictly balanced debit=credit entries in integer cents; never posts. */
export function runA14JournalEntry(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
  if (rawLines.length < 2) {
    throw new WorkforceError('JOURNAL_ENTRY_MINIMUM_TWO_LINES_REQUIRED', 400);
  }

  let totalDebits = 0;
  let totalCredits = 0;
  const normalizedLines: Json[] = [];

  for (const line of rawLines) {
    if (!line || typeof line !== 'object') throw new WorkforceError('JOURNAL_ENTRY_INVALID_LINE', 400);
    const l = line as Record<string, unknown>;
    const accountCode = typeof l.account_code === 'string' && l.account_code.trim() ? l.account_code.trim() : null;
    const debit = isInt(l.debit_cents) && l.debit_cents >= 0 ? l.debit_cents : null;
    const credit = isInt(l.credit_cents) && l.credit_cents >= 0 ? l.credit_cents : null;
    if (!accountCode || debit === null || credit === null || (debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
      throw new WorkforceError('JOURNAL_ENTRY_INVALID_LINE', 400);
    }
    totalDebits += debit;
    totalCredits += credit;
    normalizedLines.push({ account_code: accountCode, debit_cents: debit, credit_cents: credit, memo: typeof l.memo === 'string' ? l.memo.slice(0, 200) : '' });
  }

  if (totalDebits !== totalCredits) {
    throw new WorkforceError('JOURNAL_ENTRY_UNBALANCED', 400, {
      total_debits_cents: totalDebits,
      total_credits_cents: totalCredits,
      out_of_balance_cents: totalDebits - totalCredits,
    });
  }

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Draft adjusting journal entry balanced at ${totalDebits} cents across ${normalizedLines.length} lines. Awaiting accountant posting approval.`,
    findings: [
      {
        code: 'BALANCED_JOURNAL_PROPOSAL_READY',
        severity: 'INFO',
        summary: `Debits (${totalDebits} cents) equal Credits (${totalCredits} cents). Entry is NOT posted to the general ledger.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Accountant must review supporting workpapers and post via the authoritative ledger workflow.',
      },
    ],
    structured_data: {
      balanced: true,
      total_debits_cents: totalDebits,
      total_credits_cents: totalCredits,
      lines: normalizedLines,
      posted_to_ledger: false,
    },
  };
}

/** A15: Financial Statement Agent — checks Balance Sheet A = L + E invariant, P&L net income, and materiality ratios. */
export function runA15FinancialStatement(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const assets = payload.total_assets_cents;
  const liabilities = payload.total_liabilities_cents;
  const equity = payload.total_equity_cents;
  const revenue = payload.total_revenue_cents;
  const expenses = payload.total_expenses_cents;

  if (!isInt(assets) || !isInt(liabilities) || !isInt(equity) || !isInt(revenue) || !isInt(expenses)) {
    throw new WorkforceError('FINANCIAL_STATEMENT_INVALID_TOTALS', 400);
  }

  const balanceSheetDiff = assets - (liabilities + equity);
  const netIncome = revenue - expenses;
  const marginPct = revenue > 0 ? Number(((netIncome / revenue) * 100).toFixed(2)) : 0;

  return {
    status: balanceSheetDiff !== 0 ? 'REVIEW_REQUIRED' : 'ADVISORY',
    summary:
      balanceSheetDiff !== 0
        ? `Balance sheet out of balance by ${balanceSheetDiff} cents (A=${assets}, L+E=${liabilities + equity}). Net income: ${netIncome} cents.`
        : `Balance sheet ties exactly (A=L+E=${assets} cents); net income ${netIncome} cents (${marginPct}% margin).`,
    findings: [
      {
        code: balanceSheetDiff !== 0 ? 'BALANCE_SHEET_OUT_OF_BALANCE' : 'FINANCIAL_STATEMENTS_TIED_ADVISORY',
        severity: balanceSheetDiff !== 0 ? 'CRITICAL' : 'INFO',
        summary:
          balanceSheetDiff !== 0
            ? `Accounting equation A = L + E fails by ${balanceSheetDiff} cents.`
            : `Accounting equation holds; net profit margin is ${marginPct}%.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        recommended_human_action: 'Accountant must review trial balance tie-out and footnote disclosures.',
      },
    ],
    structured_data: {
      total_assets_cents: assets,
      total_liabilities_cents: liabilities,
      total_equity_cents: equity,
      balance_sheet_diff_cents: balanceSheetDiff,
      net_income_cents: netIncome,
      net_margin_pct: marginPct,
    },
  };
}

/** A16: Book-to-Tax Agent — computes Schedule M-1/M-3 permanent & temporary book-to-tax adjustments. */
export function runA16BookToTax(
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
): WorkforceDomainHandlerResult {
  const bookNetIncome = payload.book_net_income_cents;
  if (!isInt(bookNetIncome)) {
    throw new WorkforceError('BOOK_TO_TAX_INVALID_INCOME', 400);
  }
  const mealsExpense = isInt(payload.business_meals_cents) ? payload.business_meals_cents : 0;
  const nondeductiblePenalties = isInt(payload.penalties_cents) ? payload.penalties_cents : 0;
  const bookDepreciation = isInt(payload.book_depreciation_cents) ? payload.book_depreciation_cents : 0;
  const taxDepreciation = isInt(payload.tax_depreciation_cents) ? payload.tax_depreciation_cents : 0;

  const mealsAddback = Math.round(mealsExpense * 0.5);
  const depreciationTimingDiff = bookDepreciation - taxDepreciation;
  const estimatedTaxableIncome = bookNetIncome + mealsAddback + nondeductiblePenalties + depreciationTimingDiff;

  return {
    status: 'REVIEW_REQUIRED',
    summary: `Computed M-1 book-to-tax bridge: book income ${bookNetIncome} cents → advisory taxable income ${estimatedTaxableIncome} cents.`,
    findings: [
      {
        code: 'BOOK_TO_TAX_BRIDGE_PROPOSED',
        severity: 'INFO',
        summary: `Permanent add-backs: meals 50% (${mealsAddback} cents), penalties (${nondeductiblePenalties} cents); temporary depreciation diff: ${depreciationTimingDiff} cents.`,
        evidence_source_ids: ctx.evidence.map(e => e.source_id),
        authority_citations: ['IRC §274(n) (50% Meals Limitation)', 'IRC §162(f) (Fines & Penalties)', 'IRC §168 (MACRS Depreciation)'],
        recommended_human_action: 'Tax professional must verify M-1/M-3 permanent and timing adjustments before return mapping.',
      },
    ],
    structured_data: {
      book_net_income_cents: bookNetIncome,
      permanent_meals_addback_cents: mealsAddback,
      permanent_penalties_addback_cents: nondeductiblePenalties,
      temporary_depreciation_diff_cents: depreciationTimingDiff,
      advisory_taxable_income_cents: estimatedTaxableIncome,
      authoritative_return_updated: false,
    },
    authority_citations: ['IRC §274(n)', 'IRC §162(f)', 'IRC §168'],
  };
}

export const BATCH_2_AGENT_SPECS: readonly WorkforceAgentSpec[] = Object.freeze([
  {
    agent_id: 'A12', batch_id: 'BATCH_2_ACCOUNTING', category: 'ACCOUNTING',
    overview_name: 'Bookkeeping Agent', workflow_stages: [4, 5, 6],
    allowed_roles: ['accountant', 'bookkeeper', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'transactions'], authorized_tools: ['database.read'],
    data_classes: ['INTERNAL', 'FINANCIAL_DATA'], output_audience: 'ACCOUNTANT', risk_level: 'MATERIAL',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA12Bookkeeping',
    handler: runA12Bookkeeping,
  },
  {
    agent_id: 'A13', batch_id: 'BATCH_2_ACCOUNTING', category: 'ACCOUNTING',
    overview_name: 'Reconciliation Agent', workflow_stages: [5, 6],
    allowed_roles: ['accountant', 'bookkeeper', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'bank_ending_balance_cents', 'ledger_ending_balance_cents', 'deposits_in_transit_cents', 'outstanding_checks_cents'],
    authorized_tools: ['database.read'], data_classes: ['INTERNAL', 'FINANCIAL_DATA'],
    output_audience: 'ACCOUNTANT', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA13Reconciliation',
    handler: runA13Reconciliation,
  },
  {
    agent_id: 'A14', batch_id: 'BATCH_2_ACCOUNTING', category: 'ACCOUNTING',
    overview_name: 'Journal Entry Agent', workflow_stages: [5, 6],
    allowed_roles: ['accountant', 'bookkeeper', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'lines'], authorized_tools: ['database.read', 'workflow.propose'],
    data_classes: ['INTERNAL', 'FINANCIAL_DATA'], output_audience: 'ACCOUNTANT', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA14JournalEntry',
    handler: runA14JournalEntry,
  },
  {
    agent_id: 'A15', batch_id: 'BATCH_2_ACCOUNTING', category: 'ACCOUNTING',
    overview_name: 'Financial Statement Agent', workflow_stages: [6, 7],
    allowed_roles: ['accountant', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'REVIEWER', permitted_decisions: ['ACKNOWLEDGE', 'RETURN_FOR_CORRECTION', 'ESCALATE'],
    authorized_inputs: ['scope', 'total_assets_cents', 'total_liabilities_cents', 'total_equity_cents', 'total_revenue_cents', 'total_expenses_cents'],
    authorized_tools: ['database.read'], data_classes: ['INTERNAL', 'FINANCIAL_DATA'],
    output_audience: 'ACCOUNTANT', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA15FinancialStatement',
    handler: runA15FinancialStatement,
  },
  {
    agent_id: 'A16', batch_id: 'BATCH_2_ACCOUNTING', category: 'ACCOUNTING',
    overview_name: 'Book-to-Tax Agent', workflow_stages: [6, 7, 8],
    allowed_roles: ['accountant', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    required_reviewer_role: 'CPA_EA', permitted_decisions: ['APPROVE_PROPOSAL', 'REJECT_PROPOSAL', 'RETURN_FOR_CORRECTION'],
    authorized_inputs: ['scope', 'book_net_income_cents', 'business_meals_cents', 'penalties_cents', 'book_depreciation_cents', 'tax_depreciation_cents'],
    authorized_tools: ['database.read', 'tax_authority.search'], data_classes: ['INTERNAL', 'FINANCIAL_DATA', 'TAX_DATA'],
    output_audience: 'CPA_EA', risk_level: 'HIGH',
    requires_case_scope: true, requires_evidence: false, source_path: SRC, handler_name: 'runA16BookToTax',
    handler: runA16BookToTax,
  },
]);
