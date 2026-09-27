/**
 * A/R Tax Services, LLC - Client Engagement Details & Scope of Work
 * Compliance with Sections 4 & 24: Active engagement letters, statutory Circular 230 notices,
 * retainers, and multi-state compliance milestones.
 */

import React from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Download,
  Calendar,
  DollarSign,
  Briefcase,
  AlertCircle
} from 'lucide-react';

export const ClientEngagementDetailsSection: React.FC = () => {
  const [downloadNotice, setDownloadNotice] = React.useState<string | null>(null);

  const handleDownloadAgreement = () => {
    const content = `A/R TAX SERVICES, LLC — MASTER TAX ENGAGEMENT AGREEMENT
Client: Desmond Hinds / Perotti Holdings & Advisory LLC
Lead Practitioner: Desmond Hinds, CPA (PTIN: P01928472)
Firm: A/R Tax Services, LLC
Date Executed: December 12, 2025
Scope of Services: Preparation and electronic filing of Form 1040, Form 1120-S, multi-state withholding, and quarterly safe-harbor tax calculations.
Standard of Practice: Treasury Department Circular No. 230 and AICPA Statements on Standards for Tax Services.
Status: EXECUTED & COUNTERSIGNED`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Signed_Engagement_Agreement_AR_Tax_Services_CY2025.txt`;
    a.click();
    setDownloadNotice('Signed Engagement Agreement downloaded successfully.');
    setTimeout(() => setDownloadNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#0A2544]" />
              <h2 className="text-xl font-bold text-neutral-900">Active Engagement Contract & Scope</h2>
            </div>
            <p className="text-sm text-neutral-600 mt-1">
              Statutory terms of engagement between taxpayer Desmond Hinds and A/R Tax Services, LLC.
            </p>
          </div>

          <button
            onClick={handleDownloadAgreement}
            className="px-4 py-2 bg-[#061A2F] text-white hover:bg-[#0A2544] text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#D7AC4A]" />
            <span>Download Signed Agreement</span>
          </button>
        </div>
      </div>

      {downloadNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-medium flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Engagement Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-1">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Engagement Status</span>
          <div className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Executed & Active (CY2025–2026)</span>
          </div>
          <p className="text-neutral-500 text-[11px] pt-1">Signed via DocuSign on Dec 12, 2025</p>
        </div>

        <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-1">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Lead Tax Practitioner</span>
          <div className="text-sm font-bold text-neutral-900">
            Desmond Hinds, CPA
          </div>
          <p className="text-neutral-500 text-[11px] pt-1">Managing Director / Signing Preparer (PTIN Active)</p>
        </div>

        <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-1">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Retainer & Fee Structure</span>
          <div className="text-sm font-bold text-neutral-900 font-mono">
            Fixed Comprehensive ($4,850.00)
          </div>
          <p className="text-emerald-700 font-semibold text-[11px] pt-1">Retainer Paid in Full ($2,500.00)</p>
        </div>
      </div>

      {/* Scope of Covered Services */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-neutral-900">Included Scope of Statutory Tax Services</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 border border-neutral-200 rounded-lg bg-neutral-50 space-y-1">
            <div className="font-bold text-neutral-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0A2544]" />
              <span>Federal Individual Return (Form 1040 + Schedules A, B, C, D, E, SE)</span>
            </div>
            <p className="text-neutral-600 pl-5">
              Comprehensive individual income reporting including multi-source 1099 independent consulting and Schedule E rental real estate.
            </p>
          </div>

          <div className="p-3 border border-neutral-200 rounded-lg bg-neutral-50 space-y-1">
            <div className="font-bold text-neutral-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0A2544]" />
              <span>Multi-State Resident & Non-Resident Filings (MD Form 502 & DC Form D-40)</span>
            </div>
            <p className="text-neutral-600 pl-5">
              State income tax allocation, reciprocity credits, and local county tax withholding computations.
            </p>
          </div>

          <div className="p-3 border border-neutral-200 rounded-lg bg-neutral-50 space-y-1">
            <div className="font-bold text-neutral-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0A2544]" />
              <span>Pass-Through Schedule K-1 Cross-Tie & Section 199A QBI Analysis</span>
            </div>
            <p className="text-neutral-600 pl-5">
              Passive activity loss limitation computations (Form 8582) and qualified business income deductions.
            </p>
          </div>

          <div className="p-3 border border-neutral-200 rounded-lg bg-neutral-50 space-y-1">
            <div className="font-bold text-neutral-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0A2544]" />
              <span>Quarterly Estimated Tax Projections & Safe Harbor Planning (CY2026)</span>
            </div>
            <p className="text-neutral-600 pl-5">
              Voucher generation under 110% prior-year safe harbor rules to avoid underpayment penalties.
            </p>
          </div>
        </div>
      </div>

      {/* Treasury Circular 230 Disclosure */}
      <div className="p-4 bg-neutral-100 border border-neutral-300 rounded-lg text-xs text-neutral-600 space-y-1">
        <div className="font-bold text-neutral-900 font-mono text-[11px] uppercase">
          Treasury Department Circular 230 Disclosure:
        </div>
        <p className="leading-relaxed text-[11px]">
          To ensure compliance with requirements imposed by the IRS, any U.S. federal tax advice contained in this demonstration portal or associated workpapers is not intended or written to be used, and cannot be used, for the purpose of (i) avoiding penalties under the Internal Revenue Code or (ii) promoting, marketing, or recommending to another party any transaction or tax-related matter.
        </p>
      </div>
    </div>
  );
};
