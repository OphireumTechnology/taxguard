/**
 * A/R Tax Services, LLC - Accountant Command Dashboard
 * Section 6 & 59: Tax Preparation Center, Key Metrics, Workpaper Status, Prior-Year Changes, and Quick Actions.
 */

import React from 'react';
import { 
  FileSpreadsheet, 
  FolderOpen, 
  AlertOctagon, 
  FileQuestion, 
  GitCompare, 
  ShieldCheck, 
  CheckCircle2, 
  Calendar, 
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Globe2,
  FileText,
  UserCheck,
  Building2,
  Home,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';

interface AccountantCommandDashboardProps {
  onNavigate: (tabId: string) => void;
  onOpenAiAssistant: () => void;
  isDark: boolean;
}

export const AccountantCommandDashboard: React.FC<AccountantCommandDashboardProps> = ({
  onNavigate,
  onOpenAiAssistant,
  isDark
}) => {
  const client = accountantCenterService.getSelectedClient();
  const taxYear = accountantCenterService.getSelectedTaxYear();
  const metrics = accountantCenterService.getDashboardMetrics();
  const { gates, canApproveForFiling, blockingReasons } = accountantCenterService.evaluateHardStopGates();
  const exceptions = accountantCenterService.getExceptions();
  const finalApproval = accountantCenterService.getFinalApprovalState();

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';
  const metricBoxBg = isDark ? 'bg-neutral-800/60 border-neutral-700' : 'bg-neutral-50 border-neutral-200';

  return (
    <div className="space-y-6">
      {/* Foreign Information Mandatory Alert (Section 29) */}
      {client.hasForeignInfo && (
        <div className="p-4 border-2 border-red-500 bg-red-50 text-red-950 rounded-lg flex items-start gap-3 shadow-sm">
          <Globe2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-sm font-bold uppercase tracking-wider text-red-900 flex items-center gap-2">
              <span>FOREIGN INFORMATION — ACCOUNTANT REVIEW REQUIRED</span>
              <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-mono rounded">HARD-STOP ACTIVE</span>
            </div>
            <p className="text-xs text-red-800 leading-relaxed">
              Foreign financial accounts (Zürcher Kantonalbank balance &gt;$10,000) have been identified from source documents. Mandatory FinCEN Form 114 (FBAR) and IRS Form 8938 reporting determinations must be explicitly made by an authorized accountant before filing approval.
            </p>
          </div>
        </div>
      )}

      {/* Top Banner: Client Header & Key Workflow Status */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded font-bold">
              Accountant Tax Preparation Center
            </span>
            <span className="text-[10px] font-mono uppercase bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 px-2 py-0.5 rounded font-bold">
              {client.category}
            </span>
          </div>
          <h2 className={`text-xl font-bold uppercase tracking-tight ${textPrimary} flex items-center gap-3`}>
            <span>{client.name}</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded border border-neutral-400 dark:border-neutral-700">
              TY{taxYear}
            </span>
          </h2>
          <p className={`text-xs ${textSecondary}`}>
            {client.entityType} • SSN/EIN: <span className="font-mono">{client.ssnEinMasked}</span> • Filing Status: <strong>{client.filingStatus}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="text-right mr-2 hidden sm:block">
            <div className="text-[10px] font-mono uppercase text-neutral-500">Current Workflow State</div>
            <div className={`text-xs font-bold font-mono px-2.5 py-1 rounded border ${
              finalApproval.isApproved 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-300' 
                : 'bg-amber-50 text-amber-900 border-amber-400 dark:bg-amber-950/50 dark:text-amber-300'
            }`}>
              {client.workflowStatus}
            </div>
          </div>

          <button
            onClick={() => onNavigate('pre_filing_review')}
            className="px-3.5 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold uppercase rounded hover:opacity-90 flex items-center gap-1.5 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Pre-Filing QC</span>
          </button>

          <button
            onClick={onOpenAiAssistant}
            className="px-3.5 py-2 border border-neutral-400 dark:border-neutral-600 text-xs font-bold uppercase rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Tax Assistant</span>
          </button>
        </div>
      </div>

      {/* KEY METRICS GRID (Section 6) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${textSecondary}`}>
            Key Practice Metrics (Dynamically Evaluated)
          </h3>
          <span className="text-[10px] font-mono text-neutral-400">
            CY{taxYear} Document &amp; Reconciliation Engine
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div 
            onClick={() => onNavigate('document_center')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${metricBoxBg}`}
          >
            <div className="text-[10px] font-mono uppercase text-neutral-500">Documents Received</div>
            <div className={`text-2xl font-bold font-mono mt-1 ${textPrimary}`}>
              {metrics.documentsReceived}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Target: ~{metrics.documentsExpected} expected</div>
          </div>

          <div 
            onClick={() => onNavigate('missing_docs')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${
              metrics.documentsMissing > 0 
                ? isDark ? 'bg-amber-950/30 border-amber-800' : 'bg-amber-50 border-amber-300' 
                : metricBoxBg
            }`}
          >
            <div className="text-[10px] font-mono uppercase text-amber-700 dark:text-amber-400 font-bold">Documents Missing</div>
            <div className="text-2xl font-bold font-mono text-amber-900 dark:text-amber-300 mt-1">
              {metrics.documentsMissing}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Actionable follow-up required</div>
          </div>

          <div 
            onClick={() => onNavigate('document_center')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${metricBoxBg}`}
          >
            <div className="text-[10px] font-mono uppercase text-neutral-500">Documents Reviewed</div>
            <div className={`text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1`}>
              {metrics.documentsReviewed}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">{metrics.documentsPendingReview} pending review</div>
          </div>

          <div 
            onClick={() => onNavigate('exceptions')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${
              metrics.aiExceptions > 0 
                ? isDark ? 'bg-red-950/30 border-red-800' : 'bg-red-50 border-red-300' 
                : metricBoxBg
            }`}
          >
            <div className="text-[10px] font-mono uppercase text-red-700 dark:text-red-400 font-bold">AI Exceptions</div>
            <div className="text-2xl font-bold font-mono text-red-900 dark:text-red-300 mt-1">
              {metrics.aiExceptions}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Hard-stop blockers</div>
          </div>

          <div 
            onClick={() => onNavigate('document_center')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${metricBoxBg}`}
          >
            <div className="text-[10px] font-mono uppercase text-neutral-500">Duplicates Detected</div>
            <div className={`text-2xl font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1`}>
              {metrics.duplicates}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Isolated from totals</div>
          </div>

          <div 
            onClick={() => onNavigate('document_center')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${
              metrics.taxYearMismatches > 0 
                ? isDark ? 'bg-amber-950/30 border-amber-800' : 'bg-amber-50 border-amber-300' 
                : metricBoxBg
            }`}
          >
            <div className="text-[10px] font-mono uppercase text-amber-700 dark:text-amber-400 font-bold">Tax-Year Mismatches</div>
            <div className="text-2xl font-bold font-mono text-amber-900 dark:text-amber-300 mt-1">
              {metrics.taxYearMismatches}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Must be reconciled</div>
          </div>

          <div 
            onClick={() => onNavigate('document_center')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${metricBoxBg}`}
          >
            <div className="text-[10px] font-mono uppercase text-neutral-500">Low Confidence (&lt;75%)</div>
            <div className={`text-2xl font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1`}>
              {metrics.lowConfidenceDocuments}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Manual OCR audit</div>
          </div>

          <div 
            onClick={() => onNavigate('document_center')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${metricBoxBg}`}
          >
            <div className="text-[10px] font-mono uppercase text-neutral-500">Documents Pending Review</div>
            <div className={`text-2xl font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1`}>
              {metrics.documentsPendingReview}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Awaiting preparer click</div>
          </div>

          <div 
            onClick={() => onNavigate('missing_docs')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${metricBoxBg}`}
          >
            <div className="text-[10px] font-mono uppercase text-neutral-500">Client Inquiries</div>
            <div className={`text-2xl font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1`}>
              {metrics.clientQuestions}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Messages in portal</div>
          </div>

          <div 
            onClick={() => onNavigate('filing_readiness')}
            className={`p-3.5 border rounded-lg cursor-pointer hover:border-neutral-500 transition-all ${
              canApproveForFiling 
                ? isDark ? 'bg-emerald-950/40 border-emerald-700' : 'bg-emerald-50 border-emerald-400'
                : isDark ? 'bg-red-950/30 border-red-800' : 'bg-red-50 border-red-300'
            }`}
          >
            <div className="text-[10px] font-mono uppercase font-bold text-neutral-700 dark:text-neutral-300">
              Readiness Status
            </div>
            <div className={`text-sm font-bold font-mono mt-1 ${
              canApproveForFiling ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-400'
            }`}>
              {canApproveForFiling ? 'READY FOR APPROVAL' : 'NOT READY — GATED'}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              {blockingReasons.length} blocking gates
            </div>
          </div>
        </div>
      </div>

      {/* WORKPAPER DASHBOARD STATUS MATRIX (Section 60) */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
        <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
              Consolidated Workpaper &amp; Quality Control Matrix
            </h3>
            <p className={`text-xs ${textSecondary}`}>
              Automated consolidation status for active client tax preparation file.
            </p>
          </div>
          <button
            onClick={() => onNavigate('workpapers')}
            className="text-xs font-bold font-mono text-neutral-700 dark:text-neutral-300 hover:underline flex items-center gap-1"
          >
            <span>View All Workpapers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 text-xs font-mono">
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">CLIENT PROFILE</span>
            <span className="text-emerald-600 font-bold">✓ VERIFIED</span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">DOC INVENTORY</span>
            <span className="text-emerald-600 font-bold">✓ {metrics.documentsReceived} DOCS</span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">INCOME SUMMARY</span>
            <span className="text-emerald-600 font-bold">✓ RECONCILED</span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">TAX PAYMENTS</span>
            <span className="text-emerald-600 font-bold">✓ VERIFIED</span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">BUSINESS P&amp;L</span>
            <span className="text-emerald-600 font-bold">✓ SCHEDULE C</span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">RENTAL SCH E</span>
            <span className="text-emerald-600 font-bold">✓ CHARLESTON</span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">INVESTMENTS</span>
            <span className="text-emerald-600 font-bold">✓ 1099-B/DIV</span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">DEDUCTIONS</span>
            <span className="text-emerald-600 font-bold">✓ ITEMIZED</span>
          </div>
          <div className="p-3 border rounded border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 flex items-center justify-between">
            <span className="text-red-700 dark:text-red-400 font-bold">FOREIGN INFO</span>
            <span className="text-red-600 font-bold">🔴 FBAR REQ</span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">PRIOR YEAR</span>
            <span className="text-emerald-600 font-bold">✓ COMPARED</span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">QC REVIEW</span>
            <span className={finalApproval.qcCompleted ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
              {finalApproval.qcCompleted ? "✓ COMPLETE" : "15/17 STAGES"}
            </span>
          </div>
          <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-500">FINAL SIGN-OFF</span>
            <span className={finalApproval.isApproved ? "text-emerald-600 font-bold" : "text-neutral-400 font-bold"}>
              {finalApproval.isApproved ? "✓ APPROVED" : "LOCKED"}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 59: PRIOR-YEAR CHANGES & QUICK ACTION PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Prior-Year Discrepancies & Exceptions */}
        <div className={`lg:col-span-2 p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary} flex items-center gap-2`}>
              <GitCompare className="w-4 h-4 text-neutral-500" />
              <span>Prior-Year Changes &amp; Key Variances Identified</span>
            </h3>
            <button
              onClick={() => onNavigate('prior_year')}
              className="text-xs font-bold font-mono text-neutral-700 dark:text-neutral-300 hover:underline"
            >
              Full Change Report
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100">
                  Apex BioTech Innovations, Inc. (Form W-2)
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-0.5">
                  W-2 compensation increased from $135,000 (TY2024) to $145,000 (TY2025). +$10,000 merit bump verified against executive contract.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-bold">
                RECONCILED
              </span>
            </div>

            <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100">
                  Sterling Strategy Advisors, LLC (Schedule C)
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-0.5">
                  Gross consulting receipts grew +31.6% from $72,000 to $94,800. Reconciled against 12-month commercial bank statements.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-bold">
                RECONCILED
              </span>
            </div>

            <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100">
                  142 Church St, Charleston Rental Property (Schedule E)
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-0.5">
                  Rental revenue rose +5.9% ($34,000 to $36,000). Property management statement verified; MACRS depreciation matches prior return schedule.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-bold">
                RECONCILED
              </span>
            </div>
          </div>
        </div>

        {/* Right Col: Primary Action Shortcuts (Section 59) */}
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-3`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
            Accountant Workflows
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Direct access to core preparation and quality control centers.
          </p>

          <div className="space-y-2 pt-1">
            <button
              onClick={() => onNavigate('exceptions')}
              className="w-full text-left p-2.5 border rounded border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-red-600" />
                <span>Review AI Exceptions</span>
              </div>
              <span className="text-[10px] font-mono bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.5 rounded">
                {metrics.aiExceptions}
              </span>
            </button>

            <button
              onClick={() => onNavigate('document_center')}
              className="w-full text-left p-2.5 border rounded border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                <span>View Consolidated Documents</span>
              </div>
              <span className="text-[10px] font-mono bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                {metrics.documentsReceived}
              </span>
            </button>

            <button
              onClick={() => onNavigate('workpapers')}
              className="w-full text-left p-2.5 border rounded border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>View Tax Workpapers</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            <button
              onClick={() => onNavigate('missing_docs')}
              className="w-full text-left p-2.5 border rounded border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileQuestion className="w-4 h-4 text-amber-600" />
                <span>Request Missing Documents</span>
              </div>
              <span className="text-[10px] font-mono bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded">
                {metrics.documentsMissing}
              </span>
            </button>

            <button
              onClick={() => onNavigate('tax_prep')}
              className="w-full text-left p-2.5 border rounded border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Prepare Return Workspace</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            <button
              onClick={() => onNavigate('pre_filing_review')}
              className="w-full text-left p-2.5 border rounded border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                <span>Pre-Filing Quality Control</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            <button
              onClick={() => onNavigate('filing_readiness')}
              className="w-full text-left p-2.5 border rounded border-neutral-900 dark:border-neutral-100 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Final Approval &amp; Demo Filing</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
