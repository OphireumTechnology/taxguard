/**
 * TaxGuard AI – Maker-Checker Review & Dual-Signoff Gate
 * Enforces strict separation of duties: maker cannot checker high-risk gates.
 */

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  UserCheck, 
  FileCheck, 
  Clock,
  ArrowRight
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { TaxGuardEngagementCase, MakerCheckerReviewStep } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardReviewApprovalView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const cases = TaxGuardStorageService.getCases(userRole, userRole === 'client' ? 'client_henze_001' : undefined);
  const activeCase: TaxGuardEngagementCase = cases[0];
  const [steps, setSteps] = useState<MakerCheckerReviewStep[]>(activeCase.makerCheckerSteps);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [signingStepNumber, setSigningStepNumber] = useState<number | null>(null);
  const [signNotes, setSignNotes] = useState<string>('');

  const handleSignoff = (stepNumber: number) => {
    setActionError(null);
    setActionSuccess(null);

    const reviewerName = 
      userRole === 'cpa' ? 'Desmond Hinds, Principal CPA' :
      userRole === 'reviewer' ? 'Sarah Jenkins, CPA' :
      userRole === 'preparer' ? 'Marcus Vance, EA' :
      userRole === 'client' ? 'Daniel Henze (Client)' :
      'Compliance Officer';

    const res = TaxGuardStorageService.completeReviewStep(
      activeCase.id,
      stepNumber,
      userRole,
      reviewerName,
      signNotes || 'Verified against source workpapers and statutory schedules.'
    );

    if (!res.success) {
      setActionError(res.error || 'Authorization failed');
      return;
    }

    setSteps([...activeCase.makerCheckerSteps]);
    setActionSuccess(`Step ${stepNumber} successfully certified and signed off by ${reviewerName}.`);
    setSigningStepNumber(null);
    setSignNotes('');
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-5">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C99A32]" />
              <span>10-Stage Maker-Checker Workflow & Statutory Sign-Off Gates</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Case: <strong>{activeCase.clientName}</strong> (TY {activeCase.taxYear} Form {activeCase.returnType})
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Separation of Duties:</span>
            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold font-mono rounded-xs">
              ENFORCED (Circ. 230)
            </span>
          </div>
        </div>

        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* 10 Steps Sequence */}
        <div className="space-y-3">
          {steps.map((step) => {
            const isCompleted = step.completed;
            const isPending = !isCompleted;
            return (
              <div
                key={step.stepNumber}
                className={`p-3.5 border rounded-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCompleted
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : step.riskTier === 'filing_critical'
                    ? 'bg-rose-50/30 border-rose-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#061A2F]">
                      Step {step.stepNumber}
                    </span>
                    <span className="font-bold text-xs text-[#061A2F]">{step.stepName}</span>
                    <span className={`px-2 py-0.2 text-[9px] font-bold uppercase rounded-xs font-mono ${
                      step.riskTier === 'filing_critical' ? 'bg-rose-100 text-rose-900' :
                      step.riskTier === 'high_risk' ? 'bg-amber-100 text-amber-900' :
                      step.riskTier === 'material' ? 'bg-blue-100 text-blue-900' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {step.riskTier.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{step.description}</p>

                  {isCompleted && (
                    <div className="text-[11px] text-emerald-800 font-medium pt-0.5">
                      Completed by <strong>{step.completedBy}</strong> on {new Date(step.completedAt || '').toLocaleDateString()}
                      {step.signoffNotes && ` • Notes: "${step.signoffNotes}"`}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {isCompleted ? (
                    <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold font-mono">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>APPROVED</span>
                    </div>
                  ) : (
                    <div>
                      {signingStepNumber === step.stepNumber ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Signoff verification note..."
                            value={signNotes}
                            onChange={(e) => setSignNotes(e.target.value)}
                            className="px-2 py-1 text-xs border border-slate-300 rounded-xs w-48"
                          />
                          <button
                            onClick={() => handleSignoff(step.stepNumber)}
                            className="px-3 py-1 bg-[#061A2F] text-white text-xs font-bold uppercase rounded-xs"
                          >
                            Sign
                          </button>
                          <button
                            onClick={() => setSigningStepNumber(null)}
                            className="px-2 py-1 border border-slate-300 text-xs rounded-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSigningStepNumber(step.stepNumber); setSignNotes(''); }}
                          className="px-3 py-1 bg-[#0A2544] hover:bg-[#061A2F] text-white text-xs font-semibold rounded-xs transition-colors"
                        >
                          Execute Signoff Gate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
