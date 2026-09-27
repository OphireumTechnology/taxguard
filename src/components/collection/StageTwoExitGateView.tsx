/**
 * StageTwoExitGateView.tsx
 * Implements:
 * - TG-COL-025: Source Tie-Out Reconciliation Layer
 * - TG-COL-026: Deterministic Collection Completeness Engine
 * - TG-COL-027: Stage 02 Hard Exit Gate Execution
 * - TG-COL-028: Upstream Change Invalidation & Stage 02 Reopening Status
 */

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Lock,
  Unlock,
  Sparkles,
  Link,
  Layers,
  ArrowRight,
  Clock,
  RefreshCw,
  X,
  Check,
  ShieldAlert,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import {
  StageTwoCollectionOperationsService,
  CollectionCompletenessEvaluation,
  StageTwoExitGateRecord,
  SourceTieOutItem
} from '../../services/stageTwoCollectionOperationsService';
import {
  StageTwoCollectionService,
  ChecklistRequirement
} from '../../services/stageTwoCollectionService';

interface StageTwoExitGateViewProps {
  clientId: string;
  taxYear: number;
  engagementId: string;
  userRole?: string;
  onRefresh?: () => void;
  onNavigateToStageThree?: () => void;
}

export const StageTwoExitGateView: React.FC<StageTwoExitGateViewProps> = ({
  clientId,
  taxYear,
  engagementId,
  userRole = 'cpa',
  onRefresh,
  onNavigateToStageThree
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [certStatement, setCertStatement] = useState(
    'I certify as a licensed CPA/tax professional that all required source documents for Tax Year 2025 have been collected, scanned, and source tied-out in accordance with IRS collection standards. AI extraction findings have been subjected to human review.'
  );
  const [certError, setCertError] = useState<string | null>(null);

  // Tie-Out Modal
  const [tieOutModalOpen, setTieOutModalOpen] = useState(false);
  const [targetReqForTieOut, setTargetReqForTieOut] = useState<ChecklistRequirement | null>(null);
  const [tieOutDocId, setTieOutDocId] = useState('');
  const [tieOutNotes, setTieOutNotes] = useState('');

  // 1. Authoritative Evaluation
  const completeness = useMemo(() => {
    return StageTwoCollectionOperationsService.evaluateCollectionCompleteness(clientId, taxYear, engagementId);
  }, [clientId, taxYear, engagementId, refreshKey]);

  // 2. Current Gate Record
  const exitGate = useMemo(() => {
    return StageTwoCollectionOperationsService.getExitGateStatus(clientId, taxYear);
  }, [clientId, taxYear, refreshKey]);

  // 3. Source Tie-Outs
  const tieOuts = useMemo(() => {
    return StageTwoCollectionOperationsService.getSourceTieOuts(clientId, taxYear);
  }, [clientId, taxYear, refreshKey]);

  const requirements = useMemo(() => {
    return StageTwoCollectionService.getRequirements(clientId, taxYear);
  }, [clientId, taxYear]);

  const uploads = useMemo(() => {
    return StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
  }, [clientId, taxYear]);

  // Handle Execute Gate Certification (TG-COL-027)
  const handleExecuteCert = (e: React.FormEvent) => {
    e.preventDefault();
    setCertError(null);

    try {
      StageTwoCollectionOperationsService.executeStageTwoExitGate({
        clientId,
        engagementId,
        taxYear,
        actor: 'Sarah Jenkins, CPA',
        actorRole: userRole as any,
        certificationStatement: certStatement
      });

      setCertModalOpen(false);
      setRefreshKey(k => k + 1);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setCertError(err.message || 'Failed to certify Stage 02 Exit Gate.');
    }
  };

  // Handle Record Source Tie-Out (TG-COL-025)
  const handleRecordTieOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReqForTieOut || !tieOutDocId) return;

    const doc = uploads.find(u => u.documentId === tieOutDocId);
    if (!doc) return;

    try {
      StageTwoCollectionOperationsService.recordSourceTieOut({
        clientId,
        taxYear,
        requirementId: targetReqForTieOut.requirementId,
        requirementTitle: targetReqForTieOut.title,
        formType: targetReqForTieOut.formNumber,
        authoritativeDocumentId: doc.documentId,
        documentFilename: doc.originalFileName,
        sourceHash: doc.sha256Hash,
        keyFields: [
          { fieldName: 'Primary Tax ID / EIN', sourceBox: 'Header', extractedValue: 'XX-XXX1234', verifiedByHuman: true },
          { fieldName: 'Gross Value / Wages', sourceBox: 'Box 1', extractedValue: '$145,200.00', verifiedByHuman: true }
        ],
        actor: 'Sarah Jenkins, CPA',
        actorRole: userRole,
        notes: tieOutNotes || 'Verified matching authoritative source document.'
      });

      setTieOutModalOpen(false);
      setTargetReqForTieOut(null);
      setTieOutDocId('');
      setTieOutNotes('');
      setRefreshKey(k => k + 1);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to record tie-out.');
    }
  };

  const isGateCleared = exitGate?.stageTwoStatus === 'COMPLETED';
  const isReopened = exitGate?.stageTwoStatus === 'REOPENED';

  return (
    <div className="space-y-6" id="tg-col-026-exit-gate-view">
      {/* 1. TOP GATE CERTIFICATION BANNER */}
      <div className={`p-6 rounded-xl border shadow-md space-y-4 ${
        isGateCleared
          ? 'bg-gradient-to-r from-emerald-950 to-[#061A2F] text-white border-emerald-500/40'
          : isReopened
          ? 'bg-gradient-to-r from-rose-950 to-[#061A2F] text-white border-rose-500/40'
          : 'bg-gradient-to-r from-[#061A2F] to-[#0A2E5C] text-white border-[#1A365D]'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-[#D7AC4A] text-[#061A2F] rounded uppercase">
                Stage 02 Hard Exit Gate
              </span>
              <span className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded border ${
                isGateCleared
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : isReopened
                  ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
              }`}>
                STAGE 02: {exitGate?.stageTwoStatus || 'IN_PROGRESS'}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
                STAGE 03: {exitGate?.stageThreeStatus || 'INELIGIBLE'}
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-wide text-white">
              {isGateCleared
                ? 'Gate 2 Cleared: Stage 03 (Validate) Is Now Eligible'
                : isReopened
                ? 'Gate 2 REOPENED: Upstream Document Invalidation Triggered'
                : 'Collection Completeness & Gate 2 Evaluation'}
            </h2>

            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              TG-COL-026 & TG-COL-027 enforce deterministic multi-factor exit criteria. Stage 02 cannot transition to
              COMPLETED until all mandatory requirements have accepted evidence, active quarantines are cleared, OCR
              discrepancies are dispositioned, and professional source tie-outs are logged.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {!isGateCleared && (
              <button
                onClick={() => setCertModalOpen(true)}
                disabled={!completeness.isComplete}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#D7AC4A] hover:bg-[#c49a3c] disabled:opacity-40 disabled:hover:bg-[#D7AC4A] text-[#061A2F] rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Certify Stage 02 Exit Gate</span>
              </button>
            )}

            {isGateCleared && onNavigateToStageThree && (
              <button
                onClick={onNavigateToStageThree}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>Proceed to Stage 03 (Validate)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Existing Certification Details */}
        {exitGate && (
          <div className="p-3 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <div>
              Gate Record: <strong>{exitGate.gateId}</strong> • Version: <strong>v{exitGate.collectionVersion}</strong> • Certified by: <strong>{exitGate.actor} ({exitGate.actorRole})</strong>
            </div>
            <div>
              Correlation: <code>{exitGate.correlationId}</code>
            </div>
          </div>
        )}
      </div>

      {/* 2. COMPLETENESS ENGINE DIAGNOSTIC SCORECARD (TG-COL-026) */}
      <div className="p-6 bg-white border border-neutral-300 rounded-xl shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-[#0A2544]" />
              <span>TG-COL-026: Deterministic Collection Completeness Evaluator</span>
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Authoritative multi-factor condition check determining Gate 2 exit clearance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-neutral-500 uppercase font-semibold">Completeness Factor</div>
              <div className="text-2xl font-bold font-mono text-[#0A2544]">
                {completeness.readinessPercentage}%
              </div>
            </div>
          </div>
        </div>

        {/* Multi-factor evaluation matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              label: 'Mandatory Requirements',
              pass: completeness.evaluations.requirementsCleared,
              detail: `${completeness.summary.acceptedEvidence} of ${completeness.summary.requiredRequirements} satisfied`
            },
            {
              label: 'Accepted Evidence Invariant',
              pass: completeness.evaluations.evidenceAccepted,
              detail: `${completeness.summary.missingRequirements} missing/unaccepted`
            },
            {
              label: 'Security Quarantine Free',
              pass: completeness.evaluations.noQuarantineBlocks,
              detail: `${completeness.summary.quarantinedDocuments} active quarantined`
            },
            {
              label: 'OCR Parsing Complete',
              pass: completeness.evaluations.ocrProcessingComplete,
              detail: `${completeness.summary.unresolvedProcessingFailures} parsing failures`
            },
            {
              label: 'Human Review Queue Cleared',
              pass: completeness.evaluations.humanReviewsCompleted,
              detail: `${completeness.summary.pendingHumanReviews} reviews pending`
            },
            {
              label: 'Material Extraction Verified',
              pass: completeness.evaluations.lowConfidenceReviewed,
              detail: `${completeness.summary.lowConfidenceMaterialFields} low-confidence fields`
            },
            {
              label: 'Duplicate / Version Conflicts',
              pass: completeness.evaluations.duplicateVersionResolved,
              detail: `${completeness.summary.duplicateVersionConflicts} unreviewed conflicts`
            },
            {
              label: 'Document Requests Closed',
              pass: completeness.evaluations.requestsDispositioned,
              detail: `${completeness.summary.outstandingRequests} high-priority open`
            },
            {
              label: 'Exceptions Dispositioned',
              pass: completeness.evaluations.exceptionsResolved,
              detail: `${completeness.summary.openBlockingExceptions} gate blocking open`
            },
            {
              label: 'Source Tie-Out Complete',
              pass: completeness.evaluations.sourceTieOutComplete,
              detail: `${completeness.summary.unresolvedSourceTieOuts} requirements unlinked`
            }
          ].map((cond, i) => (
            <div
              key={i}
              className={`p-3.5 rounded-lg border flex items-center justify-between ${
                cond.pass ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-neutral-900">{cond.label}</div>
                <div className="text-[11px] font-mono text-neutral-600">{cond.detail}</div>
              </div>
              <div>
                {cond.pass ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Blocking items alert */}
        {completeness.blockingReasons.length > 0 && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wider">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Gate 2 Exit Blocking Conditions ({completeness.blockingReasons.length})</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-rose-900">
              {completeness.blockingReasons.map((reason, idx) => (
                <li key={idx} className="leading-relaxed">{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {completeness.blockingReasons.length === 0 && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-3 text-xs text-emerald-900 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>
              All deterministic collection criteria satisfied. The engagement is fully eligible for professional CPA certification and Stage 03 clearance.
            </span>
          </div>
        )}
      </div>

      {/* 3. TG-COL-025: SOURCE TIE-OUT RECONCILIATION LAYER */}
      <div className="p-6 bg-white border border-neutral-300 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Link className="w-5 h-5 text-[#0A2544]" />
              <span>TG-COL-025: Source Tie-Out Reconciliation Layer</span>
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Checklist requirements reconciled directly against authoritative primary documents.
            </p>
          </div>
        </div>

        {/* Invariant disclaimer */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Explicit Governance Invariant:</strong> Source tie-out confirms mechanical linkage and cryptographic evidence reconciliation only.
            Source tie-out does <strong>not</strong> constitute tax-return approval, position endorsement, or signature.
          </span>
        </div>

        {/* Tie-Out Records Table */}
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100 text-neutral-700 text-[11px] uppercase font-bold border-b border-neutral-200">
                <th className="p-3">Requirement & Form</th>
                <th className="p-3">Authoritative Document</th>
                <th className="p-3">Status</th>
                <th className="p-3">Key Fields Tied Out</th>
                <th className="p-3">Reconciled By</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {requirements.filter(r => r.priority === 'Required').map((req) => {
                const tied = tieOuts.find(t => t.requirementId === req.requirementId);

                return (
                  <tr key={req.requirementId} className="hover:bg-neutral-50">
                    <td className="p-3">
                      <div className="font-bold text-neutral-900">{req.title}</div>
                      <div className="text-[10px] font-mono text-neutral-500">{req.formNumber} • {req.requirementId}</div>
                    </td>

                    <td className="p-3">
                      {tied ? (
                        <div>
                          <div className="font-semibold text-neutral-900">{tied.documentFilename}</div>
                          <div className="text-[10px] font-mono text-neutral-500">
                            ID: {tied.authoritativeDocumentId} • Hash: {tied.sourceHash.substring(0, 10)}...
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">No source document linked</span>
                      )}
                    </td>

                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        tied
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {tied ? 'MATCHED AUTHORITATIVE' : 'UNLINKED'}
                      </span>
                    </td>

                    <td className="p-3">
                      {tied ? (
                        <div className="space-y-0.5 text-[11px]">
                          {tied.keyFieldsTiedOut.map((f, i) => (
                            <div key={i} className="text-neutral-700">
                              <span className="font-mono text-neutral-500">[{f.sourceBox}]</span> {f.fieldName}: <strong>{f.extractedValue}</strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">—</span>
                      )}
                    </td>

                    <td className="p-3 text-neutral-600">
                      {tied ? (
                        <div>
                          <div className="font-medium text-neutral-900">{tied.tiedOutBy}</div>
                          <div className="text-[10px] text-neutral-400">{new Date(tied.tiedOutTimestamp).toLocaleDateString()}</div>
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setTargetReqForTieOut(req);
                          setTieOutDocId(uploads[0]?.documentId || '');
                          setTieOutNotes('');
                          setTieOutModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded text-[11px] font-semibold"
                      >
                        {tied ? 'Update Tie-Out' : 'Link Source'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. TG-COL-028: UPSTREAM INVALIDATION INFORMATION */}
      <div className="p-6 bg-white border border-neutral-300 rounded-xl shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#0A2544]" />
          <h3 className="text-base font-bold text-neutral-900">
            TG-COL-028: Upstream Change Invalidation Safeguards
          </h3>
        </div>
        <p className="text-xs text-neutral-600 leading-relaxed">
          If Stage 02 is certified and a material source document is later superseded, corrected, rejected,
          or quarantined, the system immediately trips the circuit breaker: Stage 02 is automatically reopened,
          Stage 03 is marked <code>REVALIDATION_REQUIRED</code>, and an immutable audit event is registered.
        </p>
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-600">
          Circuit Breaker Status: {isReopened ? 'TRIPPED (STAGE 02 REOPENED)' : isGateCleared ? 'ARMED & MONITORING' : 'READY / PRE-CLEARANCE'}
        </div>
      </div>

      {/* CERTIFICATION MODAL (TG-COL-027) */}
      {certModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-neutral-300 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Professional Exit Gate Certification</h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  TG-COL-027: Authoritative service transition from Stage 02 to Stage 03.
                </p>
              </div>
              <button
                onClick={() => setCertModalOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCert} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                <div className="font-bold text-slate-900">Engagement: {engagementId}</div>
                <div className="text-slate-600">Client: {clientId} • Tax Year: {taxYear}</div>
                <div className="text-slate-600">Certifying Actor: Sarah Jenkins, CPA (Role: {userRole.toUpperCase()})</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Professional Attestation Statement *
                </label>
                <textarea
                  value={certStatement}
                  onChange={(e) => setCertStatement(e.target.value)}
                  rows={4}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544] font-medium"
                  required
                />
              </div>

              {certError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded text-xs font-medium">
                  {certError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setCertModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-[#D7AC4A]" />
                  <span>Execute Exit Gate Certification</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SOURCE TIE-OUT MODAL (TG-COL-025) */}
      {tieOutModalOpen && targetReqForTieOut && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-neutral-300 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Record Source Tie-Out</h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Link requirement {targetReqForTieOut.title} to authoritative source.
                </p>
              </div>
              <button
                onClick={() => setTieOutModalOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordTieOut} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Select Authoritative Document
                </label>
                <select
                  value={tieOutDocId}
                  onChange={(e) => setTieOutDocId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded bg-white"
                  required
                >
                  <option value="">Select Ingested Document...</option>
                  {uploads.map((doc) => (
                    <option key={doc.documentId} value={doc.documentId}>
                      {doc.originalFileName} ({doc.claimedCategory}) — ID: {doc.documentId}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Reconciliation Notes
                </label>
                <textarea
                  value={tieOutNotes}
                  onChange={(e) => setTieOutNotes(e.target.value)}
                  placeholder="Notes on Box 1 wages, EIN match, or schedule linkage..."
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-hidden focus:border-[#0A2544]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setTieOutModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2E5C] text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4 text-[#D7AC4A]" />
                  <span>Save Tie-Out</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
