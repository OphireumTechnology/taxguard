/**
 * StageTwoMissingDocumentsView.tsx
 * TG-COL-021: Missing Document Detection & Dynamic Requirement Evaluation
 *
 * Implements strict invariant:
 * - A document must not satisfy a requirement merely because a file was uploaded.
 * - Rejected, quarantined, invalid, or superseded documents cannot satisfy requirements.
 */

import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  UploadCloud,
  FileText,
  AlertTriangle,
  Inbox,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Plus
} from 'lucide-react';
import {
  ChecklistRequirement,
  StageTwoUploadedDocument,
  StageTwoCollectionService
} from '../../services/stageTwoCollectionService';
import {
  StageTwoCollectionOperationsService,
  EvaluatedDocumentStatus
} from '../../services/stageTwoCollectionOperationsService';
import { StagedSecurityDocument } from '../../services/stageTwoIntakeSecurityService';

interface StageTwoMissingDocumentsViewProps {
  clientId: string;
  taxYear: number;
  engagementId: string;
  onNavigateToUpload: (req?: ChecklistRequirement) => void;
  onNavigateToRequests: (req?: ChecklistRequirement) => void;
  onRefresh?: () => void;
}

export const StageTwoMissingDocumentsView: React.FC<StageTwoMissingDocumentsViewProps> = ({
  clientId,
  taxYear,
  engagementId,
  onNavigateToUpload,
  onNavigateToRequests,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  const requirements = useMemo(() => {
    return StageTwoCollectionService.getRequirements(clientId, taxYear);
  }, [clientId, taxYear]);

  const uploads = useMemo(() => {
    return StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
  }, [clientId, taxYear]);

  const stagedDocs = useMemo(() => {
    return StageTwoCollectionService.getStagedSecurityDocuments(clientId, taxYear);
  }, [clientId, taxYear]);

  // Evaluate requirements dynamically
  const evaluatedItems = useMemo(() => {
    return requirements.map(req => {
      const evaluatedStatus = StageTwoCollectionOperationsService.evaluateRequirementStatus(
        req,
        uploads,
        stagedDocs
      );

      // Find matching docs for explanation
      const matchingDocs = uploads.filter(
        d => d.associatedRequirementId === req.requirementId ||
             d.claimedCategory === req.category
      );

      return {
        requirement: req,
        status: evaluatedStatus,
        matchingDocs
      };
    });
  }, [requirements, uploads, stagedDocs]);

  // Counts
  const counts = useMemo(() => {
    const missing = evaluatedItems.filter(i => i.status === 'MISSING').length;
    const requested = evaluatedItems.filter(i => i.status === 'REQUESTED').length;
    const underReview = evaluatedItems.filter(i => i.status === 'UNDER_REVIEW').length;
    const processing = evaluatedItems.filter(i => i.status === 'PROCESSING').length;
    const accepted = evaluatedItems.filter(i => i.status === 'ACCEPTED').length;
    const rejected = evaluatedItems.filter(i => i.status === 'REJECTED').length;
    const superseded = evaluatedItems.filter(i => i.status === 'SUPERSEDED').length;

    return { missing, requested, underReview, processing, accepted, rejected, superseded };
  }, [evaluatedItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return evaluatedItems.filter(item => {
      if (selectedStatusFilter !== 'ALL' && item.status !== selectedStatusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          item.requirement.title.toLowerCase().includes(query) ||
          item.requirement.formNumber.toLowerCase().includes(query) ||
          item.requirement.category.toLowerCase().includes(query) ||
          item.requirement.requirementId.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [evaluatedItems, selectedStatusFilter, searchQuery]);

  const getStatusBadge = (status: EvaluatedDocumentStatus) => {
    switch (status) {
      case 'ACCEPTED':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'MISSING':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'REQUESTED':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'UNDER_REVIEW':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'PROCESSING':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-900 border-red-300';
      case 'SUPERSEDED':
        return 'bg-neutral-100 text-neutral-800 border-neutral-300';
      case 'NOT_APPLICABLE':
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  return (
    <div className="space-y-6" id="tg-col-021-missing-documents-view">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-[#061A2F] to-[#0A2E5C] text-white rounded-xl shadow-md border border-[#1A365D] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D7AC4A]/20 text-[#D7AC4A] rounded-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                TG-COL-021: Missing Document Detection & Evaluation
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Dynamic evaluation of rules-driven required documentation against verified evidence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-Evaluate</span>
            </button>
          </div>
        </div>

        {/* Governance invariant notice */}
        <div className="p-3 bg-black/30 border border-white/10 rounded-lg text-xs text-slate-200 leading-relaxed flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-[#D7AC4A] shrink-0 mt-0.5" />
          <span>
            <strong>Strict Evidence Invariant:</strong> A requirement is satisfied <em>only</em> by accepted, clean evidence.
            Quarantined files, failed MIME signatures, unreviewed extraction discrepancies, and superseded revisions
            cannot satisfy mandatory IRS collection requirements.
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div
          onClick={() => setSelectedStatusFilter('MISSING')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            selectedStatusFilter === 'MISSING' ? 'ring-2 ring-rose-500 bg-rose-50 border-rose-300' : 'bg-white border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-rose-800">Missing</div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{counts.missing}</div>
        </div>

        <div
          onClick={() => setSelectedStatusFilter('REQUESTED')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            selectedStatusFilter === 'REQUESTED' ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-300' : 'bg-white border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-blue-800">Requested</div>
          <div className="text-2xl font-bold font-mono text-blue-700 mt-1">{counts.requested}</div>
        </div>

        <div
          onClick={() => setSelectedStatusFilter('UNDER_REVIEW')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            selectedStatusFilter === 'UNDER_REVIEW' ? 'ring-2 ring-amber-500 bg-amber-50 border-amber-300' : 'bg-white border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-amber-800">Under Review</div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">{counts.underReview}</div>
        </div>

        <div
          onClick={() => setSelectedStatusFilter('PROCESSING')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            selectedStatusFilter === 'PROCESSING' ? 'ring-2 ring-indigo-500 bg-indigo-50 border-indigo-300' : 'bg-white border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-indigo-800">Processing</div>
          <div className="text-2xl font-bold font-mono text-indigo-700 mt-1">{counts.processing}</div>
        </div>

        <div
          onClick={() => setSelectedStatusFilter('ACCEPTED')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            selectedStatusFilter === 'ACCEPTED' ? 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-300' : 'bg-white border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-emerald-800">Accepted</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{counts.accepted}</div>
        </div>

        <div
          onClick={() => setSelectedStatusFilter('REJECTED')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            selectedStatusFilter === 'REJECTED' ? 'ring-2 ring-red-500 bg-red-50 border-red-300' : 'bg-white border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-red-800">Rejected</div>
          <div className="text-2xl font-bold font-mono text-red-700 mt-1">{counts.rejected}</div>
        </div>

        <div
          onClick={() => setSelectedStatusFilter('SUPERSEDED')}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            selectedStatusFilter === 'SUPERSEDED' ? 'ring-2 ring-neutral-500 bg-neutral-100 border-neutral-400' : 'bg-white border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-neutral-700">Superseded</div>
          <div className="text-2xl font-bold font-mono text-neutral-800 mt-1">{counts.superseded}</div>
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
            placeholder="Search missing requirements by title, form, or category..."
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
            <option value="ALL">All Evaluated Statuses ({evaluatedItems.length})</option>
            <option value="MISSING">Missing ({counts.missing})</option>
            <option value="REQUESTED">Requested ({counts.requested})</option>
            <option value="UNDER_REVIEW">Under Review ({counts.underReview})</option>
            <option value="PROCESSING">Processing ({counts.processing})</option>
            <option value="ACCEPTED">Accepted ({counts.accepted})</option>
            <option value="REJECTED">Rejected ({counts.rejected})</option>
            <option value="SUPERSEDED">Superseded ({counts.superseded})</option>
          </select>
        </div>
      </div>

      {/* Requirement Items Table */}
      <div className="bg-white border border-neutral-300 rounded-lg shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-100 text-neutral-700 text-[11px] uppercase tracking-wider font-bold border-b border-neutral-200">
              <th className="p-3">Requirement & Form</th>
              <th className="p-3">Category</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Evaluated Status</th>
              <th className="p-3">Evidence Details</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-xs text-neutral-800">
            {filteredItems.map(({ requirement, status, matchingDocs }) => (
              <tr key={requirement.requirementId} className="hover:bg-neutral-50 transition-colors">
                <td className="p-3">
                  <div className="font-bold text-neutral-900">{requirement.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-1.5 py-0.2 text-[10px] font-mono font-semibold bg-neutral-200 text-neutral-800 rounded">
                      {requirement.formNumber}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {requirement.requirementId}
                    </span>
                  </div>
                </td>

                <td className="p-3 text-neutral-700 font-medium">
                  {requirement.category}
                </td>

                <td className="p-3">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    requirement.priority === 'Required'
                      ? 'bg-rose-100 text-rose-900'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}>
                    {requirement.priority}
                  </span>
                </td>

                <td className="p-3">
                  <span className={`px-2.5 py-1 text-[11px] font-bold font-mono rounded border ${getStatusBadge(status)}`}>
                    {status}
                  </span>
                </td>

                <td className="p-3 text-neutral-600">
                  {matchingDocs.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-neutral-800">
                        {matchingDocs.length} linked file(s):
                      </div>
                      <div className="text-[10px] font-mono text-neutral-500 truncate max-w-xs">
                        {matchingDocs.map(d => `${d.originalFileName} (${d.processingStatus})`).join(', ')}
                      </div>
                    </div>
                  ) : (
                    <span className="text-neutral-400 italic text-[11px]">No documents ingested yet</span>
                  )}
                </td>

                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {status === 'MISSING' && (
                      <>
                        <button
                          onClick={() => onNavigateToRequests(requirement)}
                          className="px-2.5 py-1 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-xs"
                          title="Create Document Request for Client"
                        >
                          <Inbox className="w-3 h-3 text-[#D7AC4A]" />
                          <span>Request</span>
                        </button>
                        <button
                          onClick={() => onNavigateToUpload(requirement)}
                          className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded text-[11px] font-semibold flex items-center gap-1"
                          title="Direct Ingest Evidence"
                        >
                          <UploadCloud className="w-3 h-3 text-neutral-600" />
                          <span>Upload</span>
                        </button>
                      </>
                    )}

                    {status === 'REQUESTED' && (
                      <button
                        onClick={() => onNavigateToRequests(requirement)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Inbox className="w-3 h-3 text-blue-600" />
                        <span>View Request</span>
                      </button>
                    )}

                    {status === 'ACCEPTED' && (
                      <span className="px-2 py-1 text-emerald-800 text-[11px] font-medium flex items-center gap-1 justify-end">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Satisfied</span>
                      </span>
                    )}

                    {(status === 'UNDER_REVIEW' || status === 'REJECTED' || status === 'SUPERSEDED') && (
                      <button
                        onClick={() => onNavigateToUpload(requirement)}
                        className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded text-[11px] font-semibold flex items-center gap-1"
                      >
                        <UploadCloud className="w-3 h-3 text-neutral-600" />
                        <span>Re-Upload</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-neutral-500 text-xs">
                  No requirements found matching the selected status or query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
