/**
 * A/R Tax Services, LLC - Personalized Document Checklist Engine
 * Compliance with Federal & Multi-State Standards (CA, NY, NC, SC, VA, TN, FL, NJ)
 *
 * Implements:
 * - Dynamic Federal & State tax document requirements center
 * - Accurate state handling (including explicit notices for FL & TN no-income-tax rules)
 * - 8 realistic Demo Taxpayer Profiles with seamless switcher
 * - Interactive Intake Questionnaire Editor allowing real-time rule regeneration
 * - Federal vs State vs Overall Readiness Scorecard
 * - Smart Upload, Camera Scan simulation, OCR data inspection, and Duplicate/Mismatch checks
 * - Rich Document Cards with "Why We Need It", "Where Can I Find It", and "Why Am I Asked For This?"
 * - Professional status override with audit logging
 */

import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Filter,
  UploadCloud,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ShieldCheck,
  FileText,
  Calendar,
  Sparkles,
  ArrowRight,
  Info,
  Building,
  DollarSign,
  Layers,
  Search,
  Eye,
  Camera,
  AlertTriangle,
  PlusCircle,
  UserCheck,
  CheckCheck,
  RotateCcw,
  SlidersHorizontal,
  Check
} from 'lucide-react';

import {
  PersonalizedDocItem,
  IntakeResponses,
  DocumentCategory,
  TargetJurisdiction,
  DocumentStatus,
  PriorityLevel,
  STATE_RULES_REGISTRY,
  generatePersonalizedChecklist,
  calculateReadinessScorecard,
  extractStateCode,
  deriveIntakeFromClientAndDocs,
  reconcileChecklistWithClientVaultDocs,
  generateAutomaticClientChecklist,
  ALL_STANDARD_TAX_FORMS,
  StandardTaxFormDef
} from '../../services/personalizedDocumentsEngine';
import { demoDataStore } from '../../services/DemoDataService';

import {
  SmartUploadModal,
  OcrInspectionModal,
  ProfessionalOverrideModal,
  IntakeQuestionnaireModal
} from './PersonalizedChecklistModals';

interface PersonalizedChecklistSectionProps {
  clientId?: string;
  selectedYear: number;
  onNavigateToUpload: () => void;
  onNavigateToVault: () => void;
  onOpenAssistant: () => void;
  onNavigateToCollectionWorkspace?: () => void;
}

export const PersonalizedChecklistSection: React.FC<PersonalizedChecklistSectionProps> = ({
  clientId: externalClientId,
  selectedYear: externalSelectedYear,
  onNavigateToUpload,
  onNavigateToVault,
  onOpenAssistant,
  onNavigateToCollectionWorkspace
}) => {
  const [storeVersion, setStoreVersion] = useState<number>(0);

  // Subscribe to demoDataStore updates
  React.useEffect(() => {
    const unsub = demoDataStore.subscribe(() => {
      setStoreVersion(v => v + 1);
    });
    return unsub;
  }, []);

  const activeClient = useMemo(() => {
    return demoDataStore.getClientById(externalClientId || 'cli_perotti') || demoDataStore.getClients()[0];
  }, [externalClientId, storeVersion]);

  const clientSubmittedDocs = useMemo(() => {
    return demoDataStore.getDocumentsByClient(activeClient.id);
  }, [activeClient.id, storeVersion]);

  const [activeTaxYear, setActiveTaxYear] = useState<number>(externalSelectedYear || 2025);

  // Automatic intake and checklist derived strictly from customer onboarding details & submitted documents
  const autoReconciled = useMemo(() => {
    return generateAutomaticClientChecklist(activeClient, clientSubmittedDocs, activeTaxYear);
  }, [activeClient, clientSubmittedDocs, activeTaxYear]);

  const [currentIntake, setCurrentIntake] = useState<IntakeResponses>(() => autoReconciled.intake);
  const [items, setItems] = useState<PersonalizedDocItem[]>(() => autoReconciled.items);

  // Synchronize when customer profile, tax year, or vault documents update automatically
  React.useEffect(() => {
    setCurrentIntake(autoReconciled.intake);
    setItems(autoReconciled.items);
  }, [autoReconciled]);

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [targetUploadDoc, setTargetUploadDoc] = useState<PersonalizedDocItem | null>(null);

  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [targetOcrDoc, setTargetOcrDoc] = useState<PersonalizedDocItem | null>(null);

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [targetOverrideDoc, setTargetOverrideDoc] = useState<PersonalizedDocItem | null>(null);

  // Filters & UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [showAllPossible, setShowAllPossible] = useState<boolean>(false);
  const [showMissingOnly, setShowMissingOnly] = useState<boolean>(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // "Does Not Apply" Explanation Drawer
  const [activeExplainId, setActiveExplainId] = useState<string | null>(null);
  const [explainText, setExplainText] = useState('');
  const [explainError, setExplainError] = useState<string | null>(null);

  // Audit & Action Notifications
  const [auditNotice, setAuditNotice] = useState<string | null>(null);

  // On-Page Tax Forms Intake & Availability State
  const [isIntakeOpen, setIsIntakeOpen] = useState<boolean>(true);
  const [intakeSearchQuery, setIntakeSearchQuery] = useState<string>('');
  const [intakeCategoryFilter, setIntakeCategoryFilter] = useState<string>('ALL');
  const [fullIntakeModalOpen, setFullIntakeModalOpen] = useState<boolean>(false);

  // Toggle individual standard tax form in intake
  const handleToggleFormIntake = (intakeKey: keyof IntakeResponses) => {
    const updatedIntake: IntakeResponses = {
      ...currentIntake,
      [intakeKey]: !currentIntake[intakeKey]
    };
    setCurrentIntake(updatedIntake);
    const baseItems = generatePersonalizedChecklist(updatedIntake, []);
    const reconciled = reconcileChecklistWithClientVaultDocs(baseItems, activeClient, clientSubmittedDocs, activeTaxYear);
    setItems(reconciled.reconciledItems);

    const formDef = ALL_STANDARD_TAX_FORMS.find(f => f.intakeKey === intakeKey);
    const isNowActive = !!updatedIntake[intakeKey];
    setAuditNotice(`${formDef ? formDef.formNumber : 'Tax form'} ${isNowActive ? 'enabled and added to' : 'removed from'} required checklist.`);
    setTimeout(() => setAuditNotice(null), 3000);
  };

  // Enable all 23 standard tax forms with one click
  const handleEnableAll23Forms = () => {
    const allEnabled: IntakeResponses = {
      ...currentIntake,
      hadW2Employment: true,
      hadFreelanceOrContract: true,
      received1099MISC: true,
      receivedInterest: true,
      receivedDividends: true,
      receivedInterestOrDividends: true,
      soldInvestments: true,
      received1099K: true,
      receivedRetirementDistributions: true,
      receivedGovernmentPayments: true,
      receivedSocialSecurity: true,
      hasPassThroughK1: true,
      hasMortgage: true,
      hasCollegeOrTuition: true,
      paysStudentLoanInterest: true,
      hasForeclosureOrAbandonment: true,
      hasCancelledDebt: true,
      hasCancelledDebtOrForeclosure: true,
      soldRealEstate: true,
      hasHSAorMSA: true,
      contributedToIRA: true,
      hasMarketplaceInsurance: true,
      hasLongTermCare: true,
      hasABLEAccount: true,
      hasEducationPlans: true,
      receivedUnemployment: true
    };
    setCurrentIntake(allEnabled);
    const baseItems = generatePersonalizedChecklist(allEnabled, []);
    const reconciled = reconcileChecklistWithClientVaultDocs(baseItems, activeClient, clientSubmittedDocs, activeTaxYear);
    setItems(reconciled.reconciledItems);
    setAuditNotice('All 23 standard federal and multi-state tax forms enabled in customer checklist.');
    setTimeout(() => setAuditNotice(null), 3500);
  };

  // Reset to onboarding profile defaults
  const handleResetToOnboarding = () => {
    const auto = generateAutomaticClientChecklist(activeClient, clientSubmittedDocs, activeTaxYear);
    setCurrentIntake(auto.intake);
    setItems(auto.items);
    setAuditNotice('Checklist reset to customer profile onboarding baseline.');
    setTimeout(() => setAuditNotice(null), 3500);
  };

  // Filtered intake forms list for on-page view
  const filteredIntakeForms = useMemo(() => {
    return ALL_STANDARD_TAX_FORMS.filter(form => {
      if (intakeCategoryFilter !== 'ALL' && form.category !== intakeCategoryFilter) {
        return false;
      }
      if (intakeSearchQuery.trim()) {
        const q = intakeSearchQuery.toLowerCase();
        const matchesNum = form.formNumber.toLowerCase().includes(q);
        const matchesTitle = form.title.toLowerCase().includes(q);
        const matchesCat = form.category.toLowerCase().includes(q);
        const matchesDesc = form.description.toLowerCase().includes(q);
        if (!matchesNum && !matchesTitle && !matchesCat && !matchesDesc) return false;
      }
      return true;
    });
  }, [intakeCategoryFilter, intakeSearchQuery]);

  const activeFormsCount = useMemo(() => {
    return ALL_STANDARD_TAX_FORMS.filter(f => !!currentIntake[f.intakeKey]).length;
  }, [currentIntake]);

  const intakeCategoriesList = useMemo(() => {
    const set = new Set<string>();
    ALL_STANDARD_TAX_FORMS.forEach(f => set.add(f.category));
    return Array.from(set);
  }, []);

  // Readiness scorecard
  const scorecard = useMemo(() => {
    return calculateReadinessScorecard(items, activeTaxYear, currentIntake.residenceState);
  }, [items, activeTaxYear, currentIntake.residenceState]);

  // State rules
  const stateRule = STATE_RULES_REGISTRY[currentIntake.residenceState] || STATE_RULES_REGISTRY.SC;

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Year matching
      if (item.taxYear !== activeTaxYear) return false;

      // Missing only quick toggle
      if (showMissingOnly) {
        if (item.status !== 'Missing' && item.status !== 'Rejected / Replace') return false;
      }

      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.formNumber.toLowerCase().includes(q) || item.title.toLowerCase().includes(q);
        const matchesPayer = item.ocrData?.payerName ? String(item.ocrData.payerName).toLowerCase().includes(q) : false;
        const matchesCategory = item.category.toLowerCase().includes(q);
        if (!matchesName && !matchesPayer && !matchesCategory) return false;
      }

      // Category filter
      if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;

      // Status filter
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;

      // Priority filter
      if (filterPriority !== 'ALL' && item.priority !== filterPriority) return false;

      // If showAllPossible is false, exclude items marked "Not Applicable" unless specifically filtered for
      if (!showAllPossible && filterStatus === 'ALL' && item.status === 'Not Applicable') {
        return false;
      }

      return true;
    });
  }, [items, activeTaxYear, searchQuery, filterCategory, filterStatus, filterPriority, showAllPossible, showMissingOnly]);

  // Categories list for filter dropdown
  const categoryList: DocumentCategory[] = useMemo(() => {
    const set = new Set<DocumentCategory>();
    items.forEach(i => set.add(i.category));
    return Array.from(set);
  }, [items]);

  // Handle client status change
  const handleClientStatusChange = (id: string, newStatus: DocumentStatus) => {
    if (newStatus === 'Not Applicable') {
      setActiveExplainId(id);
      setExplainError(null);
      const target = items.find(i => i.id === id);
      setExplainText(target?.notApplicableReason || '');
      return;
    }

    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: newStatus,
          notApplicableReason: undefined
        };
      }
      return item;
    }));

    setAuditNotice(`Item status updated to "${newStatus}". Audit log recorded.`);
    setTimeout(() => setAuditNotice(null), 3500);
  };

  // Handle saving "Does Not Apply" reason
  const handleSaveNotApplicable = (id: string) => {
    if (!explainText.trim()) {
      setExplainError('A brief statutory or factual reason is required when marking an item as "Does Not Apply".');
      return;
    }

    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: 'Not Applicable',
          notApplicableReason: explainText.trim(),
          accountantApproved: false
        };
      }
      return item;
    }));

    setActiveExplainId(null);
    setExplainText('');
    setExplainError(null);
    setAuditNotice('Explanation recorded. Item marked as "Does Not Apply" and flagged for accountant verification.');
    setTimeout(() => setAuditNotice(null), 4000);
  };

  // Upload handler
  const handleUploadSuccess = (
    docId: string,
    uploadedData: {
      fileName: string;
      fileSize: string;
      fileHash: string;
      confidenceScore: number;
      ocrData: Record<string, string | number>;
      taxYearMismatch?: boolean;
      mismatchDetectedYear?: number;
      possibleDuplicateOf?: string;
    }
  ) => {
    setItems(prev => prev.map(item => {
      if (item.id === docId) {
        const isMismatched = uploadedData.taxYearMismatch;
        return {
          ...item,
          status: isMismatched ? 'Needs Review' : 'Accepted',
          uploadedFileName: uploadedData.fileName,
          uploadedFileSize: uploadedData.fileSize,
          uploadedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
          fileHash: uploadedData.fileHash,
          confidenceScore: uploadedData.confidenceScore,
          confidenceTier: uploadedData.confidenceScore >= 95 ? 'High' : 'Medium',
          ocrData: uploadedData.ocrData,
          taxYearMismatch: uploadedData.taxYearMismatch,
          mismatchDetectedYear: uploadedData.mismatchDetectedYear,
          possibleDuplicateOf: uploadedData.possibleDuplicateOf,
          autoMatchedFromVault: true,
          accountantApproved: !isMismatched,
          reviewedBy: !isMismatched ? (activeClient.assignedReviewerName || 'Elena Rostova, CPA') : undefined,
          needsReviewReason: isMismatched
            ? `Tax Year Mismatch: Document detected for calendar year ${uploadedData.mismatchDetectedYear}, but filing year is CY${activeTaxYear}.`
            : undefined
        };
      }
      return item;
    }));

    // Keep central vault in sync
    try {
      demoDataStore.uploadDocument({
        clientId: activeClient.id,
        fileName: uploadedData.fileName,
        fileSize: uploadedData.fileSize,
        fileType: 'application/pdf',
        category: targetUploadDoc?.category || 'Tax Document',
        taxYear: activeTaxYear,
        uploadedBy: activeClient.name || 'Client'
      });
    } catch {
      // Ignore simulated persistence errors
    }

    setAuditNotice(`Document "${uploadedData.fileName}" uploaded, scanned, and indexed successfully.`);
    setTimeout(() => setAuditNotice(null), 4000);
  };

  // Professional override handler
  const handleApplyOverride = (docId: string, newStatus: DocumentStatus, reason: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === docId) {
        return {
          ...item,
          status: newStatus,
          professionalOverrideNote: reason,
          overriddenBy: 'Elena Rostova, CPA',
          overriddenAt: new Date().toISOString(),
          accountantApproved: newStatus === 'Accepted'
        };
      }
      return item;
    }));

    setAuditNotice(`Professional override logged by Elena Rostova, CPA: Status changed to "${newStatus}".`);
    setTimeout(() => setAuditNotice(null), 4500);
  };

  // Add Multi-Instance document (e.g. additional W-2 or 1099)
  const handleAddMultiInstance = (baseFormNumber: string) => {
    const existing = items.filter(i => i.formNumber === baseFormNumber && i.taxYear === activeTaxYear);
    const nextIndex = existing.length + 1;

    const newItem: PersonalizedDocItem = {
      id: `gen_${baseFormNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
      formNumber: baseFormNumber,
      title: `${baseFormNumber} (Additional Issuer #${nextIndex})`,
      category: existing[0]?.category || 'Employment',
      whyWeNeedIt: existing[0]?.whyWeNeedIt || 'Reports additional earned or investment income for tax year.',
      whereCanIFindIt: 'Obtain directly from the issuing employer, broker, or payer portal.',
      whyAmIAsked: 'Added manually to declare supplemental income source.',
      source: existing[0]?.source || 'Employer',
      appliesTo: 'Multi-State',
      stateCode: currentIntake.residenceState,
      taxYear: activeTaxYear,
      priority: 'Required',
      status: 'Missing',
      instanceIndex: nextIndex,
      totalInstances: nextIndex,
      isMultiInstanceAllowed: true
    };

    setItems(prev => [...prev, newItem]);
    setAuditNotice(`Added new instance for ${baseFormNumber} (Issuer #${nextIndex}).`);
    setTimeout(() => setAuditNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {onNavigateToCollectionWorkspace && (
        <div className="p-3 bg-neutral-900 text-white border border-neutral-700 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#D7AC4A] text-[#061A2F] text-[10px] font-mono font-bold rounded">
              Stage 02
            </span>
            <span className="text-neutral-200 font-medium">
              Tax-Year Collection Workspace active (Client ID, Engagement, Tax Year, and Return Type context).
            </span>
          </div>
          <button
            onClick={onNavigateToCollectionWorkspace}
            className="px-3 py-1 bg-[#D7AC4A] hover:bg-[#c49b3d] text-[#061A2F] rounded font-bold text-xs flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            <span>Open Stage 02 Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. CUSTOMER INFORMATION (AUTOMATIC STATE & ONBOARDING DETAILS)     */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-6 bg-[#061A2F] border-2 border-[#C99A32] text-[#F7F4ED] rounded-xl shadow-md">
        <div className="space-y-4">
          {/* Customer Header: Name, Business Name, Entity & Masked Tax ID */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/15 pb-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#E8C66A] font-bold block mb-1">
                Customer Profile
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#F7F4ED] flex items-center gap-2 flex-wrap">
                <span>{activeClient.name}</span>
                {activeClient.businessName && (
                  <span className="text-[#FAF9F5]/70 font-normal text-sm sm:text-base">
                    &bull; {activeClient.businessName}
                  </span>
                )}
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className="px-3 py-1 bg-[#0A2544] text-[#E8C66A] text-xs font-mono font-bold rounded-lg border border-[#C99A32]/60">
                {activeClient.entityType}
              </span>
              {activeClient.einOrSsnMasked && (
                <span className="px-3 py-1 bg-[#031323] text-[#FAF9F5]/90 text-xs font-mono rounded-lg border border-white/15">
                  Tax ID: {activeClient.einOrSsnMasked}
                </span>
              )}
            </div>
          </div>

          {/* Customer Details Grid: Address, Automatic State Jurisdiction, Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#FAF9F5]/60 block font-semibold mb-1">
                Physical / Mailing Address
              </span>
              <p className="text-[#F7F4ED] leading-relaxed font-medium">
                {activeClient.address}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#FAF9F5]/60 block font-semibold mb-1">
                Tax Jurisdiction / Filing State
              </span>
              <p className="text-[#E8C66A] font-bold text-sm">
                {activeClient.primaryJurisdiction}
              </p>
              {activeClient.secondaryJurisdictions && activeClient.secondaryJurisdictions.length > 0 && (
                <p className="text-[11px] text-[#FAF9F5]/70 mt-1">
                  Multi-State Filings: {activeClient.secondaryJurisdictions.join(', ')}
                </p>
              )}
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#FAF9F5]/60 block font-semibold mb-1">
                Contact Details
              </span>
              <p className="text-[#F7F4ED] font-medium">{activeClient.email}</p>
              <p className="text-[#FAF9F5]/80 mt-0.5">{activeClient.phone}</p>
              <p className="text-[11px] font-mono text-[#FAF9F5]/60 mt-1">Account Ref: {activeClient.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2B. TAX FORMS INTAKE & COMPREHENSIVE REQUIREMENTS SCOPE (ALL 23)   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-[#D8DCE2] rounded-xl shadow-xs overflow-hidden">
        {/* Header Bar */}
        <div className="p-5 bg-[#FAF9F5] border-b border-[#D8DCE2] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-1.5 bg-[#061A2F] text-[#E8C66A] rounded-lg">
                <SlidersHorizontal className="w-4 h-4" />
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[#061A2F]">
                Tax Forms Intake &amp; Document Availability
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#061A2F] text-[#E8C66A] border border-[#C99A32]/50">
                {activeFormsCount} of 23 Forms Active
              </span>
            </div>
            <p className="text-xs text-[#667085] max-w-2xl">
              All 23 standard tax forms are supported for this customer. Toggle forms directly to dynamically add or exclude them from the document requirements checklist below.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleEnableAll23Forms}
              className="px-3.5 py-1.5 bg-[#061A2F] hover:bg-[#0A2544] text-[#E8C66A] text-xs font-bold font-mono rounded-lg border border-[#C99A32]/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#E8C66A]" />
              Enable All 23 Forms
            </button>
            <button
              type="button"
              onClick={handleResetToOnboarding}
              className="px-3 py-1.5 bg-white hover:bg-[#F2EDE0] text-[#061A2F] text-xs font-semibold rounded-lg border border-[#D8DCE2] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#667085]" />
              Reset Baseline
            </button>
            <button
              type="button"
              onClick={() => setFullIntakeModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-[#F2EDE0] text-[#061A2F] text-xs font-semibold rounded-lg border border-[#D8DCE2] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C99A32]" />
              Intake Questions
            </button>
            <button
              type="button"
              onClick={() => setIsIntakeOpen(!isIntakeOpen)}
              className="px-2.5 py-1.5 bg-white hover:bg-[#F2EDE0] text-[#061A2F] text-xs font-medium rounded-lg border border-[#D8DCE2] transition-colors flex items-center gap-1 cursor-pointer"
              title={isIntakeOpen ? 'Collapse forms intake list' : 'Expand forms intake list'}
            >
              {isIntakeOpen ? (
                <>
                  <span>Hide Intake</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Show All 23 Forms</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expandable Intake Forms Grid */}
        {isIntakeOpen && (
          <div className="p-5 space-y-4">
            {/* Search and Category Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={intakeSearchQuery}
                  onChange={(e) => setIntakeSearchQuery(e.target.value)}
                  placeholder="Filter forms by code (W-2, 1099-NEC, 1098), title, or category..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF9F5] border border-[#D8DCE2] rounded-lg text-[#061A2F] placeholder-[#667085] focus:outline-hidden focus:border-[#C99A32] focus:bg-white transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-[#667085] uppercase tracking-wider font-semibold">
                  Category:
                </span>
                <select
                  value={intakeCategoryFilter}
                  onChange={(e) => setIntakeCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-[#FAF9F5] border border-[#D8DCE2] rounded-lg text-[#061A2F] font-medium focus:outline-hidden focus:border-[#C99A32] cursor-pointer"
                >
                  <option value="ALL">All Categories ({ALL_STANDARD_TAX_FORMS.length})</option>
                  {intakeCategoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Forms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {filteredIntakeForms.map((form) => {
                const isChecked = !!currentIntake[form.intakeKey];
                return (
                  <div
                    key={form.id}
                    onClick={() => handleToggleFormIntake(form.intakeKey)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isChecked
                        ? 'bg-white border-[#C99A32]/60 shadow-2xs hover:border-[#061A2F]'
                        : 'bg-[#FAF9F5]/70 border-[#D8DCE2] opacity-75 hover:opacity-100 hover:border-[#667085]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#667085] truncate">
                          {form.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                            isChecked
                              ? 'bg-[#061A2F] text-[#E8C66A] border-[#C99A32]'
                              : 'bg-white text-[#667085] border-[#D8DCE2]'
                          }`}
                        >
                          {form.formNumber}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-[#061A2F] leading-snug">
                          {form.title}
                        </h4>
                        <p className="text-[11px] text-[#475467] mt-1 leading-relaxed">
                          {form.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 mt-2 border-t border-[#D8DCE2]/60 flex items-center justify-between text-xs">
                      <span
                        className={`text-[11px] font-mono font-semibold flex items-center gap-1 ${
                          isChecked ? 'text-[#061A2F]' : 'text-[#667085]'
                        }`}
                      >
                        {isChecked ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#C99A32]" />
                            <span>Included in Checklist</span>
                          </>
                        ) : (
                          <span>Excluded</span>
                        )}
                      </span>

                      {/* Custom Toggle Switch */}
                      <div
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                          isChecked ? 'bg-[#061A2F]' : 'bg-[#D8DCE2]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-[#FAF9F5] shadow-xs transform transition-transform ${
                            isChecked ? 'translate-x-4 bg-[#E8C66A]' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. READINESS SCORECARD & WORKFLOW STAGE                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-6 bg-white border border-[#D8DCE2] rounded-xl shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-[#061A2F]">Tax Package Readiness &amp; Compliance Scorecard</h3>
              <span className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded border ${
                scorecard.filingWorkflowStage === 'Documents Complete'
                  ? 'bg-[#061A2F] text-[#E8C66A] border-[#C99A32]'
                  : scorecard.filingWorkflowStage === 'Professional Review'
                  ? 'bg-[#FAF9F5] text-[#061A2F] border-[#C99A32]'
                  : 'bg-[#FAF9F5] text-[#061A2F] border-[#D8DCE2]'
              }`}>
                Stage: {scorecard.filingWorkflowStage}
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-1">
              Readiness is calculated strictly across applicable items for Tax Year {activeTaxYear}. Items marked "Does Not Apply" are excluded from denominator.
            </p>
          </div>

          {/* Tax Year Selector */}
          <div className="flex items-center gap-1.5 bg-[#FAF9F5] p-1 rounded-lg border border-[#D8DCE2]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#667085] px-2 font-semibold">
              Tax Year:
            </span>
            {[2026, 2025, 2024, 2023].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setActiveTaxYear(yr)}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeTaxYear === yr
                    ? 'bg-[#061A2F] text-[#E8C66A] shadow-xs'
                    : 'text-[#061A2F] hover:bg-[#F2EDE0]'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Progress Meters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Federal Readiness */}
          <div className="p-4 bg-[#FAF9F5] rounded-xl border border-[#D8DCE2] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#061A2F]">Federal Readiness (Form 1040)</span>
              <span className="font-mono font-bold text-[#061A2F]">{scorecard.federalReadinessPct}%</span>
            </div>
            <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div
                className="bg-[#061A2F] h-full transition-all duration-300"
                style={{ width: `${scorecard.federalReadinessPct}%` }}
              />
            </div>
            <div className="text-[11px] text-[#667085] flex justify-between font-mono">
              <span>Required items: {scorecard.requiredReceived} of {scorecard.requiredTotal}</span>
              <span>Missing: {scorecard.requiredMissing}</span>
            </div>
          </div>

          {/* State Readiness */}
          <div className="p-4 bg-[#FAF9F5] rounded-xl border border-[#D8DCE2] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#061A2F]">
                {stateRule.name} ({currentIntake.residenceState}) Readiness
              </span>
              <span className="font-mono font-bold text-[#061A2F]">
                {!stateRule.hasIndividualIncomeTax ? '100% (No Tax)' : `${scorecard.stateReadinessPct}%`}
              </span>
            </div>
            <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div
                className="bg-[#061A2F] h-full transition-all duration-300"
                style={{ width: `${!stateRule.hasIndividualIncomeTax ? 100 : scorecard.stateReadinessPct}%` }}
              />
            </div>
            <div className="text-[11px] text-[#667085] flex justify-between font-mono">
              <span>Return: {stateRule.returnFormName}</span>
              <span>Agency: {currentIntake.residenceState}</span>
            </div>
          </div>

          {/* Overall Tax Package Readiness */}
          <div className="p-4 bg-[#FAF9F5] rounded-xl border border-[#D8DCE2] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#061A2F]">Overall Intake Fulfillment</span>
              <span className="font-mono font-bold text-[#C99A32]">{scorecard.overallReadinessPct}%</span>
            </div>
            <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div
                className="bg-[#C99A32] h-full transition-all duration-300"
                style={{ width: `${scorecard.overallReadinessPct}%` }}
              />
            </div>
            <div className="text-[11px] text-[#667085] flex justify-between font-mono">
              <span>Total Applicable: {scorecard.totalApplicable}</span>
              <span>Verified / Accepted: {scorecard.receivedOrAccepted}</span>
            </div>
          </div>
        </div>

        {/* Status Counter Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-[#D8DCE2] text-xs">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FAF9F5] border border-[#C99A32] text-[#061A2F]">
            <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
            <span className="font-medium">{scorecard.receivedOrAccepted} Accepted</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FAF9F5] border border-[#061A2F] text-[#061A2F]">
            <AlertCircle className="w-4 h-4 text-[#061A2F]" />
            <span className="font-medium">{scorecard.requiredMissing} Required Missing</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FAF9F5] border border-[#D8DCE2] text-[#061A2F]">
            <Clock className="w-4 h-4 text-[#667085]" />
            <span className="font-medium">{scorecard.needsReviewCount} Needs Review</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBFAF7] border border-[#D8DCE2] text-[#4A5568]">
            <HelpCircle className="w-4 h-4 text-[#667085]" />
            <span className="font-medium">{scorecard.optionalMissing} Optional Missing</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBFAF7] border border-[#D8DCE2] text-[#667085]">
            <XCircle className="w-4 h-4 text-[#667085]" />
            <span className="font-medium">{items.filter(i => i.status === 'Not Applicable').length} Not Applicable</span>
          </div>
        </div>
      </div>

      {/* Audit Toast Notice */}
      {auditNotice && (
        <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded-lg text-xs font-medium text-[#061A2F] flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#C99A32] flex-shrink-0" />
          <span>{auditNotice}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. SEARCH, FILTERS & CONTROLS BAR                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-4 bg-white border border-[#D8DCE2] rounded-xl space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#667085] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search forms, issuers, categories (e.g., W-2, Schwab, 1095-A)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-[#D8DCE2] rounded-lg bg-[#FAF9F5] text-[#061A2F] focus:bg-white focus:outline-hidden focus:border-[#C99A32]"
            />
          </div>

          {/* Quick Filter Buttons & Multi-Instance Adder */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMissingOnly(!showMissingOnly)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                showMissingOnly
                  ? 'bg-[#061A2F] text-[#E8C66A] border border-[#061A2F]'
                  : 'bg-[#FAF9F5] text-[#061A2F] hover:bg-[#F2EDE0] border border-[#D8DCE2]'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Missing Only</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAllPossible(!showAllPossible)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                showAllPossible
                  ? 'bg-[#061A2F] text-[#E8C66A] border border-[#061A2F]'
                  : 'bg-[#FAF9F5] text-[#061A2F] hover:bg-[#F2EDE0] border border-[#D8DCE2]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Show All Library Forms</span>
            </button>

            {/* Add instance dropdown */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAddMultiInstance('Form W-2')}
                className="px-2.5 py-1.5 bg-[#061A2F] text-white text-xs font-semibold rounded-lg hover:bg-[#0A2544] border border-[#C99A32]/40 flex items-center gap-1 cursor-pointer"
                title="Add second W-2 employer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#E8C66A]" />
                <span>+ W-2</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddMultiInstance('Form 1099-NEC')}
                className="px-2.5 py-1.5 bg-[#061A2F] text-white text-xs font-semibold rounded-lg hover:bg-[#0A2544] border border-[#C99A32]/40 flex items-center gap-1 cursor-pointer"
                title="Add second 1099-NEC payer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#E8C66A]" />
                <span>+ 1099-NEC</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddMultiInstance('Schedule K-1')}
                className="px-2.5 py-1.5 bg-[#061A2F] text-white text-xs font-semibold rounded-lg hover:bg-[#0A2544] border border-[#C99A32]/40 flex items-center gap-1 cursor-pointer"
                title="Add second Schedule K-1 entity"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#E8C66A]" />
                <span>+ K-1</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#D8DCE2] text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[#061A2F]">
            <Filter className="w-3.5 h-3.5 text-[#667085]" />
            <span>Filter By:</span>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white text-[#061A2F] text-xs focus:border-[#C99A32]"
          >
            <option value="ALL">All Categories</option>
            {categoryList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white text-[#061A2F] text-xs focus:border-[#C99A32]"
          >
            <option value="ALL">All Statuses</option>
            <option value="Missing">Missing</option>
            <option value="Accepted">Accepted</option>
            <option value="Needs Review">Needs Review</option>
            <option value="Awaiting Client">Awaiting Client</option>
            <option value="Awaiting Tax Professional">Awaiting Tax Professional</option>
            <option value="Not Applicable">Not Applicable</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 border border-[#D8DCE2] rounded-md bg-white text-[#061A2F] text-xs focus:border-[#C99A32]"
          >
            <option value="ALL">All Priorities</option>
            <option value="Required">Required Only</option>
            <option value="Required if applicable">Required if applicable</option>
            <option value="Recommended">Recommended</option>
            <option value="Optional">Optional</option>
          </select>

          <span className="text-[#667085] font-mono text-[11px] ml-auto">
            Displaying {filteredItems.length} documents for CY{activeTaxYear}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. DOCUMENT CARDS LIST                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-white border border-[#D8DCE2] rounded-xl text-[#667085] text-xs">
            No tax documents match the current filter criteria for Tax Year {activeTaxYear}.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isAccepted = item.status === 'Accepted';
            const isMissing = item.status === 'Missing';
            const isNeedsReview = item.status === 'Needs Review';
            const isNotApplicable = item.status === 'Not Applicable';

            return (
              <div
                key={item.id}
                className={`p-5 bg-white border rounded-xl transition-all shadow-2xs ${
                  isAccepted
                    ? 'border-[#C99A32] bg-[#FAF9F5]/40'
                    : isNeedsReview
                    ? 'border-[#D8DCE2] bg-[#FBFAF7]'
                    : isMissing && item.priority === 'Required'
                    ? 'border-[#061A2F] bg-white'
                    : isNotApplicable
                    ? 'border-[#D8DCE2] bg-[#FBFAF7]/60 opacity-75'
                    : 'border-[#D8DCE2] hover:border-[#C99A32]/60'
                }`}
              >
                {/* Possible Duplicate Alert Banner */}
                {item.possibleDuplicateOf && (
                  <div className="mb-3 p-2.5 bg-[#FAF9F5] border border-[#C99A32] rounded-lg text-xs text-[#061A2F] flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#C99A32] flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>POSSIBLE DUPLICATE DETECTED:</strong> This upload matches an existing record. Both documents are retained in custody for professional review.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, possibleDuplicateOf: undefined } : i));
                      }}
                      className="text-[11px] font-bold text-[#061A2F] hover:text-[#C99A32] underline flex-shrink-0 cursor-pointer"
                    >
                      Dismiss Warning
                    </button>
                  </div>
                )}

                {/* Tax Year Mismatch Warning Banner */}
                {item.taxYearMismatch && (
                  <div className="mb-3 p-2.5 bg-[#FAF9F5] border border-[#061A2F] rounded-lg text-xs text-[#061A2F] flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#061A2F] flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>TAX YEAR MISMATCH:</strong> Scanned file indicates calendar year {item.mismatchDetectedYear}, but active filing is CY{item.taxYear}. Flagged for accountant review.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, taxYearMismatch: false } : i));
                      }}
                      className="text-[11px] font-bold text-[#061A2F] hover:underline flex-shrink-0 cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Column: Form Details */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Form Code */}
                      <span className="px-2.5 py-0.5 text-xs font-bold font-mono bg-[#FAF9F5] text-[#061A2F] border border-[#D8DCE2] rounded-md">
                        {item.formNumber}
                      </span>

                      {/* Multi-instance index */}
                      {item.instanceIndex && (
                        <span className="px-2 py-0.5 text-[10px] font-mono bg-[#061A2F] text-[#E8C66A] rounded">
                          #{item.instanceIndex}
                        </span>
                      )}

                      {/* Priority Badge */}
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${
                        item.priority === 'Required'
                          ? 'bg-[#061A2F] text-[#F7F4ED] border border-[#061A2F]'
                          : item.priority === 'Required if applicable'
                          ? 'bg-[#FAF9F5] text-[#061A2F] border border-[#C99A32]'
                          : 'bg-[#FBFAF7] text-[#667085] border border-[#D8DCE2]'
                      }`}>
                        {item.priority}
                      </span>

                      {/* Status Badge */}
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1 ${
                        isAccepted
                          ? 'bg-[#FAF9F5] text-[#061A2F] border border-[#C99A32]'
                          : isNeedsReview
                          ? 'bg-[#FAF9F5] text-[#061A2F] border border-[#D8DCE2]'
                          : isMissing
                          ? 'bg-[#FBFAF7] text-[#061A2F] border border-[#061A2F]'
                          : isNotApplicable
                          ? 'bg-[#FBFAF7] text-[#667085] border border-[#D8DCE2]'
                          : 'bg-[#FAF9F5] text-[#061A2F] border border-[#D8DCE2]'
                      }`}>
                        {isAccepted && <CheckCircle2 className="w-3 h-3 text-[#C99A32]" />}
                        {isMissing && <AlertCircle className="w-3 h-3 text-[#061A2F]" />}
                        {isNeedsReview && <Clock className="w-3 h-3 text-[#C99A32]" />}
                        <span>{item.status}</span>
                      </span>

                      {/* Auto-Matched from Client Vault Badge */}
                      {item.autoMatchedFromVault && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#061A2F] text-[#E8C66A] border border-[#C99A32]/60 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-[#E8C66A]" />
                          Auto-Reconciled from Vault
                        </span>
                      )}

                      {/* Jurisdiction */}
                      <span className="px-2 py-0.5 text-[10px] font-mono bg-[#FAF9F5] text-[#4A5568] border border-[#D8DCE2] rounded">
                        Applies to: {item.appliesTo}
                      </span>

                      {/* Source */}
                      <span className="px-2 py-0.5 text-[10px] text-[#667085] font-mono">
                        Source: {item.source}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-bold text-[#061A2F]">
                      {item.title}
                    </h4>

                    {/* Plain Language "WHY WE NEED IT" */}
                    <p className="text-xs text-[#4A5568] leading-relaxed">
                      <strong className="text-[#061A2F]">Why we need it: </strong>
                      {item.whyWeNeedIt}
                    </p>

                    {/* Where to find it */}
                    <p className="text-xs text-[#667085]">
                      <strong className="text-[#061A2F]">Where to find it: </strong>
                      {item.whereCanIFindIt}
                    </p>

                    {/* Trigger: "WHY AM I BEING ASKED FOR THIS?" */}
                    <div className="p-2.5 bg-[#FAF9F5] border border-[#D8DCE2] rounded-lg text-xs text-[#4A5568] flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-[#061A2F] flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-[#061A2F]">Why am I being asked for this? </span>
                        <span>{item.whyAmIAsked}</span>
                      </div>
                    </div>

                    {/* Uploaded File Info & AI Sorter Meta */}
                    {item.uploadedFileName && (
                      <div className="p-2.5 bg-[#FAF9F5] border border-[#D8DCE2] rounded-lg space-y-1 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[#061A2F] font-medium">
                            <FileText className="w-4 h-4 text-[#C99A32] flex-shrink-0" />
                            <span>
                              {item.autoMatchedFromVault ? 'Vault File Auto-Matched: ' : 'Linked file: '}
                              <strong>{item.uploadedFileName}</strong> ({item.uploadedFileSize || '1.2 MB'})
                            </span>
                          </div>
                          {item.confidenceScore && (
                            <span className="text-[11px] font-mono font-bold text-[#E8C66A] bg-[#061A2F] px-2 py-0.5 rounded border border-[#C99A32]/40">
                              AI Classification: {item.confidenceScore}% Confidence ({item.confidenceTier})
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#667085] font-mono pt-1">
                          <span>Uploaded: {item.uploadedDate || '2026-02-14'} &bull; Hash: {item.fileHash || 'sha256_verified'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetOcrDoc(item);
                              setOcrModalOpen(true);
                            }}
                            className="text-[#061A2F] hover:text-[#C99A32] font-bold underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-[#C99A32]" />
                            <span>View Extracted Tax Boxes (OCR)</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reviewer Note if Overridden or Reviewed */}
                    {item.professionalOverrideNote && (
                      <div className="p-2.5 bg-[#FAF9F5] border border-[#C99A32] rounded-lg text-xs text-[#061A2F] space-y-0.5">
                        <div className="font-bold flex items-center gap-1.5 text-[#061A2F]">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#C99A32]" />
                          <span>Accountant Sign-Off ({item.overriddenBy || 'Elena Rostova, CPA'}):</span>
                        </div>
                        <div className="italic text-[#4A5568]">"{item.professionalOverrideNote}"</div>
                      </div>
                    )}

                    {/* Taxpayer "Does Not Apply" Note */}
                    {isNotApplicable && item.notApplicableReason && (
                      <div className="p-2.5 bg-[#FAF9F5] border border-[#D8DCE2] rounded-lg text-xs text-[#061A2F]">
                        <strong className="text-[#061A2F]">Taxpayer Exemption Statement: </strong>
                        <span className="italic text-[#4A5568]">{item.notApplicableReason}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {/* Status Selector */}
                    <div className="w-full sm:w-auto text-left">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-[#667085] font-semibold block mb-1">
                        Client Response:
                      </label>
                      <select
                        value={item.status}
                        onChange={(e) => handleClientStatusChange(item.id, e.target.value as DocumentStatus)}
                        className="w-full px-3 py-1.5 border border-[#D8DCE2] bg-white rounded-lg text-xs font-semibold text-[#061A2F] shadow-2xs focus:border-[#C99A32]"
                      >
                        <option value="Accepted">Uploaded / Verified</option>
                        <option value="Awaiting Client">Will Upload Later</option>
                        <option value="Missing">Not Received Yet</option>
                        <option value="Needs Review">Need Help / Review</option>
                        <option value="Not Applicable">Does Not Apply</option>
                      </select>
                    </div>

                    {/* Upload & Scanner Buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetUploadDoc(item);
                          setUploadModalOpen(true);
                        }}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-[#061A2F] hover:bg-[#0A2544] text-[#E8C66A] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-[#E8C66A]" />
                        <span>{item.uploadedFileName ? 'Replace' : 'Upload / Scan'}</span>
                      </button>

                      {/* Preparer Override Trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setTargetOverrideDoc(item);
                          setOverrideModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 border border-[#D8DCE2] hover:bg-[#FAF9F5] text-[#061A2F] text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer"
                        title="Accountant Status Override & Audit Logging"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#C99A32]" />
                        <span className="hidden sm:inline font-semibold">Override</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* "Does Not Apply" Reason Input Drawer */}
                {activeExplainId === item.id && (
                  <div className="mt-4 p-4 bg-[#FAF9F5] border border-[#D8DCE2] rounded-xl space-y-3">
                    <div className="text-xs font-bold text-[#061A2F] flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-[#061A2F]" />
                      <span>Document Why "{item.formNumber}" Does Not Apply for CY{activeTaxYear}:</span>
                    </div>
                    {explainError && (
                      <div className="p-2 bg-[#FAF9F5] border border-[#061A2F] text-[#061A2F] text-xs rounded font-medium">
                        {explainError}
                      </div>
                    )}
                    <textarea
                      value={explainText}
                      onChange={(e) => setExplainText(e.target.value)}
                      placeholder="e.g., Sold this property in CY2024, closed account with zero activity, or had no distributions."
                      className="w-full px-3 py-2 text-xs border border-[#D8DCE2] rounded-lg bg-white text-[#061A2F] focus:border-[#C99A32] focus:outline-hidden"
                      rows={2}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveExplainId(null)}
                        className="px-3 py-1.5 text-xs border border-[#D8DCE2] rounded-lg hover:bg-[#F2EDE0] text-[#061A2F] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveNotApplicable(item.id)}
                        className="px-3 py-1.5 text-xs bg-[#061A2F] text-[#E8C66A] font-bold rounded-lg hover:bg-[#0A2544] cursor-pointer"
                      >
                        Submit Reason for Accountant Sign-off
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 6. MODALS                                                          */}
      {/* ------------------------------------------------------------------ */}
      <SmartUploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setTargetUploadDoc(null);
        }}
        targetDoc={targetUploadDoc}
        selectedTaxYear={activeTaxYear}
        allExistingDocs={items}
        onUploadSuccess={handleUploadSuccess}
      />

      <OcrInspectionModal
        isOpen={ocrModalOpen}
        onClose={() => {
          setOcrModalOpen(false);
          setTargetOcrDoc(null);
        }}
        doc={targetOcrDoc}
      />

      <ProfessionalOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => {
          setOverrideModalOpen(false);
          setTargetOverrideDoc(null);
        }}
        doc={targetOverrideDoc}
        onApplyOverride={handleApplyOverride}
      />

      <IntakeQuestionnaireModal
        isOpen={fullIntakeModalOpen}
        onClose={() => setFullIntakeModalOpen(false)}
        currentIntake={currentIntake}
        onSaveIntake={(updatedIntake) => {
          setCurrentIntake(updatedIntake);
          const baseItems = generatePersonalizedChecklist(updatedIntake, []);
          const reconciled = reconcileChecklistWithClientVaultDocs(baseItems, activeClient, clientSubmittedDocs, activeTaxYear);
          setItems(reconciled.reconciledItems);
          setAuditNotice('Checklist requirements updated from intake questionnaire.');
          setTimeout(() => setAuditNotice(null), 3000);
        }}
      />
    </div>
  );
};
