/**
 * TaxGuard AI – Operations Dashboard Console
 * High-density executive & practitioner view.
 */

import React, { useState } from 'react';
import { 
  Users, 
  FileSpreadsheet, 
  UploadCloud, 
  AlertTriangle, 
  ListChecks, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  ShieldAlert, 
  ArrowUpRight,
  Filter,
  Search,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';
import { TaxGuardSubRoute } from '../components/TaxGuardNav';

interface TaxGuardDashboardViewProps {
  userRole: string;
  onNavigateSubRoute: (route: TaxGuardSubRoute) => void;
}

export const TaxGuardDashboardView: React.FC<TaxGuardDashboardViewProps> = ({
  userRole,
  onNavigateSubRoute
}) => {
  const [activeTaxYear, setActiveTaxYear] = useState<number>(2024);
  const cases = TaxGuardStorageService.getCases(userRole, userRole === 'client' ? 'client_henze_001' : undefined);
  const documents = TaxGuardStorageService.getDocuments(userRole, userRole === 'client' ? 'client_henze_001' : undefined);
  const discrepancies = TaxGuardStorageService.getDiscrepancies(userRole, userRole === 'client' ? 'client_henze_001' : undefined);
  const missingItems = TaxGuardStorageService.getMissingItems(userRole, userRole === 'client' ? 'client_henze_001' : undefined);
  const workpapers = TaxGuardStorageService.getWorkpapers(userRole, userRole === 'client' ? 'client_henze_001' : undefined);

  const pendingClassDocs = documents.filter(d => d.reviewStatus === 'pending_classification');
  const openDiscrepancies = discrepancies.filter(d => d.status === 'open');
  const pendingMissingItems = missingItems.filter(m => m.status === 'pending_client');

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <TaxGuardDisclaimer />

      {/* Top Stat Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-[#D8DCE2] p-3 rounded-xs shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active Engagements</div>
          <div className="text-xl font-bold text-[#061A2F] mt-1">{cases.length}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Tax Year {activeTaxYear}</div>
        </div>

        <div className="bg-white border border-[#D8DCE2] p-3 rounded-xs shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Vault Documents</div>
          <div className="text-xl font-bold text-[#061A2F] mt-1">{documents.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">SHA-256 Indexed</div>
        </div>

        <div className="bg-white border border-[#D8DCE2] p-3 rounded-xs shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Extraction Queue</div>
          <div className="text-xl font-bold text-[#C99A32] mt-1">
            {documents.filter(d => d.reviewStatus === 'in_review').length}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5">Confidence Triage</div>
        </div>

        <div className="bg-white border border-[#D8DCE2] p-3 rounded-xs shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Missing Items</div>
          <div className="text-xl font-bold text-rose-600 mt-1">{pendingMissingItems.length}</div>
          <div className="text-[10px] text-rose-500 mt-0.5">Awaiting Taxpayer</div>
        </div>

        <div className="bg-white border border-[#D8DCE2] p-3 rounded-xs shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Discrepancy Alerts</div>
          <div className="text-xl font-bold text-amber-700 mt-1">{openDiscrepancies.length}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Requires QC Review</div>
        </div>

        <div className="bg-white border border-[#D8DCE2] p-3 rounded-xs shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Workpapers Draft</div>
          <div className="text-xl font-bold text-[#061A2F] mt-1">{workpapers.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Watermarked Draft</div>
        </div>
      </div>

      {/* Honest Malware Scanning Status Banner */}
      <div className="bg-[#FAF8F5] border border-[#C99A32]/60 p-3 rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <ShieldAlert className="w-4 h-4 text-[#C99A32] flex-shrink-0" />
          <div>
            <strong className="text-[#061A2F]">Security Status:</strong> Malware scanning endpoint is currently <span className="font-semibold text-amber-700">Not Configured</span> in this deployment. All uploaded documents are held in safe quarantine before processing.
          </div>
        </div>
        <button 
          onClick={() => onNavigateSubRoute('integrations')}
          className="text-[11px] font-bold text-[#C99A32] hover:text-[#061A2F] underline inline-flex items-center gap-1"
        >
          Inspect Integration Registry <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Main Grid: Active Cases & Action Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Tax Engagements */}
        <div className="lg:col-span-2 bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide">
                Active Tax Engagements & Return Pipelines
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Maker-checker workflows, statutory due dates, and client completion stages.
              </p>
            </div>
            <button 
              onClick={() => onNavigateSubRoute('intake')}
              className="px-3 py-1 bg-[#061A2F] hover:bg-[#0A2544] text-[#F7F4ED] text-xs font-semibold rounded-xs transition-colors"
            >
              + New Intake
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {cases.map((c) => (
              <div key={c.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#061A2F]">{c.clientName}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 border border-slate-300 font-mono rounded-xs">
                      Form {c.returnType}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">TY {c.taxYear}</span>
                  </div>
                  <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Preparer: <strong className="text-slate-800">{c.assignedPreparer}</strong></span>
                    <span>Reviewer: <strong className="text-slate-800">{c.assignedReviewer}</strong></span>
                    <span>Deadline: <strong className="text-rose-700">{c.filingDeadline}</strong></span>
                  </div>
                  <div className="w-full sm:w-64 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                    <div 
                      className="bg-[#C99A32] h-full rounded-full" 
                      style={{ width: `${c.clientProgressPercent}%` }} 
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onNavigateSubRoute('review')}
                    className="px-2.5 py-1 text-xs border border-[#1A365D] text-[#061A2F] hover:bg-[#F7F4ED] rounded-xs font-medium"
                  >
                    Maker-Checker Gates
                  </button>
                  <button
                    onClick={() => onNavigateSubRoute('workpapers')}
                    className="px-2.5 py-1 text-xs bg-[#0A2544] text-white hover:bg-[#061A2F] rounded-xs font-medium"
                  >
                    Workpapers
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Priority Queue */}
        <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide">
              TaxGuard Action Priorities
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              High-priority alerts requiring practitioner attention.
            </p>
          </div>

          <div className="space-y-3">
            <div 
              onClick={() => onNavigateSubRoute('discrepancies')}
              className="p-3 bg-amber-50/70 border border-amber-200 rounded-xs hover:bg-amber-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>1099 vs. Bank Deposit Discrepancy</span>
              </div>
              <p className="text-[11px] text-amber-800 mt-1 leading-snug">
                $1,450 variance between Apex Commercial 1099-NEC and Q4 operating deposits.
              </p>
            </div>

            <div 
              onClick={() => onNavigateSubRoute('missing-items')}
              className="p-3 bg-rose-50/70 border border-rose-200 rounded-xs hover:bg-rose-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                <ListChecks className="w-3.5 h-3.5 text-rose-700" />
                <span>Form 1098 Mortgage Statement</span>
              </div>
              <p className="text-[11px] text-rose-800 mt-1 leading-snug">
                Required for Daniel Henze Schedule A & SC Property Tax deduction.
              </p>
            </div>

            <div 
              onClick={() => onNavigateSubRoute('extraction')}
              className="p-3 bg-blue-50/70 border border-blue-200 rounded-xs hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <Cpu className="w-3.5 h-3.5 text-blue-700" />
                <span>Low-Confidence Field Review (Box 17 SC)</span>
              </div>
              <p className="text-[11px] text-blue-800 mt-1 leading-snug">
                Confidence 0.81 on SC state tax withholding requires manual staff sign-off.
              </p>
            </div>

            <div 
              onClick={() => onNavigateSubRoute('reports')}
              className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xs hover:bg-emerald-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cryptographic SHA-256 Seal Active</span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-1 leading-snug">
                Public verification record AR-TAX-2024-VRF-88219 minted.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
