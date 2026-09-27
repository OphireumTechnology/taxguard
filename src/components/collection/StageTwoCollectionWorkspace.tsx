/**
 * A/R Tax Services, LLC - Stage 02 Collection Workspace
 * Unified 18-Stage Tax Operating Workflow — Milestone M2 / Stage 02: Collect
 *
 * Implements:
 * - TG-COL-001: Centralized Tax-Year Collection Workspace
 *   Organized around: Client ID + Engagement + Tax Year + Entity/Return Type
 *   Access to: Document Checklist, Upload Center, Document Vault, Missing Documents,
 *              Document Requests, Processing Status, Exceptions, Human Review, Collection Readiness.
 * - TG-COL-002: Dynamic Rules-Driven Document Checklist Integration with Stable Requirement IDs
 * - TG-COL-003: Secure Upload Center Integration with SHA-256 Hashing, Unique Document IDs, & Audit Logging
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  UploadCloud,
  FolderLock,
  AlertCircle,
  Inbox,
  Sparkles,
  Eye,
  ShieldCheck,
  Building2,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  FileText,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Hash,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  Info,
  Layers,
  Camera,
  X,
  Plus,
  GitBranch,
  Edit3,
  Tag,
  Ban,
  Check
} from 'lucide-react';

import {
  StageTwoCollectionService,
  ChecklistRequirement,
  StageTwoUploadedDocument,
  CollectionReadinessReport,
  TaxYearCollectionWorkspaceContext,
  CollectionDocumentStatus
} from '../../services/stageTwoCollectionService';
import { StagedSecurityDocument } from '../../services/stageTwoIntakeSecurityService';
import {
  DocumentIntelligenceRecord,
  HumanReviewQueueItem,
  HumanReviewAction,
  TaxDocumentCategory,
  CONTROLLED_TAX_CATEGORIES,
  ExtractedFieldProvenance
} from '../../services/stageTwoDocumentIntelligenceService';

import { StageTwoMissingDocumentsView } from './StageTwoMissingDocumentsView';
import { StageTwoDocumentRequestsView } from './StageTwoDocumentRequestsView';
import { StageTwoExceptionsView } from './StageTwoExceptionsView';
import { StageTwoExitGateView } from './StageTwoExitGateView';
import { StageTwoCollectionOperationsService } from '../../services/stageTwoCollectionOperationsService';
import { StageThreeValidationWorkspace } from '../validation/StageThreeValidationWorkspace';
import { UploadScanCenterSection } from '../../demo/views/client/UploadScanCenterSection';
import { ClientVaultSection } from '../../demo/views/client/ClientVaultSection';
import { MissingDocumentsSection } from '../../demo/views/client/MissingDocumentsSection';
import { ClientDocumentRequestsView } from '../../demo/views/client/ClientSubViews';
import { AccountantReviewStatusSection } from '../../demo/views/client/AccountantReviewStatusSection';
import { DemoVaultService } from '../../demo/services/clientDashboardServices';

interface StageTwoCollectionWorkspaceProps {
  clientId?: string;
  selectedTaxYear: number;
  onTaxYearChange?: (year: number) => void;
  initialSubTab?: 'checklist' | 'upload' | 'vault' | 'missing' | 'requests' | 'processing' | 'security' | 'exceptions' | 'review' | 'readiness';
  onOpenAssistant?: () => void;

  /*
   * LIVE server-authoritative workflow controls.
   *
   * These default to false/undefined for legacy or DEMO
   * consumers so no existing caller gains new authority.
   */
  serverStageThreeEligible?: boolean;
  onServerWorkflowRefresh?: () => void;
}

export const StageTwoCollectionWorkspace: React.FC<StageTwoCollectionWorkspaceProps> = ({
  clientId: propClientId,
  selectedTaxYear,
  onTaxYearChange,
  initialSubTab = 'checklist',
  onOpenAssistant,
  serverStageThreeEligible = false,
  onServerWorkflowRefresh
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'checklist' | 'upload' | 'vault' | 'missing' | 'requests' | 'processing' | 'security' | 'exceptions' | 'review' | 'readiness'
  >(initialSubTab);
  const [showStageThree, setShowStageThree] = useState(false);

  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Direct Upload Modal State (TG-COL-003)
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [targetRequirement, setTargetRequirement] = useState<ChecklistRequirement | null>(null);
  const [targetReqForRequest, setTargetReqForRequest] = useState<ChecklistRequirement | null>(null);
  const [uploadCategory, setUploadCategory] = useState('Tax Return & Supporting Schedule');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);

  // Reusable vault service
  const vaultService = useMemo(() => new DemoVaultService(), []);

  // 1. Resolve Workspace Context (TG-COL-001)
  const context = useMemo<TaxYearCollectionWorkspaceContext>(() => {
    return StageTwoCollectionService.getWorkspaceContext(propClientId, selectedTaxYear);
  }, [propClientId, selectedTaxYear, workspaceVersion]);

  // 2. Fetch Requirements & Readiness (TG-COL-002)
  const requirements = useMemo<ChecklistRequirement[]>(() => {
    return StageTwoCollectionService.getRequirements(context.clientId, context.taxYear);
  }, [context.clientId, context.taxYear, workspaceVersion]);

  const readiness = useMemo<CollectionReadinessReport>(() => {
    return StageTwoCollectionService.evaluateCollectionReadiness(context.clientId, context.taxYear);
  }, [context.clientId, context.taxYear, workspaceVersion]);

  const uploadedDocs = useMemo<StageTwoUploadedDocument[]>(() => {
    return StageTwoCollectionService.getUploadedDocuments(context.clientId, context.taxYear);
  }, [context.clientId, context.taxYear, workspaceVersion]);

  // Sprint 2 Security & Quarantine Docs
  const stagedDocs = useMemo<StagedSecurityDocument[]>(() => {
    return StageTwoCollectionService.getStagedSecurityDocuments(context.clientId, context.taxYear);
  }, [context.clientId, context.taxYear, workspaceVersion]);

  const quarantinedDocs = useMemo<StagedSecurityDocument[]>(() => {
    return StageTwoCollectionService.getQuarantinedDocuments(context.clientId);
  }, [context.clientId, workspaceVersion]);

  // Sprint 4 Operational State
  const sprintFourExceptions = useMemo(() => {
    return StageTwoCollectionOperationsService.getExceptions(context.clientId, context.taxYear);
  }, [context.clientId, context.taxYear, workspaceVersion]);

  const openExceptionsCount = useMemo(() => {
    return sprintFourExceptions.filter(e => e.status === 'OPEN' || e.status === 'REOPENED' || e.status === 'UNDER_REVIEW').length;
  }, [sprintFourExceptions]);

  const sprintFourRequests = useMemo(() => {
    return StageTwoCollectionOperationsService.getDocumentRequests(context.clientId, context.taxYear);
  }, [context.clientId, context.taxYear, workspaceVersion]);

  const openRequestsCount = useMemo(() => {
    return sprintFourRequests.filter(r => r.status === 'OPEN' || r.status === 'IN_PROGRESS').length;
  }, [sprintFourRequests]);

  // Quarantine disposition state (TG-COL-008)
  const [selectedQuarantineDoc, setSelectedQuarantineDoc] = useState<StagedSecurityDocument | null>(null);
  const [dispositionReason, setDispositionReason] = useState('');
  const [dispositionRole, setDispositionRole] = useState<'admin' | 'cpa' | 'compliance'>('cpa');
  const [dispositionStatusMessage, setDispositionStatusMessage] = useState<string | null>(null);

  const handleDisposition = (disposition: 'CLEARED' | 'REJECTED' | 'DELETED_DISPOSED') => {
    if (!selectedQuarantineDoc) return;
    if (!dispositionReason.trim()) {
      alert('A compliance or operational justification is required to disposition quarantined files.');
      return;
    }
    try {
      StageTwoCollectionService.dispositionQuarantinedDocument({
        documentId: selectedQuarantineDoc.documentId,
        actor: `Staff User (${dispositionRole.toUpperCase()})`,
        actorRole: dispositionRole,
        disposition,
        reason: dispositionReason
      });
      setDispositionStatusMessage(`Document ${selectedQuarantineDoc.documentId} marked as ${disposition}.`);
      setSelectedQuarantineDoc(null);
      setDispositionReason('');
      setWorkspaceVersion(v => v + 1);
      setTimeout(() => setDispositionStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Disposition failed: ${err.message}`);
    }
  };

  // Sprint 3: Document Intelligence Review Queue & Actions
  const reviewQueue = useMemo<HumanReviewQueueItem[]>(() => {
    return StageTwoCollectionService.getHumanReviewQueue(context.clientId, context.taxYear, 'cpa');
  }, [context.clientId, context.taxYear, workspaceVersion]);

  const [selectedReviewItem, setSelectedReviewItem] = useState<HumanReviewQueueItem | null>(null);
  const [reviewAction, setReviewAction] = useState<HumanReviewAction>('ACCEPT');
  const [reviewRole, setReviewRole] = useState<'cpa' | 'preparer' | 'compliance' | 'admin'>('cpa');
  const [reviewJustification, setReviewJustification] = useState('');
  const [fieldCorrectionKey, setFieldCorrectionKey] = useState('');
  const [fieldCorrectionValue, setFieldCorrectionValue] = useState('');
  const [reclassifiedCategory, setReclassifiedCategory] = useState<TaxDocumentCategory>('W-2');
  const [reviewStatusMessage, setReviewStatusMessage] = useState<string | null>(null);

  const handleExecuteReviewAction = () => {
    if (!selectedReviewItem) return;
    if (!reviewJustification.trim()) {
      alert('A justification or operational explanation is required to complete this human review action.');
      return;
    }
    if (reviewAction === 'CORRECT' && (!fieldCorrectionKey.trim() || !fieldCorrectionValue.trim())) {
      alert('A correction requires both the source field key and the human-verified replacement value.');
      return;
    }

    try {
      const corrections: Record<string, any> = {};
      if (reviewAction === 'CORRECT' && fieldCorrectionKey.trim()) {
        corrections[fieldCorrectionKey.trim()] = fieldCorrectionValue;
      }

      StageTwoCollectionService.executeHumanReviewAction({
        documentId: selectedReviewItem.documentId,
        actor: `Staff Reviewer (${reviewRole.toUpperCase()})`,
        actorRole: reviewRole,
        action: reviewAction,
        justification: reviewJustification,
        fieldCorrections: Object.keys(corrections).length > 0 ? corrections : undefined,
        reclassifiedCategory: reviewAction === 'RECLASSIFY' ? reclassifiedCategory : undefined
      });

      setReviewStatusMessage(`Document ${selectedReviewItem.documentId} review action [${reviewAction}] completed.`);
      setSelectedReviewItem(null);
      setReviewJustification('');
      setFieldCorrectionKey('');
      setFieldCorrectionValue('');
      setWorkspaceVersion(v => v + 1);
      setTimeout(() => setReviewStatusMessage(null), 3500);
    } catch (err: any) {
      alert(`Review action failed: ${err.message}`);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    requirements.forEach(r => set.add(r.category));
    return Array.from(set).sort();
  }, [requirements]);

  // Filtered requirements
  const filteredRequirements = useMemo(() => {
    return requirements.filter(r => {
      const matchSearch =
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.formNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.requirementId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        selectedStatusFilter === 'ALL' || r.status === selectedStatusFilter;

      const matchCategory =
        selectedCategoryFilter === 'ALL' || r.category === selectedCategoryFilter;

      return matchSearch && matchStatus && matchCategory;
    });
  }, [requirements, searchQuery, selectedStatusFilter, selectedCategoryFilter]);

  // Handle requirement status update
  const handleStatusChange = (reqId: string, newStatus: CollectionDocumentStatus) => {
    StageTwoCollectionService.updateRequirementStatus(
      context.clientId,
      context.taxYear,
      reqId,
      newStatus,
      'client',
      'Status manually toggled in Collection Workspace'
    );
    setWorkspaceVersion(v => v + 1);
  };

  // Handle opening upload for specific requirement
  const handleOpenUploadForReq = (req: ChecklistRequirement) => {
    setTargetRequirement(req);
    setUploadCategory(req.category);
    setUploadFile(null);
    setUploadErrorMessage(null);
    setUploadSuccessMessage(null);
    setUploadModalOpen(true);
  };

  // Submit direct upload (TG-COL-003)
  const handleExecuteUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadErrorMessage('Please select a file to upload.');
      return;
    }

    setIsSubmittingUpload(true);
    setUploadErrorMessage(null);

    try {
      const ingested = await StageTwoCollectionService.ingestDocumentUpload({
        clientId: context.clientId,
        engagementId: context.engagementId,
        taxYear: context.taxYear,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client Portal User',
        originalFileName: uploadFile.name,
        fileSizeBytes: uploadFile.size,
        mimeType: uploadFile.type || 'application/pdf',
        claimedCategory: uploadCategory,
        associatedRequirementId: targetRequirement ? targetRequirement.requirementId : undefined,
        file: uploadFile
      });

      setUploadSuccessMessage(
        `Successfully ingested file with Document ID: ${ingested.documentId}. SHA-256: ${ingested.sha256Hash.substring(0, 12)}... (Status: Received — Awaiting Staff Verification)`
      );
      setUploadFile(null);
      setWorkspaceVersion(v => v + 1);

      setTimeout(() => {
        setUploadModalOpen(false);
        setUploadSuccessMessage(null);
      }, 2000);
    } catch (err: any) {
      setUploadErrorMessage(err.message || 'Failed to ingest document.');
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  if (
    showStageThree &&
    serverStageThreeEligible
  ) {
    return (
      <StageThreeValidationWorkspace
        clientId={context.clientId}
        selectedTaxYear={context.taxYear}
        onTaxYearChange={onTaxYearChange}
        userRole="client"
        onOpenAssistant={onOpenAssistant}
        onNavigateToStageTwo={() => {
          setShowStageThree(false);
          onServerWorkflowRefresh?.();
        }}
      />
    );
  }

  return (
    <div className="space-y-6" id="stage-two-collection-workspace">
      {/* ========================================================================= */}
      {/* 1. TOP CONTEXT BAR: Client ID + Engagement + Tax Year + Entity/Return Type */}
      {/* ========================================================================= */}
      <div className="bg-[#061A2F] text-white border border-[#1A365D] rounded-xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-[#D7AC4A] text-[#061A2F] rounded-xs uppercase tracking-wider">
                Stage 02: Collect
              </span>
              <span className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700 rounded-xs flex items-center gap-1">
                <Hash className="w-3 h-3 text-slate-400" />
                <span>Client ID: {context.clientId}</span>
              </span>
              <span className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700 rounded-xs">
                {context.engagementId}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Building2 className="w-6 h-6 text-[#D7AC4A] flex-shrink-0" />
                <span>{context.entityName}</span>
              </h1>
              <span className="text-slate-400 hidden sm:inline">•</span>
              <span className="text-sm text-slate-300 font-medium">
                {context.returnType}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              <span>Jurisdictions: <strong className="text-slate-200">{context.jurisdictions.join(', ')}</strong></span>
              <span>•</span>
              <span>Assigned Preparer: <strong className="text-slate-200">{context.assignedPreparer}</strong></span>
              <span>•</span>
              <span>Assigned Reviewer: <strong className="text-slate-200">{context.assignedReviewer}</strong></span>
            </div>
          </div>

          {/* Tax Year Selection & Readiness Summary */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="tax-year-select" className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#D7AC4A]" />
                <span>Tax Year:</span>
              </label>
              <select
                id="tax-year-select"
                value={context.taxYear}
                onChange={(e) => onTaxYearChange && onTaxYearChange(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 bg-[#031323] border border-slate-700 rounded-md text-xs font-mono font-bold text-white focus:outline-hidden focus:border-[#D7AC4A]"
              >
                {[2025, 2024, 2023, 2022].map(yr => (
                  <option key={yr} value={yr}>CY {yr}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center gap-4 w-full sm:w-auto">
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Collection Readiness
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-bold font-mono text-[#D7AC4A]">
                    {readiness.readinessScore}%
                  </span>
                  <span className="text-xs text-slate-300">
                    ({readiness.receivedCount} of {readiness.requiredCount} required received)
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActiveSubTab('readiness')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors ml-auto"
              >
                Gate Status
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. COLLECTION WORKSPACE SUB-NAVIGATION TABS */}
      {/* ========================================================================= */}
      <div className="bg-white border border-neutral-300 rounded-lg p-1.5 flex flex-wrap items-center gap-1 shadow-xs">
        {[
          { id: 'checklist', label: 'Document Checklist', icon: CheckSquare, count: requirements.length },
          { id: 'upload', label: 'Upload Center', icon: UploadCloud },
          { id: 'vault', label: 'Document Vault', icon: FolderLock },
          { id: 'missing', label: 'Missing Documents', icon: AlertCircle, count: readiness.missingCount, badgeColor: 'bg-rose-100 text-rose-800' },
          { id: 'requests', label: 'Document Requests', icon: Inbox, count: openRequestsCount > 0 ? openRequestsCount : undefined, badgeColor: 'bg-blue-100 text-blue-900' },
          { id: 'processing', label: 'Processing Status', icon: Sparkles, count: uploadedDocs.length },
          { id: 'security', label: 'Security & Staging', icon: ShieldAlert, count: quarantinedDocs.length > 0 ? quarantinedDocs.length : undefined, badgeColor: 'bg-rose-100 text-rose-800' },
          { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle, count: openExceptionsCount > 0 ? openExceptionsCount : undefined, badgeColor: 'bg-rose-100 text-rose-800' },
          { id: 'review', label: 'Human Review', icon: Eye, count: reviewQueue.filter(i => i.status === 'PENDING_REVIEW').length > 0 ? reviewQueue.filter(i => i.status === 'PENDING_REVIEW').length : undefined, badgeColor: 'bg-amber-100 text-amber-900' },
          { id: 'readiness', label: 'Collection Readiness', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${
                isActive
                  ? 'bg-[#061A2F] text-white shadow-xs'
                  : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#D7AC4A]' : 'text-neutral-500'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-slate-800 text-slate-200'
                      : tab.badgeColor || 'bg-neutral-200 text-neutral-800'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. TAB CONTENT VIEWS */}
      {/* ========================================================================= */}

      {/* SUB-TAB: CHECKLIST (TG-COL-002) */}
      {activeSubTab === 'checklist' && (
        <div className="space-y-4">
          <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search requirement by title, form number, or ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-md focus:outline-hidden focus:border-[#0A2544]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-neutral-500" />
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="text-xs border border-neutral-300 rounded-md px-2 py-1.5 bg-white text-neutral-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Required">Required</option>
                  <option value="Requested">Requested</option>
                  <option value="Received">Received</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Missing">Missing</option>
                  <option value="Superseded">Superseded</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>

                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="text-xs border border-neutral-300 rounded-md px-2 py-1.5 bg-white text-neutral-700"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                setTargetRequirement(null);
                setUploadCategory('General Supporting Documentation');
                setUploadFile(null);
                setUploadModalOpen(true);
              }}
              className="px-3 py-1.5 bg-[#061A2F] hover:bg-[#0A2544] text-white rounded-md text-xs font-semibold flex items-center gap-1.5 self-start md:self-auto"
            >
              <Plus className="w-3.5 h-3.5 text-[#D7AC4A]" />
              <span>Upload Document</span>
            </button>
          </div>

          {/* Requirements Table / Grid */}
          <div className="space-y-3">
            {filteredRequirements.map((req) => (
              <div
                key={req.requirementId}
                className="p-4 bg-white border border-neutral-300 hover:border-neutral-400 rounded-lg shadow-xs transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 rounded">
                      {req.requirementId}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-800 rounded">
                      {req.formNumber}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 rounded">
                      {req.category}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono text-neutral-600 bg-neutral-50 rounded">
                      {req.jurisdiction}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900">{req.title}</h3>
                  <p className="text-xs text-neutral-600 line-clamp-2">{req.description}</p>

                  {req.statutoryBasis && (
                    <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#D7AC4A]" />
                      <span>Authority: {req.statutoryBasis}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-2 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500">Status:</span>
                    <select
                      value={req.status}
                      onChange={(e) => handleStatusChange(req.requirementId, e.target.value as CollectionDocumentStatus)}
                      className={`text-xs font-semibold px-2 py-1 rounded border ${
                        req.status === 'Accepted'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : req.status === 'Received' || req.status === 'Under Review'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : req.status === 'Missing' || req.status === 'Required'
                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                          : 'bg-neutral-100 text-neutral-800 border-neutral-300'
                      }`}
                    >
                      <option value="Required">Required</option>
                      <option value="Requested">Requested</option>
                      <option value="Received">Received</option>
                      <option value="Processing">Processing</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Missing">Missing</option>
                      <option value="Superseded">Superseded</option>
                      <option value="Not Applicable">Not Applicable</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleOpenUploadForReq(req)}
                    className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Attach Upload</span>
                  </button>
                </div>
              </div>
            ))}

            {filteredRequirements.length === 0 && (
              <div className="p-8 text-center bg-neutral-50 border border-dashed border-neutral-300 rounded-lg text-neutral-500 text-xs">
                No checklist requirements matched your active filters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB: UPLOAD CENTER (TG-COL-003) */}
      {activeSubTab === 'upload' && (
        <div className="space-y-6">
          <UploadScanCenterSection
            selectedYear={context.taxYear}
            onDocumentProcessed={(doc) => {
              // Automatically ingest into Stage 02 Collection Service
              StageTwoCollectionService.ingestDocumentUpload({
                clientId: context.clientId,
                engagementId: context.engagementId,
                taxYear: context.taxYear,
                uploaderSource: 'scanner_intake',
                uploadedBy: 'Client Portal Scanner',
                originalFileName: doc.name || 'scanned_tax_document.pdf',
                fileSizeBytes: doc.sizeBytes || 250000,
                mimeType: doc.type || 'application/pdf',
                claimedCategory: doc.classificationSuggestion || 'Scanned Document'
              });
              setWorkspaceVersion(v => v + 1);
            }}
            onNavigateToAiPipeline={() => setActiveSubTab('processing')}
          />
        </div>
      )}

      {/* SUB-TAB: DOCUMENT VAULT */}
      {activeSubTab === 'vault' && (
        <div className="space-y-6">
          <ClientVaultSection
            vaultService={vaultService}
            clientId={context.clientId}
            onOpenAssistant={onOpenAssistant || (() => {})}
          />
        </div>
      )}

      {/* SUB-TAB: MISSING DOCUMENTS (TG-COL-021) */}
      {activeSubTab === 'missing' && (
        <StageTwoMissingDocumentsView
          clientId={context.clientId}
          taxYear={context.taxYear}
          engagementId={context.engagementId}
          onNavigateToUpload={(req) => {
            if (req) {
              handleOpenUploadForReq(req);
            } else {
              setActiveSubTab('upload');
            }
          }}
          onNavigateToRequests={(req) => {
            setTargetReqForRequest(req || null);
            setActiveSubTab('requests');
          }}
          onRefresh={() => setWorkspaceVersion(v => v + 1)}
        />
      )}

      {/* SUB-TAB: DOCUMENT REQUESTS (TG-COL-022 & TG-COL-023) */}
      {activeSubTab === 'requests' && (
        <StageTwoDocumentRequestsView
          clientId={context.clientId}
          taxYear={context.taxYear}
          engagementId={context.engagementId}
          initialTargetRequirement={targetReqForRequest}
          onNavigateToUpload={() => setActiveSubTab('upload')}
        />
      )}

      {/* SUB-TAB: PROCESSING STATUS */}
      {activeSubTab === 'processing' && (
        <div className="space-y-6">
          {/* AI Intelligence & Governance Header */}
          <div className="p-5 bg-gradient-to-r from-[#061A2F] to-[#0A2E5C] text-white rounded-xl shadow-md border border-[#1A365D] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#D7AC4A]/20 text-[#D7AC4A] rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Stage 02 Document Intelligence & OCR Pipeline
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    TG-COL-012 through TG-COL-020: Isolated gate clearance, OCR extraction, AI classification, duplicate detection, and version tracking.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-[11px] font-mono font-bold bg-[#1A365D] text-[#D7AC4A] border border-[#D7AC4A]/40 rounded">
                  ENGINE: DEV / SIMULATED OCR
                </span>
                <span className="px-2.5 py-1 text-[11px] font-mono font-bold bg-white/10 text-white rounded">
                  {uploadedDocs.length} Ingested Records
                </span>
              </div>
            </div>

            <div className="p-3 bg-black/25 border border-white/10 rounded-lg text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#D7AC4A] shrink-0 mt-0.5" />
              <span>
                <strong>Strict AI Governance Mandate:</strong> AI operates strictly as an intake extraction and decision-support tool. Proposed data does <strong>NOT</strong> verify tax returns, confirm tax positions, approve deductions, or sign returns. Professional CPA/preparer review remains the sole authoritative record.
              </span>
            </div>
          </div>

          {/* Ingested Documents List with Intelligence Cards */}
          <div className="space-y-4">
            {uploadedDocs.map((doc) => {
              const intel: DocumentIntelligenceRecord | undefined =
                doc.intelligenceRecord ||
                StageTwoCollectionService.getIntelligenceRecord(doc.documentId);

              return (
                <div
                  key={doc.documentId}
                  className="bg-white border border-neutral-300 rounded-xl p-5 shadow-xs space-y-4"
                >
                  {/* Top Bar: Doc ID, Original File, Categories */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-200">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 rounded">
                          {doc.documentId}
                        </span>
                        <span className="text-sm font-bold text-neutral-900">{doc.originalFileName}</span>
                        <span className="text-xs font-mono text-neutral-500">
                          ({(doc.fileSizeBytes / 1024).toFixed(1)} KB)
                        </span>
                        <span className="text-xs font-mono text-neutral-400">
                          SHA-256: {doc.sha256Hash.substring(0, 12)}...
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                        <span>Claimed: <strong>{doc.claimedCategory}</strong></span>
                        {intel && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              AI Detected: <strong className="text-[#0A2544]">{intel.aiDetectedCategory}</strong>
                              <span className="text-[10px] font-mono text-neutral-500">
                                ({(intel.classificationConfidence * 100).toFixed(0)}% conf)
                              </span>
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>Uploaded {new Date(doc.uploadTimestamp).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setActiveSubTab('vault')}
                        className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 rounded text-xs font-medium"
                      >
                        View in Vault
                      </button>

                      {intel?.humanReviewRequired && (
                        <button
                          onClick={() => {
                            setActiveSubTab('review');
                            const item = reviewQueue.find(q => q.documentId === doc.documentId);
                            if (item) setSelectedReviewItem(item);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review Flagged Data</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Intelligence Status Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* OCR Status */}
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-mono uppercase text-neutral-500 font-bold">OCR Ingestion</div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                          intel?.ocrState === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : intel?.ocrState === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {intel?.ocrState || 'PENDING_OCR'}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {intel?.ocrArtifact?.pageCount || 1} pg
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate">
                        Simulated Dev Engine
                      </div>
                    </div>

                    {/* AI Classification */}
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-mono uppercase text-neutral-500 font-bold">Classification</div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                          intel?.classificationConflict
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {intel?.classificationConflict ? 'CONFLICT' : 'MATCHED'}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {intel ? `${(intel.classificationConfidence * 100).toFixed(0)}%` : '—'}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate">
                        {intel?.classificationConflict
                          ? `Claimed ${doc.claimedCategory}`
                          : intel?.aiDetectedCategory || 'Pending'}
                      </div>
                    </div>

                    {/* Duplicate Detection */}
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-mono uppercase text-neutral-500 font-bold">Duplicate Check</div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                          intel?.duplicateDetection.isDuplicate
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {intel?.duplicateDetection.isDuplicate ? 'DUPLICATE' : 'UNIQUE'}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {intel?.duplicateDetection.duplicateType || 'NONE'}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate">
                        {intel?.duplicateDetection.matchedDocumentId
                          ? `Matches ${intel.duplicateDetection.matchedDocumentId}`
                          : 'No duplicate detected'}
                      </div>
                    </div>

                    {/* Version Intelligence */}
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-mono uppercase text-neutral-500 font-bold">Version Status</div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                          intel?.versionIntelligence.relationship === 'SUPERSEDED'
                            ? 'bg-neutral-200 text-neutral-700'
                            : intel?.versionIntelligence.relationship === 'CORRECTED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {intel?.versionIntelligence.relationship || 'ORIGINAL'}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          v{intel?.versionIntelligence.versionNumber || 1}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate">
                        {intel?.versionIntelligence.requiresDownstreamRevalidation
                          ? '⚡ Revalidation Required'
                          : 'Standard Version'}
                      </div>
                    </div>
                  </div>

                  {/* Conflict or Review Alert Callout */}
                  {intel?.classificationConflict && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Category Conflict Detected:</strong> Uploader claimed category "
                        {doc.claimedCategory}", but AI Document Intelligence identified "
                        {intel.aiDetectedCategory}". Routed to the Human Review Queue for professional CPA determination.
                      </div>
                    </div>
                  )}

                  {/* Structured Extracted Data Card */}
                  {intel && intel.extractedData && (
                    <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-[#0A2544]" />
                          <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                            Normalized Structured Data Schema ({intel.aiDetectedCategory})
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-500">
                          Extraction Schema v1.0
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-neutral-200 rounded">
                          <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-200">
                            <tr>
                              <th className="p-2.5">Field / Box</th>
                              <th className="p-2.5">Extracted Value</th>
                              <th className="p-2.5">Confidence</th>
                              <th className="p-2.5">Tier</th>
                              <th className="p-2.5">Materiality</th>
                              <th className="p-2.5">Provenance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200">
                            {Object.entries(intel.extractedData as any)
                              .filter(([k, v]) => k !== 'documentType' && v && typeof v === 'object' && 'confidence' in v)
                              .map(([key, rawProv]) => {
                                const prov = rawProv as ExtractedFieldProvenance;
                                return (
                                  <tr key={key} className="hover:bg-white transition-colors">
                                    <td className="p-2.5 font-medium text-neutral-900">
                                      {prov.fieldLabel || prov.fieldKey || key}
                                    </td>
                                    <td className="p-2.5 font-mono font-bold text-neutral-800">
                                      {String(prov.extractedValue ?? '—')}
                                    </td>
                                    <td className="p-2.5 font-mono">
                                      {(prov.confidence * 100).toFixed(0)}%
                                    </td>
                                    <td className="p-2.5">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        prov.confidenceTier === 'HIGH_CONFIDENCE'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : prov.confidenceTier === 'REVIEW_REQUIRED'
                                          ? 'bg-amber-100 text-amber-900'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {prov.confidenceTier}
                                      </span>
                                    </td>
                                    <td className="p-2.5">
                                      {prov.isMaterialField ? (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                          Material
                                        </span>
                                      ) : (
                                        <span className="text-neutral-400 text-[10px]">Standard</span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-[11px] text-neutral-500 font-mono">
                                      {prov.sourceReference || 'Extracted'}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {uploadedDocs.length === 0 && (
              <div className="p-8 text-center bg-neutral-50 border border-dashed border-neutral-300 rounded-lg text-neutral-500 text-xs">
                No documents uploaded yet for Tax Year {context.taxYear}. Use the Upload Center to submit records.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB: SECURITY & ISOLATED STAGING (M2 SPRINT 2) */}
      {activeSubTab === 'security' && (
        <div className="space-y-6">
          {/* 1. Critical Invariants Callout */}
          <div className="p-4 bg-[#061A2F] border border-[#1A365D] rounded-xl text-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#D7AC4A]">
                <ShieldAlert className="w-5 h-5" />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  M2 Stage 02 Security Pipeline & Invariant Boundaries
                </h2>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#1A365D] text-slate-200 border border-slate-600 rounded">
                Sprint 2 Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Boundary 1</div>
                <div className="font-bold text-amber-300 mt-0.5">Upload ≠ Verified</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  A successful document receipt only confirms ingestion into staging. Verification requires full accounting inspection.
                </p>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Boundary 2</div>
                <div className="font-bold text-amber-300 mt-0.5">Clean Scan ≠ Tax Verified</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Passing signature, archive, and malware screening does not certify that tax numbers or schedules are accurate.
                </p>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Boundary 3</div>
                <div className="font-bold text-amber-300 mt-0.5">Encrypted Storage ≠ Human Reviewed</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  AES-256-GCM vault storage protects confidentiality at rest; CPA human sign-off remains mandatory before filing.
                </p>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Boundary 4</div>
                <div className="font-bold text-emerald-400 mt-0.5">OCR Gate Locked</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Downstream OCR & AI extraction engines are strictly blocked from accessing any document that has not cleared all security gates.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Quarantine Alert & Queue (TG-COL-008) */}
          {quarantinedDocs.length > 0 && (
            <div className="p-5 bg-rose-50 border border-rose-300 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-900">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <h3 className="text-sm font-bold">Active Quarantine Queue ({quarantinedDocs.length} Flagged)</h3>
                </div>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-rose-200 text-rose-900 rounded">
                  Isolated from Vault & OCR
                </span>
              </div>

              <p className="text-xs text-rose-800">
                These documents were intercepted by signature, archive bomb, or malware detection heuristics. They cannot be downloaded normally or forwarded to OCR processing.
              </p>

              {dispositionStatusMessage && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded text-xs">
                  {dispositionStatusMessage}
                </div>
              )}

              <div className="space-y-3">
                {quarantinedDocs.map((doc) => (
                  <div
                    key={doc.documentId}
                    className="p-4 bg-white border border-rose-200 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300 rounded">
                          {doc.documentId}
                        </span>
                        <span className="text-xs font-bold text-neutral-900">{doc.originalFilename}</span>
                        <span className="text-[10px] text-rose-700 font-mono">
                          Status: {doc.quarantineStatus}
                        </span>
                      </div>
                      <p className="text-xs text-rose-800 font-medium">
                        Reason: {doc.quarantineReason || 'Security scan threat detection triggered'}
                      </p>
                      <div className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-2 font-mono">
                        <span>Scanner: {doc.malwareScannerName}</span>
                        <span>•</span>
                        <span>Detected Type: {doc.signatureValidation.detectedFileType}</span>
                        <span>•</span>
                        <span>Quarantined: {doc.quarantineTimestamp ? new Date(doc.quarantineTimestamp).toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setSelectedQuarantineDoc(doc)}
                        className="px-3 py-1.5 bg-rose-800 hover:bg-rose-900 text-white rounded text-xs font-semibold"
                      >
                        Review Disposition
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Disposition Action Form */}
              {selectedQuarantineDoc && (
                <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-3 mt-4">
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                    <span className="text-xs font-bold text-neutral-900">
                      Quarantine Disposition for {selectedQuarantineDoc.documentId} ({selectedQuarantineDoc.originalFilename})
                    </span>
                    <button
                      onClick={() => setSelectedQuarantineDoc(null)}
                      className="text-xs text-neutral-500 hover:text-neutral-800"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        Authorized Role
                      </label>
                      <select
                        value={dispositionRole}
                        onChange={(e) => setDispositionRole(e.target.value as any)}
                        className="w-full px-2 py-1.5 border border-neutral-300 rounded bg-white text-xs"
                      >
                        <option value="cpa">CPA (Reviewer)</option>
                        <option value="compliance">Compliance Officer</option>
                        <option value="admin">System Administrator</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        Compliance / Operational Reason (Mandatory)
                      </label>
                      <input
                        type="text"
                        value={dispositionReason}
                        onChange={(e) => setDispositionReason(e.target.value)}
                        placeholder="e.g. Verified harmless test artifact / Verified false positive"
                        className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleDisposition('REJECTED')}
                      className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded text-xs font-semibold"
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => handleDisposition('DELETED_DISPOSED')}
                      className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-semibold"
                    >
                      Permanently Delete
                    </button>
                    <button
                      onClick={() => handleDisposition('CLEARED')}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold"
                    >
                      Release & Clear Quarantine
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Isolated File Staging Registry Table (TG-COL-004) */}
          <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <FolderLock className="w-5 h-5 text-[#0A2544]" />
                  <span>Isolated File Staging Registry</span>
                </h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Tracks all inbound documents through staging, MIME validation, anti-malware, and encryption gates.
                </p>
              </div>

              <span className="px-2.5 py-1 text-xs font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 rounded self-start sm:self-auto">
                {stagedDocs.length} Documents in Registry
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-neutral-200 rounded-lg">
                <thead className="bg-neutral-50 text-neutral-700 uppercase font-mono text-[10px] border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Document ID</th>
                    <th className="p-3">Filename & Size</th>
                    <th className="p-3">Uploader</th>
                    <th className="p-3">MIME / Signature</th>
                    <th className="p-3">Malware Scan</th>
                    <th className="p-3">Encryption</th>
                    <th className="p-3">Integrity (SHA-256)</th>
                    <th className="p-3">OCR Ready</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {stagedDocs.map((doc) => (
                    <tr key={doc.documentId} className="hover:bg-neutral-50/50">
                      <td className="p-3 font-mono font-bold text-neutral-900">
                        {doc.documentId}
                        <div className="text-[10px] text-neutral-500 font-normal">v{doc.provenance.versionNumber}</div>
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-neutral-900 max-w-[180px] truncate" title={doc.originalFilename}>
                          {doc.originalFilename}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-500">
                          {(doc.fileSizeBytes / 1024).toFixed(1)} KB • {doc.claimedCategory}
                        </div>
                      </td>

                      <td className="p-3 text-neutral-600">
                        <div>{doc.uploader}</div>
                        <div className="text-[10px] font-mono text-neutral-400">{doc.uploaderSource}</div>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          doc.signatureValidation.validationResult === 'PASSED'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}>
                          {doc.signatureValidation.validationResult}
                        </span>
                        <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                          {doc.signatureValidation.detectedFileType}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          doc.malwareScanStatus === 'CLEAN'
                            ? 'bg-emerald-100 text-emerald-900'
                            : doc.malwareScanStatus === 'INFECTED'
                            ? 'bg-rose-100 text-rose-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {doc.malwareScanStatus}
                        </span>
                        <div className="text-[9px] font-mono text-neutral-500 mt-0.5 truncate max-w-[120px]" title={doc.malwareScannerName}>
                          {doc.malwareScannerName}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {doc.encryptionMetadata?.algorithm || 'AES-256-GCM'}
                        </span>
                        <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                          {doc.encryptionStatus}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          doc.integrityRecord.integrityVerificationStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}>
                          {doc.integrityRecord.integrityVerificationStatus}
                        </span>
                        <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                          {doc.integrityRecord.originalHash.substring(0, 10)}...
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          doc.isReadyForOcr
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {doc.isReadyForOcr ? 'GATE OPEN' : 'BLOCKED'}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {stagedDocs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-neutral-500 text-xs">
                        No staged documents in intake registry for Tax Year {context.taxYear}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Subsystems Specifications Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-[#0A2544]">
                <ShieldCheck className="w-4 h-4 text-[#D7AC4A]" />
                <h4 className="text-xs font-bold uppercase tracking-wider">MIME Magic Byte Validation</h4>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                TG-COL-005 verifies file headers against binary signatures (%PDF-, PNG, JPEG, TIFF). Dangerous executable headers (MZ, ELF, scripts) are blocked before ingestion.
              </p>
            </div>

            <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-[#0A2544]">
                <Layers className="w-4 h-4 text-[#D7AC4A]" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Archive Bomb Protection</h4>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                TG-COL-006 enforces a 100:1 maximum decompression ratio, 100MB uncompressed limit, and nested zip detection before unpacking archives.
              </p>
            </div>

            <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-[#0A2544]">
                <FolderLock className="w-4 h-4 text-[#D7AC4A]" />
                <h4 className="text-xs font-bold uppercase tracking-wider">7-Year IRS Preservation</h4>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                TG-COL-011 preserves all superseded records with version provenance. Document replacement creates a new version while retaining original audit trails.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: EXCEPTIONS (TG-COL-024) */}
      {activeSubTab === 'exceptions' && (
        <StageTwoExceptionsView
          clientId={context.clientId}
          taxYear={context.taxYear}
          engagementId={context.engagementId}
          userRole="client"
          onRefresh={() => setWorkspaceVersion(v => v + 1)}
        />
      )}

      {/* SUB-TAB: HUMAN REVIEW (TG-COL-019 & TG-COL-020) */}
      {activeSubTab === 'review' && (
        <div className="space-y-6">
          {/* Status Message Banner */}
          {reviewStatusMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{reviewStatusMessage}</span>
            </div>
          )}

          {/* AI Governance & Professional Control Header */}
          <div className="p-5 bg-gradient-to-r from-[#061A2F] to-[#0A2E5C] text-white rounded-xl shadow-md border border-[#1A365D] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#D7AC4A]/20 text-[#D7AC4A] rounded-lg">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Stage 02 Operational Human Review Queue
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    TG-COL-019 & TG-COL-020: Professional review of AI category conflicts, low-confidence extractions, duplicates, and superseded versions.
                  </p>
                </div>
              </div>

              {/* Reviewer Role Picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">Acting Role:</span>
                <select
                  value={reviewRole}
                  onChange={(e) => setReviewRole(e.target.value as any)}
                  className="px-2.5 py-1 text-xs font-semibold bg-[#1A365D] text-[#D7AC4A] border border-[#D7AC4A]/40 rounded focus:outline-none"
                >
                  <option value="cpa">CPA (Level 2 Reviewer)</option>
                  <option value="preparer">Tax Preparer</option>
                  <option value="compliance">Compliance Officer</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-black/25 border border-white/10 rounded-lg text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#D7AC4A] shrink-0 mt-0.5" />
              <span>
                <strong>Authoritative Review Mandate:</strong> In accordance with Circular 230 and TaxGuard compliance controls, AI extractions are purely advisory. An authorized human tax professional must independently accept, correct, reclassify, or reject all flagged records before Gate 2 clearance.
              </span>
            </div>
          </div>

          {/* Queue Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-neutral-300 rounded-xl shadow-xs">
              <div className="text-[10px] font-mono uppercase text-neutral-500 font-bold">Total Flagged</div>
              <div className="text-2xl font-bold text-neutral-900 mt-0.5">{reviewQueue.length}</div>
              <div className="text-[11px] text-neutral-500">Intake documents requiring inspection</div>
            </div>

            <div className="p-4 bg-white border border-amber-300 rounded-xl shadow-xs bg-amber-50/20">
              <div className="text-[10px] font-mono uppercase text-amber-800 font-bold">Pending Review</div>
              <div className="text-2xl font-bold text-amber-900 mt-0.5">
                {reviewQueue.filter(q => q.status === 'PENDING_REVIEW').length}
              </div>
              <div className="text-[11px] text-amber-700">Awaiting CPA action</div>
            </div>

            <div className="p-4 bg-white border border-blue-300 rounded-xl shadow-xs bg-blue-50/20">
              <div className="text-[10px] font-mono uppercase text-blue-800 font-bold">In Review / Escalated</div>
              <div className="text-2xl font-bold text-blue-900 mt-0.5">
                {reviewQueue.filter(q => q.status === 'IN_REVIEW' || q.status === 'ESCALATED').length}
              </div>
              <div className="text-[11px] text-blue-700">Under active partner review</div>
            </div>

            <div className="p-4 bg-white border border-emerald-300 rounded-xl shadow-xs bg-emerald-50/20">
              <div className="text-[10px] font-mono uppercase text-emerald-800 font-bold">Completed / Cleared</div>
              <div className="text-2xl font-bold text-emerald-900 mt-0.5">
                {reviewQueue.filter(q => q.status === 'REVIEWED').length}
              </div>
              <div className="text-[11px] text-emerald-700">Approved for downstream</div>
            </div>
          </div>

          {/* Operational Review Queue Table */}
          <div className="bg-white border border-neutral-300 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Pending Review Items</h3>
                <p className="text-xs text-neutral-500">
                  Select an item to inspect low-confidence fields, resolve category conflicts, or record audit-logged dispositions.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-neutral-100 text-neutral-700 border border-neutral-300 rounded">
                Tax Year {context.taxYear}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="p-3">Document ID & File</th>
                    <th className="p-3">Claimed vs Detected</th>
                    <th className="p-3">Review Triggers</th>
                    <th className="p-3">Flagged Fields</th>
                    <th className="p-3">Queue Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {reviewQueue.map((item) => (
                    <tr key={item.reviewItemId} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-mono font-bold text-neutral-900">{item.documentId}</div>
                        <div className="text-[11px] text-neutral-500">{item.filename}</div>
                      </td>

                      <td className="p-3">
                        <div className="text-xs">
                          Claimed: <span className="font-semibold text-neutral-700">{item.clientClaimedCategory}</span>
                        </div>
                        <div className="text-xs text-[#0A2544]">
                          Detected: <span className="font-semibold">{item.aiDetectedCategory}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {item.reviewReasons.map((reason, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                reason === 'CATEGORY_CONFLICT'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : reason === 'LOW_CONFIDENCE_MATERIAL_FIELD'
                                  ? 'bg-rose-100 text-rose-800'
                                  : reason === 'DUPLICATE_SUSPECTED'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3">
                        {item.flaggedFields.length > 0 ? (
                          <div className="space-y-0.5">
                            {item.flaggedFields.map((f, i) => (
                              <div key={i} className="text-[11px] font-mono text-rose-700">
                                {f.fieldLabel || f.fieldKey}: {(f.confidence * 100).toFixed(0)}% conf
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic">None</span>
                        )}
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'PENDING_REVIEW'
                            ? 'bg-amber-100 text-amber-900'
                            : item.status === 'IN_REVIEW'
                            ? 'bg-blue-100 text-blue-900'
                            : item.status === 'REVIEWED'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedReviewItem(item);
                            setReviewAction('ACCEPT');
                            setReviewJustification('');
                            setFieldCorrectionKey(item.flaggedFields[0]?.fieldKey || '');
                            setFieldCorrectionValue('');
                            setReclassifiedCategory(item.aiDetectedCategory);
                          }}
                          className="px-3 py-1.5 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-xs font-semibold shadow-xs"
                        >
                          Review & Action
                        </button>
                      </td>
                    </tr>
                  ))}

                  {reviewQueue.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-500 text-xs">
                        No documents currently require human review for Tax Year {context.taxYear}. All intake documents meet confidence thresholds.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Review & Action Modal */}
          {selectedReviewItem && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-neutral-300 overflow-hidden max-h-[90vh] flex flex-col">
                {/* Modal Header */}
                <div className="p-5 bg-[#061A2F] text-white flex items-center justify-between border-b border-[#1A365D]">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                      Human Review Disposition — {selectedReviewItem.documentId}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Acting as: <strong>{reviewRole.toUpperCase()}</strong> | File: {selectedReviewItem.filename}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedReviewItem(null)}
                    className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  {/* Triggers Callout */}
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-1">
                    <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Review Triggered Reasons:</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                      {selectedReviewItem.reviewReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Flagged Fields Table (if any) */}
                  {selectedReviewItem.flaggedFields.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-neutral-800">Flagged Low-Confidence Fields:</div>
                      <div className="border border-neutral-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-neutral-100 text-neutral-700">
                            <tr>
                              <th className="p-2">Field</th>
                              <th className="p-2">Extracted Value</th>
                              <th className="p-2">Confidence</th>
                              <th className="p-2">Material</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200">
                            {selectedReviewItem.flaggedFields.map((f, i) => (
                              <tr key={i}>
                                <td className="p-2 font-mono font-bold text-neutral-800">{f.fieldLabel || f.fieldKey}</td>
                                <td className="p-2 font-mono text-neutral-700">{String(f.extractedValue ?? '—')}</td>
                                <td className="p-2 font-mono text-rose-700">{(f.confidence * 100).toFixed(0)}%</td>
                                <td className="p-2">
                                  {f.isMaterialField ? (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 rounded">
                                      Material
                                    </span>
                                  ) : (
                                    'No'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Action Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-800">
                      Select Human Review Action (TG-COL-020):
                    </label>
                    <select
                      value={reviewAction}
                      onChange={(e) => setReviewAction(e.target.value as HumanReviewAction)}
                      className="w-full p-2 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#061A2F]"
                    >
                      <option value="ACCEPT">ACCEPT — Accept AI extraction as verified proposed data</option>
                      <option value="CORRECT">CORRECT — Override extracted field with human-verified figure</option>
                      <option value="RECLASSIFY">RECLASSIFY — Change document tax category</option>
                      <option value="MARK_DUPLICATE">MARK_DUPLICATE — Flag as duplicate of existing record</option>
                      <option value="MARK_SUPERSEDED">MARK_SUPERSEDED — Supersede with newer document version</option>
                      <option value="REQUEST_REPLACEMENT">REQUEST_REPLACEMENT — Request new copy from client</option>
                      <option value="ESCALATE">ESCALATE — Escalate to Senior CPA / Partner</option>
                      <option value="REJECT">REJECT — Reject document completely</option>
                    </select>
                  </div>

                  {/* Dynamic inputs based on action */}
                  {reviewAction === 'CORRECT' && (
                    <div className="p-3 bg-neutral-50 border border-neutral-300 rounded-lg space-y-3">
                      <div className="text-xs font-bold text-neutral-800">Field Override Details:</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-neutral-600 block mb-1">Field Name / Key:</label>
                          <input
                            type="text"
                            value={fieldCorrectionKey}
                            onChange={(e) => setFieldCorrectionKey(e.target.value)}
                            placeholder="e.g. wagesTipsOtherComp"
                            className="w-full p-2 text-xs border border-neutral-300 rounded focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-neutral-600 block mb-1">Human-Verified Value:</label>
                          <input
                            type="text"
                            value={fieldCorrectionValue}
                            onChange={(e) => setFieldCorrectionValue(e.target.value)}
                            placeholder="e.g. 85400.00"
                            className="w-full p-2 text-xs border border-neutral-300 rounded focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {reviewAction === 'RECLASSIFY' && (
                    <div className="p-3 bg-neutral-50 border border-neutral-300 rounded-lg space-y-2">
                      <label className="text-xs font-bold text-neutral-800 block">
                        Corrected Tax Document Category (19 Controlled Categories):
                      </label>
                      <select
                        value={reclassifiedCategory}
                        onChange={(e) => setReclassifiedCategory(e.target.value as TaxDocumentCategory)}
                        className="w-full p-2 text-xs border border-neutral-300 rounded focus:outline-none"
                      >
                        {CONTROLLED_TAX_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Mandatory Justification */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                      <span>Operational / Compliance Justification:</span>
                      <span className="text-[10px] font-normal text-rose-600 font-mono">* Required for Audit Trail</span>
                    </label>
                    <textarea
                      value={reviewJustification}
                      onChange={(e) => setReviewJustification(e.target.value)}
                      placeholder="Detail the reason for this action, professional findings, or client communications..."
                      rows={3}
                      className="w-full p-2 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#061A2F]"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-neutral-100 border-t border-neutral-300 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedReviewItem(null)}
                    className="px-4 py-2 bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-300 rounded text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteReviewAction}
                    className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Execute Human Disposition</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Original Staff Review Section */}
          <div className="pt-4 border-t border-neutral-200">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Standard Engagement Review Panel
            </h4>
            <AccountantReviewStatusSection />
          </div>
        </div>
      )}

      {/* SUB-TAB: COLLECTION READINESS & HARD EXIT GATE (TG-COL-025 to TG-COL-028) */}
      {activeSubTab === 'readiness' && (
        <StageTwoExitGateView
          clientId={context.clientId}
          taxYear={context.taxYear}
          engagementId={context.engagementId}
          userRole="client"
          onRefresh={() => setWorkspaceVersion(v => v + 1)}
          onNavigateToStageThree={() => setShowStageThree(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. DIRECT UPLOAD MODAL (TG-COL-003) */}
      {/* ========================================================================= */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-neutral-300 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Secure Document Ingestion</h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Direct upload into Stage 02 Collection Workspace with SHA-256 verification.
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {targetRequirement && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                <div className="font-bold text-slate-900">Target Requirement: {targetRequirement.title}</div>
                <div className="text-[11px] font-mono text-slate-600">ID: {targetRequirement.requirementId} • Form: {targetRequirement.formNumber}</div>
              </div>
            )}

            <form onSubmit={handleExecuteUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Document Category
                </label>
                <input
                  type="text"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Select File (PDF, PNG, JPEG, TIFF)
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#061A2F] file:text-white hover:file:bg-[#0A2544]"
                  required
                />
              </div>

              {uploadSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded text-xs">
                  {uploadSuccessMessage}
                </div>
              )}

              {uploadErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded text-xs">
                  {uploadErrorMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUpload || !uploadFile}
                  className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2544] disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4 text-[#D7AC4A]" />
                  <span>{isSubmittingUpload ? 'Hashing & Ingesting...' : 'Ingest Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
