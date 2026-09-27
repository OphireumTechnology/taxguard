import React, { useState } from 'react';
import {
  FileText,
  FolderOpen,
  BookOpen,
  Sparkles,
  Eye,
  Send,
  Archive,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Lock,
  ChevronRight,
  AlertTriangle,
  Building,
  Building2,
  Shield,
  FileSpreadsheet,
  CheckSquare,
  DollarSign,
  HelpCircle,
  X,
  Info,
  FileEdit,
  Receipt,
  Scale,
  Check,
  Edit3
} from 'lucide-react';
import { User, Engagement, DocumentItem } from '../../../types';
import {
  TaxWorkspaceTab,
  ExtractedFact,
  AccountingConnector,
  TaxStrategyItem,
  BusinessClosureWorkflow,
  FilingSubmissionDetails,
  MissingDocumentItem
} from '../../../types/clientPortal';
import {
  MOCK_DOCUMENTS,
  MOCK_ACCOUNTING_CONNECTORS,
  MOCK_STRATEGIES,
  MOCK_BUSINESS_CLOSURE,
  MOCK_FILING_DETAILS,
  MOCK_ENGAGEMENT,
  MOCK_MISSING_DOCUMENTS
} from '../../../services/clientPortalService';
import { ExpensesView } from './ExpensesView';
import { FinancialConnectionsView } from './FinancialConnectionsView';
import { AmendmentView } from './AmendmentView';

interface TaxWorkspaceViewProps {
  currentUser?: User | null;
  activeEngagement?: Engagement;
  selectedTaxYear?: number;
  documents?: DocumentItem[];
  accountingConnectors?: AccountingConnector[];
  strategies?: TaxStrategyItem[];
  businessClosure?: BusinessClosureWorkflow;
  filingDetails?: FilingSubmissionDetails;
  initialTab?: TaxWorkspaceTab;
  onOpenUpload?: (category?: string, taxYear?: number) => void;
  onNavigate?: (tab: string, subTab?: string) => void;
  onNavigateToApprovals?: () => void;
  onNavigateToMessages?: () => void;
}

export const TaxWorkspaceView: React.FC<TaxWorkspaceViewProps> = ({
  currentUser,
  activeEngagement = MOCK_ENGAGEMENT,
  selectedTaxYear = 2025,
  documents = MOCK_DOCUMENTS,
  accountingConnectors = MOCK_ACCOUNTING_CONNECTORS,
  strategies = MOCK_STRATEGIES,
  businessClosure = MOCK_BUSINESS_CLOSURE,
  filingDetails = MOCK_FILING_DETAILS,
  initialTab = 'return_review',
  onOpenUpload = () => {},
  onNavigate,
  onNavigateToApprovals,
  onNavigateToMessages
}) => {
  const handleNavApprovals = () => {
    if (onNavigate) onNavigate('approvals');
    else if (onNavigateToApprovals) onNavigateToApprovals();
  };

  const handleNavMessages = () => {
    if (onNavigate) onNavigate('messages');
    else if (onNavigateToMessages) onNavigateToMessages();
  };
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<TaxWorkspaceTab>(initialTab);

  // Client comment on locked return draft
  const [returnComments, setReturnComments] = useState<Array<{ id: string; author: string; timestamp: string; text: string; status: 'open' | 'resolved' }>>([
    {
      id: 'comm_1',
      author: 'Robert Perotti',
      timestamp: '2026-03-11T10:15:00Z',
      text: 'Verified Schedule C consulting income matches 1099-NEC. Can you verify whether line 13 depreciation includes the new monitor setup?',
      status: 'resolved'
    },
    {
      id: 'comm_2',
      author: 'Desmond Hinds, Founder & CEO',
      timestamp: '2026-03-11T14:30:00Z',
      text: 'Yes Robert, the monitor setup is included under Section 179 expensing on Form 4562 Line 6 ($2,450 workstation package).',
      status: 'resolved'
    }
  ]);
  const [newCommentText, setNewCommentText] = useState('');

  // Strategy acknowledgment state
  const [strategyList, setStrategyList] = useState<TaxStrategyItem[]>(strategies);

  // Business closure interactive step toggle
  const [closureWorkflow, setClosureWorkflow] = useState<BusinessClosureWorkflow>(businessClosure);
  const [closureSuccessNotice, setClosureSuccessNotice] = useState<string | null>(null);

  // AI Extraction Sample Facts with Provenance
  const sampleExtractedFacts: ExtractedFact[] = [
    {
      id: 'fact_01',
      documentId: 'doc_w2_01',
      documentName: '2025_W2_Employer_Primary.pdf',
      pageNumber: 1,
      boundingBox: { x: 140, y: 220, width: 180, height: 40 },
      fieldKey: 'box_1_wages',
      fieldLabel: 'Box 1: Wages, tips, other compensation',
      extractedValue: '$148,250.00',
      confidenceScore: 99.4,
      extractionTimestamp: '2026-01-20T11:46:12Z',
      modelIdentifier: 'ar-tax-ocr-v2.4-mef-certified',
      reviewerStatus: 'confirmed_by_accountant'
    },
    {
      id: 'fact_02',
      documentId: 'doc_w2_01',
      documentName: '2025_W2_Employer_Primary.pdf',
      pageNumber: 1,
      boundingBox: { x: 340, y: 220, width: 180, height: 40 },
      fieldKey: 'box_2_fed_withholding',
      fieldLabel: 'Box 2: Federal income tax withheld',
      extractedValue: '$26,410.00',
      confidenceScore: 98.8,
      extractionTimestamp: '2026-01-20T11:46:12Z',
      modelIdentifier: 'ar-tax-ocr-v2.4-mef-certified',
      reviewerStatus: 'confirmed_by_accountant'
    },
    {
      id: 'fact_03',
      documentId: 'doc_1099_01',
      documentName: '1099_NEC_Consulting_Client.pdf',
      pageNumber: 1,
      boundingBox: { x: 120, y: 190, width: 160, height: 35 },
      fieldKey: 'box_1_nonemployee_compensation',
      fieldLabel: 'Box 1: Nonemployee compensation',
      extractedValue: '$42,500.00',
      confidenceScore: 97.2,
      extractionTimestamp: '2026-02-10T14:12:00Z',
      modelIdentifier: 'ar-tax-ocr-v2.4-mef-certified',
      reviewerStatus: 'confirmed_by_accountant'
    },
    {
      id: 'fact_04',
      documentId: 'doc_k1_01',
      documentName: '2025_Schedule_K1_PassThrough.pdf',
      pageNumber: 1,
      boundingBox: { x: 210, y: 310, width: 140, height: 30 },
      fieldKey: 'box_1_ordinary_business_income',
      fieldLabel: 'Box 1: Ordinary business income (loss)',
      extractedValue: '$31,840.00',
      confidenceScore: 89.1,
      extractionTimestamp: '2026-02-15T09:20:00Z',
      modelIdentifier: 'ar-tax-ocr-v2.4-mef-certified',
      reviewerStatus: 'confirmed_by_accountant',
      humanCorrection: {
        correctedBy: 'Desmond Hinds, Founder & CEO',
        originalValue: '$31,840.00',
        correctedValue: '$31,840.00',
        correctionTimestamp: '2026-02-15T10:11:00Z',
        correctionReason: 'Verified against final Schedule K-1 Statement A footnote.'
      }
    }
  ];

  const handleAcknowledgeStrategy = (strategyId: string) => {
    setStrategyList(prev => prev.map(s => s.id === strategyId ? {
      ...s,
      clientAcknowledgmentStatus: 'acknowledged',
      clientAcknowledgedTimestamp: new Date().toISOString()
    } : s));
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const newComment = {
      id: `comm_${Date.now()}`,
      author: currentUser?.name || 'Client',
      timestamp: new Date().toISOString(),
      text: newCommentText.trim(),
      status: 'open' as const
    };
    setReturnComments(prev => [...prev, newComment]);
    setNewCommentText('');
  };

  return (
    <div className="space-y-6" id="tax-workspace-container">
      {/* Workspace Navigation Bar */}
      <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-3 shadow-md">
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#0B2748] px-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C99A3D]">
              Primary Client Annual Workspace
            </span>
            <div className="text-sm font-bold text-white">
              {selectedTaxYear} Tax Year Workspace &bull; Form 1040 &amp; Entity Advisory
            </div>
          </div>

          {/* Specialized Action: Closing or Discontinuing a Business */}
          <button
            type="button"
            onClick={() => setActiveWorkspaceTab('business_closure')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeWorkspaceTab === 'business_closure'
                ? 'bg-rose-900/40 text-rose-300 border border-rose-500/50'
                : 'bg-[#0B2748] text-slate-300 hover:text-white border border-[#1E3A5F]'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-rose-400" />
            <span>Business Closure Request</span>
          </button>
        </div>

        {/* Workspace Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          {[
            { key: 'intake', label: 'Intake Organizer', icon: CheckSquare },
            { key: 'documents', label: 'Document Vault', icon: FolderOpen },
            { key: 'expenses', label: 'Expenses & Cash', icon: DollarSign },
            { key: 'books_records', label: 'Books & Records', icon: BookOpen },
            { key: 'financial_connections', label: 'Bank Feeds', icon: Building2 },
            { key: 'strategy', label: 'Strategy Summary', icon: Sparkles },
            { key: 'return_review', label: 'Return Review', icon: Eye },
            { key: 'filing_status', label: 'Filing Status', icon: Send },
            { key: 'post_filing', label: 'Post-Filing Records', icon: Archive },
            { key: 'prior_years', label: 'Prior Years', icon: Calendar },
            { key: 'amendment', label: 'Amendments', icon: FileEdit }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeWorkspaceTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveWorkspaceTab(tab.key as TaxWorkspaceTab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#0D2340] text-white font-bold border border-[#C99A3D]/60 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#0A1F38]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C99A3D]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 1. INTAKE ORGANIZER SUB-VIEW */}
      {/* --------------------------------------------------------------------- */}
      {activeWorkspaceTab === 'intake' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-white">
                {selectedTaxYear} Comprehensive Tax Organizer
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Guided autosaving intake adapting to Individual, Sole Proprietorship, S-Corp, Rental Real Estate, and Multistate filings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Intake 100% Complete &bull; Locked for Preparation
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-2">
              <div className="font-bold text-[#E2BD67] uppercase tracking-wider">Filing Status &amp; Family</div>
              <div className="text-slate-200">Married Filing Jointly (Robert &amp; Sarah Perotti)</div>
              <div className="text-slate-400">2 Qualifying Dependents (Children under 17)</div>
              <div className="text-emerald-400 text-[11px] font-semibold">✓ Confirmed &amp; Verified</div>
            </div>

            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-2">
              <div className="font-bold text-[#E2BD67] uppercase tracking-wider">Pass-Through Entities</div>
              <div className="text-slate-200">Perotti Advisory Group, LLC (S-Corp)</div>
              <div className="text-slate-400">EIN: ••-•••4912 &bull; South Carolina</div>
              <div className="text-emerald-400 text-[11px] font-semibold">✓ W-2 Officer Salary Reconciled</div>
            </div>

            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-2">
              <div className="font-bold text-[#E2BD67] uppercase tracking-wider">Multistate &amp; Foreign Disclosures</div>
              <div className="text-slate-200">Primary Resident: South Carolina</div>
              <div className="text-slate-400">No foreign accounts exceeding $10,000 threshold (No FBAR required)</div>
              <div className="text-emerald-400 text-[11px] font-semibold">✓ Zero Foreign Flags</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0B2748]/50 border border-[#C99A3D]/40 text-xs text-slate-200 flex items-start gap-3">
            <Info className="w-4 h-4 text-[#C99A3D] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Need to update life circumstances?</span> If you had a change in marital status, moved between states, purchased real estate, or sold business assets after submission, message your preparer to unlock your organizer.
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. DOCUMENT VAULT SUB-VIEW WITH OCR PROVENANCE */}
      {/* --------------------------------------------------------------------- */}
      {activeWorkspaceTab === 'documents' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-white">
                  Document Vault &amp; AI Provenance Engine
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Allowlisted formats: PDF, PDF/A, JPG, PNG, HEIC, TIFF, CSV, XLSX, OFX, QFX, QBO. Executables rejected.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenUpload('bank_statement', selectedTaxYear)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Tax Documents</span>
                </button>
              </div>
            </div>

            {/* Document Security & Malware Scanning Status */}
            <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Security Engine: <strong>AES-256 Envelope Encryption</strong> at rest &bull; ClamAV &amp; ViruScan pipeline active.</span>
              </div>
              <div className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> All 6 vault items clean
              </div>
            </div>

            {/* AI Extracted Facts with Provenance and Bounding Boxes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#C99A3D] flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#E2BD67]" />
                  <span>OCR Field Extraction Provenance (Source Linked)</span>
                </h3>
                <span className="text-[11px] text-slate-400">All low-confidence values require human CPA review</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sampleExtractedFacts.map((fact) => (
                  <div
                    key={fact.id}
                    className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{fact.fieldLabel}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                        {fact.confidenceScore}% Confidence
                      </span>
                    </div>

                    <div className="text-base font-serif font-bold text-[#E2BD67]">
                      {fact.extractedValue}
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-0.5">
                      <div>Source: <span className="text-slate-300">{fact.documentName} (Page {fact.pageNumber})</span></div>
                      <div>Document ID: <span className="font-mono text-slate-300">{fact.documentId}</span></div>
                      <div>
                        Bounding Box:{' '}
                        <span className="font-mono text-slate-300">
                          x={fact.boundingBox.x}, y={fact.boundingBox.y}, w={fact.boundingBox.width}, h={fact.boundingBox.height}
                        </span>
                      </div>
                      <div>Extraction Engine: <span className="font-mono text-slate-300">{fact.modelIdentifier}</span></div>
                      <div className="text-emerald-400 font-medium">✓ Reviewer status: {fact.reviewerStatus}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. BOOKS & RECORDS (ACCOUNTING INTEGRATION) */}
      {/* --------------------------------------------------------------------- */}
      {activeWorkspaceTab === 'books_records' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-white">
                Books &amp; Records Reconciliation
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Read-only OAuth connection to your general ledger. Adjustments are proposed rather than overwriting source files.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                QuickBooks Online Connected (Read-Only)
              </span>
            </div>
          </div>

          {accountingConnectors.map((conn) => (
            <div key={conn.id} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
                  <div className="text-slate-400">Entity Ledger</div>
                  <div className="font-bold text-white text-sm mt-0.5">{conn.connectedEntityName}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
                  <div className="text-slate-400">Total Accounts</div>
                  <div className="font-bold text-white text-sm mt-0.5">{conn.syncRecordCounts.accounts} Chart Accounts</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
                  <div className="text-slate-400">Transactions Analyzed</div>
                  <div className="font-bold text-white text-sm mt-0.5">{conn.syncRecordCounts.transactions} Entries</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
                  <div className="text-slate-400">Last Successful Sync</div>
                  <div className="font-bold text-[#E2BD67] text-sm mt-0.5">
                    {new Date(conn.lastSyncTimestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Proposed Adjusting Journal Entries */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#C99A3D]">
                  Proposed Tax Adjustments (Workpaper Basis)
                </h3>
                <div className="space-y-2.5">
                  {conn.proposedAdjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="font-bold text-white text-sm">{adj.accountName}</div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0B2748] text-[#E2BD67]">
                          Amount: ${adj.proposedDebit.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-300">{adj.description}</p>
                      <div className="p-2.5 rounded-lg bg-[#07172B] border border-[#1E3A5F] text-slate-300">
                        <strong className="text-white">Tax Authority Reason:</strong> {adj.taxReason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. TAX STRATEGY SUMMARY */}
      {/* --------------------------------------------------------------------- */}
      {activeWorkspaceTab === 'strategy' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-white">
                Accountant-Approved Tax Strategy Summary
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Customized tax planning strategies backed by explicit Internal Revenue Code (IRC) statutory authorities.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#0B2748] border border-[#C99A3D]/40 text-[#E2BD67] text-xs font-semibold">
                {strategyList.length} Active Approved Strategies
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {strategyList.map((strat) => (
              <div
                key={strat.id}
                className="p-5 rounded-2xl bg-[#06172C] border border-[#1E3A5F] space-y-4 shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E3A5F]/70 pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-white">{strat.title}</h3>
                    <div className="text-xs text-[#E2BD67] font-mono mt-0.5">
                      Statutory Authority: {strat.relevantAuthority}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {strat.clientAcknowledgmentStatus === 'acknowledged' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Client Acknowledged
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAcknowledgeStrategy(strat.id)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#C99A3D] text-[#06172C] hover:brightness-105 transition-all shadow"
                      >
                        Acknowledge Strategy
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="font-bold text-slate-200">Objective &amp; Scope:</div>
                    <p className="text-slate-300 leading-relaxed">{strat.objective}</p>

                    <div className="font-bold text-slate-200 pt-1">Required Substantiation Evidence:</div>
                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                      {strat.requiredEvidence.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 p-3.5 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
                    <div className="font-bold text-slate-200">Estimated Scenario Impact:</div>
                    <div className="text-xl font-serif font-bold text-[#E2BD67]">
                      ${strat.estimatedScenarioSavings.conservative.toLocaleString()} – ${strat.estimatedScenarioSavings.moderate.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-400 italic">
                      {strat.estimatedScenarioSavings.disclaimer}
                    </p>

                    <div className="pt-2 text-[11px] text-slate-400 border-t border-[#1E3A5F] mt-2">
                      Responsible Professional: <strong className="text-white">{strat.responsibleProfessional}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 5. RETURN REVIEW (LOCKED REVIEW COPY) */}
      {/* --------------------------------------------------------------------- */}
      {activeWorkspaceTab === 'return_review' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B2748] border border-[#C99A3D]/40 text-xs font-bold text-[#E2BD67] uppercase tracking-wider mb-2">
                  <Lock className="w-3.5 h-3.5 text-[#E2BD67]" />
                  <span>Locked Review Copy &bull; Version 2.0</span>
                </div>
                <h2 className="font-serif text-2xl font-bold text-white">
                  2025 Form 1040 &amp; Form SC1040 Client Inspection Copy
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Tax returns are prepared and locked against direct client editing to ensure professional standards. You may submit questions or correction requests below.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleNavApprovals}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-md flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Proceed to Form 8879 Authorization</span>
                </button>
              </div>
            </div>

            {/* Return Key Figures Summary Table */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
                <div className="text-slate-400">Total Income (Line 9)</div>
                <div className="font-serif font-bold text-white text-base mt-1">$222,590.00</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
                <div className="text-slate-400">Adjusted Gross Income (Line 11)</div>
                <div className="font-serif font-bold text-white text-base mt-1">$208,440.00</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
                <div className="text-slate-400">Taxable Income (Line 15)</div>
                <div className="font-serif font-bold text-white text-base mt-1">$178,440.00</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
                <div className="text-slate-400">Federal Refund / (Balance)</div>
                <div className="font-serif font-bold text-emerald-400 text-base mt-1">+$3,812.00 Refund</div>
              </div>
            </div>

            {/* Document Preview Frame (Safe Mock Representation) */}
            <div className="rounded-xl border border-[#1E3A5F] bg-[#06172C] p-6 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300 border-b border-[#1E3A5F] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#C99A3D]" />
                  <span className="font-bold text-white">2025_Form_1040_Locked_Client_Draft_v2.pdf</span>
                  <span className="text-slate-400">(48 Pages &bull; SHA-256: e3b0c442...)</span>
                </div>
                <span className="text-emerald-400 font-semibold">✓ Preparer Quality Certified</span>
              </div>

              <div className="bg-[#040E1B] p-5 rounded-lg text-xs font-mono text-slate-300 space-y-2 overflow-x-auto">
                <div className="text-slate-400">// FORM 1040 SCHEDULE SYNOPSIS (TAX YEAR 2025)</div>
                <div>&bull; Schedule 1: Additional Income &amp; Adjustments to Income (Consulting: $42,500; SEP IRA deduction: $14,150)</div>
                <div>&bull; Schedule 2: Additional Taxes (Self-Employment Tax: $6,005)</div>
                <div>&bull; Schedule 3: Additional Credits (Child Tax Credit: $4,000; Residential Energy Credit: $1,200)</div>
                <div>&bull; Schedule C: Profit or Loss From Business (Gross: $42,500; Expenses: $12,850; Net: $29,650)</div>
                <div>&bull; Schedule E: Supplemental Income &amp; Loss (Pass-Through K-1: $31,840)</div>
                <div>&bull; Form 4562: Depreciation &amp; Amortization (IRC § 179 Expensing: $2,450)</div>
                <div>&bull; Form SC1040: South Carolina Individual Income Tax Return (SC Refund: $640.00)</div>
              </div>
            </div>

            {/* Client Comments & Resolution Thread */}
            <div className="rounded-xl border border-[#1E3A5F] bg-[#06172C] p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#C99A3D] flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#E2BD67]" />
                <span>Client Review Feedback &amp; Correction Inquiries</span>
              </h3>

              <div className="space-y-3">
                {returnComments.map((comm) => (
                  <div key={comm.id} className="p-3.5 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{comm.author}</span>
                      <span className="text-[11px] text-slate-400">{new Date(comm.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-300">{comm.text}</p>
                    <span className="inline-block text-[10px] font-semibold text-emerald-400">✓ Resolved</span>
                  </div>
                ))}
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="pt-2 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Ask a question or request a correction regarding your return draft..."
                  className="flex-1 bg-[#07172B] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C99A3D]"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0B2748] hover:bg-[#11355F] border border-[#C99A3D]/40 transition-colors disabled:opacity-50"
                >
                  Submit Question
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 6. FILING STATUS (MeF TRANSMISSION & ACKNOWLEDGMENTS) */}
      {/* --------------------------------------------------------------------- */}
      {activeWorkspaceTab === 'filing_status' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-white">
                Electronic Filing &amp; Government Submission Tracking
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Authorized Modernized e-File (MeF) transmission tracking for federal and state revenue authorities.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Awaiting Client Form 8879 Authorization
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Federal IRS Submission Gate */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">Federal (IRS) Form 1040</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#0B2748] text-[#E2BD67]">MeF Queue</span>
              </div>
              <div className="text-slate-300">Channel: Authorized MeF Electronic Return Transmitter</div>
              <div className="text-slate-400">Electronic Filing Identification Number (EFIN): 29••••</div>
              <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] space-y-1">
                <div className="font-semibold text-slate-200">Pre-Submission Validation:</div>
                <div className="text-emerald-400">✓ Social Security numbers &amp; names match SSA registry</div>
                <div className="text-emerald-400">✓ Schedule C &amp; K-1 mathematical checks verified</div>
                <div className="text-amber-400">⏳ Form 8879 client signature authorization pending</div>
              </div>
            </div>

            {/* South Carolina SCDOR Submission Gate */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">South Carolina (SCDOR) Form SC1040</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#0B2748] text-[#E2BD67]">Linked MeF</span>
              </div>
              <div className="text-slate-300">State Agency: South Carolina Department of Revenue</div>
              <div className="text-slate-400">Submission Mode: Federal / State Combined Electronic Filing</div>
              <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] space-y-1">
                <div className="font-semibold text-slate-200">State Validation:</div>
                <div className="text-emerald-400">✓ South Carolina tax rate: 6.2% statutory applied</div>
                <div className="text-emerald-400">✓ State withholding reconciled against Form W-2</div>
                <div className="text-amber-400">⏳ State e-sign authorization bundled with Form 8879</div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-white text-sm">Ready to complete authorization?</div>
              <div className="text-xs text-slate-300">Once signed, your return transmits immediately during the active IRS MeF processing window.</div>
            </div>
            <button
              type="button"
              onClick={onNavigateToApprovals}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow whitespace-nowrap"
            >
              Sign Form 8879 Now
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 7. POST-FILING RECORDS */}
      {/* --------------------------------------------------------------------- */}
      {activeWorkspaceTab === 'post_filing' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6">
          <div className="border-b border-[#0B2748] pb-4">
            <h2 className="font-serif text-xl font-bold text-white">
              Post-Filing Records &amp; Estimated Tax Schedule
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Guidelines, retention requirements, and 2026 Form 1040-ES payment vouchers once filings are completed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <div className="font-bold text-white text-sm">2026 Form 1040-ES Estimated Tax Schedule</div>
              <p className="text-slate-300">
                To prevent underpayment penalties under IRC § 6654, make quarterly estimated tax installments:
              </p>
              <div className="space-y-2">
                <div className="flex justify-between p-2 rounded bg-[#07172B]">
                  <span>Voucher 1: Due April 15, 2026</span>
                  <span className="font-bold text-[#E2BD67]">$3,200.00</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-[#07172B]">
                  <span>Voucher 2: Due June 15, 2026</span>
                  <span className="font-bold text-[#E2BD67]">$3,200.00</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-[#07172B]">
                  <span>Voucher 3: Due September 15, 2026</span>
                  <span className="font-bold text-[#E2BD67]">$3,200.00</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-[#07172B]">
                  <span>Voucher 4: Due January 15, 2027</span>
                  <span className="font-bold text-[#E2BD67]">$3,200.00</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <div className="font-bold text-white text-sm">Statutory Record Retention Guidelines</div>
              <div className="text-slate-300 space-y-2 leading-relaxed">
                <div>&bull; <strong className="text-white">Income Tax Returns:</strong> Retain minimum 7 years from filing date.</div>
                <div>&bull; <strong className="text-white">Employment Taxes:</strong> Retain all W-2/941 records minimum 4 years.</div>
                <div>&bull; <strong className="text-white">Real Estate &amp; Capital Assets:</strong> Retain purchase, improvement, and depreciation records for duration of ownership plus 7 years after sale.</div>
              </div>
              <div className="text-[11px] text-slate-400">All uploaded documents in your A/R Tax Services vault are preserved under automated compliance retention.</div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 8. PRIOR YEARS */}
      {/* --------------------------------------------------------------------- */}
      {activeWorkspaceTab === 'prior_years' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6">
          <div className="border-b border-[#0B2748] pb-4">
            <h2 className="font-serif text-xl font-bold text-white">
              Prior Tax Years &amp; Historical Archive
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Access completed returns, filed vouchers, and prior-year carryforward items.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-white text-sm">2024 Tax Year &bull; Form 1040 &amp; Form SC1040</div>
                <div className="text-slate-400">Filed April 12, 2025 &bull; IRS Acceptance Code: AC_202409182736</div>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-[#0B2748] hover:bg-[#11355F] text-white border border-[#C99A3D]/40 text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5 text-[#C99A3D]" />
                <span>Download Filed 2024 Return</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-white text-sm">2023 Tax Year &bull; Form 1040 &amp; Form SC1040</div>
                <div className="text-slate-400">Filed April 14, 2024 &bull; IRS Acceptance Code: AC_202308192837</div>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-[#0B2748] hover:bg-[#11355F] text-white border border-[#C99A3D]/40 text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5 text-[#C99A3D]" />
                <span>Download Filed 2023 Return</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 9. SPECIALIZED BUSINESS-CLOSURE WORKFLOW (SECTION 15) */}
      {/* --------------------------------------------------------------------- */}
      {activeWorkspaceTab === 'business_closure' && (
        <div className="rounded-2xl bg-[#07172B] border-2 border-rose-500/50 p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Controlled Statutory Workflow</span>
              </div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Closing or Discontinuing a Business: {closureWorkflow.entityName}
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                A/R Tax Services, LLC guides you through all multi-agency federal, state, and payroll obligations. Note: Closing an IRS business account does NOT automatically dissolve a state legal entity.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs font-mono text-slate-200">
                EIN: {closureWorkflow.einMasked} &bull; State: {closureWorkflow.stateOfFormation}
              </span>
            </div>
          </div>

          {closureSuccessNotice && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
              <span>{closureSuccessNotice}</span>
              <button type="button" onClick={() => setClosureSuccessNotice(null)}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Business Closure Multi-Agency Step Checklist */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#C99A3D]">
              Multi-Agency Regulatory Checklist
            </h3>

            <div className="space-y-2.5">
              {closureWorkflow.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`p-4 rounded-xl border text-xs transition-all space-y-2 ${
                    step.completed
                      ? 'bg-[#06172C] border-emerald-500/40 text-slate-200'
                      : 'bg-[#06172C] border-[#1E3A5F] text-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#0B2748] text-slate-400'
                      }`}>
                        {step.completed ? '✓' : idx + 1}
                      </span>
                      <span className="font-bold text-white text-sm">{step.title}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {step.requiresCpaReview && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0B2748] text-[#E2BD67]">
                          Requires CPA Review
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        step.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {step.completed ? 'Completed' : 'Pending Action'}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-300 leading-relaxed pl-7">{step.description}</p>
                  {step.notes && (
                    <div className="pl-7 text-[11px] text-slate-400 italic">Note: {step.notes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-white text-sm">Schedule a Dedicated Closure Consultation</div>
              <div className="text-xs text-slate-300">Meet with Desmond Hinds to coordinate tax clearance certificates and state dissolution filings.</div>
            </div>
            <button
              type="button"
              onClick={onNavigateToMessages}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0B2748] hover:bg-[#11355F] border border-[#C99A3D]/40 transition-colors whitespace-nowrap"
            >
              Consult with Desmond
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
