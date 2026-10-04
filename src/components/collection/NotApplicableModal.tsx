/**
 * A/R Tax Services, LLC — TaxGuard AI
 * Requirement "Not Applicable" Exception Modal
 *
 * Implements:
 * - Persisting client's factual reason for declaring a requirement not applicable
 * - Conflict detection against questionnaire answers
 * - Routing conflicting answers to professional CPA review
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, X, Send, ShieldAlert } from 'lucide-react';
import { ChecklistRequirement, StageTwoCollectionService } from '../../services/stageTwoCollectionService';
import { TaxDocumentRequirementEngine } from '../../services/taxDocumentRequirementEngine';

interface NotApplicableModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirement: ChecklistRequirement | null;
  taxYear: number;
  clientId: string;
  onSuccess: () => void;
}

export const NotApplicableModal: React.FC<NotApplicableModalProps> = ({
  isOpen,
  onClose,
  requirement,
  taxYear,
  clientId,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  if (!isOpen || !requirement) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setError('Please provide a specific business or factual reason (minimum 5 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);
    setWarningMessage(null);

    try {
      TaxDocumentRequirementEngine.markNotApplicable(clientId, taxYear, requirement.requirementId, reason);
      StageTwoCollectionService.updateRequirementStatus(clientId, taxYear, requirement.requirementId, 'Not Applicable', 'client', reason);

      const code = requirement.requirementId.split('-').slice(-2).join('-');
      try {
        const res = await fetch(`/api/stage-two-three/requirements/${taxYear}/${encodeURIComponent(code)}/not-applicable`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, reason })
        });
        const data = await res.json();
        if (data?.requiresProfessionalReview) {
          setWarningMessage(`Noted. Because your questionnaire indicated activity in this category, this exemption requires professional CPA verification: "${data.conflictReason || 'Flagged for CPA review'}".`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 3000);
          return;
        }
      } catch {
        // Local persistence succeeded
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-[#0D2745] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#071A2E] border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>Mark Requirement as Not Applicable</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 text-xs space-y-1">
            <div className="text-slate-400 font-mono text-[10px]">REQUIREMENT</div>
            <div className="text-white font-semibold">{requirement.title} ({requirement.formNumber})</div>
            <div className="text-slate-300 text-[11px]">{requirement.description}</div>
          </div>

          {warningMessage && (
            <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{warningMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-200">
              Why does this document not apply to your {taxYear} taxes?
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Did not receive any 1099-INT interest income this year; closed all accounts at First National Bank in 2024."
              className="w-full px-3 py-2 bg-[#06182B] border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#D4A843]"
            />
            <p className="text-[11px] text-slate-400">
              Your explanation is logged into the audit ledger and reviewed by your preparer.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-700/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Confirm Exemption'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
