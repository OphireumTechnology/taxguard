/**
 * A/R Tax Services, LLC - Accountant AI Exception Center
 * Section 22: High Priority, Review, and Information Exceptions with human-in-the-loop disposition.
 */

import React, { useState } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ArrowUpRight, 
  Filter, 
  Search,
  MessageSquare,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';
import { AiExceptionRecord } from '../../types/accountantCenter';

interface AiExceptionCenterProps {
  isDark: boolean;
  onNavigateToDocs?: () => void;
}

export const AiExceptionCenter: React.FC<AiExceptionCenterProps> = ({ isDark, onNavigateToDocs }) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Disposition modal
  const [activeException, setActiveException] = useState<AiExceptionRecord | null>(null);
  const [dispositionAction, setDispositionAction] = useState<string>('Resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const exceptions = accountantCenterService.getExceptions();
  const client = accountantCenterService.getSelectedClient();
  const taxYear = accountantCenterService.getSelectedTaxYear();

  const getSeverityLabel = (e: AiExceptionRecord): string => {
    if (e.severity) return e.severity;
    if (e.priority === 'HIGH') return 'High Priority';
    if (e.priority === 'REVIEW') return 'Review';
    return 'Information';
  };

  const getStatusLabel = (e: AiExceptionRecord): string => {
    if (e.status) return e.status;
    if (e.disposition === 'OPEN') return 'Open';
    if (e.disposition === 'RESOLVED') return 'Resolved';
    if (e.disposition === 'NOT_APPLICABLE') return 'Not Applicable';
    if (e.disposition === 'CLIENT_CLARIFICATION_REQUIRED') return 'Client Clarification Required';
    return e.disposition || 'Open';
  };

  const filtered = exceptions.filter(e => {
    const sev = getSeverityLabel(e);
    const st = getStatusLabel(e);
    if (selectedSeverity !== 'ALL' && sev !== selectedSeverity) return false;
    if (selectedStatus !== 'ALL' && st !== selectedStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
    }
    return true;
  });

  const openResolveModal = (exc: AiExceptionRecord, defaultAction: string) => {
    setActiveException(exc);
    setDispositionAction(defaultAction);
    setResolutionNotes('');
  };

  const handleApplyDisposition = () => {
    if (!activeException) return;
    if (!resolutionNotes.trim()) {
      alert('Statutory audit trail requirement: Please record a brief accountant reason/basis.');
      return;
    }

    let disp: any = 'RESOLVED';
    if (dispositionAction.includes('Clarification')) disp = 'CLIENT_CLARIFICATION_REQUIRED';
    else if (dispositionAction.includes('Not Applicable') || dispositionAction === 'Not Applicable') disp = 'NOT_APPLICABLE';
    else if (dispositionAction.includes('Corrected')) disp = 'CORRECTED';
    else if (dispositionAction.includes('Escalated')) disp = 'ESCALATED';

    accountantCenterService.resolveException(activeException.id, disp, resolutionNotes);
    setActiveException(null);
  };

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  const highCount = exceptions.filter(e => getSeverityLabel(e) === 'High Priority' && getStatusLabel(e) === 'Open').length;
  const reviewCount = exceptions.filter(e => getSeverityLabel(e) === 'Review' && getStatusLabel(e) === 'Open').length;
  const infoCount = exceptions.filter(e => getSeverityLabel(e) === 'Information' && getStatusLabel(e) === 'Open').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[10px] font-mono uppercase bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
            Section 22 &bull; Accountant Exception Center
          </div>
          <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary} flex items-center gap-2`}>
            <span>Tax AI Exception &amp; Discrepancy Clearance</span>
            {highCount > 0 && (
              <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-mono rounded">
                {highCount} High Priority Blockers
              </span>
            )}
          </h2>
          <p className={`text-xs ${textSecondary} mt-0.5`}>
            Intelligent risk scoring, classification anomalies, and duplicate isolation for <strong>{client.name}</strong> (TY{taxYear}).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-2.5 border rounded border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 text-xs font-mono flex items-center gap-3">
            <span className="text-red-600 font-bold">🔴 {highCount} High</span>
            <span className="text-amber-600 font-bold">🟡 {reviewCount} Review</span>
            <span className="text-blue-600 font-bold">🔵 {infoCount} Info</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 border rounded-lg shadow-sm ${cardBg} flex flex-col sm:flex-row items-stretch sm:items-center gap-3`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search exceptions by title, category, or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded focus:outline-none"
          />
        </div>

        <select
          value={selectedSeverity}
          onChange={e => setSelectedSeverity(e.target.value)}
          className="text-xs py-1.5 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded focus:outline-none font-mono"
        >
          <option value="ALL">All Severities</option>
          <option value="High Priority">High Priority (Hard-Stops)</option>
          <option value="Review">Review (Recommended)</option>
          <option value="Information">Information Only</option>
        </select>

        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="text-xs py-1.5 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded focus:outline-none font-mono"
        >
          <option value="ALL">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Resolved">Resolved</option>
          <option value="Not Applicable">Not Applicable</option>
          <option value="Client Clarification Required">Client Clarification</option>
        </select>
      </div>

      {/* Exception Records Grid / List */}
      <div className="space-y-3">
        {filtered.map((exc) => {
          const sevLabel = getSeverityLabel(exc);
          const stLabel = getStatusLabel(exc);
          const isHigh = sevLabel === 'High Priority';
          const isReview = sevLabel === 'Review';
          const isResolved = stLabel !== 'Open';

          return (
            <div 
              key={exc.id}
              className={`p-4 border rounded-lg shadow-sm transition-all ${
                isResolved 
                  ? 'opacity-70 bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800' 
                  : isHigh 
                  ? 'border-red-400 bg-red-50/30 dark:bg-red-950/20 dark:border-red-900' 
                  : isReview 
                  ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-900' 
                  : 'border-blue-400 bg-blue-50/20 dark:bg-blue-950/20 dark:border-blue-900'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isHigh ? 'bg-red-600 text-white' : isReview ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                    }`}>
                      {sevLabel}
                    </span>
                    <span className="text-xs font-mono font-bold text-neutral-500">
                      {exc.category} &bull; {exc.id}
                    </span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-bold ${
                      isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-800'
                    }`}>
                      [{stLabel.toUpperCase()}]
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {exc.title}
                  </h3>

                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {exc.description}
                  </p>

                  {exc.impactOnPreparation && (
                    <div className="text-[11px] font-mono text-neutral-500">
                      <strong>Filing Impact:</strong> {exc.impactOnPreparation}
                    </div>
                  )}

                  {(exc.resolutionNote || exc.resolutionNotes) && (
                    <div className="p-2 border rounded border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-mono text-emerald-900 dark:text-emerald-200 mt-2">
                      <strong>Accountant Disposition ({exc.resolvedBy}):</strong> {exc.resolutionNote || exc.resolutionNotes}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {!isResolved && (
                  <div className="flex flex-wrap md:flex-col gap-1.5 self-start min-w-[170px]">
                    <button
                      onClick={() => openResolveModal(exc, 'Resolved')}
                      className="w-full px-2.5 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold uppercase hover:bg-emerald-700 flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>

                    <button
                      onClick={() => openResolveModal(exc, 'Client Clarification Required')}
                      className="w-full px-2.5 py-1.5 border border-neutral-400 dark:border-neutral-600 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ask Client</span>
                    </button>

                    <button
                      onClick={() => openResolveModal(exc, 'Not Applicable')}
                      className="w-full px-2.5 py-1.5 border border-neutral-400 dark:border-neutral-600 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Mark N/A
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className={`p-8 border rounded-lg text-center text-neutral-500 font-mono text-xs ${cardBg}`}>
            No exceptions found matching current filter parameters.
          </div>
        )}
      </div>

      {/* Resolution Audit Modal */}
      {activeException && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-lg border rounded-xl p-5 shadow-2xl ${
            isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
          } space-y-4`}>
            <div className="flex justify-between items-center border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold uppercase">Record Exception Disposition</h3>
              <button onClick={() => setActiveException(null)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800 font-mono">
                <div className="text-[10px] text-neutral-500">EXCEPTION</div>
                <strong>{activeException.title}</strong>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-neutral-500">Disposition Status</label>
                <select
                  value={dispositionAction}
                  onChange={e => setDispositionAction(e.target.value)}
                  className="w-full mt-1 p-2 text-xs bg-neutral-50 dark:bg-neutral-800 border rounded font-mono"
                >
                  <option value="Resolved">Resolved / Cleared</option>
                  <option value="Not Applicable">Not Applicable / Waived</option>
                  <option value="Corrected">Corrected via Source Document</option>
                  <option value="Client Clarification Required">Client Clarification Required</option>
                  <option value="Escalated">Escalated to Senior Reviewer</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-neutral-500">
                  Accountant Rationale / Audit Notes (Required)
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="State the reason, verification check, or source authority for resolving this exception..."
                  className="w-full mt-1 p-2 text-xs bg-neutral-50 dark:bg-neutral-800 border rounded focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setActiveException(null)}
                className="px-3 py-1.5 border rounded text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDisposition}
                className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded text-xs font-bold uppercase"
              >
                Commit Disposition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
