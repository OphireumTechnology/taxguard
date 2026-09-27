/**
 * A/R Tax Services, LLC - Missing Documents & Accountant Issues Workspace
 * Compliance with Section 21: Missing items flagged as “Potential issue for accountant review.”
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  UploadCloud,
  HelpCircle,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  Info,
  ShieldAlert
} from 'lucide-react';

interface MissingDocumentsSectionProps {
  selectedYear: number;
  onNavigateToUpload: () => void;
  onOpenAssistant: () => void;
}

export interface MissingDocumentItem {
  id: string;
  title: string;
  sourcePayer: string;
  formType: string;
  taxYear: number;
  reasonDetected: string;
  impactScore: number;
  dueDate: string;
  isPotentialIssue: boolean;
}

const INITIAL_MISSING_ITEMS: MissingDocumentItem[] = [
  {
    id: 'miss-1',
    title: 'Form 1099-DIV (Vanguard Institutional Brokerage)',
    sourcePayer: 'Vanguard Group Inc.',
    formType: 'Form 1099-DIV',
    taxYear: 2025,
    reasonDetected: 'Prior-year Form 1040 reported $4,812 in qualified dividends from this custodian.',
    impactScore: 15,
    dueDate: '2026-03-31',
    isPotentialIssue: true
  },
  {
    id: 'miss-2',
    title: 'Schedule K-1 Pass-Through (Pinnacle Real Estate LP)',
    sourcePayer: 'Pinnacle Real Estate Fund LP',
    formType: 'Form 1065 Schedule K-1',
    taxYear: 2025,
    reasonDetected: 'Engagement questionnaire confirmed active partnership interest throughout CY2025.',
    impactScore: 25,
    dueDate: '2026-04-01',
    isPotentialIssue: true
  },
  {
    id: 'miss-3',
    title: 'FinCEN Form 114 Foreign Account Statement',
    sourcePayer: 'Credit Suisse / UBS Zurich',
    formType: 'Foreign Bank Statement (FBAR)',
    taxYear: 2025,
    reasonDetected: 'Questionnaire Section 17 indicated foreign aggregate balances exceeded $10,000 threshold.',
    impactScore: 20,
    dueDate: '2026-04-15',
    isPotentialIssue: true
  }
];

export const MissingDocumentsSection: React.FC<MissingDocumentsSectionProps> = ({
  selectedYear,
  onNavigateToUpload,
  onOpenAssistant
}) => {
  const [missingItems, setMissingItems] = useState<MissingDocumentItem[]>(INITIAL_MISSING_ITEMS);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const activeYearMissing = missingItems.filter(i => i.taxYear === selectedYear);

  const handleResolve = (id: string, reason: string) => {
    setMissingItems(prev => prev.filter(i => i.id !== id));
    setActionNotice(`Resolution recorded: ${reason}. Potential issue updated for accountant review.`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <h2 className="text-xl font-bold text-neutral-900">Missing Documents & Review Flags (CY{selectedYear})</h2>
            </div>
            <p className="text-sm text-neutral-600 mt-1">
              Automated reconciliation against prior-year returns, client questionnaires, and 1099 matching cycles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToUpload}
              className="px-4 py-2 bg-[#061A2F] text-white hover:bg-[#0A2544] text-xs font-semibold rounded flex items-center gap-2 transition-colors shadow-xs"
            >
              <UploadCloud className="w-4 h-4 text-[#D7AC4A]" />
              <span>Upload Replacement</span>
            </button>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-xs font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Mandatory Notice Card */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-xs font-bold text-amber-900">
            Potential issue for accountant review.
          </div>
          <div className="text-xs text-amber-800 leading-relaxed">
            All missing documents listed below are actively flagged on your practitioner's preparation board. The AI system does not independently waive or dismiss statutory tax return requirements.
          </div>
        </div>
      </div>

      {/* Missing Items List or Zero State */}
      {activeYearMissing.length === 0 ? (
        <div className="p-8 bg-white border border-neutral-300 rounded-lg text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-sm font-bold text-neutral-900">
            {selectedYear === 2026
              ? 'CY2026 Planning Phase — No Missing Statutory Documents'
              : `Zero Missing Documents for Tax Year ${selectedYear}`}
          </h3>
          <p className="text-xs text-neutral-600 max-w-md mx-auto">
            {selectedYear === 2026
              ? 'Official Form W-2 and 1099 statements will be generated by issuers in January 2027. Review planning worksheets and quarterly estimated safe harbor vouchers.'
              : `All required tax slips, schedules, and authorizations for CY${selectedYear} were received, certified by your lead CPA, and archived.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeYearMissing.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white border border-amber-300 rounded-lg shadow-xs space-y-3"
            >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-bold font-mono bg-neutral-100 text-neutral-800 border border-neutral-300 rounded">
                    {item.formType}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200 rounded">
                    Potential issue for accountant review
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">Due {item.dueDate}</span>
                </div>

                <h3 className="text-sm font-bold text-neutral-900 mt-1">{item.title}</h3>
                <p className="text-xs text-neutral-600">
                  <strong className="text-neutral-800">Detection Trigger:</strong> {item.reasonDetected}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <button
                  onClick={onNavigateToUpload}
                  className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-semibold rounded hover:bg-[#0A2544] flex items-center gap-1.5 shadow-2xs"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-[#D7AC4A]" />
                  <span>Upload Now</span>
                </button>
                <button
                  onClick={() => handleResolve(item.id, 'Marked as Not Applicable / Closed in 2025')}
                  className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded"
                >
                  Does Not Apply in 2025
                </button>
                <button
                  onClick={onOpenAssistant}
                  className="p-1.5 text-neutral-500 hover:text-neutral-800 rounded"
                  title="Ask Tax Advisor"
                >
                  <Sparkles className="w-4 h-4 text-[#D7AC4A]" />
                </button>
              </div>
            </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
