/**
 * A/R Tax Services, LLC - Stage 02 Collection Report View
 * Section 44: Comprehensive Accountant Collection Report
 *
 * Displays:
 * - Client Demographics & Tax Engagement details
 * - Collection Summary with live percentage metrics
 * - Categorized Breakdown: Income, Property, Business, Deductions/Credits, Payments, State
 * - Outstanding Requirements with priority, reasons, and request status
 * - Unresolved Collection Exceptions
 * - Stage 02 Readiness & Exit Gate Status
 */

import React, { useMemo } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  ShieldCheck,
  Building2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import {
  StageTwoOrchestratorService,
  StageTwoCollectionSummaryReport
} from '../../services/stageTwoOrchestratorService';

interface StageTwoCollectionReportViewProps {
  clientId: string;
  taxYear: number;
  onRefresh?: () => void;
}

export const StageTwoCollectionReportView: React.FC<StageTwoCollectionReportViewProps> = ({
  clientId,
  taxYear,
  onRefresh
}) => {
  const report: StageTwoCollectionSummaryReport = useMemo(() => {
    return StageTwoOrchestratorService.generateCollectionReport(clientId, taxYear);
  }, [clientId, taxYear]);

  return (
    <div className="space-y-6 text-[#F8FAFC]">
      {/* Header and Print action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#0D2745] border border-slate-700/60 rounded-xl shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40">
              AUDIT RECORD &bull; STAGE 02
            </span>
            <span className="text-xs text-[#A9B7C8] font-mono">
              Generated: {new Date(report.generatedAt).toLocaleString()}
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#D4A843]" />
            <span>Accountant Stage 02 Collection Report</span>
          </h2>
          <p className="text-xs text-[#A9B7C8] mt-0.5">
            Full compliance summary of client tax evidence intake, matching, and exit gate readiness.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-md"
        >
          <Printer className="w-4 h-4 text-[#06182B]" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* 1. Client Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[#0D2745] border border-slate-700/60 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-[#A9B7C8]">Client Name</div>
          <div className="text-base font-bold text-white mt-1">{report.clientName}</div>
          <div className="text-xs font-mono text-[#D4A843] mt-0.5">ID: {report.clientId}</div>
        </div>

        <div className="p-4 bg-[#0D2745] border border-slate-700/60 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-[#A9B7C8]">Tax Year & Return</div>
          <div className="text-base font-bold text-white mt-1">TY {report.taxYear} &bull; {report.returnType}</div>
          <div className="text-xs text-[#A9B7C8] mt-0.5">Filing Status: {report.filingStatus}</div>
        </div>

        <div className="p-4 bg-[#0D2745] border border-slate-700/60 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-[#A9B7C8]">Engagement ID</div>
          <div className="text-base font-bold font-mono text-white mt-1">{report.engagementId}</div>
          <div className="text-xs text-[#A9B7C8] mt-0.5">Jurisdictions: {report.jurisdictions.join(', ')}</div>
        </div>

        <div className="p-4 bg-[#0D2745] border border-slate-700/60 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-[#A9B7C8]">Stage 02 Gate Readiness</div>
          <div className="flex items-center gap-2 mt-1">
            {report.isReadyForExitGate ? (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>READY FOR EXIT GATE</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>IN PROGRESS ({report.missingCount} Missing)</span>
              </span>
            )}
          </div>
          <div className="text-xs font-mono text-[#D4A843] font-bold mt-1.5">
            Progress: {report.collectionProgressPercent}%
          </div>
        </div>
      </div>

      {/* 2. Top Collection Summary Metrics (Section 39) */}
      <div className="p-5 bg-[#0D2745] border border-slate-700/60 rounded-xl space-y-4">
        <h3 className="text-xs font-mono uppercase font-bold text-[#D4A843] tracking-wider">
          Top Collection Summary (Section 39)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
          <div className="p-3 bg-[#06182B] border border-slate-700/80 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-[#A9B7C8]">Required</div>
            <div className="text-lg font-bold text-white mt-0.5">{report.totalRequired}</div>
          </div>
          <div className="p-3 bg-[#06182B] border border-slate-700/80 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-emerald-400">Received</div>
            <div className="text-lg font-bold text-emerald-300 mt-0.5">{report.receivedCount}</div>
          </div>
          <div className="p-3 bg-[#06182B] border border-slate-700/80 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-blue-400">Accepted</div>
            <div className="text-lg font-bold text-blue-300 mt-0.5">{report.collectionAcceptedCount}</div>
          </div>
          <div className="p-3 bg-[#06182B] border border-slate-700/80 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-amber-400">Missing</div>
            <div className="text-lg font-bold text-amber-300 mt-0.5">{report.missingCount}</div>
          </div>
          <div className="p-3 bg-[#06182B] border border-slate-700/80 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-cyan-400">Processing</div>
            <div className="text-lg font-bold text-cyan-300 mt-0.5">{report.processingCount}</div>
          </div>
          <div className="p-3 bg-[#06182B] border border-slate-700/80 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-purple-400">Needs Review</div>
            <div className="text-lg font-bold text-purple-300 mt-0.5">{report.needsReviewCount}</div>
          </div>
          <div className="p-3 bg-[#06182B] border border-slate-700/80 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-rose-400">Rejected</div>
            <div className="text-lg font-bold text-rose-300 mt-0.5">{report.rejectedCount}</div>
          </div>
        </div>
      </div>

      {/* 3. Categorized Evidence Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income */}
        <div className="p-4 bg-[#0D2745] border border-slate-700/60 rounded-xl space-y-2">
          <div className="text-xs font-mono font-bold text-[#D4A843] uppercase flex items-center justify-between">
            <span>Income Evidence</span>
            <span>{Object.values(report.incomeSummary).reduce((a, b) => a + b, 0)} Items</span>
          </div>
          <ul className="text-xs space-y-1.5 text-[#A9B7C8]">
            <li className="flex justify-between"><span>Employment (W-2):</span> <strong className="text-white">{report.incomeSummary.employmentCount}</strong></li>
            <li className="flex justify-between"><span>Interest (1099-INT):</span> <strong className="text-white">{report.incomeSummary.interestCount}</strong></li>
            <li className="flex justify-between"><span>Dividends (1099-DIV):</span> <strong className="text-white">{report.incomeSummary.dividendsCount}</strong></li>
            <li className="flex justify-between"><span>Brokerage (1099-B):</span> <strong className="text-white">{report.incomeSummary.brokerageCount}</strong></li>
            <li className="flex justify-between"><span>Business / 1099-NEC:</span> <strong className="text-white">{report.incomeSummary.businessCount}</strong></li>
          </ul>
        </div>

        {/* State Jurisdictions */}
        <div className="p-4 bg-[#0D2745] border border-slate-700/60 rounded-xl space-y-2">
          <div className="text-xs font-mono font-bold text-[#D4A843] uppercase">State Jurisdictions</div>
          <div className="text-xs text-[#A9B7C8]">Primary Residency: <strong className="text-white">{report.jurisdictions[0] || 'SC'}</strong></div>
          <div className="text-xs text-[#A9B7C8] mt-1">
            Applicable States:
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {report.jurisdictions.map(st => (
                <span key={st} className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#06182B] text-slate-200 border border-slate-700">
                  {st}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Operational Status */}
        <div className="p-4 bg-[#0D2745] border border-slate-700/60 rounded-xl space-y-2">
          <div className="text-xs font-mono font-bold text-[#D4A843] uppercase">Operational Status</div>
          <ul className="text-xs space-y-1.5 text-[#A9B7C8]">
            <li className="flex justify-between"><span>Collection Progress:</span> <strong className="text-[#D4A843]">{report.collectionProgressPercent}%</strong></li>
            <li className="flex justify-between"><span>Processing Progress:</span> <strong className="text-white">{report.processingProgressPercent}%</strong></li>
            <li className="flex justify-between"><span>Collection Review:</span> <strong className="text-white">{report.collectionReviewPercent}%</strong></li>
            <li className="flex justify-between"><span>Waived Items:</span> <strong className="text-white">{report.waivedCount}</strong></li>
            <li className="flex justify-between"><span>Not Applicable:</span> <strong className="text-white">{report.notApplicableCount}</strong></li>
          </ul>
        </div>
      </div>

      {/* 4. Outstanding Requirements */}
      <div className="p-5 bg-[#0D2745] border border-slate-700/60 rounded-xl space-y-3">
        <h3 className="text-xs font-mono uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>Outstanding Requirements ({report.outstandingRequirements.length})</span>
        </h3>
        {report.outstandingRequirements.length === 0 ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>All mandatory active requirements have been satisfied for Tax Year {report.taxYear}.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {report.outstandingRequirements.map(req => (
              <div key={req.requirementId} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-white">{req.title}</div>
                  <div className="text-[11px] text-[#A9B7C8]">{req.reason}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/40 font-bold">
                    {req.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                    Request: {req.requestStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Exceptions */}
      {report.exceptions.length > 0 && (
        <div className="p-5 bg-[#0D2745] border border-slate-700/60 rounded-xl space-y-3">
          <h3 className="text-xs font-mono uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Stage 02 Collection Exceptions ({report.exceptions.length})</span>
          </h3>
          <div className="space-y-2">
            {report.exceptions.map(ex => (
              <div key={ex.id} className="p-3 bg-[#06182B] border border-slate-700/80 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white">{ex.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    ex.severity === 'CRITICAL' || ex.severity === 'BLOCKING' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  }`}>
                    {ex.category} &bull; {ex.severity}
                  </span>
                </div>
                <p className="text-[11px] text-[#A9B7C8]">{ex.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
