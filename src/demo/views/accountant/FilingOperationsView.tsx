/**
 * A/R Tax Services, LLC - Filing Operations & Simulated Transmission Center
 * Sections 10, 11, 12, 13, 20:
 * Connects authoritative gates, Maker-Checker validations, idempotency locks,
 * agency simulation queues, and simulated government acknowledgements.
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Send,
  RotateCcw,
  FileCheck,
  Building2,
  Lock,
  Unlock,
  Eye,
  FileText,
  Clock,
  History,
  XCircle,
  AlertOctagon,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';
import { preFilingGateRegistryService } from '../../services/preFilingGateRegistryService';
import { DemoFilingRecordExtended } from '../../types/preFilingGateRegistry';

interface FilingOperationsViewProps {
  isDark: boolean;
  onNavigateToQc?: () => void;
  onNavigateToPrep?: () => void;
  onNavigateToAudit?: () => void;
}

export const FilingOperationsView: React.FC<FilingOperationsViewProps> = ({
  isDark,
  onNavigateToQc,
  onNavigateToPrep,
  onNavigateToAudit
}) => {
  const [activeModal, setActiveModal] = useState<'package' | 'gates' | 'auth' | 'ack' | 'correction' | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const [submissionFeedback, setSubmissionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const client = accountantCenterService.getSelectedClient();
  const taxYear = accountantCenterService.getSelectedTaxYear();
  const { gates, canApproveForFiling, blockingReasons } = accountantCenterService.evaluateHardStopGates();
  const finalApproval = accountantCenterService.getFinalApprovalState();
  const extendedRecord: DemoFilingRecordExtended = preFilingGateRegistryService.getExtendedFilingRecord(client.id, taxYear);
  const returnVersion = preFilingGateRegistryService.getReturnVersion(client.id, taxYear);

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  // Authorize demo release (Gate 7 release clearance)
  const handleAuthorizeRelease = () => {
    const authResult = preFilingGateRegistryService.recordFilingReleaseAuthorization(
      client.id,
      taxYear,
      'Marcus Vance, EA'
    );
    if (!authResult.success) {
      setSubmissionFeedback({ type: 'error', message: authResult.message });
    } else {
      setSubmissionFeedback({ type: 'success', message: authResult.message });
      accountantCenterService.notify();
    }
  };

  // Run demo filing simulation with immediate re-evaluation and idempotency lock
  const handleRunSimulation = () => {
    setSubmissionFeedback(null);
    const result = accountantCenterService.simulateEFiling();
    if (!result.success) {
      setSubmissionFeedback({ type: 'error', message: result.message });
    } else {
      setSubmissionFeedback({ type: 'success', message: result.message });
    }
  };

  // Return return for correction (Filing staff boundary enforcement)
  const handleReturnForCorrection = () => {
    if (!correctionNote.trim()) {
      alert('Please provide a correction reason for the responsible preparer.');
      return;
    }
    accountantCenterService.notifyMaterialChange(
      'Filing Operations Return for Correction',
      correctionNote,
      'Filing Operations Staff (Sarah Jenkins)'
    );
    setActiveModal(null);
    setCorrectionNote('');
    setSubmissionFeedback({
      type: 'success',
      message: `Return v${returnVersion} returned to ${client.assignedPreparer || 'Preparer'} for correction. Downstream approvals invalidated.`
    });
  };

  // Simulate gateway response
  const handleSimulateAgencyResponse = (status: 'Accepted' | 'Rejected') => {
    accountantCenterService.updateFilingStatus(
      status,
      status === 'Rejected'
        ? 'R0000-902-01 Schedule C Principal Business Activity Code mismatch with primary NAICS description'
        : undefined
    );
  };

  return (
    <div className="space-y-6">
      {/* STATUTORY DEMONSTRATION NOTICE (Mandatory Sections 13, 20, 54) */}
      <div className="p-4 border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 rounded-lg shadow-sm space-y-1">
        <div className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>DEMONSTRATION ENVIRONMENT — STATUTORY DISCLOSURE</span>
        </div>
        <p className="text-xs leading-relaxed font-sans">
          DEMONSTRATION ENVIRONMENT — No live IRS or state filing, payment, electronic signature, government transmission, or government acknowledgement is performed.
        </p>
      </div>

      {/* Header */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
            Section 10 &bull; Filing Operations &amp; Transmission Queue
          </div>
          <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
            Filing Operations Workspace
          </h2>
          <p className={`text-xs ${textSecondary} mt-0.5`}>
            Electronic Return Originator (ERO) &bull; Client: <strong>{client.name}</strong> &bull; Tax Cycle: <strong className="font-mono">TY{taxYear}</strong> &bull; Version: <strong className="font-mono">v{returnVersion}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className={`px-3 py-1.5 rounded font-bold border ${
            extendedRecord.status.includes('ACCEPTED') ? 'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200' :
            extendedRecord.status.includes('REJECTED') ? 'bg-red-100 text-red-900 border-red-400 dark:bg-red-950 dark:text-red-200' :
            extendedRecord.status.includes('SUBMITTED') || extendedRecord.status.includes('FILED') ? 'bg-blue-100 text-blue-900 border-blue-400 dark:bg-blue-950 dark:text-blue-200' :
            'bg-neutral-100 text-neutral-900 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-200'
          }`}>
            {extendedRecord.status}
          </span>
        </div>
      </div>

      {/* Feedback banner if any */}
      {submissionFeedback && (
        <div className={`p-4 border rounded-lg flex items-start gap-2 text-xs ${
          submissionFeedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
            : 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/40 dark:text-red-200'
        }`}>
          {submissionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <strong>{submissionFeedback.type === 'success' ? 'Simulation Dispatched' : 'Execution Blocked'}:</strong> {submissionFeedback.message}
          </div>
          <button onClick={() => setSubmissionFeedback(null)} className="text-xs font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Section 10: Complete Status Matrix */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
        <div className="border-b pb-3 border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
          <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
            10. Return Transmission Dossier &amp; Control Board
          </h3>
          <span className="text-xs font-mono text-neutral-400">IRS MeF XML Package &bull; Version v{returnVersion}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
            <span className="text-[10px] text-neutral-500 uppercase block">Client / Entity</span>
            <span className="text-xs font-bold text-neutral-900 dark:text-white truncate block">{client.name}</span>
            <span className="text-[10px] text-neutral-500">{client.entityType}</span>
          </div>
          <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
            <span className="text-[10px] text-neutral-500 uppercase block">Tax Year / Form</span>
            <span className="text-xs font-bold text-neutral-900 dark:text-white">TY{taxYear} &bull; Form 1040</span>
            <span className="text-[10px] text-neutral-500">SC1040 (Resident State)</span>
          </div>
          <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
            <span className="text-[10px] text-neutral-500 uppercase block">Jurisdictions</span>
            <span className="text-xs font-bold text-neutral-900 dark:text-white">IRS Federal + SC DOR</span>
            <span className="text-[10px] text-emerald-600">Dual-Filing Linked</span>
          </div>
          <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
            <span className="text-[10px] text-neutral-500 uppercase block">Return Version</span>
            <span className="text-xs font-bold text-neutral-900 dark:text-white font-mono">v{returnVersion}</span>
            <span className="text-[10px] text-neutral-400">Package Lock Active</span>
          </div>

          <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
            <span className="text-[10px] text-neutral-500 uppercase block">Assigned Preparer</span>
            <span className="text-xs font-bold text-neutral-900 dark:text-white">{client.assignedPreparer || 'Marcus Vance, EA'}</span>
            <span className="text-[10px] text-neutral-500">Workpaper Author</span>
          </div>
          <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
            <span className="text-[10px] text-neutral-500 uppercase block">Independent Reviewer</span>
            <span className="text-xs font-bold text-neutral-900 dark:text-white">{client.assignedReviewer || 'Elena Rostova, CPA'}</span>
            <span className="text-[10px] text-emerald-600">QC Reviewer</span>
          </div>
          <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
            <span className="text-[10px] text-neutral-500 uppercase block">Client Approval Status</span>
            <span className="text-xs font-bold text-emerald-600">Approved by Client</span>
            <span className="text-[10px] text-neutral-400">Form 8879 Signed</span>
          </div>
          <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
            <span className="text-[10px] text-neutral-500 uppercase block">Gate Registry Status</span>
            <span className={`text-xs font-bold ${canApproveForFiling ? 'text-emerald-600' : 'text-red-600'}`}>
              {canApproveForFiling ? 'All 7 Gates Cleared' : `${blockingReasons.length} Gates Blocked`}
            </span>
            <span className="text-[10px] text-neutral-400">Authoritative Evaluator</span>
          </div>
        </div>

        {/* Transmission & Idempotency Bar */}
        <div className="p-3.5 border rounded border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20 text-xs font-mono grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <span className="text-neutral-500 block text-[10px]">SUBMISSION ID:</span>
            <strong className="text-neutral-900 dark:text-white text-xs">{extendedRecord.submissionId}</strong>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px]">SUBMISSION TIMESTAMP:</span>
            <strong className="text-neutral-900 dark:text-white text-xs">
              {extendedRecord.filingTimestamp || extendedRecord.filingDateTime ? new Date(extendedRecord.filingTimestamp || extendedRecord.filingDateTime).toLocaleString() : 'Pending Release'}
            </strong>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px]">IDEMPOTENCY / LOCK STATUS:</span>
            <strong className="text-emerald-600 text-xs">
              {extendedRecord.duplicateSubmissionStatus || 'Single Dispatch (Guarded)'}
            </strong>
          </div>
        </div>

        {/* Section 11: Filing Staff Boundary Notice */}
        <div className="p-3 border rounded border-blue-300 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2.5">
          <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold uppercase tracking-wider text-[11px]">
              Section 11 &bull; Filing Staff Role Boundary Enforcement
            </div>
            <p className="text-[11px] leading-relaxed">
              Filing operations staff may authorize release and run simulations within permissions. They must not alter tax calculations, workpapers, or accounting entries. If adjustments are required, return the return to the responsible preparer or reviewer using the correction workflow below.
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveModal('package')}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Package</span>
          </button>

          <button
            onClick={() => setActiveModal('gates')}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Gate Details</span>
          </button>

          <button
            onClick={() => setActiveModal('auth')}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>View Authorization</span>
          </button>

          <button
            onClick={onNavigateToAudit}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5" />
            <span>View Audit History</span>
          </button>

          <button
            onClick={() => setActiveModal('ack')}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>View Acknowledgement</span>
          </button>

          <button
            onClick={() => setActiveModal('correction')}
            className="px-3 py-1.5 border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 rounded text-xs font-bold uppercase flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Return for Correction</span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleAuthorizeRelease}
              className="px-4 py-2 bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black rounded text-xs font-bold uppercase hover:opacity-90 flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Authorize Demo Release</span>
            </button>

            {/* MANDATORY EXECUTION BUTTON LABEL (Section 6 & 10) */}
            <button
              onClick={handleRunSimulation}
              disabled={!canApproveForFiling}
              title={
                !canApproveForFiling
                  ? `Blocked by ${blockingReasons.length} unresolved gates. Re-evaluate in Pre-Filing QC.`
                  : 'Execute simulated electronic transmission with idempotency lock.'
              }
              className={`px-5 py-2 rounded text-xs font-bold uppercase flex items-center gap-2 shadow transition-all ${
                canApproveForFiling
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90'
                  : 'bg-neutral-300 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Run Demo Filing Simulation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Agency Controls & Response Engine */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase font-mono text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Agency Gateway Simulation Controls (IRS &bull; South Carolina DOR)</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">Sandbox Environment</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSimulateAgencyResponse('Accepted')}
            className="px-3.5 py-1.5 bg-emerald-700 text-white rounded text-xs font-bold uppercase hover:bg-emerald-800 shadow-sm"
          >
            Simulate IRS / State Acceptance
          </button>
          <button
            onClick={() => handleSimulateAgencyResponse('Rejected')}
            className="px-3.5 py-1.5 bg-red-700 text-white rounded text-xs font-bold uppercase hover:bg-red-800 shadow-sm"
          >
            Simulate Agency Rejection
          </button>
          <button
            onClick={() => accountantCenterService.updateFilingStatus('Resubmitted')}
            className="px-3.5 py-1.5 border border-neutral-400 dark:border-neutral-600 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Simulate Package Resubmission
          </button>
        </div>
      </div>

      {/* MODALS */}

      {/* 1. View Acknowledgement Modal */}
      {activeModal === 'ack' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`max-w-xl w-full p-6 border rounded-lg shadow-xl ${cardBg} space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <div className="font-bold text-sm uppercase">Simulated Government Acknowledgement</div>
              <button onClick={() => setActiveModal(null)} className="text-xs font-bold font-mono">Close ✕</button>
            </div>

            {/* MANDATORY PROMINENT DISCLAIMER (Section 13) */}
            <div className="p-3 border border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 rounded text-xs font-bold">
              SIMULATED ACKNOWLEDGEMENT — NO GOVERNMENT AGENCY WAS CONTACTED.
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div><strong>Agency:</strong> {extendedRecord.latestAcknowledgement?.agency || 'Internal Revenue Service (IRS MeF)'}</div>
              <div><strong>Status:</strong> {extendedRecord.latestAcknowledgement?.status || 'PENDING'}</div>
              <div><strong>Acknowledgement Code:</strong> {extendedRecord.latestAcknowledgement?.code || 'ACK-000 (Simulated Code)'}</div>
              <div><strong>Transmission Hash:</strong> {extendedRecord.latestAcknowledgement?.transmissionHash || extendedRecord.mefTransmissionHash}</div>
              <div><strong>Electronic Postmark:</strong> {extendedRecord.latestAcknowledgement?.electronicPostmark || '2026-04-14T23:59:58Z (Simulated)'}</div>
              <div><strong>Statutory Notice:</strong> {extendedRecord.latestAcknowledgement?.statutoryNotice || 'This is an educational practice simulation.'}</div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black rounded text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Return for Correction Modal */}
      {activeModal === 'correction' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`max-w-lg w-full p-6 border rounded-lg shadow-xl ${cardBg} space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <div className="font-bold text-sm uppercase">Return for Correction (Staff Boundary)</div>
              <button onClick={() => setActiveModal(null)} className="text-xs font-bold font-mono">Close ✕</button>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Filing operations staff do not edit workpapers directly. Specify the required adjustments below. The file will be routed back to <strong>{client.assignedPreparer || 'the Preparer'}</strong> and downstream approvals will be invalidated.
            </p>

            <div>
              <label className="block text-[11px] font-bold uppercase mb-1">Correction Instructions</label>
              <textarea
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                rows={3}
                placeholder="E.g., Schedule C line 9 vehicle expense needs log substantiation. Please verify odometer summary."
                className="w-full p-2 border rounded text-xs bg-neutral-50 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setActiveModal(null)} className="px-3 py-1.5 border rounded text-xs font-bold">Cancel</button>
              <button onClick={handleReturnForCorrection} className="px-4 py-1.5 bg-amber-700 text-white rounded text-xs font-bold">
                Submit Correction Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. View Package Modal */}
      {activeModal === 'package' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`max-w-2xl w-full p-6 border rounded-lg shadow-xl ${cardBg} space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <div className="font-bold text-sm uppercase">Tax Return Package Manifest &bull; v{returnVersion}</div>
              <button onClick={() => setActiveModal(null)} className="text-xs font-bold font-mono">Close ✕</button>
            </div>
            <div className="space-y-2 text-xs font-mono max-h-72 overflow-y-auto">
              <div className="p-2 border rounded">1. Form 1040 U.S. Individual Income Tax Return (MeF XML v2025.1)</div>
              <div className="p-2 border rounded">2. Schedule 1 (Additional Income and Adjustments)</div>
              <div className="p-2 border rounded">3. Schedule C (Profit or Loss From Business — Consulting)</div>
              <div className="p-2 border rounded">4. Schedule E (Supplemental Income and Loss — Rental Property)</div>
              <div className="p-2 border rounded">5. Form 8938 (Statement of Specified Foreign Financial Assets)</div>
              <div className="p-2 border rounded">6. Form 8879 (IRS e-file Signature Authorization — Signed)</div>
              <div className="p-2 border rounded">7. SC1040 South Carolina Individual Income Tax Return</div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setActiveModal(null)} className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black rounded text-xs font-bold">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. View Gates Modal */}
      {activeModal === 'gates' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`max-w-2xl w-full p-6 border rounded-lg shadow-xl ${cardBg} space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <div className="font-bold text-sm uppercase">Authoritative 7 Pre-Filing Gate Status</div>
              <button onClick={() => setActiveModal(null)} className="text-xs font-bold font-mono">Close ✕</button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {gates.map(g => (
                <div key={g.id} className="p-2.5 border rounded flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="font-bold">Gate {g.gateNumber}: {g.name}</span>
                    {g.blockingReason && (
                      <div className="text-[10px] text-red-600 font-bold">Blocker: {g.blockingReason}</div>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    g.isCleared ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
                  }`}>
                    {g.isCleared ? 'CLEARED' : 'BLOCKED'}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2">
              {onNavigateToQc && (
                <button onClick={onNavigateToQc} className="text-xs font-bold underline font-mono">
                  Open Pre-Filing Quality Control &rarr;
                </button>
              )}
              <button onClick={() => setActiveModal(null)} className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black rounded text-xs font-bold">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. View Authorization Modal */}
      {activeModal === 'auth' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`max-w-xl w-full p-6 border rounded-lg shadow-xl ${cardBg} space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <div className="font-bold text-sm uppercase">Form 8879 &amp; Client Authorization Dossier</div>
              <button onClick={() => setActiveModal(null)} className="text-xs font-bold font-mono">Close ✕</button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div><strong>Form 8879 Status:</strong> Certified &bull; Client Signature Verified</div>
              <div><strong>Client Signature Date:</strong> {new Date().toLocaleDateString()}</div>
              <div><strong>Identity Verification:</strong> Driver License / State ID on file (KB Verified)</div>
              <div><strong>Bank Consent:</strong> Form 8888 Direct Deposit Routing Confirmed</div>
              <div><strong>Firm Consent:</strong> Section 7216 Taxpayer Disclosure Consent Signed</div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setActiveModal(null)} className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black rounded text-xs font-bold">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
