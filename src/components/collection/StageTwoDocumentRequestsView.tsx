/**
 * StageTwoDocumentRequestsView.tsx
 * TG-COL-022: Document Request Management & Duplicate Prevention
 * TG-COL-023: Client Reminder & Automated Chasing Engine
 *
 * Implements:
 * - Controlled document request generation linked to Client ID + Tax Year + Requirement ID
 * - Strict duplicate request prevention for unresolved requirements
 * - Automated chasing reminders with escalation status & simulated dev notice
 * - Resolution lifecycle (SATISFIED, WAIVED, CANCELLED) with mandatory notes
 */

import React, { useState, useMemo } from 'react';
import {
  Inbox,
  Send,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Bell,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  FileText
} from 'lucide-react';
import {
  StageTwoCollectionOperationsService,
  DocumentRequest,
  ReminderDispatchRecord
} from '../../services/stageTwoCollectionOperationsService';
import {
  ChecklistRequirement,
  StageTwoCollectionService
} from '../../services/stageTwoCollectionService';

interface StageTwoDocumentRequestsViewProps {
  clientId: string;
  taxYear: number;
  engagementId: string;
  initialTargetRequirement?: ChecklistRequirement | null;
  onNavigateToUpload?: () => void;
}

export const StageTwoDocumentRequestsView: React.FC<StageTwoDocumentRequestsViewProps> = ({
  clientId,
  taxYear,
  engagementId,
  initialTargetRequirement,
  onNavigateToUpload
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(!!initialTargetRequirement);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>(
    initialTargetRequirement?.requirementId || ''
  );
  const [customTitle, setCustomTitle] = useState<string>(initialTargetRequirement?.title || '');
  const [requestedDocDescription, setRequestedDocDescription] = useState<string>(
    initialTargetRequirement ? `Official copy of ${initialTargetRequirement.title} (${initialTargetRequirement.formNumber})` : ''
  );
  const [requestPriority, setRequestPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'>('HIGH');
  const [dueDateDays, setDueDateDays] = useState<number>(14);
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState<boolean>(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // Resolution modal
  const [resolvingRequest, setResolvingRequest] = useState<DocumentRequest | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'SATISFIED' | 'WAIVED' | 'CANCELLED'>('SATISFIED');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  // Reminder status message
  const [reminderStatusMessage, setReminderStatusMessage] = useState<string | null>(null);

  // Fetch live requests and reminders
  const requests = useMemo(() => {
    return StageTwoCollectionOperationsService.getDocumentRequests(clientId, taxYear);
  }, [clientId, taxYear, refreshKey]);

  const reminders = useMemo(() => {
    return StageTwoCollectionOperationsService.getReminders(clientId, taxYear);
  }, [clientId, taxYear, refreshKey]);

  const requirements = useMemo(() => {
    return StageTwoCollectionService.getRequirements(clientId, taxYear);
  }, [clientId, taxYear]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (selectedStatusFilter !== 'ALL' && r.status !== selectedStatusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.requestedDocument.toLowerCase().includes(q) ||
          r.requestId.toLowerCase().includes(q) ||
          r.requirementId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requests, selectedStatusFilter, searchQuery]);

  // Handle create request
  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMessage(null);

    const targetReq = requirements.find(r => r.requirementId === selectedRequirementId);
    if (!targetReq && !selectedRequirementId) {
      setFormErrorMessage('Please select a target requirement.');
      return;
    }

    try {
      const dueDate = new Date(Date.now() + dueDateDays * 24 * 3600 * 1000).toISOString();

      StageTwoCollectionOperationsService.createDocumentRequest({
        clientId,
        engagementId,
        taxYear,
        requirementId: targetReq ? targetReq.requirementId : selectedRequirementId,
        title: customTitle || (targetReq ? targetReq.title : 'Additional Tax Document'),
        requestedDocument: requestedDocDescription || (targetReq ? `Copy of ${targetReq.title}` : 'Supporting documentation'),
        requestedBy: 'Sarah Jenkins, CPA',
        requestedByRole: 'cpa',
        dueDate,
        priority: requestPriority,
        allowDuplicateOverride
      });

      setCreateModalOpen(false);
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      setFormErrorMessage(err.message || 'Failed to create document request.');
    }
  };

  // Handle send reminder / chase
  const handleSendReminder = (req: DocumentRequest) => {
    try {
      const dispatch = StageTwoCollectionOperationsService.sendDocumentReminder({
        requestId: req.requestId,
        clientId,
        taxYear,
        actor: 'Sarah Jenkins, CPA',
        actorRole: 'cpa',
        channel: 'EMAIL'
      });

      setReminderStatusMessage(
        `Dispatched Automated Chase #${dispatch.reminderId} via ${dispatch.deliveryChannel}. Escalation: ${dispatch.escalationStatus}. (${dispatch.providerStatus})`
      );
      setRefreshKey(k => k + 1);

      setTimeout(() => setReminderStatusMessage(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to send reminder.');
    }
  };

  // Handle submit resolution
  const handleExecuteResolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingRequest) return;
    setResolutionError(null);

    if (!resolutionNotes.trim()) {
      setResolutionError('Mandatory justification notes are required.');
      return;
    }

    try {
      StageTwoCollectionOperationsService.resolveDocumentRequest({
        requestId: resolvingRequest.requestId,
        clientId,
        taxYear,
        actor: 'Sarah Jenkins, CPA',
        actorRole: 'cpa',
        resolutionStatus,
        notes: resolutionNotes
      });

      setResolvingRequest(null);
      setResolutionNotes('');
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      setResolutionError(err.message || 'Failed to resolve request.');
    }
  };

  return (
    <div className="space-y-6" id="tg-col-022-document-requests-view">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-[#061A2F] to-[#0A2E5C] text-white rounded-xl shadow-md border border-[#1A365D] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D7AC4A]/20 text-[#D7AC4A] rounded-lg">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                TG-COL-022 & TG-COL-023: Document Request & Automated Chasing Engine
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Lifecycle tracking of outstanding document requests with duplicate prevention and automated reminder escalations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedRequirementId(requirements[0]?.requirementId || '');
                setCustomTitle(requirements[0]?.title || '');
                setRequestedDocDescription(requirements[0] ? `Official ${requirements[0].title}` : '');
                setFormErrorMessage(null);
                setCreateModalOpen(true);
              }}
              className="px-3 py-1.5 bg-[#D7AC4A] hover:bg-[#c49a3c] text-[#061A2F] rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Document Request</span>
            </button>
          </div>
        </div>

        {reminderStatusMessage && (
          <div className="p-3 bg-blue-900/60 border border-blue-400 text-blue-100 rounded text-xs font-medium flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#D7AC4A] flex-shrink-0" />
            <span>{reminderStatusMessage}</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-2xs">
          <div className="text-[10px] text-neutral-500 uppercase font-semibold">Total Requests</div>
          <div className="text-2xl font-bold font-mono text-neutral-900 mt-1">{requests.length}</div>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-2xs">
          <div className="text-[10px] text-blue-700 uppercase font-semibold">Active Open</div>
          <div className="text-2xl font-bold font-mono text-blue-700 mt-1">
            {requests.filter(r => r.status === 'OPEN' || r.status === 'IN_PROGRESS').length}
          </div>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-2xs">
          <div className="text-[10px] text-emerald-700 uppercase font-semibold">Fulfilled</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
            {requests.filter(r => r.status === 'FULFILLED').length}
          </div>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-2xs">
          <div className="text-[10px] text-amber-700 uppercase font-semibold">Chasing Reminders Sent</div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
            {reminders.length}
          </div>
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
            placeholder="Search requests by title, document, ID..."
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
            <option value="ALL">All Requests ({requests.length})</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.map((req) => {
          const isOverdue = new Date(req.dueDate).getTime() < Date.now() && (req.status === 'OPEN' || req.status === 'IN_PROGRESS');

          return (
            <div
              key={req.requestId}
              className="p-5 bg-white border border-neutral-300 rounded-xl shadow-xs space-y-3 transition-colors hover:border-neutral-400"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 rounded">
                      {req.requestId}
                    </span>
                    <span className="text-sm font-bold text-neutral-900">{req.title}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      req.priority === 'URGENT'
                        ? 'bg-red-100 text-red-900'
                        : req.priority === 'HIGH'
                        ? 'bg-rose-100 text-rose-900'
                        : 'bg-neutral-100 text-neutral-700'
                    }`}>
                      {req.priority} PRIORITY
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                      req.status === 'FULFILLED'
                        ? 'bg-emerald-100 text-emerald-900'
                        : req.status === 'CANCELLED'
                        ? 'bg-neutral-200 text-neutral-700'
                        : isOverdue
                        ? 'bg-rose-100 text-rose-900 animate-pulse'
                        : 'bg-blue-100 text-blue-900'
                    }`}>
                      {isOverdue ? 'OVERDUE' : req.status}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-700 leading-relaxed font-medium">
                    {req.requestedDocument}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-500 pt-1">
                    <span>Requested by: <strong>{req.requestedBy}</strong> ({req.requestedByRole.toUpperCase()})</span>
                    <span>•</span>
                    <span>Due Date: <strong>{new Date(req.dueDate).toLocaleDateString()}</strong></span>
                    <span>•</span>
                    <span>Requirement ID: <code>{req.requirementId}</code></span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(req.status === 'OPEN' || req.status === 'IN_PROGRESS') && (
                    <>
                      <button
                        onClick={() => handleSendReminder(req)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-700" />
                        <span>Chase Client ({req.reminderCount})</span>
                      </button>

                      <button
                        onClick={() => {
                          setResolvingRequest(req);
                          setResolutionStatus('SATISFIED');
                          setResolutionNotes('');
                          setResolutionError(null);
                        }}
                        className="px-3 py-1.5 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#D7AC4A]" />
                        <span>Disposition Request</span>
                      </button>
                    </>
                  )}

                  {req.status === 'FULFILLED' && req.resolution && (
                    <div className="text-right text-xs">
                      <span className="font-bold text-emerald-800">Fulfilled by {req.resolution.resolvedBy}</span>
                      <div className="text-[10px] text-neutral-500">{new Date(req.resolution.resolvedAt).toLocaleString()}</div>
                    </div>
                  )}

                  {req.status === 'CANCELLED' && req.resolution && (
                    <div className="text-right text-xs">
                      <span className="font-bold text-neutral-700">Closed: {req.resolution.resolutionStatus}</span>
                      <div className="text-[10px] text-neutral-500">{req.resolution.resolutionNotes}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Chasing Engine Status Ribbon */}
              <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded text-xs text-neutral-600 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>
                    Chasing Schedule: {req.reminderCount} reminder(s) dispatched • Escalation Status: <strong className="text-neutral-800">{req.escalationStatus}</strong>
                  </span>
                </div>
                {req.lastReminderDate && (
                  <div className="text-[11px] font-mono text-neutral-500">
                    Last Chase: {new Date(req.lastReminderDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredRequests.length === 0 && (
          <div className="p-8 text-center text-neutral-500 text-xs bg-white border border-neutral-300 rounded-lg">
            No document requests found for the selected criteria.
          </div>
        )}
      </div>

      {/* CREATE REQUEST MODAL (TG-COL-022) */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-neutral-300 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Create Document Request</h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  TG-COL-022: Controlled document request with duplicate request prevention.
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Target Checklist Requirement
                </label>
                <select
                  value={selectedRequirementId}
                  onChange={(e) => {
                    const reqId = e.target.value;
                    setSelectedRequirementId(reqId);
                    const target = requirements.find(r => r.requirementId === reqId);
                    if (target) {
                      setCustomTitle(target.title);
                      setRequestedDocDescription(`Official copy of ${target.title} (${target.formNumber})`);
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544] bg-white"
                  required
                >
                  <option value="">Select a Requirement...</option>
                  {requirements.map((req) => (
                    <option key={req.requirementId} value={req.requirementId}>
                      {req.title} ({req.formNumber}) — Priority: {req.priority}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Request Title
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Detailed Instructions for Client
                </label>
                <textarea
                  value={requestedDocDescription}
                  onChange={(e) => setRequestedDocDescription(e.target.value)}
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={requestPriority}
                    onChange={(e) => setRequestPriority(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value="URGENT">URGENT</option>
                    <option value="HIGH">HIGH</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    Due Date Cadence
                  </label>
                  <select
                    value={dueDateDays}
                    onChange={(e) => setDueDateDays(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded bg-white"
                  >
                    <option value={7}>7 Calendar Days</option>
                    <option value={14}>14 Calendar Days</option>
                    <option value={30}>30 Calendar Days</option>
                  </select>
                </div>
              </div>

              {/* Duplicate Prevention Override */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allowDuplicateOverride"
                    checked={allowDuplicateOverride}
                    onChange={(e) => setAllowDuplicateOverride(e.target.checked)}
                    className="rounded text-[#0A2544] focus:ring-[#0A2544]"
                  />
                  <label htmlFor="allowDuplicateOverride" className="font-semibold text-amber-900 cursor-pointer">
                    Explicit Duplicate Override
                  </label>
                </div>
                <p className="text-[11px] text-amber-800">
                  By default, duplicate active requests for the same requirement are strictly blocked. Check this box only if multiple independent submissions are required.
                </p>
              </div>

              {formErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{formErrorMessage}</span>
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
                  <Inbox className="w-4 h-4 text-[#D7AC4A]" />
                  <span>Create Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL */}
      {resolvingRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-neutral-300 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Disposition Document Request</h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Request ID: {resolvingRequest.requestId} • {resolvingRequest.title}
                </p>
              </div>
              <button
                onClick={() => setResolvingRequest(null)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteResolution} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Resolution Action
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded bg-white"
                >
                  <option value="SATISFIED">Mark Satisfied (Evidence Received)</option>
                  <option value="WAIVED">Waive Requirement (Preparer Exception)</option>
                  <option value="CANCELLED">Cancel Request</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Mandatory Disposition Justification Notes *
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="State evidence reference or business justification for closing this request..."
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                  required
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
                  onClick={() => setResolvingRequest(null)}
                  className="px-4 py-2 border border-neutral-300 rounded text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#D7AC4A]" />
                  <span>Execute Disposition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
