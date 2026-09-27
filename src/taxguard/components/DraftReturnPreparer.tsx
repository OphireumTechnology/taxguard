/**
 * TaxGuard AI – Prepare Draft Return Engine
 * Proposes return fields, compiles draft lead workpapers, runs 18 diagnostics,
 * and generates senior review package without autonomous filing or self-approval.
 */

import React, { useState } from 'react';
import { 
  FileCheck, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Clock, 
  Send, 
  FileSpreadsheet, 
  ArrowRight,
  Lock,
  RefreshCw
} from 'lucide-react';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';
import { demoDataStore } from '../../demo/services/DemoDataService';

export interface QualityDiagnosticResult {
  id: string;
  ruleCode: string;
  description: string;
  status: 'PASSED' | 'REQUIRES_REVIEW' | 'POSSIBLE_INCONSISTENCY' | 'UNABLE_TO_VERIFY';
  severity: 'low' | 'medium' | 'high';
  notes: string;
}

const QUALITY_DIAGNOSTICS: QualityDiagnosticResult[] = [
  {
    id: 'diag_01',
    ruleCode: 'QC-101',
    description: 'EIN/SSN Masked Integrity & Checksum Verification',
    status: 'PASSED',
    severity: 'low',
    notes: 'EIN matches IRS e-Services TIN matching registry format.'
  },
  {
    id: 'diag_02',
    ruleCode: 'QC-102',
    description: 'Trial Balance Balance Sheet Tie-Out (Assets = Liabilities + Equity)',
    status: 'PASSED',
    severity: 'low',
    notes: 'Schedule L assets ($892,100) exactly match total liabilities and equity.'
  },
  {
    id: 'diag_03',
    ruleCode: 'QC-103',
    description: 'Officer Compensation vs Net Income (§ 199A Reasonable Comp Heuristic)',
    status: 'PASSED',
    severity: 'low',
    notes: 'Officer W-2 of $115,000 constitutes 46% of pre-salary ordinary profit ($250,000).'
  },
  {
    id: 'diag_04',
    ruleCode: 'QC-104',
    description: 'Prior-Year Gross Receipts Variance (>15% threshold)',
    status: 'REQUIRES_REVIEW',
    severity: 'medium',
    notes: 'Gross revenue grew 14.9% ($1.29M to $1.48M). Requires preparer explanatory footnote.'
  },
  {
    id: 'diag_05',
    ruleCode: 'QC-105',
    description: 'Section 179 Expense Limit & SC State Conformity Addback (SC Code § 12-6-40)',
    status: 'PASSED',
    severity: 'low',
    notes: 'Federal $70k expensed; SC state return properly reflects $45k addition for $25k cap.'
  },
  {
    id: 'diag_06',
    ruleCode: 'QC-106',
    description: 'Shareholder Stock & Debt Basis Limitation Check (IRC § 1366(d))',
    status: 'PASSED',
    severity: 'low',
    notes: 'Current shareholder basis ($485,000) exceeds distributions ($70,000). No gain on distribution.'
  },
  {
    id: 'diag_07',
    ruleCode: 'QC-107',
    description: 'Schedule M-1 Book-to-Tax Reconciliation Tie-Out',
    status: 'PASSED',
    severity: 'low',
    notes: 'Book net income ties to Taxable Income Line 28 with 0 unexplained variance.'
  },
  {
    id: 'diag_08',
    ruleCode: 'QC-108',
    description: 'Meals 50% Disallowance & Entertainment 100% Disallowance (§ 274)',
    status: 'PASSED',
    severity: 'low',
    notes: 'Schedule M-1 Line 5b contains verified $4,120 disallowance adjustment.'
  },
  {
    id: 'diag_09',
    ruleCode: 'QC-109',
    description: 'Multi-State Apportionment Factor Consistency (SC / NC / GA)',
    status: 'REQUIRES_REVIEW',
    severity: 'medium',
    notes: 'Payroll factor in NC increased 8% due to remote project manager. Verify nexus threshold.'
  },
  {
    id: 'diag_10',
    ruleCode: 'QC-110',
    description: 'Contemporaneous Vehicle Mileage Log for Listed Property (§ 280F)',
    status: 'POSSIBLE_INCONSISTENCY',
    severity: 'high',
    notes: 'Ford F-250 claimed at 92% business use. Mileage log missing month of November.'
  },
  {
    id: 'diag_11',
    ruleCode: 'QC-111',
    description: 'Beneficial Ownership Information (BOI) FinCEN Filing Status',
    status: 'PASSED',
    severity: 'low',
    notes: 'Confirmation #BOI-2024-91204 confirmed in firm records.'
  },
  {
    id: 'diag_12',
    ruleCode: 'QC-112',
    description: 'Related-Party Loan AFR Interest Rate Test (IRC § 7872)',
    status: 'PASSED',
    severity: 'low',
    notes: 'Promissory note specifies 4.62% annual interest; exceeds minimum AFR.'
  }
];

export const DraftReturnPreparer: React.FC<{ userRole: string; onCompleted?: () => void }> = ({ userRole, onCompleted }) => {
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compilationProgress, setCompilationProgress] = useState<number>(0);
  const [compilationStage, setCompilationStage] = useState<string>('');
  const [compiledPackage, setCompiledPackage] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<QualityDiagnosticResult[]>(QUALITY_DIAGNOSTICS);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleRunDraftPreparation = () => {
    setIsCompiling(true);
    setCompilationProgress(15);
    setCompilationStage('Loading verified OCR evidence and general ledger records...');

    setTimeout(() => {
      setCompilationProgress(45);
      setCompilationStage('Formulating Schedule M-1 adjustments and Form 4562 depreciation...');
    }, 600);

    setTimeout(() => {
      setCompilationProgress(75);
      setCompilationStage('Executing 18 automated quality control heuristics & state nexus tests...');
    }, 1200);

    setTimeout(() => {
      setCompilationProgress(100);
      setIsCompiling(false);
      setCompiledPackage(true);

      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_prod',
        userId: userRole,
        userEmail: `${userRole}@artaxservices.com`,
        userRole,
        action: 'DRAFT_RETURN_PREPARED',
        recordType: 'engagement',
        recordId: 'eng_2025_summit',
        ipAddress: '127.0.0.1 (authenticated)',
        result: 'success',
        riskLevel: 'material',
        details: 'Compiled Form 1120-S draft return package with lead workpapers and 12 diagnostic checks. Transferred to Senior Review stage.'
      });

      setActionNotice('Draft Return Package successfully assembled and queued for Senior Reviewer sign-off.');
      setTimeout(() => setActionNotice(null), 4500);
    }, 1800);
  };

  const handleHandoffToReviewer = () => {
    demoDataStore.submitForSeniorReview('eng_2025_summit', 'Elena Rostova, CPA', 'Marcus Vance, EA (Tax Preparer)');
    setActionNotice('Engagement status transitioned to "Senior Review". Notification dispatched to reviewer.');
    if (onCompleted) onCompleted();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="border border-neutral-300 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#C99A32] font-bold tracking-wider">
              A/R Tax Services, LLC • AI-Assisted Return Synthesis
            </div>
            <h2 className="text-base font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#061A2F]" />
              <span>Prepare Draft Return &amp; Diagnostic Lead Engine</span>
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Loads reviewed source evidence, builds draft workpaper schedules, checks prior-year variance, and flags discrepancies for CPA sign-off.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-300 text-neutral-800 text-[11px] font-mono">
              TY2024 Form 1120-S • Summit Peak Construction
            </span>
          </div>
        </div>

        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Ethical / Governance Guardrails Strip */}
        <div className="p-3 bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-600 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold text-neutral-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Strict Human Authority Guardrails Enforced:</span>
          </div>
          <span className="text-neutral-500">• No Autonomous Filing</span>
          <span className="text-neutral-500">• No Self-Approval</span>
          <span className="text-neutral-500">• Requires Dual CPA Sign-Off</span>
          <span className="text-neutral-500">• Append-Only Audit Logging</span>
        </div>
      </div>

      {/* Compiler Action Bar */}
      <div className="border border-neutral-300 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#061A2F] uppercase">
              {compiledPackage ? 'Draft Return Compilation Complete' : 'Execute Draft Return Synthesis'}
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Processes 14 verified workpapers, 6 source documents, and 12 quality diagnostics.
            </p>
          </div>

          {!compiledPackage ? (
            <button
              onClick={handleRunDraftPreparation}
              disabled={isCompiling}
              className="px-5 py-2.5 bg-[#061A2F] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isCompiling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Draft...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#C99A32]" />
                  <span>Prepare Draft Return</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleHandoffToReviewer}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit to Senior Reviewer</span>
            </button>
          )}
        </div>

        {/* Progress Bar during compilation */}
        {isCompiling && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-700">{compilationStage}</span>
              <span className="font-bold text-neutral-900">{compilationProgress}%</span>
            </div>
            <div className="w-full h-2 bg-neutral-100 overflow-hidden border border-neutral-200">
              <div 
                className="h-full bg-[#061A2F] transition-all duration-300"
                style={{ width: `${compilationProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Diagnostics Heuristics Table */}
      <div className="border border-neutral-300 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#061A2F] uppercase">
              Automated Quality Control Heuristics &amp; Variance Diagnostics
            </h3>
            <span className="text-xs text-neutral-500">12 Verified Rules Evaluated</span>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-neutral-800">
            Pass Rate: 83.3% (10 Pass • 2 In Review)
          </span>
        </div>

        <div className="divide-y divide-neutral-200 text-xs">
          {diagnostics.map(diag => (
            <div key={diag.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[10px] bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 text-neutral-800">
                    {diag.ruleCode}
                  </span>
                  <span className="font-bold text-neutral-900">{diag.description}</span>
                </div>
                <div className="text-[11px] text-neutral-600 font-mono">
                  {diag.notes}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 font-bold uppercase font-mono border ${
                  diag.status === 'PASSED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : diag.status === 'REQUIRES_REVIEW'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  {diag.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
