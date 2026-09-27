import React from 'react';
import { X, CheckCircle, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { WorkCycleStage } from '../../types';

interface LifecycleDetailModalProps {
  isOpen: boolean;
  currentStage: WorkCycleStage;
  onClose: () => void;
}

interface StageDetail {
  number: number;
  stage: WorkCycleStage;
  name: string;
  responsibleRole: string;
  description: string;
  clientAction: string;
  deliverable: string;
}

const ALL_18_STAGES: StageDetail[] = [
  { number: 1, stage: 'Onboard', name: 'Client Onboarding & Engagement Setup', responsibleRole: 'Intake Specialist', description: 'Conflict clearance, engagement letter execution, portal access provisioning.', clientAction: 'Sign engagement letter, verify identity.', deliverable: 'Executed Engagement Letter' },
  { number: 2, stage: 'Collect', name: 'Document Collection & Intake', responsibleRole: 'Client / Intake Specialist', description: 'Collection of W-2s, 1099s, K-1s, bank statements, receipts, and prior returns.', clientAction: 'Upload source documents and complete Tax Organizer.', deliverable: 'Document Vault Intake Package' },
  { number: 3, stage: 'Validate', name: 'Identity & Source Validation', responsibleRole: 'Verification Specialist', description: 'Anti-malware scan, document classification, EIN/SSN verification.', clientAction: 'Respond to document clarification requests.', deliverable: 'Verified Document Index' },
  { number: 4, stage: 'Record', name: 'Data Entry & Transaction Coding', responsibleRole: 'Data Entry Clerk', description: 'Batch transaction ingestion, cash receipts, AP bills, and check registers.', clientAction: 'Provide missing transaction descriptions.', deliverable: 'General Ledger Data Batches' },
  { number: 5, stage: 'Reconcile', name: 'Bookkeeping & Bank Reconciliation', responsibleRole: 'Bookkeeper', description: 'Monthly account reconciliation, trial balance tie-out, adjusting journal entries.', clientAction: 'Clarify unclassified transfers or deposits.', deliverable: 'Reconciled Trial Balance' },
  { number: 6, stage: 'Review', name: 'Accounting Review & Diagnostic Checks', responsibleRole: 'Staff Accountant', description: 'Depreciation schedules, Section 179 analysis, Schedule M-1 adjustments.', clientAction: 'Confirm asset acquisition dates and business use %.', deliverable: 'Pre-Tax Accounting Workpapers' },
  { number: 7, stage: 'Report', name: 'Management Reporting & Financials', responsibleRole: 'Staff Accountant / Controller', description: 'Preparation of GAAP / tax-basis balance sheet, income statement, cash flows.', clientAction: 'Review management financial packet.', deliverable: 'Certified Financial Statements' },
  { number: 8, stage: 'Plan', name: 'Strategic Tax Planning & Scenarios', responsibleRole: 'Tax Advisor', description: 'Entity structure analysis, reasonable compensation review, pass-through entity elections.', clientAction: 'Review tax optimization scenarios.', deliverable: 'Tax Strategy Roadmap' },
  { number: 9, stage: 'Prepare Taxes', name: 'Tax Return Preparation', responsibleRole: 'Tax Preparer (CPA/EA)', description: 'Drafting Federal Form 1120-S, state returns, shareholder K-1 schedules.', clientAction: 'Confirm partner personal information.', deliverable: 'Draft Return Package' },
  { number: 10, stage: 'Approve', name: 'Senior CPA Technical Quality Review', responsibleRole: 'Senior Reviewer (CPA)', description: 'Maker-Checker quality certification, statutory compliance gate, release for signature.', clientAction: 'Review certified draft and submit corrections.', deliverable: 'Certified Form 8879 Package' },
  { number: 11, stage: 'Sign', name: 'Client Review & E-Signature', responsibleRole: 'Client', description: 'Client review of draft return package and execution of Form 8879 authorization.', clientAction: 'Authorize Form 8879-S e-signature.', deliverable: 'Signed E-File Authorization' },
  { number: 12, stage: 'File', name: 'Electronic Filing & Transmission', responsibleRole: 'Filing Specialist', description: 'MeF XML schema generation, transmission to IRS and State DOR gateways.', clientAction: 'None — System automated transmission.', deliverable: 'IRS MeF Submission Record' },
  { number: 13, stage: 'Government Feedback', name: 'Agency Acceptance & Feedback', responsibleRole: 'Government Systems', description: 'Receipt of electronic acknowledgment, MeF Submission ID validation.', clientAction: 'View official IRS acceptance notice.', deliverable: 'IRS Electronic Acknowledgment' },
  { number: 14, stage: 'Resolve', name: 'Notice Resolution & Examination', responsibleRole: 'Tax Resolution Specialist', description: 'Handling agency discrepancy notices, CP2000 responses, audit representation.', clientAction: 'Upload agency notice if received.', deliverable: 'Agency Resolution Letter' },
  { number: 15, stage: 'Monitor', name: 'Transcript Monitoring & Compliance', responsibleRole: 'Compliance Officer', description: 'IRS transcript tracking, account freeze monitoring, payment verification.', clientAction: 'Confirm quarterly estimated payments.', deliverable: 'Transcript Health Report' },
  { number: 16, stage: 'Archive', name: 'Permanent Vault & Regulatory Archive', responsibleRole: 'Archivist', description: 'Statutory 7-year immutable retention, SHA-256 verification hash stamping.', clientAction: 'Download permanent return copies anytime.', deliverable: 'Archival Certified Package' },
  { number: 17, stage: 'Renew', name: 'Annual Engagement Renewal', responsibleRole: 'Engagement Manager', description: 'Evaluation of prior year scope, roll-forward of entity profile, retainer update.', clientAction: 'Confirm ongoing service scope.', deliverable: 'Renewal Agreement' },
  { number: 18, stage: 'Repeat', name: 'Annual Tax Operating Cycle Rollover', responsibleRole: 'All Teams', description: 'New tax year activation, roll-forward tax organizer generation.', clientAction: 'Initiate new year tax cycle.', deliverable: 'Next Year Client Packet' }
];

export const LifecycleDetailModal: React.FC<LifecycleDetailModalProps> = ({
  isOpen,
  currentStage,
  onClose
}) => {
  if (!isOpen) return null;

  const currentIdx = ALL_18_STAGES.findIndex(s => s.stage === currentStage);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lifecycle-modal-title"
    >
      <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#D8DCE2] bg-[#061A2F] text-white flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-[#D7AC4A] uppercase tracking-wider font-bold">
              A/R Tax Services, LLC • Operational Architecture
            </div>
            <h2 id="lifecycle-modal-title" className="text-base sm:text-lg font-bold">
              18-Stage Authoritative Tax Operating Lifecycle
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Stage Indicator Banner */}
        <div className="bg-[#FAF9F5] border-b border-[#D8DCE2] px-5 py-3 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase font-bold text-[#667085]">Current Stage:</span>
            <span className="px-2.5 py-1 bg-[#061A2F] text-[#E8C66A] font-bold rounded font-mono">
              Stage {currentIdx + 1} of 18: {currentStage}
            </span>
          </div>
          <div className="text-xs text-[#667085]">
            Responsible: <strong className="text-[#061A2F]">{ALL_18_STAGES[currentIdx]?.responsibleRole || 'Practice Team'}</strong>
          </div>
        </div>

        {/* Scrollable List of All 18 Stages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {ALL_18_STAGES.map((s, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isFuture = idx > currentIdx;

            return (
              <div
                key={s.number}
                className={`p-4 rounded-lg border transition-colors ${
                  isCurrent
                    ? 'border-[#C99A32] bg-[#FAF9F5] shadow-xs'
                    : isCompleted
                    ? 'border-[#D8DCE2] bg-white'
                    : 'border-[#E5E7EB] bg-[#FBFAF7] opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono ${
                        isCurrent
                          ? 'bg-[#C99A32] text-white'
                          : isCompleted
                          ? 'bg-[#061A2F] text-white'
                          : 'border border-[#D8DCE2] text-[#667085] bg-white'
                      }`}
                    >
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : s.number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-[#061A2F]">{s.name}</h3>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-[#C99A32] text-white text-[10px] font-bold uppercase rounded tracking-wider">
                            Active Stage
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] text-[10px] font-bold uppercase rounded">
                            Completed
                          </span>
                        )}
                        {isFuture && (
                          <span className="text-[10px] text-[#9CA3AF] font-mono uppercase">
                            Upcoming
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#4B5563] mt-1">{s.description}</p>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block flex-shrink-0">
                    <div className="text-[10px] font-mono uppercase text-[#667085]">Role</div>
                    <div className="text-xs font-semibold text-[#061A2F]">{s.responsibleRole}</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#D8DCE2] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-[#061A2F]">Client Action: </span>
                    <span className="text-[#667085]">{s.clientAction}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#061A2F]">Standard Deliverable: </span>
                    <span className="text-[#667085]">{s.deliverable}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#D8DCE2] bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#061A2F] text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-[#031323] transition-colors cursor-pointer"
          >
            Close Lifecycle Architecture
          </button>
        </div>
      </div>
    </div>
  );
};
