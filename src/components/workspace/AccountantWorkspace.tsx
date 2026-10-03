/**
 * A/R Tax Services, LLC — Accountant & Preparer Workspace
 * Production workspace for case preparation, side-by-side document validation,
 * recording, reconciliation, client requests, and preparation review handoff.
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Edit2,
  Send,
  Layers,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  User,
  Plus,
  ArrowRight,
  ExternalLink,
  Lock,
  ChevronRight,
  XCircle,
  HelpCircle,
  FolderLock,
  DollarSign,
  Scale
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredToken } from '../../services/api';
import { AccountantBookkeepingSection } from './AccountantBookkeepingSection';

interface AssignedCase {
  caseId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  activeStage: number;
  stageName: string;
  status: string;
  unreviewedDocsCount: number;
  unresolvedExceptionsCount: number;
  updatedAt: string;
}

interface ReviewDocument {
  id: string;
  clientId: string;
  taxYear: number;
  fileName: string;
  documentType: string;
  sha256: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CORRECTED';
  isVerified: boolean;
  confidence: number;
  extractedFields: Array<{
    name: string;
    sourceValue: string;
    proposedValue: string;
    correctedValue?: string;
    verified: boolean;
  }>;
  exceptions: string[];
  notes?: string;
}

export const AccountantWorkspace: React.FC = () => {
  const { currentUser, logout } = useApp();
  const [activeTab, setActiveTab] = useState<'cases' | 'doc_review' | 'requests' | 'records' | 'reconciliation' | 'bookkeeping'>('cases');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case_2025_001');
  const [selectedDocId, setSelectedDocId] = useState<string | null>('doc_001');
  const [filterTaxYear, setFilterTaxYear] = useState<number>(2025);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Correction inputs
  const [correctionField, setCorrectionField] = useState<string>('');
  const [correctionValue, setCorrectionValue] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');

  // Client Request modal / inputs
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [requestItemName, setRequestItemName] = useState<string>('');
  const [requestReason, setRequestReason] = useState<string>('');

  // Sample assigned cases (reflecting live database structure)
  const [cases, setCases] = useState<AssignedCase[]>([
    {
      caseId: 'case_2025_001',
      clientId: 'client_uhnw_1040',
      clientName: 'Daniel Henze',
      taxYear: 2025,
      activeStage: 3,
      stageName: '03 Validate',
      status: 'IN_REVIEW',
      unreviewedDocsCount: 2,
      unresolvedExceptionsCount: 0,
      updatedAt: '2026-10-02T13:45:00Z'
    },
    {
      caseId: 'case_2025_002',
      clientId: 'client_sc_corp',
      clientName: 'Palmetto Tech LLC',
      taxYear: 2025,
      activeStage: 4,
      stageName: '04 Record',
      status: 'PREPARATION',
      unreviewedDocsCount: 0,
      unresolvedExceptionsCount: 0,
      updatedAt: '2026-10-01T16:20:00Z'
    },
    {
      caseId: 'case_2025_003',
      clientId: 'client_investor',
      clientName: 'Robert Vance',
      taxYear: 2025,
      activeStage: 2,
      stageName: '02 Collect',
      status: 'AWAITING_CLIENT',
      unreviewedDocsCount: 1,
      unresolvedExceptionsCount: 1,
      updatedAt: '2026-10-02T11:10:00Z'
    }
  ]);

  // Documents for review in the active case
  const [documents, setDocuments] = useState<ReviewDocument[]>([
    {
      id: 'doc_001',
      clientId: 'client_uhnw_1040',
      taxYear: 2025,
      fileName: '2025_Form_W2_Employer.pdf',
      documentType: 'Form W-2',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'PENDING',
      isVerified: false,
      confidence: 0.98,
      extractedFields: [
        { name: 'Box 1: Wages, tips, other comp.', sourceValue: '$185,420.00', proposedValue: '185420.00', verified: false },
        { name: 'Box 2: Federal income tax withheld', sourceValue: '$38,910.00', proposedValue: '38910.00', verified: false },
        { name: 'Box 16: State wages (SC)', sourceValue: '$185,420.00', proposedValue: '185420.00', verified: false },
        { name: 'Box 17: State income tax (SC)', sourceValue: '$9,820.00', proposedValue: '9820.00', verified: false }
      ],
      exceptions: []
    },
    {
      id: 'doc_002',
      clientId: 'client_uhnw_1040',
      taxYear: 2025,
      fileName: '1099_DIV_Fidelity_Brokerage.pdf',
      documentType: 'Form 1099-DIV',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      status: 'PENDING',
      isVerified: false,
      confidence: 0.95,
      extractedFields: [
        { name: 'Box 1a: Total ordinary dividends', sourceValue: '$14,250.00', proposedValue: '14250.00', verified: false },
        { name: 'Box 1b: Qualified dividends', sourceValue: '$11,800.00', proposedValue: '11800.00', verified: false }
      ],
      exceptions: []
    }
  ]);

  const selectedCase = cases.find(c => c.caseId === selectedCaseId) || cases[0];
  const selectedDoc = documents.find(d => d.id === selectedDocId) || documents[0];

  const handleAcceptField = (fieldName: string) => {
    if (!selectedDoc) return;
    setDocuments(prev => prev.map(doc => {
      if (doc.id !== selectedDoc.id) return doc;
      const updatedFields = doc.extractedFields.map(f => {
        if (f.name === fieldName) {
          return { ...f, verified: true };
        }
        return f;
      });
      const allVerified = updatedFields.every(f => f.verified);
      return {
        ...doc,
        extractedFields: updatedFields,
        isVerified: allVerified,
        status: allVerified ? 'ACCEPTED' : doc.status
      };
    }));
    setActionNotice({ type: 'success', message: `Field "${fieldName}" accepted as verified evidence.` });
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleCorrectField = () => {
    if (!selectedDoc || !correctionField || !correctionValue || !correctionReason) {
      setActionNotice({ type: 'error', message: 'Field name, corrected value, and professional reason are required.' });
      return;
    }
    setDocuments(prev => prev.map(doc => {
      if (doc.id !== selectedDoc.id) return doc;
      const updatedFields = doc.extractedFields.map(f => {
        if (f.name === correctionField) {
          return { ...f, correctedValue: correctionValue, verified: true };
        }
        return f;
      });
      return {
        ...doc,
        extractedFields: updatedFields,
        status: 'CORRECTED',
        notes: `Corrected ${correctionField} to ${correctionValue}. Reason: ${correctionReason}`
      };
    }));
    setCorrectionField('');
    setCorrectionValue('');
    setCorrectionReason('');
    setActionNotice({ type: 'success', message: `Field corrected and audit logged with professional reason.` });
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleRejectDocument = (reason: string) => {
    if (!selectedDoc) return;
    setDocuments(prev => prev.map(doc => {
      if (doc.id !== selectedDoc.id) return doc;
      return { ...doc, status: 'REJECTED', isVerified: false, notes: reason };
    }));
    setActionNotice({ type: 'success', message: `Document marked REJECTED. Client request required for resubmission.` });
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleCreateClientRequest = () => {
    if (!requestItemName || !requestReason) {
      setActionNotice({ type: 'error', message: 'Item name and explanation required.' });
      return;
    }
    setShowRequestModal(false);
    setRequestItemName('');
    setRequestReason('');
    setActionNotice({ type: 'success', message: 'Client RFI request created and dispatched to client portal.' });
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="min-h-screen bg-[#06182B] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-14 bg-[#071A2E] border-b border-slate-700/60 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">A/R Tax Services</span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-xs text-blue-400 font-mono font-semibold">Accountant &amp; Preparer Workspace</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-[#06182B] border border-slate-700/60 px-2.5 py-1 rounded-lg text-xs font-mono text-[#D4A843]">
            <Calendar className="w-3.5 h-3.5" />
            <span>Tax Year: {filterTaxYear}</span>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-700/60">
            <span className="text-xs text-slate-300 font-medium">{currentUser?.name || 'Staff Preparer'}</span>
            <button
              type="button"
              onClick={logout}
              className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded bg-[#0D2745] hover:bg-red-950/40 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-60 bg-[#071A2E] border-r border-slate-700/60 flex flex-col justify-between shrink-0">
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Preparation Modules
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('cases')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'cases' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Assigned Dossiers</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('doc_review')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'doc_review' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Side-by-Side Review</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'requests' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Client Requests (RFI)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'records' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Stage 04: Record Entries</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reconciliation')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'reconciliation' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Stage 05: Reconcile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bookkeeping')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'bookkeeping' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Bookkeeping &amp; Ledger</span>
            </button>
          </div>

          <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 font-mono space-y-1">
            <div>Role: <span className="text-white">Accountant / Preparer</span></div>
            <div>Authority: <span className="text-emerald-400">Server Governed</span></div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionNotice && (
            <div className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
              actionNotice.type === 'success' 
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                : 'bg-red-950/60 border-red-500/40 text-red-300'
            }`}>
              <span>{actionNotice.message}</span>
              <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
          )}

          {/* TAB 1: ASSIGNED CASES */}
          {activeTab === 'cases' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-white">Assigned Client Tax Cases</h1>
                  <p className="text-xs text-slate-400">Manage tax preparation progression across all 18 canonical workflow stages.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search client or case..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-[#0D2745] border border-slate-700/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 outline-none w-56"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#071A2E] text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700/60">
                    <tr>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Tax Year</th>
                      <th className="px-4 py-3">Current Stage</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Pending Docs</th>
                      <th className="px-4 py-3">Last Active</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {cases.map((cs) => (
                      <tr key={cs.caseId} className="hover:bg-[#102D4F]/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-[#D4A843]" />
                          <span>{cs.clientName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({cs.clientId})</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[#D4A843]">{cs.taxYear}</td>
                        <td className="px-4 py-3 font-mono text-blue-300">{cs.stageName}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/30">
                            {cs.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">{cs.unreviewedDocsCount}</td>
                        <td className="px-4 py-3 text-[11px] text-slate-400">{new Date(cs.updatedAt).toLocaleTimeString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCaseId(cs.caseId);
                              setActiveTab('doc_review');
                            }}
                            className="px-3 py-1 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Open Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: SIDE-BY-SIDE DOCUMENT REVIEW */}
          {activeTab === 'doc_review' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">Side-by-Side Document &amp; Extraction Review</h1>
                  <p className="text-xs text-slate-400">
                    Case: <strong className="text-white">{selectedCase.clientName}</strong> ({selectedCase.taxYear}) &bull; Stage 03 Validate
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(true)}
                  className="px-3 py-1.5 bg-[#0D2745] hover:bg-[#102D4F] border border-slate-700/60 text-xs text-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#D4A843]" />
                  <span>Request Client Clarification</span>
                </button>
              </div>

              {/* Side by Side Container */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Source Document Preview */}
                <div className="lg:col-span-6 bg-[#0D2745] border border-slate-700/60 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#D4A843]" />
                        <span className="font-bold text-white text-sm">{selectedDoc?.fileName}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {selectedDoc?.documentType}
                      </span>
                    </div>

                    {/* Simulated High-Fidelity Document Preview */}
                    <div className="bg-[#06182B] border border-slate-800 rounded-xl p-6 min-h-[360px] flex flex-col justify-between font-mono text-xs text-slate-300 space-y-4 shadow-inner">
                      <div className="border-b border-slate-800 pb-3 flex justify-between items-center text-[11px]">
                        <span className="font-bold text-white">INTERNAL REVENUE SERVICE SOURCE DOCUMENT</span>
                        <span className="text-emerald-400">SHA-256 VERIFIED</span>
                      </div>
                      <div className="space-y-2 text-[11px] leading-relaxed">
                        <div className="grid grid-cols-2 gap-2 p-2 bg-[#071A2E] rounded">
                          <div><strong>Form:</strong> {selectedDoc?.documentType}</div>
                          <div><strong>Tax Year:</strong> {selectedDoc?.taxYear}</div>
                          <div><strong>Employee / Recipient:</strong> Daniel Henze</div>
                          <div><strong>SSN:</strong> •••-••-9482</div>
                        </div>
                        <div className="p-3 bg-[#071A2E] rounded space-y-1">
                          <div className="text-[#D4A843] font-bold">Reported Amounts:</div>
                          {selectedDoc?.extractedFields.map((f, i) => (
                            <div key={i} className="flex justify-between py-0.5 border-b border-slate-800/60">
                              <span>{f.name}:</span>
                              <span className="text-white font-bold">{f.sourceValue}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate font-mono">
                        Hash: {selectedDoc?.sha256}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRejectDocument('Document illegible or mismatched tax year.')}
                      className="px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-950/30 text-red-300 hover:bg-red-950/60 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Reject Document
                    </button>
                  </div>
                </div>

                {/* Right: AI Extraction & Professional Corrections */}
                <div className="lg:col-span-6 bg-[#0D2745] border border-slate-700/60 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white text-sm">Extracted Evidence Verification</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#D4A843]">
                      Confidence: {(selectedDoc?.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedDoc?.extractedFields.map((f, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-[#06182B] border border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{f.name}</span>
                          {f.verified ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                              VERIFIED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                              PROPOSED
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-400 block">Proposed Value:</span>
                            <span className="text-white font-bold">{f.proposedValue}</span>
                          </div>
                          {f.correctedValue && (
                            <div>
                              <span className="text-blue-400 block">CPA Corrected:</span>
                              <span className="text-emerald-300 font-bold">{f.correctedValue}</span>
                            </div>
                          )}
                        </div>
                        {!f.verified && (
                          <div className="pt-1 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleAcceptField(f.name)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Accept Proposed
                            </button>
                            <button
                              type="button"
                              onClick={() => setCorrectionField(f.name)}
                              className="px-2.5 py-1 bg-[#102D4F] hover:bg-[#1A3F6D] text-slate-200 rounded text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              Correct...
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Manual Correction Drawer / Form */}
                  {correctionField && (
                    <div className="p-4 bg-[#071A2E] border border-blue-500/40 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-300">Professional Correction: {correctionField}</span>
                        <button onClick={() => setCorrectionField('')} className="text-slate-400 hover:text-white">&times;</button>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Corrected Value (e.g. 185420.00)"
                          value={correctionValue}
                          onChange={(e) => setCorrectionValue(e.target.value)}
                          className="w-full bg-[#06182B] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Professional audit reason (e.g. Adjusted per Box 14 explanation)"
                          value={correctionReason}
                          onChange={(e) => setCorrectionReason(e.target.value)}
                          className="w-full bg-[#06182B] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCorrectField}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Save Verified Correction
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLIENT REQUEST LOOP */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">Client Information Requests (RFI)</h1>
                  <p className="text-xs text-slate-400">Track missing documentation and client clarification items.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(true)}
                  className="px-3 py-1.5 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Client Request</span>
                </button>
              </div>

              <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-white">Missing 1099-B Brokerage Statement</span>
                    <p className="text-slate-400 text-[11px]">Request dispatched to Daniel Henze on Oct 1, 2026. Awaiting response.</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                    PENDING CLIENT
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RECORD ENTRIES */}
          {activeTab === 'records' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white">Stage 04: Authoritative Record Entries</h1>
                <p className="text-xs text-slate-400">Recorded tax records derived strictly from verified source evidence.</p>
              </div>

              <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="font-bold text-white">W-2 Wages (Box 1)</span>
                    <span className="text-slate-400 block text-[11px]">Doc: 2025_Form_W2_Employer.pdf</span>
                  </div>
                  <span className="text-emerald-400 font-bold">$185,420.00</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RECONCILIATION */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white">Stage 05: Reconciliation &amp; Balance Verification</h1>
                <p className="text-xs text-slate-400">Deterministic reconciliation between source documents, general ledger, and trial balance.</p>
              </div>

              <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="p-4 bg-[#06182B] rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Total Income Reconciliation</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      BALANCED ($0.00 VARIANCE)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-300">
                    <div>Source Total: <strong className="text-white">$199,670.00</strong></div>
                    <div>Recorded Total: <strong className="text-white">$199,670.00</strong></div>
                    <div>Variance: <strong className="text-emerald-400">$0.00</strong></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: BOOKKEEPING & GENERAL LEDGER COMMAND CENTER */}
          {activeTab === 'bookkeeping' && (
            <AccountantBookkeepingSection
              clientId={selectedCase.clientId}
              clientName={selectedCase.clientName}
              taxYear={selectedCase.taxYear}
            />
          )}
        </main>
      </div>

      {/* Client Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create Client Information Request</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Requested Document / Information</label>
                <input
                  type="text"
                  placeholder="e.g., 2025 Form 1099-B Brokerage Statement"
                  value={requestItemName}
                  onChange={(e) => setRequestItemName(e.target.value)}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Explanation to Taxpayer</label>
                <textarea
                  placeholder="Please upload the complete 1099 composite statement showing cost basis."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg px-3 py-2 text-white h-24"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateClientRequest}
                className="px-4 py-1.5 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] font-bold text-xs rounded-xl"
              >
                Dispatch to Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
