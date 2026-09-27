import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCheck,
  FileText,
  UploadCloud,
  Download,
  ShieldCheck,
  Lock,
  ChevronRight,
  Eye,
  Sparkles,
  Search,
  Filter,
  Info
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientReconciliationSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
  onNavigateToVault?: () => void;
}

export const ClientReconciliationSection: React.FC<ClientReconciliationSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant,
  onNavigateToVault
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState('rec_01');
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Reconciliation records
  const reconciliationRecords = [
    {
      id: 'rec_01',
      accountName: 'Operating Checking Account (••4912)',
      institution: 'First Citizens Bank',
      accountType: 'Commercial Checking',
      periodEnding: 'December 31, 2025',
      statementEndingBalance: 184520.44,
      bookBalance: 184520.44,
      reconciledBalance: 184520.44,
      varianceDifference: 0.00,
      status: 'Fully Reconciled & Certified',
      clearedTxnsCount: 84,
      unclearedDepositsCount: 0,
      unclearedChecksCount: 0,
      statementPdfAttached: 'FirstCitizens_Checking_Stmt_2025-12.pdf',
      preparedBy: 'Elena Rostova, CPA',
      preparedDate: 'Jan 08, 2026',
      reviewedBy: 'Desmond Hinds, CEO',
      reviewDate: 'Jan 10, 2026',
      approvedBy: 'Partner Signoff Completed',
      approvalDate: 'Jan 12, 2026'
    },
    {
      id: 'rec_02',
      accountName: 'Corporate Platinum Amex (••3008)',
      institution: 'American Express',
      accountType: 'Credit Card',
      periodEnding: 'December 31, 2025',
      statementEndingBalance: 12480.90,
      bookBalance: 12480.90,
      reconciledBalance: 12480.90,
      varianceDifference: 0.00,
      status: 'Fully Reconciled & Certified',
      clearedTxnsCount: 42,
      unclearedDepositsCount: 0,
      unclearedChecksCount: 0,
      statementPdfAttached: 'Amex_Corporate_Stmt_2025-12.pdf',
      preparedBy: 'Elena Rostova, CPA',
      preparedDate: 'Jan 08, 2026',
      reviewedBy: 'Desmond Hinds, CEO',
      reviewDate: 'Jan 10, 2026',
      approvedBy: 'Partner Signoff Completed',
      approvalDate: 'Jan 12, 2026'
    },
    {
      id: 'rec_03',
      accountName: 'First Citizens Commercial Note (LN-004819)',
      institution: 'First Citizens Bank',
      accountType: 'Commercial Note Payable',
      periodEnding: 'December 31, 2025',
      statementEndingBalance: 114000.00,
      bookBalance: 114000.00,
      reconciledBalance: 114000.00,
      varianceDifference: 0.00,
      status: 'Fully Reconciled & Certified',
      clearedTxnsCount: 12,
      unclearedDepositsCount: 0,
      unclearedChecksCount: 0,
      statementPdfAttached: 'FirstCitizens_Loan_Stmt_2025-12.pdf',
      preparedBy: 'Elena Rostova, CPA',
      preparedDate: 'Jan 09, 2026',
      reviewedBy: 'Desmond Hinds, CEO',
      reviewDate: 'Jan 10, 2026',
      approvedBy: 'Partner Signoff Completed',
      approvalDate: 'Jan 12, 2026'
    },
    {
      id: 'rec_04',
      accountName: 'Operating Checking Account (••4912)',
      institution: 'First Citizens Bank',
      accountType: 'Commercial Checking',
      periodEnding: 'January 31, 2026',
      statementEndingBalance: 198420.10,
      bookBalance: 198420.10,
      reconciledBalance: 198420.10,
      varianceDifference: 0.00,
      status: 'Preliminary Review (Open Period)',
      clearedTxnsCount: 68,
      unclearedDepositsCount: 1,
      unclearedChecksCount: 2,
      statementPdfAttached: 'Pending Official Month-End PDF',
      preparedBy: 'Elena Rostova, CPA',
      preparedDate: 'Feb 05, 2026',
      reviewedBy: 'Pending Senior Review',
      reviewDate: 'In Progress',
      approvedBy: 'Pending Final Close',
      approvalDate: 'Pending'
    }
  ];

  const activeRec = reconciliationRecords.find(r => r.id === selectedAccountId) || reconciliationRecords[0];

  const handleUploadMissingStatement = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadNotice(`Statement "${file.name}" uploaded and routed to CPA Elena Rostova.`);
      demoDataStore.logAudit({
        user: 'Michael Perotti',
        role: 'client',
        action: 'Uploaded Monthly Bank Statement PDF',
        record: `${activeRec.accountName} - ${file.name}`,
        result: 'Success (Simulated)',
        reason: 'Client supplied official institution PDF for reconciliation tie-out'
      });
      setTimeout(() => setUploadNotice(null), 5000);
    }
  };

  return (
    <div className="space-y-6" id="client-reconciliation-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Reconciliation Center
              </span>
              <span className="text-xs text-[#667085]">Bank, Credit &amp; Debt Tie-Out Center</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Bank &amp; Financial Account Reconciliations
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Certified three-way matching between bank statements, general ledger balances, and tax return workpapers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="px-3.5 py-2 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer">
              <UploadCloud className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Upload Bank Statement</span>
              <input type="file" accept=".pdf" onChange={handleUploadMissingStatement} className="hidden" />
            </label>
          </div>
        </div>

        {/* Upload Notice */}
        {uploadNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{uploadNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Routed to CPA review queue</span>
          </div>
        )}

        {/* Account Selector Strip */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto">
          {reconciliationRecords.map(rec => (
            <button
              key={rec.id}
              onClick={() => setSelectedAccountId(rec.id)}
              className={`p-3 rounded-lg border text-left transition-colors cursor-pointer whitespace-nowrap min-w-[220px] ${
                selectedAccountId === rec.id
                  ? 'bg-[#061A2F] text-white border-[#061A2F]'
                  : 'bg-[#FBFAF7] text-[#061A2F] border-[#D8DCE2] hover:border-[#061A2F]'
              }`}
            >
              <div className="text-[10px] font-mono uppercase opacity-75">{rec.periodEnding}</div>
              <div className="font-bold text-xs truncate mt-0.5">{rec.accountName}</div>
              <div className="text-[11px] font-mono mt-1 flex items-center justify-between">
                <span>${rec.statementEndingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <span className={`text-[10px] font-bold ${
                  selectedAccountId === rec.id ? 'text-[#E8C66A]' : 'text-[#1B5E20]'
                }`}>
                  Diff: $0.00
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ACTIVE RECONCILIATION DETAILS CARD */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-6 shadow-xs">
        <div className="border-b border-[#D8DCE2] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#061A2F]">{activeRec.accountName}</h3>
              <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-bold">
                {activeRec.status}
              </span>
            </div>
            <div className="text-xs text-[#667085] mt-0.5">
              Institution: <strong className="text-[#061A2F]">{activeRec.institution}</strong> &bull; Period Ended: <strong className="text-[#061A2F]">{activeRec.periodEnding}</strong>
            </div>
          </div>

          <button
            onClick={() => alert(`Simulated download of ${activeRec.statementPdfAttached}`)}
            className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F] flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-[#C99A32]" />
            <span>View Statement PDF</span>
          </button>
        </div>

        {/* 3-Way Tie-Out Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded-lg">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Official Statement Ending Balance</span>
            <div className="text-lg font-bold font-mono text-[#061A2F] mt-1">
              ${activeRec.statementEndingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-[#667085] mt-1">Verified via {activeRec.statementPdfAttached}</div>
          </div>

          <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded-lg">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">General Ledger Book Balance</span>
            <div className="text-lg font-bold font-mono text-[#061A2F] mt-1">
              ${activeRec.bookBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-[#667085] mt-1">General Ledger Code 1010</div>
          </div>

          <div className="p-4 bg-[#FAF9F5] border border-[#C99A32] rounded-lg">
            <span className="text-[10px] font-mono uppercase text-[#061A2F] font-bold block">Unreconciled Variance</span>
            <div className="text-lg font-bold font-mono text-[#1B5E20] mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5" />
              $0.00 (Zero Variance)
            </div>
            <div className="text-[10px] text-[#061A2F] mt-1 font-medium">Equilibrium certified by CPA</div>
          </div>
        </div>

        {/* 3-Level Accounting Signoff Audit Trail */}
        <div className="border border-[#D8DCE2] rounded-lg p-4 bg-[#FBFAF7] space-y-3">
          <div className="text-xs font-bold text-[#061A2F] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1B5E20]" />
            <span>Three-Tier Maker-Checker Professional Signoff History</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white border border-[#E5E7EB] rounded space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#667085]">1. Prepared By (Staff / Senior)</div>
              <div className="font-bold text-[#061A2F]">{activeRec.preparedBy}</div>
              <div className="text-[11px] text-[#1B5E20] font-mono font-medium">Completed on {activeRec.preparedDate}</div>
            </div>

            <div className="p-3 bg-white border border-[#E5E7EB] rounded space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#667085]">2. Technical Review</div>
              <div className="font-bold text-[#061A2F]">{activeRec.reviewedBy}</div>
              <div className="text-[11px] text-[#1B5E20] font-mono font-medium">Reviewed on {activeRec.reviewDate}</div>
            </div>

            <div className="p-3 bg-white border border-[#E5E7EB] rounded space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#667085]">3. Partner Final Approval</div>
              <div className="font-bold text-[#061A2F]">{activeRec.approvedBy}</div>
              <div className="text-[11px] text-[#1B5E20] font-mono font-medium">Certified on {activeRec.approvalDate}</div>
            </div>
          </div>
        </div>

        {/* Client Rights Policy Notice */}
        <div className="border border-[#D8DCE2] bg-[#FAF9F5] p-3.5 rounded text-xs text-[#667085] flex items-start gap-2">
          <Info className="w-4 h-4 text-[#C99A32] flex-shrink-0 mt-0.5" />
          <div>
            <strong>Client Governance Policy:</strong> Clients may review verified reconciliation schedules, download monthly statement copies, and upload missing source PDFs. In accordance with professional accounting rules, clients cannot sign off on or override reconciliation differences.
          </div>
        </div>
      </div>
    </div>
  );
};
