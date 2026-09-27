import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UploadCloud,
  FileText,
  ChevronRight,
  Sparkles,
  Info,
  Lock,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientTaxReadinessSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
  onNavigateToSignatures?: () => void;
}

export const ClientTaxReadinessSection: React.FC<ClientTaxReadinessSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant,
  onNavigateToSignatures
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Readiness Checklist Items
  const [checklistItems, setChecklistItems] = useState([
    {
      id: 'chk_01',
      category: 'Corporate Governance',
      title: 'S-Corporation Reasonable Officer Compensation Study',
      description: 'RCReports benchmark verifying $175,000 W-2 salary meets IRS Rev. Rul. 74-44 standards.',
      statutoryRef: 'IRC § 1366 / Rev. Rul. 74-44',
      status: 'Complete' as 'Complete' | 'Action Required' | 'In Progress' | 'Blocked',
      docRef: 'RCReports_Reasonable_Comp_2025.pdf',
      lastVerified: 'Elena Rostova, CPA'
    },
    {
      id: 'chk_02',
      category: 'Corporate Governance',
      title: 'Form 7203 Shareholder Stock & Debt Basis Calculation',
      description: 'Beginning basis $842,500 updated for 2025 net income and distributions.',
      statutoryRef: 'IRS Form 7203 / IRC § 1367',
      status: 'Complete',
      docRef: 'Form_7203_Workpaper_2025.pdf',
      lastVerified: 'Elena Rostova, CPA'
    },
    {
      id: 'chk_03',
      category: 'Payroll & Withholding',
      title: 'Form 941 & Form W-3 Federal Wage Reconciliation',
      description: 'Four quarterly Form 941 filings tie exactly to General Ledger officer & staff wages.',
      statutoryRef: 'Treas. Reg. § 31.6011(a)-4',
      status: 'Complete',
      docRef: '941_W3_Annual_Tieout.pdf',
      lastVerified: 'Elena Rostova, CPA'
    },
    {
      id: 'chk_04',
      category: 'Deductions & Substantiation',
      title: '50% Meal Limitation & Business Entertainment Classification',
      description: 'Client review of Charlotte meeting receipts to confirm business attendees.',
      statutoryRef: 'IRC § 274(n) / Treas. Reg. § 1.274-5',
      status: 'Action Required',
      docRef: 'Pending Receipt Review',
      lastVerified: 'Client Action Pending'
    },
    {
      id: 'chk_05',
      category: 'Multi-State & Nexus',
      title: 'South Carolina Pass-Through Entity (PTE) Election Notice',
      description: 'SC Act 61 elective tax form to claim state tax credit on federal Form 1120-S.',
      statutoryRef: 'SC Code § 12-6-545(G)',
      status: 'Complete',
      docRef: 'SC_PTE_Election_Affidavit.pdf',
      lastVerified: 'Elena Rostova, CPA'
    },
    {
      id: 'chk_06',
      category: 'Contractors & Information Reporting',
      title: 'Form 1099-NEC Nonemployee Compensation Filing',
      description: 'All payments over $600 reported to IRS and contractors prior to Jan 31 statutory deadline.',
      statutoryRef: 'IRC § 6041A',
      status: 'Complete',
      docRef: '1099NEC_IRS_Receipt_2025.pdf',
      lastVerified: 'A/R Tax Services E-File Team'
    },
    {
      id: 'chk_07',
      category: 'Foreign & Digital Assets',
      title: 'FinCEN Form 114 (FBAR) & Digital Asset Questionnaire',
      description: 'Taxpayer confirmation regarding offshore accounts and virtual currency transactions.',
      statutoryRef: '31 U.S.C. § 5314 / IRS Form 1040 Q1',
      status: 'Complete',
      docRef: 'FBAR_Negative_Declaration.pdf',
      lastVerified: 'Michael Perotti'
    }
  ]);

  const totalItems = checklistItems.length;
  const completedItems = checklistItems.filter(i => i.status === 'Complete').length;
  const readinessPercent = Math.round((completedItems / totalItems) * 100);

  const categories = ['ALL', 'Corporate Governance', 'Payroll & Withholding', 'Deductions & Substantiation', 'Multi-State & Nexus', 'Foreign & Digital Assets'];

  const filteredItems = activeCategory === 'ALL'
    ? checklistItems
    : checklistItems.filter(i => i.category === activeCategory);

  const handleCertifyItem = (id: string, title: string) => {
    setChecklistItems(prev =>
      prev.map(i => i.id === id ? { ...i, status: 'Complete', lastVerified: 'Michael Perotti (Certified)' } : i)
    );
    setActionNotice(`Readiness item "${title}" certified!`);
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Certified Tax Readiness Item',
      record: title,
      result: 'Success (Simulated)',
      reason: 'Taxpayer provided statutory substantiation'
    });
    setTimeout(() => setActionNotice(null), 5000);
  };

  return (
    <div className="space-y-6" id="client-tax-readiness-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Pre-Filing Verification
              </span>
              <span className="text-xs text-[#667085]">Audit-Proof Tax Workpaper Gate</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Tax Readiness &amp; Statutory Compliance Scorecard
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Comprehensive verification of reasonable compensation, basis limitations, 1099 tie-outs, and state PTE elections.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-[#667085]">Readiness Score</div>
              <div className="text-2xl font-bold font-mono text-[#061A2F]">{readinessPercent}%</div>
            </div>
            {onNavigateToSignatures && readinessPercent >= 85 && (
              <button
                onClick={onNavigateToSignatures}
                className="px-3.5 py-2 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Proceed to Form 8879</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#E8C66A]" />
              </button>
            )}
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{actionNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Recorded to audit trail</span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="pt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-[#667085]">
            <span>Compliance Threshold: <strong>{completedItems} of {totalItems} items validated</strong></span>
            <span className="font-mono text-[#1B5E20] font-bold">Safe Harbor Threshold Met</span>
          </div>
          <div className="h-2 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1B5E20] transition-all duration-500 rounded-full"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-[#D8DCE2] bg-white px-4 rounded-t-lg overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeCategory === cat
                ? 'border-[#061A2F] text-[#061A2F]'
                : 'border-transparent text-[#667085] hover:text-[#061A2F]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Checklist Table */}
      <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4 shadow-xs">
        <div className="space-y-3">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="border border-[#D8DCE2] rounded-lg p-4 bg-[#FBFAF7] flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-white border border-[#D8DCE2] font-mono text-[#667085] rounded">
                    {item.category}
                  </span>
                  <span className="font-bold text-sm text-[#061A2F]">{item.title}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    item.status === 'Complete'
                      ? 'bg-[#E8F5E9] text-[#1B5E20] border-[#C8E6C9]'
                      : 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2]'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-[#4B5563]">{item.description}</p>
                <div className="text-[11px] text-[#667085] flex flex-wrap items-center gap-3 pt-0.5">
                  <span>Statutory Ref: <strong className="font-mono text-[#061A2F]">{item.statutoryRef}</strong></span>
                  <span>&bull;</span>
                  <span>Workpaper: <strong className="text-[#061A2F]">{item.docRef}</strong></span>
                  <span>&bull;</span>
                  <span>Verified by: <strong className="text-[#1B5E20]">{item.lastVerified}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {item.status === 'Action Required' ? (
                  <button
                    onClick={() => handleCertifyItem(item.id, item.title)}
                    className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#0A2544] cursor-pointer"
                  >
                    Provide Substantiation
                  </button>
                ) : (
                  <button
                    onClick={() => alert(`Showing certified workpaper for ${item.title}`)}
                    className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F]"
                  >
                    View Workpaper
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
