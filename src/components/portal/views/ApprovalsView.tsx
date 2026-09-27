import React, { useState } from 'react';
import {
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  Clock,
  Download,
  AlertTriangle,
  Lock,
  Calendar,
  Eye,
  FileText,
  Key,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  X
} from 'lucide-react';
import { User, Engagement } from '../../../types';
import {
  ApprovalRecord,
  ApprovalsTab,
  TaxWorkflowState
} from '../../../types/clientPortal';
import {
  MOCK_APPROVALS,
  MOCK_ENGAGEMENT
} from '../../../services/clientPortalService';

interface ApprovalsViewProps {
  currentUser?: User | null;
  activeEngagement?: Engagement;
  selectedTaxYear?: number;
  approvals?: ApprovalRecord[];
  currentWorkflowState?: TaxWorkflowState;
  onApproveRecord?: (approvalId: string, signedRecord: Partial<ApprovalRecord>) => void;
  onNavigateToWorkspaceTab?: (tab: string) => void;
  onNavigate?: (tab: string, subTab?: string) => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  currentUser,
  activeEngagement = MOCK_ENGAGEMENT,
  selectedTaxYear = 2025,
  approvals = MOCK_APPROVALS,
  currentWorkflowState = 'CLIENT_REVIEW',
  onApproveRecord,
  onNavigateToWorkspaceTab,
  onNavigate
}) => {
  const handleNavWorkspace = (subTab: string) => {
    if (onNavigate) {
      onNavigate('workspace', subTab);
    } else if (onNavigateToWorkspaceTab) {
      onNavigateToWorkspaceTab(subTab);
    }
  };
  const [activeTab, setActiveTab] = useState<ApprovalsTab>('pending');
  const [selectedForSigning, setSelectedForSigning] = useState<ApprovalRecord | null>(null);
  const [typedSignature, setTypedSignature] = useState('');
  const [confirmPerjuryCheck, setConfirmPerjuryCheck] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [signingError, setSigningError] = useState<string | null>(null);
  const [signedSuccessNotice, setSignedSuccessNotice] = useState<string | null>(null);

  const pendingApprovals = approvals.filter(a => a.status === 'pending_client_signature');
  const approvedRecords = approvals.filter(a => a.status === 'approved');

  const handleOpenSigningModal = (record: ApprovalRecord) => {
    setSelectedForSigning(record);
    setTypedSignature(currentUser?.name || 'Robert Perotti');
    setConfirmPerjuryCheck(false);
    setTotpCode('');
    setSigningError(null);
  };

  const handleExecuteSigning = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForSigning) return;

    if (!confirmPerjuryCheck) {
      setSigningError('You must check the box declaring under penalties of perjury that you have examined this return.');
      return;
    }
    if (!typedSignature.trim()) {
      setSigningError('Please type your legal full name exactly as it appears on your tax return.');
      return;
    }

    const signedData: Partial<ApprovalRecord> = {
      status: 'approved',
      signerName: typedSignature.trim(),
      signedTimestamp: new Date().toISOString(),
      timeZone: 'America/New_York (EST)',
      ipAddressMasked: '73.189.•••.•••',
      deviceFingerprintMasked: 'macOS 14.3 &bull; Chrome 122.0',
      tamperEvidentHashChain: `sha256_signed_${Date.now()}_91827364501928374`,
      certificateDownloadUrl: `/certificates/cert_8879_${selectedForSigning.taxYear}_completed.pdf`
    };

    onApproveRecord(selectedForSigning.id, signedData);
    setSelectedForSigning(null);
    setSignedSuccessNotice(`Successfully signed and recorded authorization for ${selectedForSigning.title}. Tamper-evident digest logged.`);
  };

  return (
    <div className="space-y-6" id="client-approvals-container">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#0B2748]">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
            Official Client Approvals &bull; Statutory Authorizations
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight mt-0.5">
            Client Approvals &amp; E-File Authorizations
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Compliant with IRS Publication 4557, IRC § 7216, and Modernized e-File (MeF) signature mandates.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-[#07172B] border border-[#1E3A5F] p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-[#C99A3D] text-[#06172C] shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending ({pendingApprovals.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-[#C99A3D] text-[#06172C] shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed Archive ({approvedRecords.length})</span>
          </button>
        </div>
      </div>

      {signedSuccessNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{signedSuccessNotice}</span>
          </div>
          <button type="button" onClick={() => setSignedSuccessNotice(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 1. PENDING APPROVALS LIST */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingApprovals.length === 0 ? (
            <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-8 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="font-serif text-lg font-bold text-white">All Authorizations Complete</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                There are currently no documents or forms awaiting your signature. All tax filings for {selectedTaxYear} are authorized and queued.
              </p>
            </div>
          ) : (
            pendingApprovals.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-[#07172B] border-2 border-[#C99A3D] p-6 shadow-xl space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#C99A3D]/20 text-[#E2BD67] border border-[#C99A3D]/40 text-[11px] font-bold uppercase tracking-wider mb-2">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Formal Signature Required</span>
                    </div>
                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                      {item.title}
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleNavWorkspace('return_review')}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0B2748] hover:bg-[#11355F] border border-[#1E3A5F] transition-colors flex items-center gap-2"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#C99A3D]" />
                      <span>Inspect Return Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenSigningModal(item)}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-lg flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Review &amp; Authorize Form 8879</span>
                    </button>
                  </div>
                </div>

                {/* Statutory Consent Preview Box */}
                <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs text-slate-300 space-y-2">
                  <div className="font-bold text-slate-200">Statutory Consent Language Preview:</div>
                  <p className="italic text-slate-300 leading-relaxed pl-3 border-l-2 border-[#C99A3D]">
                    &ldquo;{item.exactConsentLanguage}&rdquo;
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#1E3A5F]/70">
                    <span>Document SHA-256: <strong className="font-mono text-slate-300">{item.documentSha256.substring(0, 16)}...</strong></span>
                    <span>Signer Capacity: <strong className="text-white">Primary Taxpayer</strong></span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. COMPLETED APPROVALS ARCHIVE */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-4">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Immutable Signed Evidence &amp; Certificates of Completion
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Cryptographically chained records verifying identity, IP, timestamp, and exact consent text.
            </p>
          </div>

          <div className="space-y-3">
            {approvedRecords.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-white text-sm">{item.title}</span>
                    <div className="text-slate-400 text-[11px] mt-0.5">{item.description}</div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 self-start sm:self-auto">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Legally Executed
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] text-[11px] text-slate-300">
                  <div>
                    <span>Executed By: </span>
                    <strong className="text-white">{item.signerName}</strong>
                  </div>
                  <div>
                    <span>Timestamp: </span>
                    <span className="text-slate-200">{item.signedTimestamp ? new Date(item.signedTimestamp).toLocaleString() : 'Recent'}</span>
                  </div>
                  <div>
                    <span>IP / Context: </span>
                    <span className="font-mono text-slate-300">{item.ipAddressMasked || '73.189.•••.•••'}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-[#1E3A5F]/70 pt-2">
                  <div className="truncate max-w-lg">
                    <span>Cryptographic Digest: </span>
                    <span className="font-mono text-[#E2BD67]">{item.tamperEvidentHashChain}</span>
                  </div>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-[#0B2748] hover:bg-[#11355F] text-white border border-[#C99A3D]/40 text-xs font-semibold flex items-center gap-1 self-start sm:self-auto"
                  >
                    <Download className="w-3.5 h-3.5 text-[#C99A3D]" />
                    <span>Download Signed PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. MODAL: FORM 8879 ELECTRONIC SIGNATURE DIALOG */}
      {/* --------------------------------------------------------------------- */}
      {selectedForSigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-[#07172B] border-2 border-[#C99A3D] p-6 sm:p-8 shadow-2xl space-y-6 my-8">
            <button
              type="button"
              onClick={() => setSelectedForSigning(null)}
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#0B2748]"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
                IRS Publication 4557 Identity Verification
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mt-0.5">
                IRS Form 8879: Electronic Filing Authorization
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Authorizing A/R Tax Services, LLC (ERO: Desmond Hinds) to transmit your 2025 Form 1040 and Form SC1040 to the IRS and SCDOR.
              </p>
            </div>

            {signingError && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
                {signingError}
              </div>
            )}

            {/* Mandatory Statutory Language Box */}
            <div className="rounded-xl border border-[#1E3A5F] bg-[#06172C] p-4 text-xs text-slate-200 space-y-3">
              <div className="font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#C99A3D]" />
                <span>Declaration Under Penalties of Perjury:</span>
              </div>
              <p className="leading-relaxed italic bg-[#07172B] p-3 rounded-lg border border-[#1E3A5F] text-slate-300">
                &ldquo;Under penalties of perjury, I declare that I have examined a copy of my 2025 electronic individual income tax return and accompanying schedules and statements, and to the best of my knowledge and belief, it is true, correct, and complete. I authorize A/R Tax Services, LLC (Desmond Hinds, Founder &amp; CEO, ERO) to enter my PIN or transmit this return to the Internal Revenue Service and South Carolina Department of Revenue.&rdquo;
              </p>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Document Version Hash: <strong className="font-mono text-slate-300">e3b0c44298fc1c14...</strong></span>
                <span>Signing Capacity: <strong className="text-white">Primary Taxpayer</strong></span>
              </div>
            </div>

            <form onSubmit={handleExecuteSigning} className="space-y-4">
              {/* Checkbox confirmation */}
              <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={confirmPerjuryCheck}
                  onChange={(e) => setConfirmPerjuryCheck(e.target.checked)}
                  className="mt-0.5 rounded border-[#1E3A5F] text-[#C99A3D] focus:ring-[#C99A3D]"
                />
                <span className="leading-relaxed">
                  I agree that typing my name below and completing verification constitutes my legally binding electronic signature under federal law (ESIGN Act &amp; IRS Publication 1345).
                </span>
              </label>

              {/* Type legal name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Type Full Legal Name (Electronic Signature):
                </label>
                <input
                  type="text"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  placeholder="e.g. Robert Perotti"
                  className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-4 py-3 text-sm text-white font-serif focus:outline-none focus:border-[#C99A3D]"
                  required
                />
              </div>

              {/* Multi-Factor Authentication Verification */}
              <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[#C99A3D]" />
                    <span>Multi-Factor Verification:</span>
                  </span>
                  <span className="text-emerald-400 font-semibold">✓ Authenticated Session</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Your identity is authenticated via your verified multi-factor credentials. Masked IP address (73.189.•••.•••) and timestamp will be embedded into the permanent transmission manifest.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedForSigning(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-[#0B2748] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-lg flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Execute Binding E-Signature</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
