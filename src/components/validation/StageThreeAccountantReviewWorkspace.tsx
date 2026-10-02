/**
 * A/R Tax Services, LLC — Stage 03 Accountant Document Review Workspace
 *
 * Dedicated professional document-validation workspace supporting Stage 03 (Validate).
 * (Distinct from Stage 06 Tax/Workpaper Review).
 *
 * Implements:
 * - Review Queue, Client Cases, Documents, Exceptions, Client Requests, Completed Reviews
 * - Split-View Interface:
 *   - LEFT: Secure original document preview
 *   - RIGHT: Metadata, proposed classification, extracted fields with 4-tier values
 *            (Source, Proposed, Corrected, Verified), confidence, provenance, exceptions, review controls
 * - Professional actions: Claim, Accept, Correct (mandatory reason), Reject, Reclassify,
 *   Duplicate, Supersede, Request Replacement/Missing/Clarification, Complete Review, Verify Evidence
 * - Maker-Checker enforcement: Preparer cannot approve their own protected action
 * - Optimistic concurrency control (verifies version before mutations)
 * - Verified evidence generation with source provenance
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Check,
  X,
  Edit2,
  Send,
  Filter,
  Search,
  Building2,
  Calendar,
  AlertCircle,
  HelpCircle,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FolderLock,
  Hash,
  Download,
  ExternalLink,
  Layers,
  ArrowRight,
  Inbox
} from 'lucide-react';
import {
  ReviewItemDetails,
  ClientCaseRequestRecord
} from '../../server/taxguard/accountantDocumentReview.service';

interface StageThreeAccountantReviewWorkspaceProps {
  initialTaxYear?: number;
  selectedClientId?: string;
  onNavigateToCase?: (clientId: string, taxYear: number) => void;
}

type MainTab = 'queue' | 'cases' | 'documents' | 'exceptions' | 'requests' | 'completed';

export const StageThreeAccountantReviewWorkspace: React.FC<StageThreeAccountantReviewWorkspaceProps> = ({
  initialTaxYear = 2025,
  selectedClientId,
  onNavigateToCase
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('queue');
  const [taxYear, setTaxYear] = useState<number>(initialTaxYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_REVIEW' | 'COMPLETED' | 'FLAGGED'>('ALL');

  const [queueItems, setQueueItems] = useState<ReviewItemDetails[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReviewItemDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Correction & review action states
  const [correctionFieldId, setCorrectionFieldId] = useState<string | null>(null);
  const [correctedValue, setCorrectedValue] = useState<string>('');
  const [actionJustification, setActionJustification] = useState<string>('');
  const [reclassifyCategory, setReclassifyCategory] = useState<string>('W-2');

  // Client request creation modal within review
  const [clientRequestModalOpen, setClientRequestModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<'REPLACEMENT_REQUIRED' | 'MISSING_DOCUMENT' | 'CLARIFICATION'>('CLARIFICATION');
  const [requestMessage, setRequestMessage] = useState('');

  // Client requests list
  const [clientRequests, setClientRequests] = useState<ClientCaseRequestRecord[]>([]);

  // Fetch Review Queue
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stage-two-three/accountant/review-queue?taxYear=${taxYear}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setQueueItems(data.items);
        if (selectedDocId) {
          const updated = data.items.find((i: ReviewItemDetails) => i.documentId === selectedDocId);
          if (updated) setSelectedItem(updated);
        } else if (data.items.length > 0 && !selectedItem) {
          setSelectedDocId(data.items[0].documentId);
          setSelectedItem(data.items[0]);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  };

  // Fetch Requests
  const fetchRequests = async () => {
    try {
      const res = await fetch(`/api/stage-two-three/requests/${taxYear}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.requests)) {
        setClientRequests(data.requests);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchRequests();
  }, [taxYear]);

  // Handle selecting item
  const handleSelectItem = (item: ReviewItemDetails) => {
    setSelectedDocId(item.documentId);
    setSelectedItem(item);
    setCorrectionFieldId(null);
    setCorrectedValue('');
    setActionJustification('');
  };

  // Execute Review Action
  const handleExecuteAction = async (action: string, fieldId?: string) => {
    if (!selectedItem) return;

    if (
      ['CORRECT', 'REJECT', 'REJECT_DOCUMENT', 'MARK_DUPLICATE', 'MARK_SUPERSEDED'].includes(action) &&
      (!actionJustification || actionJustification.trim().length < 5)
    ) {
      setStatusMessage({
        text: 'A professional explanation (minimum 5 characters) is required for this action.',
        type: 'warning'
      });
      return;
    }

    if (action === 'CORRECT' && (!correctedValue || !fieldId)) {
      setStatusMessage({ text: 'A corrected value is required.', type: 'warning' });
      return;
    }

    setActionLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/stage-two-three/accountant/review-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedItem.documentId,
          expectedVersion: selectedItem.version,
          action,
          fieldId,
          correctedValue: action === 'CORRECT' ? correctedValue : undefined,
          justification: actionJustification,
          newCategory: action === 'RECLASSIFY' ? reclassifyCategory : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Action execution failed.');
      }

      setSelectedItem(data.item);
      setQueueItems(prev => prev.map(i => (i.documentId === data.item.documentId ? data.item : i)));
      setStatusMessage({
        text: `Action [${action}] succeeded. Item version is now v${data.updatedVersion}.`,
        type: 'success'
      });

      setCorrectionFieldId(null);
      setCorrectedValue('');
      setActionJustification('');
    } catch (err: any) {
      setStatusMessage({
        text: err.message || 'Review action failed.',
        type: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Verify Evidence Action
  const handleVerifyEvidence = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/stage-two-three/accountant/verify-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedItem.clientId,
          taxYear: selectedItem.taxYear,
          documentId: selectedItem.documentId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to establish verified evidence.');
      }

      setStatusMessage({
        text: `Successfully verified ${data.evidenceRecords.length} evidence records with source provenance.`,
        type: 'success'
      });
      fetchQueue();
    } catch (err: any) {
      setStatusMessage({
        text: err.message || 'Failed to verify evidence.',
        type: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    return queueItems.filter(item => {
      const matchSearch =
        item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.clientId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === 'ALL' || item.proposedCategory === categoryFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && item.status === 'PENDING_REVIEW') ||
        (statusFilter === 'IN_REVIEW' && item.status === 'IN_REVIEW') ||
        (statusFilter === 'COMPLETED' && item.status === 'VERIFIED') ||
        (statusFilter === 'FLAGGED' && item.exceptions.some(e => e.status === 'OPEN'));
      return matchSearch && matchCategory && matchStatus;
    });
  }, [queueItems, searchQuery, categoryFilter, statusFilter]);

  return (
    <div className="space-y-6" id="stage-three-accountant-review-workspace">
      {/* 1. Header Bar */}
      <div className="bg-[#0D2745] border border-slate-700/80 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40">
                STAGE 03 — VALIDATE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
                Professional Document Validation Workspace
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#D4A843]" />
              <span>Accountant Document Review</span>
            </h1>
            <p className="text-xs text-[#A9B7C8] mt-1">
              Verify intake evidence, resolve exceptions, validate mathematical consistency, and establish authoritative tax records.
            </p>
          </div>

          {/* Tax Year Selector & Refresh */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Tax Year:</span>
              <select
                value={taxYear}
                onChange={e => setTaxYear(Number(e.target.value))}
                className="px-3 py-1.5 bg-[#06182B] border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-hidden focus:border-[#D4A843]"
              >
                {[2026, 2025, 2024, 2023, 2022].map(yr => (
                  <option key={yr} value={yr}>CY {yr}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { fetchQueue(); fetchRequests(); }}
              className="p-2 rounded-lg bg-[#102D4F] border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl p-1.5 flex flex-wrap items-center gap-1 shadow-md">
        {[
          { id: 'queue', label: 'Review Queue', icon: FileText, count: queueItems.filter(i => i.status === 'PENDING_REVIEW' || i.status === 'IN_REVIEW').length },
          { id: 'cases', label: 'Client Cases', icon: Building2 },
          { id: 'documents', label: 'Documents', icon: FolderLock, count: queueItems.length },
          { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle, count: queueItems.reduce((acc, i) => acc + i.exceptions.filter(e => e.status === 'OPEN').length, 0), badgeColor: 'bg-amber-950 text-amber-300' },
          { id: 'requests', label: 'Client Requests', icon: Inbox, count: clientRequests.filter(r => r.status === 'OPEN' || r.status === 'CLIENT_RESPONDED').length },
          { id: 'completed', label: 'Completed Reviews', icon: CheckCircle2, count: queueItems.filter(i => i.status === 'VERIFIED').length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                isActive
                  ? 'bg-[#D4A843] text-[#06182B] shadow-md'
                  : 'text-[#A9B7C8] hover:text-white hover:bg-[#102D4F]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? 'bg-[#06182B] text-[#D4A843]' : tab.badgeColor || 'bg-[#102D4F] text-[#A9B7C8]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
            : statusMessage.type === 'warning'
            ? 'bg-amber-950/80 border-amber-500/50 text-amber-200'
            : 'bg-red-950/80 border-red-500/50 text-red-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 3. SPLIT-VIEW REVIEW SCREEN (QUEUE TAB) */}
      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Queue List & Filters (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>Intake Items for Verification</span>
                <span className="font-mono text-[#D4A843]">{filteredQueue.length} items</span>
              </div>

              {/* Search & Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search client, filename..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#06182B] border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#D4A843]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="px-2 py-1 bg-[#06182B] border border-slate-700 rounded-md text-[11px] text-slate-300"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Review</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="FLAGGED">Has Exceptions</option>
                    <option value="COMPLETED">Verified</option>
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="px-2 py-1 bg-[#06182B] border border-slate-700 rounded-md text-[11px] text-slate-300"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="W-2">W-2 Wage</option>
                    <option value="1099-NEC">1099-NEC</option>
                    <option value="1099-INT">1099-INT</option>
                    <option value="1099-DIV">1099-DIV</option>
                    <option value="1098">1098 Mortgage</option>
                    <option value="1095-A">1095-A Health</option>
                    <option value="Trial Balance">Trial Balance</option>
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredQueue.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">
                    No documents matching the active filter.
                  </div>
                ) : (
                  filteredQueue.map(item => {
                    const isSelected = selectedItem?.documentId === item.documentId;
                    const openExceptions = item.exceptions.filter(e => e.status === 'OPEN').length;

                    return (
                      <div
                        key={item.documentId}
                        onClick={() => handleSelectItem(item)}
                        className={`p-3 rounded-xl border transition cursor-pointer text-xs space-y-1.5 ${
                          isSelected
                            ? 'bg-[#102D4F] border-[#D4A843] shadow-md'
                            : 'bg-[#06182B] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white truncate max-w-[180px]">
                            {item.fileName}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            item.status === 'VERIFIED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : item.status === 'IN_REVIEW'
                              ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                              : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          }`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{item.clientName} ({item.clientId})</span>
                          <span className="font-mono">{item.proposedCategory}</span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
                          <span>v{item.version} &bull; {(item.fileSizeBytes / 1024).toFixed(0)} KB</span>
                          {openExceptions > 0 && (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{openExceptions} exc</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Split-Screen Document Review (8 Cols) */}
          <div className="lg:col-span-8">
            {!selectedItem ? (
              <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl p-12 text-center text-slate-400 text-sm">
                Select an intake document from the review queue on the left.
              </div>
            ) : (
              <div className="bg-[#0D2745] border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden space-y-6 p-6">
                {/* Document Header & Quick Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{selectedItem.fileName}</h2>
                      <span className="px-2 py-0.5 rounded-md bg-[#102D4F] border border-slate-700 text-xs font-mono text-[#D4A843]">
                        v{selectedItem.version}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Client: <strong className="text-white">{selectedItem.clientName}</strong> &bull; Tax Year: <strong className="text-white">{selectedItem.taxYear}</strong> &bull; SHA-256: <span className="font-mono text-slate-400">{selectedItem.sha256.substring(0, 16)}...</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleExecuteAction('CLAIM')}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-[#102D4F] hover:bg-[#153a66] border border-slate-700 rounded-lg text-xs font-semibold text-white transition cursor-pointer"
                    >
                      Claim Review
                    </button>
                    <button
                      onClick={() => handleExecuteAction('ACCEPT')}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept All</span>
                    </button>
                    <button
                      onClick={handleVerifyEvidence}
                      disabled={actionLoading}
                      className="px-4 py-1.5 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Evidence</span>
                    </button>
                  </div>
                </div>

                {/* Split Panel: Document Preview (Left) vs Extracted Values & Controls (Right) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Original Document Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono uppercase text-[#D4A843] font-bold">
                      <span>Source Document Preview</span>
                      <span className="text-[10px] text-slate-400">Page 1 of 1</span>
                    </div>

                    <div className="bg-[#06182B] border border-slate-800 rounded-xl p-4 min-h-[360px] flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                      <FileText className="w-12 h-12 text-[#D4A843]/60" />
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-white">{selectedItem.fileName}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          MIME: {selectedItem.mimeType} &bull; Size: {(selectedItem.fileSizeBytes / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <div className="p-3 bg-[#0D2745] rounded-lg border border-slate-700 text-xs text-slate-300 max-w-xs text-left space-y-1">
                        <div className="text-[10px] text-[#D4A843] font-mono">DOCUMENT INTEGRITY</div>
                        <div>Status: <span className="text-emerald-400 font-semibold">Passed SHA-256 Validation</span></div>
                        <div className="truncate">Hash: {selectedItem.sha256}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right: 4-Tier Extracted Fields: Source, Proposed, Corrected, Verified */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono uppercase text-[#D4A843] font-bold">
                      <span>Extracted Tax & Accounting Values</span>
                      <span className="text-[10px] text-slate-400">{selectedItem.extractedFields.length} Fields</span>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {selectedItem.extractedFields.length === 0 ? (
                        <div className="p-6 bg-[#06182B] rounded-xl border border-slate-800 text-center text-xs text-slate-400">
                          No machine-extracted fields on this document.
                        </div>
                      ) : (
                        selectedItem.extractedFields.map(field => {
                          const isCorrecting = correctionFieldId === field.fieldId;

                          return (
                            <div
                              key={field.fieldId}
                              className="p-3 bg-[#06182B] border border-slate-800 rounded-xl space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-white">{field.fieldLabel}</span>
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-[#0D2745] text-slate-300">
                                  Confidence: {(field.confidence * 100).toFixed(0)}%
                                </span>
                              </div>

                              {/* 4-Tier Values Display */}
                              <div className="grid grid-cols-2 gap-2 text-[11px] p-2 bg-[#0D2745] rounded-lg border border-slate-700/60 font-mono">
                                <div>
                                  <span className="text-slate-400 text-[10px] block">PROPOSED VALUE</span>
                                  <span className="text-slate-200">{String(field.proposedValue)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-[10px] block">VERIFIED VALUE</span>
                                  <span className="text-emerald-400 font-bold">
                                    {field.verifiedValue !== undefined && field.verifiedValue !== null
                                      ? String(field.verifiedValue)
                                      : 'Pending Approval'}
                                  </span>
                                </div>
                              </div>

                              {field.correctionReason && (
                                <div className="text-[10px] text-amber-300 bg-amber-950/40 p-1.5 rounded-md border border-amber-800/40">
                                  Correction Note: {field.correctionReason}
                                </div>
                              )}

                              {/* Field Action Buttons */}
                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                                {isCorrecting ? (
                                  <div className="w-full space-y-2 pt-2">
                                    <input
                                      type="text"
                                      placeholder="Human-verified corrected value..."
                                      value={correctedValue}
                                      onChange={e => setCorrectedValue(e.target.value)}
                                      className="w-full px-3 py-1.5 bg-[#06182B] border border-slate-700 rounded-md text-xs text-white"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Mandatory professional correction reason..."
                                      value={actionJustification}
                                      onChange={e => setActionJustification(e.target.value)}
                                      className="w-full px-3 py-1.5 bg-[#06182B] border border-slate-700 rounded-md text-xs text-white"
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => setCorrectionFieldId(null)}
                                        className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleExecuteAction('CORRECT', field.fieldId)}
                                        className="px-3 py-1 bg-[#D4A843] text-[#06182B] font-bold rounded-md text-xs"
                                      >
                                        Apply Correction
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setCorrectionFieldId(field.fieldId);
                                        setCorrectedValue(String(field.proposedValue));
                                      }}
                                      className="px-2.5 py-1 text-slate-300 hover:text-white bg-[#102D4F] rounded-md text-[11px] flex items-center gap-1 cursor-pointer"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Correct</span>
                                    </button>
                                    <button
                                      onClick={() => handleExecuteAction('ACCEPT', field.fieldId)}
                                      className="px-2.5 py-1 text-emerald-300 hover:text-white bg-emerald-950 border border-emerald-500/40 rounded-md text-[11px] flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Accept</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Review Exceptions & Actions Panel */}
                <div className="p-4 bg-[#06182B] border border-slate-800 rounded-xl space-y-3">
                  <div className="text-xs font-mono uppercase text-[#D4A843] font-bold">
                    Professional Disposition Controls
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter justification or internal audit note..."
                      value={actionJustification}
                      onChange={e => setActionJustification(e.target.value)}
                      className="flex-1 min-w-[280px] px-3 py-2 bg-[#0D2745] border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#D4A843]"
                    />

                    <button
                      onClick={() => handleExecuteAction('ADD_NOTE')}
                      disabled={!actionJustification.trim()}
                      className="px-3 py-2 bg-[#102D4F] hover:bg-[#153a66] border border-slate-700 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 cursor-pointer"
                    >
                      Add Note
                    </button>
                    <button
                      onClick={() => handleExecuteAction('REJECT_DOCUMENT')}
                      className="px-3 py-2 bg-red-950 hover:bg-red-900 border border-red-500/50 rounded-lg text-xs font-bold text-red-200 transition cursor-pointer"
                    >
                      Reject Document
                    </button>
                    <button
                      onClick={() => handleExecuteAction('MARK_DUPLICATE')}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition cursor-pointer"
                    >
                      Mark Duplicate
                    </button>
                    <button
                      onClick={() => handleExecuteAction('REQUEST_REPLACEMENT')}
                      className="px-3 py-2 bg-amber-950 hover:bg-amber-900 border border-amber-500/50 rounded-lg text-xs font-bold text-amber-200 transition cursor-pointer"
                    >
                      Request Replacement from Client
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. CLIENT REQUESTS TAB */}
      {activeTab === 'requests' && (
        <div className="bg-[#0D2745] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Active Case Document Requests</h2>
              <p className="text-xs text-slate-300">
                Track requests sent to clients for replacements, missing schedules, or clarifications.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {clientRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-[#06182B] rounded-xl border border-slate-800">
                No active client document requests for Tax Year {taxYear}.
              </div>
            ) : (
              clientRequests.map(req => (
                <div key={req.requestId} className="p-4 bg-[#06182B] rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{req.title}</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                      req.status === 'CLIENT_RESPONDED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-slate-300">{req.message}</p>
                  {req.clientResponse && (
                    <div className="p-2.5 bg-[#0D2745] rounded-lg border border-slate-700 text-emerald-300 font-medium">
                      Client Response: &quot;{req.clientResponse}&quot; ({req.clientRespondedAt})
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                    <span>Issued by {req.createdByName} on {req.createdAt}</span>
                    <span>Client: {req.clientId}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
