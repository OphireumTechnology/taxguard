/**
 * A/R Tax Services, LLC - Client / Taxpayer Demonstration Dashboard
 * Comprehensive 35+ function taxpayer portal with strict black-and-white theme.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  DemoClient, 
  DemoEngagement, 
  DemoDocument, 
  DemoInvoice, 
  DemoTransaction 
} from '../types';
import { demoDataStore } from '../services/DemoDataService';
import { SimulatedActionModal, SimulatedActionType } from '../components/SimulatedActionModal';
import { 
  FileText, 
  UploadCloud, 
  CheckCircle, 
  AlertCircle, 
  CreditCard, 
  PenTool, 
  MessageSquare, 
  Download, 
  ShieldCheck, 
  Folder, 
  Calendar,
  DollarSign,
  Clock,
  Sparkles,
  Send,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Camera
} from 'lucide-react';
import { 
  DocumentScanner, 
  DocumentUploadQueue, 
  MissingItemsPanel, 
  VerificationPanel,
  EstimatedPaymentsCenter,
  TaxGuardVoiceAssistant,
  TaxPlanningScenarioModeler
} from '../../taxguard';
import {
  DemoOverviewService,
  DemoVaultService,
  DemoOrganizerService,
  DemoIncomeExpenseService,
  DemoReturnReviewService,
  DemoInvoiceService,
  DemoNoticeService,
  DemoAdvisoryService,
  ClientDashboardOverview
} from '../services/clientDashboardServices';
import { normalizeClientTab, CLIENT_NAV_GROUPS } from '../config/clientNavGroups';
import { ClientOverviewSection } from './client/ClientOverviewSection';
import { ClientVaultSection } from './client/ClientVaultSection';
import { ClientOrganizerSection } from './client/ClientOrganizerSection';
import { ClientIncomeExpensesSection } from './client/ClientIncomeExpensesSection';
import { ClientReturnReviewSection } from './client/ClientReturnReviewSection';
import { ClientInvoicesSection } from './client/ClientInvoicesSection';
import { ClientNoticesSection } from './client/ClientNoticesSection';
import { ClientAdvisorySection } from './client/ClientAdvisorySection';
import { ClientAssistantModal } from './client/ClientAssistantModal';
import { ClientProfileEntitiesSection } from './client/ClientProfileEntitiesSection';
import { ClientBookkeepingSection } from './client/ClientBookkeepingSection';
import { ClientJournalLedgerSection } from './client/ClientJournalLedgerSection';
import { ClientBankConnectionsSection } from './client/ClientBankConnectionsSection';
import { ClientAccountingConnectionsSection } from './client/ClientAccountingConnectionsSection';
import { ClientReconciliationSection } from './client/ClientReconciliationSection';
import { ClientFinancialReportsSection } from './client/ClientFinancialReportsSection';
import { ClientTaxReadinessSection } from './client/ClientTaxReadinessSection';
import { ClientEstimatedTaxesSection } from './client/ClientEstimatedTaxesSection';
import { ClientMessagesTasksSection } from './client/ClientMessagesTasksSection';
import { ClientLenderPackageSection } from './client/ClientLenderPackageSection';
import { ClientAmendmentsClosureSection } from './client/ClientAmendmentsClosureSection';
import { ClientPriorArchiveSection } from './client/ClientPriorArchiveSection';
import { ClientSettingsConsentSection } from './client/ClientSettingsConsentSection';
import { ClientHelpSupportSection } from './client/ClientHelpSupportSection';
import { StageTwoCollectionWorkspace } from '../../components/collection/StageTwoCollectionWorkspace';
import { PersonalizedChecklistSection } from './client/PersonalizedChecklistSection';
import { UploadScanCenterSection } from './client/UploadScanCenterSection';
import { AiProcessingPipelineSection } from './client/AiProcessingPipelineSection';
import { MissingDocumentsSection } from './client/MissingDocumentsSection';
import { AccountantReviewStatusSection } from './client/AccountantReviewStatusSection';
import { TaxPackageSection } from './client/TaxPackageSection';
import { ClientQuestionnaireSection } from './client/ClientQuestionnaireSection';
import { ClientContactsSection } from './client/ClientContactsSection';
import { ClientEngagementDetailsSection } from './client/ClientEngagementDetailsSection';
import {
  ClientDocumentRequestsView,
  ClientImportHistoryView,
  ClientCustomersArView,
  ClientVendorsApView,
  ClientLedgerView,
  ClientTrialBalanceView,
  ClientPeriodCloseView,
  ClientFilingStatusView,
  ClientAppointmentsView,
  ClientNotificationsView,
  ClientActivityHistoryView,
  ClientContactSupportView
} from './client/ClientSubViews';

interface ClientDashboardViewProps {
  onOpenAiAssistant: () => void;
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
}

export const ClientDashboardView: React.FC<ClientDashboardViewProps> = ({ 
  onOpenAiAssistant,
  activeNavId,
  onSelectNav
}) => {
  const { currentUser } = useApp();

  /*
   * LIVE DATA ISOLATION
   *
   * Firebase LIVE clients must never inherit the seeded
   * cli_perotti demonstration dataset.
   */
  const isLiveClient =
    Boolean(currentUser?.id) &&
    Boolean(currentUser?.email) &&
    currentUser.email.toLowerCase() !== 'artest2026';

  /*
   * AUTHORITATIVE CLIENT ID BOUNDARY
   *
   * LIVE:
   *   Use the authenticated TaxGuard user/client identifier.
   *
   * DEMO:
   *   Preserve the seeded cli_perotti demonstration fixture.
   *
   * A LIVE account is NEVER allowed to fall back to cli_perotti.
   */
  const authoritativeClientId =
    isLiveClient
      ? currentUser?.clientId || currentUser?.id
      : 'cli_perotti';

  /*
   * DEFENSE IN DEPTH
   *
   * ClientDashboardView remains the demonstration taxpayer portal.
   *
   * The router should never render this component for a LIVE client.
   * If routing fails, LIVE data must still never fall back to the
   * cli_perotti demonstration taxpayer.
   */
  const allowDemoData =
    !isLiveClient;

  const [client, setClient] = useState<DemoClient | undefined>(undefined);
  const [engagements, setEngagements] = useState<DemoEngagement[]>([]);
  const [documents, setDocuments] = useState<DemoDocument[]>([]);
  const [invoices, setInvoices] = useState<DemoInvoice[]>([]);
  const [transactions, setTransactions] = useState<DemoTransaction[]>([]);

  // Discretion & Privacy Mode (Phase 8 & 23)
  const [discretionMode, setDiscretionMode] = useState<boolean>(true);

  // Tax Year Selection (Section 5 & 7 safeguards)
  const [selectedTaxYear, setSelectedTaxYear] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('artax_selected_tax_year');
      if (saved) return parseInt(saved, 10);
    }
    return 2025;
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [pendingTaxYear, setPendingTaxYear] = useState<number | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);

  const handleSelectTaxYear = (year: number) => {
    setSelectedTaxYear(year);
    if (typeof window !== 'undefined') {
      localStorage.setItem('artax_selected_tax_year', year.toString());
    }
  };

  const handleInitiateTaxYearChange = (newYear: number) => {
    if (newYear === selectedTaxYear) return;
    if (hasUnsavedChanges) {
      setPendingTaxYear(newYear);
      setShowUnsavedModal(true);
    } else {
      handleSelectTaxYear(newYear);
    }
  };

  const handleConfirmSwitchDiscard = () => {
    if (pendingTaxYear !== null) {
      handleSelectTaxYear(pendingTaxYear);
      setHasUnsavedChanges(false);
      setPendingTaxYear(null);
    }
    setShowUnsavedModal(false);
  };

  const handleConfirmSwitchSave = () => {
    if (pendingTaxYear !== null) {
      // Simulate draft auto-save
      handleSelectTaxYear(pendingTaxYear);
      setHasUnsavedChanges(false);
      setPendingTaxYear(null);
    }
    setShowUnsavedModal(false);
  };

  const handleCancelSwitch = () => {
    setPendingTaxYear(null);
    setShowUnsavedModal(false);
  };

  // Live Camera Scanner State
  const [showScanner, setShowScanner] = useState<boolean>(false);

  // Active tab within Client Portal - drives or synchronizes with left sidebar
  const [internalTab, setInternalTab] = useState<string>('overview');
  const currentTab = normalizeClientTab(activeNavId || internalTab);
  const setTab = (targetTab: string) => {
    const normalized = normalizeClientTab(targetTab);
    if (onSelectNav) {
      onSelectNav(normalized);
    } else {
      setInternalTab(normalized);
    }
  };

  // Modal State
  const [modalAction, setModalAction] = useState<SimulatedActionType | null>(null);
  const [selectedEngagement, setSelectedEngagement] = useState<DemoEngagement | undefined>(undefined);
  const [selectedInvoice, setSelectedInvoice] = useState<DemoInvoice | undefined>(undefined);

  // Modular Client Dashboard Services
  const overviewService = useMemo(() => new DemoOverviewService(), []);
  const vaultService = useMemo(() => new DemoVaultService(), []);
  const organizerService = useMemo(() => new DemoOrganizerService(), []);
  const incomeExpenseService = useMemo(() => new DemoIncomeExpenseService(), []);
  const returnService = useMemo(() => new DemoReturnReviewService(), []);
  const invoiceService = useMemo(() => new DemoInvoiceService(), []);
  const noticeService = useMemo(() => new DemoNoticeService(), []);
  const advisoryService = useMemo(() => new DemoAdvisoryService(), []);

  // Overview data and assistant modal state
  const [overviewData, setOverviewData] = useState<ClientDashboardOverview | null>(null);
  const [assistantModalOpen, setAssistantModalOpen] = useState<boolean>(false);

  // Correction feedback note
  const [correctionNote, setCorrectionNote] = useState('');
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  // File upload simulation
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Form W-2 (Wage Statement)');
  const [isUploading, setIsUploading] = useState(false);

  // Refresh data from store
  const refresh = () => {
    /*
     * LIVE clients fail closed here.
     *
     * The demoDataStore contains seeded demonstration taxpayers.
     * It is never an authoritative source for a Firebase LIVE client.
     */
    if (isLiveClient) {
      setClient(null);
      setEngagements([]);
      setDocuments([]);
      setInvoices([]);
      return;
    }

    const currentClient = demoDataStore.getClientById('cli_perotti');
    setClient(currentClient);
    const allEngs = demoDataStore.getEngagements().filter(e => e.clientId === 'cli_perotti');
    setEngagements(allEngs);
    const docs = (isLiveClient ? [] : demoDataStore.getDocumentsByClient('cli_perotti'));
    setDocuments(docs);
    const invs = demoDataStore.getInvoices().filter(i => i.clientId === 'cli_perotti');
    setInvoices(invs);
    const txns = demoDataStore.getTransactions().filter(t => t.clientId === 'cli_perotti');
    setTransactions(txns);
    overviewService.getOverview('cli_perotti').then(setOverviewData);
  
  };

  useEffect(() => {
    refresh();
    return demoDataStore.subscribe(refresh);
  }, [overviewService]);

  const activeEngagement = engagements.find(e => !e.isArchived) || engagements[0];

  // Helper to mask values if discretionMode is active
  const formatDiscreetAmount = (val: number | string) => {
    if (discretionMode) return 'â€¢â€¢â€¢â€¢â€¢â€¢';
    if (typeof val === 'number') {
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return val;
  };

  // Handle simulated upload
  const handleSimulatedUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName.trim()) return;
    setIsUploading(true);
    await new Promise(res => setTimeout(res, 400));

    demoDataStore.uploadDocument({
      clientId: 'cli_perotti',
      engagementId: activeEngagement?.id,
      fileName: uploadFileName.endsWith('.pdf') ? uploadFileName : `${uploadFileName}.pdf`,
      fileSize: '1.84 MB',
      fileType: 'application/pdf',
      category: uploadCategory,
      taxYear: 2025,
      uploadedBy: client?.name || 'Michael Perotti',
      notes: 'Uploaded via Client Demonstration Vault'
    });

    setUploadFileName('');
    setIsUploading(false);
  };

  // Submit correction request
  const handleSubmitCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionNote.trim() || !activeEngagement) return;

    demoDataStore.logAudit({
      user: client?.name || 'Michael Perotti',
      role: 'client',
      action: 'Submitted Return Correction Request',
      record: `Engagement: ${activeEngagement.id}`,
      result: 'Warning (Simulated)',
      reason: correctionNote
    });

    setCorrectionSuccess(true);
    setCorrectionNote('');
    setTimeout(() => setCorrectionSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Portal Workspace Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8DCE2] pb-3">
        <div>
          <h2 className="text-base font-bold text-[#061A2F]">
            {currentTab === 'overview' && 'Client Overview & Active Filing Status'}
            {currentTab === 'entities' && 'Entity Profiles, Org Chart & Beneficial Ownership'}
            {currentTab === 'contacts' && 'Authorized Representatives & Form 2848 Power of Attorney'}
            {currentTab === 'engagement' && 'Active Engagement Scope & Service Agreement'}
            {currentTab === 'checklist' && 'Personalized Document Intake Checklist'}
            {currentTab === 'vault' && 'Secure Document Vault & Records'}
            {currentTab === 'upload_center' && 'Upload & Multi-Page Scanning Center'}
            {currentTab === 'ai_pipeline' && 'AI Document Processing Pipeline & Extraction'}
            {currentTab === 'missing_docs' && 'Missing Documents & Potential Issues'}
            {currentTab === 'review_status' && 'Accountant Review Status & Verification Milestones'}
            {currentTab === 'tax_package' && 'Demonstration Tax Preparation Package'}
            {currentTab === 'requests' && 'Formal Accountant Document Requests'}
            {currentTab === 'questionnaire' && 'Dynamic Client Onboarding Questionnaire'}
            {currentTab === 'bookkeeping' && 'Transaction Register & Bookkeeping Classification'}
            {currentTab === 'customers_ar' && 'Customers & Accounts Receivable Ledger'}
            {currentTab === 'vendors_ap' && 'Vendors & Accounts Payable Ledger'}
            {currentTab === 'journal' && 'General Journal & Chart of Accounts'}
            {currentTab === 'trial_balance' && 'Adjusted Trial Balance Workpapers'}
            {currentTab === 'period_close' && 'Financial Period Close & Accounting Lock'}
            {currentTab === 'bank_feeds' && 'Bank Feeds & Direct Aggregation Connections'}
            {currentTab === 'accounting_sync' && 'Cloud Accounting Sync & COA Tax Mapping'}
            {currentTab === 'reconciliation' && 'Bank & Credit Card Statement Reconciliation'}
            {currentTab === 'financial_reports' && 'Financial Statements & Management Reports'}
            {currentTab === 'ledger' && 'Income & Expense Workpapers'}
            {currentTab === 'return_review' && 'Draft Return Review & Form 8879 Authorization'}
            {currentTab === 'filing_status' && 'Electronic Filing Status & IRS MEF Confirmations'}
            {currentTab === 'readiness' && 'Tax Readiness & Statutory Compliance Scorecard'}
            {currentTab === 'estimated_tax' && 'Estimated Tax & Safe Harbor Vouchers'}
            {currentTab === 'advisory' && 'Tax Advisory, Strategy & Scenario Forecast'}
            {currentTab === 'tax_planning' && 'Tax Strategy Forecast & Scenario Modeler'}
            {currentTab === 'appointments' && 'Consultations & Strategy Appointments'}
            {currentTab === 'voice_assistant' && 'TaxGuard Voice Assistant'}
            {currentTab === 'messages' && 'Secure Messages, Inquiries & Actionable Tasks'}
            {currentTab === 'lender_package' && 'Credit, Lender & Underwriting Package Portal'}
            {currentTab === 'amendments' && 'Tax Return Amendments & Entity Dissolutions'}
            {currentTab === 'billing' && 'Fee Invoices & Payments'}
            {currentTab === 'notices' && 'Tax Notices, Audits & IRS Transcripts'}
            {currentTab === 'archive' && 'Prior Year Tax Archive & Multi-Year History'}
            {currentTab === 'import_history' && 'Data Import & Transmission History'}
            {currentTab === 'settings' && 'Security, Consents & Preferences'}
            {currentTab === 'notifications' && 'Notifications & Action Center'}
            {currentTab === 'activity_history' && 'Audit Log & Activity History'}
            {currentTab === 'contact_support' && 'Dedicated Practice Support'}
            {currentTab === 'support' && 'Client Support, Tax Knowledge Base & Contacts'}
          </h2>
          <p className="text-xs text-[#667085]">
            A/R Tax Services, LLC â€¢ Client Demonstration Portal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Header Tax Year Selector (Section 5 & 7 safeguards) */}
          <div className="flex items-center gap-1.5 bg-white border border-[#061A2F]/20 rounded px-2.5 py-1 shadow-2xs">
            <span className="text-[11px] font-bold text-[#061A2F] font-mono">Tax Year:</span>
            <select
              id="header-tax-year-selector"
              value={selectedTaxYear}
              onChange={(e) => handleInitiateTaxYearChange(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold font-mono text-[#061A2F] cursor-pointer outline-hidden"
            >
              <option value={2026}>2026 (Upcoming / Planning)</option>
              <option value={2025}>2025 (Current Filing Season)</option>
              <option value={2024}>2024 (Prior Year Filing / Reference)</option>
              <option value={2023}>2023 (Historical Reference)</option>
            </select>
          </div>

          {/* UHNW Privacy / Discretion Mode Toggle */}
          <button
            onClick={() => setDiscretionMode(!discretionMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
              discretionMode
                ? 'bg-[#F7F4ED] border-[#C99A32]/60 text-[#061A2F]'
                : 'bg-white border-[#D8DCE2] text-[#667085] hover:text-[#061A2F]'
            }`}
            title="Toggle sensitive balance and identifier masking for high-net-worth privacy"
          >
            {discretionMode ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-[#C99A32]" />
                <span className="font-semibold text-[11px]">Discretion Mode: Active</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-[#667085]" />
                <span className="text-[11px]">Discretion Mode: Revealed</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Category Quick Navigation Bar: Clean, effortless jump between primary sections */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs border-b border-[#D8DCE2]/60 pt-0.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#667085] font-semibold mr-1 shrink-0">
          Section:
        </span>
        {CLIENT_NAV_GROUPS.map((group) => {
          const isGroupActive = group.items.some(i => i.id === currentTab);
          const firstItem = group.items[0];
          return (
            <button
              key={group.id}
              onClick={() => {
                if (onSelectNav && firstItem) {
                  onSelectNav(firstItem.id);
                }
              }}
              className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-all shrink-0 font-medium cursor-pointer ${
                isGroupActive
                  ? 'bg-[#061A2F] text-[#E8C66A] border border-[#C99A32]/40 font-bold shadow-2xs'
                  : 'bg-white text-[#4A5568] border border-[#D8DCE2] hover:bg-[#F7F4ED] hover:text-[#061A2F]'
              }`}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Unified 18-Stage Tax Operating Workflow Banner */}
      <div className="p-3.5 bg-[#061A2F] text-white border border-[#C99A32]/40 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-[#C99A32]/20 border border-[#C99A32]/40 text-[#C99A32]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-[#C99A32] uppercase">
                Unified 18-Stage Operating Workflow
              </span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-900/60 text-emerald-300 font-mono font-bold">
                Stage 01 Passed &bull; Stage 02 (Collect) Active
              </span>
            </div>
            <div className="font-semibold text-slate-200 text-xs">
              Client Identity &amp; IRC Â§ 7216 Onboarding Dossier Cleared &bull; Hard Exit Gate Passed
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#stage_one_onboard"
            className="px-3 py-1.5 rounded-lg bg-[#C99A32] hover:bg-[#D9BF7A] text-[#061A2F] font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer no-underline"
          >
            <span>Review Identity Dossier</span>
          </a>
        </div>
      </div>

      {/* Multi-Year Notification Banner (Section 5) */}
      {selectedTaxYear !== 2025 && (
        <div className="p-3 bg-neutral-100 border border-neutral-300 rounded-lg text-xs text-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>
              Viewing <strong>Tax Year {selectedTaxYear}</strong>. Records and documents are displayed in read-only / reference mode.
            </span>
          </div>
          <button
            onClick={() => handleSelectTaxYear(2025)}
            className="text-[11px] font-bold text-[#061A2F] underline hover:no-underline font-mono"
          >
            Switch to Current Filing Season (CY2025)
          </button>
        </div>
      )}

      {/* 2. TAB WORKSPACE SECTIONS */}

      {/* TAB: OVERVIEW */}
      {currentTab === 'overview' && (
        overviewData ? (
          <ClientOverviewSection
            overview={overviewData}
            onNavigate={(sec) => setTab(sec)}
            onOpenAssistant={() => setAssistantModalOpen(true)}
          />
        ) : (
          <div className="p-8 text-center text-xs font-mono text-[#667085] bg-white border border-[#D8DCE2] rounded-lg">
            Loading Client Overview &amp; Filing Dossier...
          </div>
        )
      )}

      {/* TAB: ENTITIES & OWNERSHIP */}
      {currentTab === 'entities' && (
        <ClientProfileEntitiesSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: CONTACTS & REPRESENTATIVES */}
      {currentTab === 'contacts' && (
        <ClientContactsSection />
      )}

      {/* TAB: ENGAGEMENT DETAILS */}
      {currentTab === 'engagement' && (
        <ClientEngagementDetailsSection />
      )}

      {/* TAB: STAGE 02 COLLECTION WORKSPACE (TG-COL-001) */}
      {currentTab === 'collection_workspace' && (
        <StageTwoCollectionWorkspace
          clientId={authoritativeClientId}
          selectedTaxYear={selectedTaxYear}
          onTaxYearChange={setSelectedTaxYear}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: PERSONALIZED CHECKLIST */}
      {currentTab === 'checklist' && (
        <PersonalizedChecklistSection
          clientId={authoritativeClientId}
          selectedYear={selectedTaxYear}
          onNavigateToUpload={() => setTab('upload_center')}
          onNavigateToVault={() => setTab('vault')}
          onOpenAssistant={() => setAssistantModalOpen(true)}
          onNavigateToCollectionWorkspace={() => setTab('collection_workspace')}
        />
      )}

      {/* TAB: SECURE DOCUMENT VAULT */}
      {currentTab === 'vault' && (
        <ClientVaultSection
          vaultService={vaultService}
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: UPLOAD & SCAN CENTER */}
      {currentTab === 'upload_center' && (
        <UploadScanCenterSection
          selectedYear={selectedTaxYear}
          onDocumentProcessed={() => {}}
          onNavigateToAiPipeline={() => setTab('ai_pipeline')}
        />
      )}

      {/* TAB: AI PROCESSING PIPELINE */}
      {currentTab === 'ai_pipeline' && (
        <AiProcessingPipelineSection />
      )}

      {/* TAB: MISSING DOCUMENTS */}
      {currentTab === 'missing_docs' && (
        <MissingDocumentsSection
          selectedYear={selectedTaxYear}
          onNavigateToUpload={() => setTab('upload_center')}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: ACCOUNTANT REVIEW STATUS */}
      {currentTab === 'review_status' && (
        <AccountantReviewStatusSection />
      )}

      {/* TAB: 15-COMPONENT TAX PREPARATION PACKAGE */}
      {currentTab === 'tax_package' && (
        <TaxPackageSection selectedYear={selectedTaxYear} />
      )}

      {/* TAB: DOCUMENT REQUESTS */}
      {currentTab === 'requests' && (
        <ClientDocumentRequestsView onNavigateToUpload={() => setTab('upload_center')} />
      )}

      {/* TAB: QUESTIONNAIRE & ORGANIZER */}
      {currentTab === 'questionnaire' && (
        <ClientQuestionnaireSection
          selectedYear={selectedTaxYear}
          onOpenAssistant={() => setAssistantModalOpen(true)}
          onNavigateToChecklist={() => setTab('checklist')}
          onUnsavedChange={setHasUnsavedChanges}
        />
      )}

      {/* TAB: TAX ORGANIZER (21-SECTION DRAFT & SUBMISSION ENGINE) */}
      {currentTab === 'organizer' && (
        <ClientOrganizerSection
          organizerService={organizerService}
          clientId={authoritativeClientId}
          onNavigateToVault={() => setTab('vault')}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: PREFERENCES & NOTIFICATION DELEGATION */}
      {currentTab === 'preferences' && (
        <ClientSettingsConsentSection
          clientId={authoritativeClientId}
          defaultTab="notifications"
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: INTEGRATION CENTER */}
      {currentTab === 'integrations_center' && (
        <ClientAccountingConnectionsSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: CUSTOMERS & AR */}
      {currentTab === 'customers_ar' && (
        <ClientCustomersArView />
      )}

      {/* TAB: VENDORS & AP */}
      {currentTab === 'vendors_ap' && (
        <ClientVendorsApView />
      )}

      {/* TAB: TRIAL BALANCE */}
      {currentTab === 'trial_balance' && (
        <ClientTrialBalanceView />
      )}

      {/* TAB: PERIOD CLOSE */}
      {currentTab === 'period_close' && (
        <ClientPeriodCloseView />
      )}

      {/* TAB: FILING STATUS & 8879 */}
      {currentTab === 'filing_status' && (
        <ClientFilingStatusView />
      )}

      {/* TAB: APPOINTMENTS */}
      {currentTab === 'appointments' && (
        <ClientAppointmentsView />
      )}

      {/* TAB: NOTIFICATIONS */}
      {currentTab === 'notifications' && (
        <ClientNotificationsView />
      )}

      {/* TAB: ACTIVITY HISTORY & AUDIT LOG */}
      {currentTab === 'activity_history' && (
        <ClientActivityHistoryView />
      )}

      {/* TAB: IMPORT HISTORY */}
      {currentTab === 'import_history' && (
        <ClientImportHistoryView />
      )}

      {/* TAB: CONTACT SUPPORT */}
      {currentTab === 'contact_support' && (
        <ClientContactSupportView />
      )}

      {/* TAB: BOOKKEEPING & REGISTERS */}
      {currentTab === 'bookkeeping' && (
        <ClientBookkeepingSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
          onNavigateToVault={() => setTab('vault')}
        />
      )}

      {/* TAB: GENERAL JOURNAL & TRIAL BALANCE */}
      {currentTab === 'journal' && (
        <ClientJournalLedgerSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
          onNavigateToReports={() => setTab('financial_reports')}
        />
      )}

      {/* TAB: BANK FEEDS & AGGREGATION */}
      {currentTab === 'bank_feeds' && (
        <ClientBankConnectionsSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
          onNavigateToBookkeeping={() => setTab('bookkeeping')}
        />
      )}

      {/* TAB: ACCOUNTING SYNC */}
      {currentTab === 'accounting_sync' && (
        <ClientAccountingConnectionsSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: RECONCILIATION */}
      {currentTab === 'reconciliation' && (
        <ClientReconciliationSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
          onNavigateToVault={() => setTab('vault')}
        />
      )}

      {/* TAB: FINANCIAL REPORTS */}
      {currentTab === 'financial_reports' && (
        <ClientFinancialReportsSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
          onNavigateToLenderPackage={() => setTab('lender_package')}
        />
      )}

      {/* TAB: INCOME & EXPENSES */}
      {currentTab === 'income_expenses' && (
        <ClientIncomeExpensesSection
          incomeExpenseService={incomeExpenseService}
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: GENERAL LEDGER */}
      {currentTab === 'ledger' && (
        <ClientLedgerView />
      )}

      {/* TAB: RETURN REVIEW & SIGNATURE */}
      {currentTab === 'return_review' && (
        <ClientReturnReviewSection
          returnService={returnService}
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: TAX READINESS */}
      {currentTab === 'readiness' && (
        <ClientTaxReadinessSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
          onNavigateToSignatures={() => setTab('return_review')}
        />
      )}

      {/* TAB: BILLING & INVOICES */}
      {currentTab === 'billing' && (
        <ClientInvoicesSection
          invoiceService={invoiceService}
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: TAX NOTICES & CONTROVERSY */}
      {currentTab === 'notices' && (
        <ClientNoticesSection
          noticeService={noticeService}
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: ADVISORY & SCENARIO MODELING */}
      {(currentTab === 'advisory' || currentTab === 'tax_planning') && (
        <ClientAdvisorySection
          advisoryService={advisoryService}
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: ESTIMATED TAX & SAFE HARBOR */}
      {currentTab === 'estimated_tax' && (
        <ClientEstimatedTaxesSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: SECURE MESSAGES & TASKS */}
      {currentTab === 'messages' && (
        <ClientMessagesTasksSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
          onNavigateToVault={() => setTab('vault')}
          onNavigateToOrganizer={() => setTab('questionnaire')}
          onNavigateToSignatures={() => setTab('return_review')}
        />
      )}

      {/* TAB: LENDER PACKAGE */}
      {currentTab === 'lender_package' && (
        <ClientLenderPackageSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: AMENDMENTS & CLOSURES */}
      {currentTab === 'amendments' && (
        <ClientAmendmentsClosureSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: VOICE ASSISTANT */}
      {currentTab === 'voice_assistant' && (
        <div className="pt-1">
          <TaxGuardVoiceAssistant userRole="client" />
        </div>
      )}

      {/* TAB: ARCHIVE */}
      {currentTab === 'archive' && (
        <ClientPriorArchiveSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: SETTINGS & CONSENTS */}
      {currentTab === 'settings' && (
        <ClientSettingsConsentSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* TAB: HELP & SUPPORT */}
      {currentTab === 'support' && (
        <ClientHelpSupportSection
          clientId={authoritativeClientId}
          onOpenAssistant={() => setAssistantModalOpen(true)}
        />
      )}

      {/* 4. Professional & Regulatory Disclaimers Notice (Phase 6, 8, 23) */}
      <div className="border border-[#D8DCE2] bg-[#FBFAF7] p-4 rounded-lg text-xs text-[#667085] leading-relaxed space-y-1">
        <p className="font-bold text-[#061A2F] uppercase text-[10px] tracking-wider">
          Advisory &amp; Privacy Notice
        </p>
        <p>
          Client engagement files, draft returns, and electronic signature authorizations are access-controlled. Tax outcomes depend strictly on individual client documentation, statutory provisions, and regulatory determinations. A/R Tax Services, LLC is an independent firm and does not guarantee specific refund or examination determinations.
        </p>
      </div>

      {/* Simulated Action Modal */}
      {modalAction && (
        <SimulatedActionModal
          actionType={modalAction}
          engagement={selectedEngagement || activeEngagement}
          invoice={selectedInvoice}
          userRole="client"
          userName={client?.name || 'Michael Perotti'}
          onClose={() => setModalAction(null)}
          onCompleted={() => {
            refresh();
            setModalAction(null);
          }}
        />
      )}

      {/* Client Assistant Modal */}
      <ClientAssistantModal
        isOpen={assistantModalOpen}
        onClose={() => setAssistantModalOpen(false)}
        currentSection={currentTab}
        clientId={authoritativeClientId}
      />

      {/* Tax-Year Switching Safeguard Modal (Section 7) */}
      {showUnsavedModal && (
        <div 
          id="tax-year-unsaved-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="bg-white border border-neutral-300 rounded-lg max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-800">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900">
                  Unsaved Changes in Tax Year {selectedTaxYear}
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  You have uncommitted modifications in the CY{selectedTaxYear} organizer draft. Switching to Tax Year {pendingTaxYear} without saving will discard these changes.
                </p>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded text-xs text-neutral-700 space-y-1">
              <div className="font-semibold text-neutral-900">Choose an action:</div>
              <div>â€¢ <strong>Save Draft:</strong> Retain all in-progress answers and switch to CY{pendingTaxYear}.</div>
              <div>â€¢ <strong>Discard:</strong> Abandon uncommitted entries and switch immediately.</div>
              <div>â€¢ <strong>Cancel:</strong> Stay in CY{selectedTaxYear} to continue editing.</div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <button
                id="btn-cancel-year-switch"
                onClick={handleCancelSwitch}
                className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 border border-neutral-300 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-discard-year-switch"
                onClick={handleConfirmSwitchDiscard}
                className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-300 rounded transition-colors"
              >
                Discard Changes
              </button>
              <button
                id="btn-save-year-switch"
                onClick={handleConfirmSwitchSave}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold bg-[#061A2F] hover:bg-[#0A2544] text-white rounded transition-colors shadow-xs"
              >
                Save Draft &amp; Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};






