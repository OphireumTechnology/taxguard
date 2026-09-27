/**
 * StageTwoExceptionsView.tsx
 * TG-COL-024: Unified Stage 02 Exception Management Integration
 *
 * Implements:
 * - Consolidated intake & intelligence exceptions (Security, OCR, Classification, Extraction, Duplicates, Mismatches)
 * - Persistent blocking state across views
 * - Role-gated resolution and waiver with mandatory justification, evidence reference, and audit trail
 */

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Search,
  Filter,
  Plus,
  X,
  FileText,
  Clock,
  UserCheck,
  Layers,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import {
  StageTwoCollectionOperationsService,
  StageTwoExceptionItem,
  StageTwoExceptionCategory,
  StageTwoExceptionSeverity,
  StageTwoExceptionStatus
} from '../../services/stageTwoCollectionOperationsService';

interface StageTwoExceptionsViewProps {
  clientId: string;
  taxYear: number;
  engagementId: string;
  userRole?: string;
  onRefresh?: () => void;
}

export const StageTwoExceptionsView: React.FC<StageTwoExceptionsViewProps> = ({
  clientId,
  taxYear,
  engagementId,
  userRole = 'cpa',
  onRefresh
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Resolution modal
  const [targetException, setTargetException] = useState<StageTwoExceptionItem | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'RESOLVE' | 'WAIVE_WITH_JUSTIFICATION'>('RESOLVE');
  const [justification, setJustification] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  // New exception modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<StageTwoExceptionCategory>('TAX_YEAR_MISMATCH');
  const [newSeverity, setNewSeverity] = useState<StageTwoExceptionSeverity>('HIGH');
  const [newIsBlocking, setNewIsBlocking] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSourceDocId, setNewSourceDocId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const exceptions = useMemo(() => {
    return StageTwoCollectionOperationsService.getExceptions(clientId, taxYear);
  }, [clientId, taxYear, refreshKey]);

  // Counts
  const counts = useMemo(() => {
    const total = exceptions.length;
    const open = exceptions.filter(e => e.status === 'OPEN' || e.status === 'REOPENED' || e.status === 'UNDER_REVIEW').length;
    const blocking = exceptions.filter(e => e.isBlocking && (e.status === 'OPEN' || e.status === 'REOPENED')).length;
    const resolved = exceptions.filter(e => e.status === 'RESOLVED' || e.status === 'WAIVED_WITH_JUSTIFICATION').length;
    return { total, open, blocking, resolved };
  }, [exceptions]);

  // Filtered exceptions
  const filteredExceptions = useMemo(() => {
    return exceptions.filter(exc => {
      if (selectedStatusFilter !== 'ALL' && exc.status !== selectedStatusFilter) {
        return false;
      }
      if (selectedCategoryFilter !== 'ALL' && exc.category !== selectedCategoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          exc.title.toLowerCase().includes(q) ||
          exc.description.toLowerCase().includes(q) ||
          exc.exceptionId.toLowerCase().includes(q) ||
          (exc.sourceDocumentId && exc.sourceDocumentId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [exceptions, selectedStatusFilter, selectedCategoryFilter, searchQuery]);

  // Handle resolve/waive
  const handleExecuteDisposition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetException) return;
    setResolutionError(null);

    try {
      StageTwoCollectionOperationsService.resolveException({
        exceptionId: targetException.exceptionId,
        clientId,
        taxYear,
        actor: 'Sarah Jenkins, CPA',
        actorRole: userRole,
        action: resolutionAction,
        justification,
        evidenceReference: evidenceReference || undefined
      });

      setTargetException(null);
      setJustification('');
      setEvidenceReference('');
      setRefreshKey(k => k + 1);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setResolutionError(err.message || 'Failed to disposition exception.');
    }
  };

  // Handle create exception
  const handleCreateException = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newTitle.trim() || !newDescription.trim()) {
      setCreateError('Title and description are required.');
      return;
    }

    try {
      StageTwoCollectionOperationsService.createException({
        clientId,
        engagementId,
        taxYear,
        category: newCategory,
        severity: newSeverity,
        isBlocking: newIsBlocking,
        title: newTitle,
        description: newDescription,
        sourceDocumentId: newSourceDocId || undefined,
        actor: 'Sarah Jenkins, CPA',
        actorRole: userRole
      });

      setCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewSourceDocId('');
      setRefreshKey(k => k + 1);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create exception.');
    }
  };

  const getSeverityBadge = (sev: StageTwoExceptionSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-900 border-red-300';
      case 'HIGH':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'LOW':
        return 'bg-neutral-100 text-neutral-800 border-neutral-300';
    }
  };

  return (
    <div className="space-y-6" id="tg-col-024-exceptions-view">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-[#061A2F] to-[#0A2E5C] text-white rounded-xl shadow-md border border-[#1A365D] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D7AC4A]/20 text-[#D7AC4A] rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                TG-COL-024: Unified Stage 02 Exception Management
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Consolidated integrity, security, OCR, duplicate, and tax-year discrepancies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-3 py-1.5 bg-[#D7AC4A] hover:bg-[#c49a3c] text-[#061A2F] rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Log Manual Exception</span>
            </button>
          </div>
        </div>

        {/* Governance note */}
        <div className="p-3 bg-black/30 border border-white/10 rounded-lg text-xs text-slate-200 leading-relaxed flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[#D7AC4A] shrink-0 mt-0.5" />
          <span>
            <strong>Authoritative Persistence Invariant:</strong> Open blocking exceptions cannot disappear merely because
            a user navigates away or uploads another document. Every waiver or resolution requires professional
            justification, role authorization, and is immutably logged to the audit registry.
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-2xs">
          <div className="text-[10px] text-neutral-500 uppercase font-semibold">Total Exceptions</div>
          <div className="text-2xl font-bold font-mono text-neutral-900 mt-1">{counts.total}</div>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-2xs">
          <div className="text-[10px] text-amber-800 uppercase font-semibold">Open Discrepancies</div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">{counts.open}</div>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-2xs">
          <div className="text-[10px] text-rose-800 uppercase font-semibold">Gate 2 Blocking</div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{counts.blocking}</div>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-2xs">
          <div className="text-[10px] text-emerald-800 uppercase font-semibold">Resolved / Waived</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{counts.resolved}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exceptions by ID, description, document..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-500" />
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-neutral-300 rounded bg-white font-medium"
          >
            <option value="ALL">All Statuses ({exceptions.length})</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
            <option value="WAIVED_WITH_JUSTIFICATION">Waived</option>
            <option value="REOPENED">Reopened</option>
          </select>

          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-neutral-300 rounded bg-white font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="SECURITY_QUARANTINE">Security Quarantine</option>
            <option value="OCR_PROCESSING_FAILURE">OCR Failure</option>
            <option value="AI_CATEGORY_CONFLICT">AI Category Conflict</option>
            <option value="LOW_CONFIDENCE_MATERIAL_FIELD">Low Confidence Field</option>
            <option value="EXACT_HASH_DUPLICATE">Exact Duplicate</option>
            <option value="SUPERSEDED_VERSION_CONFLICT">Superseded Version</option>
            <option value="TAX_YEAR_MISMATCH">Tax Year Mismatch</option>
            <option value="UPSTREAM_SOURCE_INVALIDATION">Upstream Change</option>
          </select>
        </div>
      </div>

      {/* Exceptions List */}
      <div className="space-y-3">
        {filteredExceptions.map((exc) => {
          const isOpen = exc.status === 'OPEN' || exc.status === 'REOPENED' || exc.status === 'UNDER_REVIEW';

          return (
            <div
              key={exc.exceptionId}
              className={`p-5 rounded-xl border shadow-xs space-y-3 transition-colors ${
                exc.isBlocking && isOpen ? 'bg-rose-50/40 border-rose-300' : 'bg-white border-neutral-300'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 rounded">
                      {exc.exceptionId}
                    </span>
                    <span className="text-sm font-bold text-neutral-900">{exc.title}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getSeverityBadge(exc.severity)}`}>
                      {exc.severity}
                    </span>
                    {exc.isBlocking && isOpen && (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-600 text-white rounded">
                        GATE 2 BLOCKING
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                      exc.status === 'RESOLVED'
                        ? 'bg-emerald-100 text-emerald-900'
                        : exc.status === 'WAIVED_WITH_JUSTIFICATION'
                        ? 'bg-indigo-100 text-indigo-900'
                        : 'bg-amber-100 text-amber-900'
                    }`}>
                      {exc.status}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-700 leading-relaxed font-medium">
                    {exc.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-500 pt-1">
                    <span>Category: <strong>{exc.category}</strong></span>
                    {exc.sourceDocumentId && (
                      <>
                        <span>•</span>
                        <span>Source Doc: <code>{exc.sourceDocumentId}</code></span>
                      </>
                    )}
                    <span>•</span>
                    <span>Logged: {new Date(exc.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isOpen && (
                    <button
                      onClick={() => {
                        setTargetException(exc);
                        setResolutionAction('RESOLVE');
                        setJustification('');
                        setEvidenceReference('');
                        setResolutionError(null);
                      }}
                      className="px-3 py-1.5 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#D7AC4A]" />
                      <span>Resolve or Waive</span>
                    </button>
                  )}

                  {!isOpen && exc.resolution && (
                    <div className="text-right text-xs">
                      <span className="font-bold text-emerald-800">
                        {exc.resolution.status} by {exc.resolution.resolvedBy}
                      </span>
                      <div className="text-[10px] text-neutral-500 italic max-w-xs truncate">
                        "{exc.resolution.reason}"
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit History Snapshot */}
              {exc.auditHistory.length > 0 && (
                <div className="p-2.5 bg-neutral-50/80 border border-neutral-200 rounded text-[11px] text-neutral-600 space-y-1">
                  <div className="font-semibold text-neutral-700 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <span>Audit Trail:</span>
                  </div>
                  {exc.auditHistory.slice(-2).map((audit, i) => (
                    <div key={i} className="font-mono text-[10px] text-neutral-500">
                      [{new Date(audit.timestamp).toLocaleTimeString()}] {audit.actor} ({audit.role}): {audit.action} — {audit.notes}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredExceptions.length === 0 && (
          <div className="p-8 text-center text-neutral-500 text-xs bg-white border border-neutral-300 rounded-lg">
            No exceptions currently logged for Tax Year {taxYear}.
          </div>
        )}
      </div>

      {/* DISPOSITION MODAL (RESOLVE OR WAIVE) */}
      {targetException && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-neutral-300 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Disposition Exception</h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  ID: {targetException.exceptionId} • Category: {targetException.category}
                </p>
              </div>
              <button
                onClick={() => setTargetException(null)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteDisposition} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Action
                </label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded bg-white font-medium"
                >
                  <option value="RESOLVE">Resolve Exception (Verified & Remediated)</option>
                  <option value="WAIVE_WITH_JUSTIFICATION">Waive with Professional Justification</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Mandatory Professional Justification *
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain why this exception is resolved or why a formal waiver applies..."
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Evidence Reference / Workpaper Note
                </label>
                <input
                  type="text"
                  value={evidenceReference}
                  onChange={(e) => setEvidenceReference(e.target.value)}
                  placeholder="e.g., Workpaper WP-2025-W2, Client Email 03/15/2025"
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                />
              </div>

              {resolutionError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded text-xs font-medium">
                  {resolutionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setTargetException(null)}
                  className="px-4 py-2 border border-neutral-300 rounded text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#D7AC4A]" />
                  <span>Confirm Disposition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE EXCEPTION MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-neutral-300 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Log Collection Exception</h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Record an intake or evidence discrepancy into the unified exceptions registry.
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateException} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="TAX_YEAR_MISMATCH">Tax Year Mismatch</option>
                    <option value="LOW_CONFIDENCE_MATERIAL_FIELD">Low Confidence Field</option>
                    <option value="MISSING_MANDATORY_EVIDENCE">Missing Evidence</option>
                    <option value="SECURITY_QUARANTINE">Security Quarantine</option>
                    <option value="OCR_PROCESSING_FAILURE">OCR Processing Failure</option>
                    <option value="EXACT_HASH_DUPLICATE">Exact Duplicate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Severity
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Exception Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Form 1099-INT Tax Year 2024 uploaded for 2025 engagement"
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Detailed Description & Findings
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe the discrepancy and actions required to remedy..."
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Associated Document ID (Optional)
                </label>
                <input
                  type="text"
                  value={newSourceDocId}
                  onChange={(e) => setNewSourceDocId(e.target.value)}
                  placeholder="e.g., DOC-2025-10023"
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="newIsBlocking"
                  checked={newIsBlocking}
                  onChange={(e) => setNewIsBlocking(e.target.checked)}
                  className="rounded text-[#0A2544] focus:ring-[#0A2544]"
                />
                <label htmlFor="newIsBlocking" className="text-xs font-semibold text-neutral-800 cursor-pointer">
                  Gate 2 Blocking Condition (Prevents Stage 02 Exit Clearance)
                </label>
              </div>

              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded text-xs font-medium">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4 text-[#D7AC4A]" />
                  <span>Log Exception</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
