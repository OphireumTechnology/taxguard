/**
 * A/R Tax Services, LLC - Senior Reviewer / CPA / EA Demonstration Workspace
 * Strict Maker-Checker QC enforcement, return certification, and variance diagnostics.
 */

import React, { useState, useEffect } from 'react';
import { DemoEngagement, DemoTaxWorkpaper, DemoAuditEvent } from '../types';
import { demoDataStore } from '../services/DemoDataService';
import { 
  Scale, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  ShieldCheck, 
  XCircle, 
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  Layers,
  BookOpen,
  ShieldAlert
} from 'lucide-react';
import { 
  ProfessionalReviewQueue,
  ApprovalGate,
  DiscrepancyPanel,
  AIResearchAssistant,
  SideBySideReviewWorkspace,
  BrandedDeliverablesGenerator
} from '../../taxguard';

interface ReviewerDashboardViewProps {
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
  onOpenAiAssistant: () => void;
}

export const ReviewerDashboardView: React.FC<ReviewerDashboardViewProps> = ({ 
  activeNavId, 
  onSelectNav, 
  onOpenAiAssistant 
}) => {
  const [engagements, setEngagements] = useState<DemoEngagement[]>([]);
  const [workpapers, setWorkpapers] = useState<DemoTaxWorkpaper[]>([]);
  const [selectedEngagement, setSelectedEngagement] = useState<DemoEngagement | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const currentSection = activeNavId && activeNavId !== 'default' ? activeNavId : 'queue';

  const refresh = () => {
    const allEngs = demoDataStore.getEngagements();
    setEngagements(allEngs);
    setWorkpapers(demoDataStore.getWorkpapers());
    if (!selectedEngagement && allEngs.length > 0) {
      setSelectedEngagement(allEngs.find(e => e.approvalState === 'Pending Review' || e.currentStatus === 'Senior Review') || allEngs[0]);
    }
  };

  useEffect(() => {
    refresh();
    return demoDataStore.subscribe(refresh);
  }, []);

  // Handle CPA Quality Certification
  const handleApprove = () => {
    if (!selectedEngagement) return;
    const reviewerName = 'Elena Rostova, CPA';
    const reviewerId = 'usr_rev_elena';

    const result = demoDataStore.approveEngagementByReviewer(
      selectedEngagement.id,
      reviewerName,
      reviewerId
    );

    if (result.success) {
      setActionNotice({
        type: 'success',
        message: `Certified return package for ${selectedEngagement.clientName}. Released for client signature authorization.`
      });
      refresh();
    } else {
      setActionNotice({
        type: 'error',
        message: result.error || 'Maker-Checker gate failure.'
      });
    }

    setTimeout(() => setActionNotice(null), 5000);
  };

  // Handle Return with Correction Request
  const handleReject = () => {
    if (!selectedEngagement || !rejectionNotes.trim()) return;
    demoDataStore.rejectEngagementByReviewer(
      selectedEngagement.id,
      'Elena Rostova, CPA',
      rejectionNotes.trim()
    );

    setActionNotice({
      type: 'success',
      message: `Return sent back to preparer with formal correction notice.`
    });
    setRejectionNotes('');
    refresh();
    setTimeout(() => setActionNotice(null), 5000);
  };

  const reviewQueue = engagements.filter(e => 
    e.currentStatus === 'Senior Review' || 
    e.currentStatus === 'Corrections Required' || 
    e.approvalState === 'Pending Review' ||
    e.approvalState === 'Reviewer Approved'
  );

  return (
    <div className="space-y-6">
      {/* Action Notice */}
      {actionNotice && (
        <div className={`p-3 border text-xs font-bold ${
          actionNotice.type === 'success' 
            ? 'border-black bg-neutral-50 text-black' 
            : 'border-black bg-white text-black'
        }`}>
          {actionNotice.message}
        </div>
      )}

      {/* Header Info */}
      <div className="border border-neutral-300 p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            A/R Tax Services, LLC • Director of Quality Control &amp; Technical Tax Positions
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            Senior Reviewer &amp; CPA Quality Certification Workspace
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="border border-black px-2 py-1 text-xs font-mono font-bold bg-neutral-50">
            Review Queue: {reviewQueue.length} Active Returns
          </span>
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Review Assistant</span>
          </button>
        </div>
      </div>

      {/* Section: Side-by-Side OCR & Provenance Review */}
      {currentSection === 'side_by_side' && (
        <div className="pt-1">
          <SideBySideReviewWorkspace userRole="reviewer" />
        </div>
      )}

      {/* Section: Branded Deliverables & Workpaper Packages */}
      {currentSection === 'deliverables' && (
        <div className="pt-1">
          <BrandedDeliverablesGenerator userRole="reviewer" />
        </div>
      )}

      {/* Section: Maker-Checker Approval Gate */}
      {currentSection === 'approval_gate' && (
        <div className="space-y-6">
          <div className="border border-neutral-300 p-5 bg-white">
            <ApprovalGate userRole="reviewer" />
          </div>
          <div className="border border-neutral-300 p-5 bg-white">
            <ProfessionalReviewQueue userRole="reviewer" />
          </div>
        </div>
      )}

      {/* Section: Variance & Discrepancy Diagnostics */}
      {currentSection === 'diagnostics' && (
        <div className="border border-neutral-300 p-5 bg-white">
          <DiscrepancyPanel userRole="reviewer" />
        </div>
      )}

      {/* Section: IRC / Statutory Defense Research */}
      {currentSection === 'research' && (
        <div className="border border-neutral-300 p-5 bg-white">
          <AIResearchAssistant userRole="reviewer" />
        </div>
      )}

      {/* Section: Active Senior Review Queue & Certification (Default / Overview / Queue) */}
      {(currentSection === 'queue' || currentSection === 'certification' || currentSection === 'overview' || currentSection === 'workpapers') && (
        <>
          {/* Review Queue Table */}
      <div className="border border-neutral-300 overflow-x-auto">
        <div className="p-3 bg-neutral-50 border-b border-neutral-300 text-xs font-bold uppercase tracking-wider text-black flex items-center justify-between">
          <span>Active Senior Review Queue</span>
          <span className="text-[11px] font-mono text-neutral-500 font-normal">
            Enforces strict two-party verification (Preparer &ne; Reviewer)
          </span>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-white text-[10px] font-mono uppercase text-neutral-600">
              <th className="p-2.5">Client &amp; Entity</th>
              <th className="p-2.5">Form / Year</th>
              <th className="p-2.5">Preparer</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">Approval State</th>
              <th className="p-2.5">Statutory Deadline</th>
              <th className="p-2.5 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {reviewQueue.map((eng) => {
              const isSelected = selectedEngagement?.id === eng.id;
              return (
                <tr key={eng.id} className={`hover:bg-neutral-50 ${isSelected ? 'bg-neutral-100 font-medium' : ''}`}>
                  <td className="p-2.5">
                    <div className="font-bold text-black">{eng.clientName}</div>
                    <div className="text-[11px] text-neutral-500">{eng.businessName || eng.entityType}</div>
                  </td>
                  <td className="p-2.5 font-mono text-black">{eng.formType} ({eng.taxYear})</td>
                  <td className="p-2.5 text-neutral-700">{eng.assignedPreparerId === 'usr_acc_marcus' ? 'Marcus Vance, EA' : 'Practice Preparer'}</td>
                  <td className="p-2.5">
                    <span className="border border-neutral-300 px-1.5 py-0.5 text-[10px] font-mono">
                      {eng.currentStatus}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      eng.approvalState === 'Reviewer Approved' 
                        ? 'border-black bg-black text-white' 
                        : eng.approvalState === 'Corrections Required'
                        ? 'border-black bg-white text-black'
                        : 'border-neutral-300 bg-white text-black'
                    }`}>
                      {eng.approvalState}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-neutral-600">{eng.statutoryDeadline}</td>
                  <td className="p-2.5 text-right">
                    <button
                      onClick={() => setSelectedEngagement(eng)}
                      className={`px-2.5 py-1 text-xs border ${
                        isSelected 
                          ? 'border-black bg-black text-white font-bold' 
                          : 'border-neutral-300 hover:border-black'
                      }`}
                    >
                      Inspect Dossier
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Return Dossier & Quality Gate */}
      {selectedEngagement && (
        <div className="border border-neutral-300 p-5 space-y-5 bg-white">
          <div className="border-b border-neutral-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 mr-2">
                Dossier Audit Mode
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-black inline">
                {selectedEngagement.formType} — {selectedEngagement.businessName || selectedEngagement.clientName}
              </h3>
            </div>
            <div className="text-xs font-mono text-neutral-600">
              Assigned Reviewer: <strong>Elena Rostova, CPA</strong>
            </div>
          </div>

          {/* Workpapers Traceability Matrix */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-black">
              Source-to-Return Workpapers &amp; Book-to-Tax Adjustments
            </h4>
            <div className="border border-neutral-300 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-mono uppercase text-neutral-600">
                    <th className="p-2">Workpaper Title</th>
                    <th className="p-2">Form Line</th>
                    <th className="p-2 text-right">Book Amount</th>
                    <th className="p-2 text-right">Tax Adjustment</th>
                    <th className="p-2 text-right">Tax Line Amount</th>
                    <th className="p-2">QC Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {workpapers.filter(w => w.engagementId === selectedEngagement.id).map((wp) => (
                    <tr key={wp.id} className="hover:bg-neutral-50">
                      <td className="p-2 font-medium text-black">
                        <div>{wp.title}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">{wp.notes}</div>
                      </td>
                      <td className="p-2 font-mono text-neutral-600">{wp.formLine}</td>
                      <td className="p-2 font-mono text-right">${wp.bookAmount.toFixed(2)}</td>
                      <td className="p-2 font-mono text-right text-neutral-700">
                        {wp.taxAdjustment !== 0 ? (wp.taxAdjustment > 0 ? `+${wp.taxAdjustment.toFixed(2)}` : wp.taxAdjustment.toFixed(2)) : '$0.00'}
                      </td>
                      <td className="p-2 font-mono font-bold text-right text-black">${wp.taxAmount.toFixed(2)}</td>
                      <td className="p-2">
                        <span className="border border-neutral-300 px-1.5 py-0.5 text-[10px] font-mono">
                          {wp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {workpapers.filter(w => w.engagementId === selectedEngagement.id).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-3 text-center text-neutral-500 font-mono text-xs">
                        Trial balance accounts reconciled directly to statutory return schedules.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maker-Checker Verification Gate */}
          <div className="border border-black p-4 space-y-3 bg-neutral-50">
            <div className="flex items-center gap-2 font-bold uppercase text-xs text-black">
              <ShieldCheck className="w-4 h-4 text-black" />
              <span>CPA Maker-Checker Final Release Certification</span>
            </div>
            <p className="text-xs text-neutral-700 leading-relaxed">
              By certifying below, you attest that you are an authorized CPA/EA independent of the primary preparer ({selectedEngagement.assignedPreparerId === 'usr_acc_marcus' ? 'Marcus Vance, EA' : 'Staff Preparer'}), have inspected all underlying 1099/W-2/bank statements, and verified Schedule M-1 book-to-tax reconciliations.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={handleApprove}
                className="px-5 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Certify Return &amp; Release to Client (Simulated)</span>
              </button>

              <div className="text-[11px] font-mono text-neutral-500">
                Action is immutably logged with timestamp and reviewer ID.
              </div>
            </div>
          </div>

          {/* Return for Correction Section */}
          <div className="border border-neutral-300 p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold uppercase text-xs text-black">
              <AlertTriangle className="w-4 h-4 text-black" />
              <span>Issue Review Diagnostic / Return with Corrections Required</span>
            </div>
            <textarea
              rows={2}
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Specify technical adjustment, missing document, or variance requiring preparer correction..."
              className="w-full p-2.5 text-xs border border-neutral-300 focus:outline-none focus:border-black rounded-none"
            />
            <button
              onClick={handleReject}
              disabled={!rejectionNotes.trim()}
              className="px-4 py-1.5 border border-black text-xs font-bold uppercase hover:bg-neutral-100 disabled:opacity-40"
            >
              Return to Preparer with Notice
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};
