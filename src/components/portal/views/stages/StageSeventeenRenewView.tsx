/**
 * A/R Tax Services, LLC — Stage 17: Renew Workspace
 * Returning client annual engagement renewal, prior-year profile carryforward,
 * confirmation of unchanged taxpayer information, and new tax year onboarding.
 * Mandatory: Prior-year evidence never satisfies new-year requirements.
 */

import React, { useState } from 'react';
import {
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Clock,
  Building2,
  Lock,
  UserCheck
} from 'lucide-react';

interface StageSeventeenRenewViewProps {
  clientId: string;
  selectedTaxYear: number;
  clientName?: string;
  onCommissionNewTaxYear?: (nextYear: number) => void;
}

export const StageSeventeenRenewView: React.FC<StageSeventeenRenewViewProps> = ({
  clientId,
  selectedTaxYear,
  clientName,
  onCommissionNewTaxYear
}) => {
  const nextTaxYear = selectedTaxYear + 1;
  const [confirmedIdentity, setConfirmedIdentity] = useState<boolean>(false);
  const [confirmedAddress, setConfirmedAddress] = useState<boolean>(false);
  const [confirmedDependents, setConfirmedDependents] = useState<boolean>(false);
  const [hasRenewed, setHasRenewed] = useState<boolean>(false);

  const canCommission = confirmedIdentity && confirmedAddress && confirmedDependents;

  const handleCommission = () => {
    if (!canCommission) return;
    setHasRenewed(true);
    onCommissionNewTaxYear?.(nextTaxYear);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 17 of 18 · Renew
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <RotateCcw className="w-5 h-5 text-[#D4A843]" />
              <span>Annual Client Engagement Renewal &amp; Rollover</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Completed TY: <strong className="text-white">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Target Renewal: <strong className="text-[#D4A843]">Tax Year {nextTaxYear}</strong></span>
          </div>
        </div>

        {/* The 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 17: Rollover portal for returning clients preparing for the next filing season.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">Confirm your unchanged identity details below to carry forward your profile into Tax Year {nextTaxYear}.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">Provisions your new engagement shell, carries forward depreciation assets, and initializes dynamic intake.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Stage 18 (Repeat) opens your fresh, segregated workspace for Tax Year {nextTaxYear}.</p>
          </div>
        </div>
      </div>

      {/* Confirmation & Carryforward Form */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-5">
        <h3 className="text-sm font-bold text-white border-b border-slate-700/60 pb-3">
          Carryforward Verification for Tax Year {nextTaxYear}
        </h3>

        {hasRenewed ? (
          <div className="p-5 rounded-xl bg-[#06182B] border border-emerald-500/40 text-xs space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Tax Year {nextTaxYear} Engagement Commissioned</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Your returning profile has been carried forward cleanly. You can switch to Tax Year {nextTaxYear} at the top of your dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-slate-300 text-xs leading-relaxed">
              To expedite your Tax Year {nextTaxYear} preparation, please confirm that your core biographical records remain current:
            </p>

            <div className="space-y-2.5">
              <label className="flex items-start gap-3 p-3 bg-[#071A2E] rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedIdentity}
                  onChange={(e) => setConfirmedIdentity(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-[#D4A843] focus:ring-[#D4A843]"
                />
                <span className="text-slate-200">
                  My legal name ({clientName || 'Taxpayer'}), Social Security Number / ITIN, and date of birth have not changed.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-[#071A2E] rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedAddress}
                  onChange={(e) => setConfirmedAddress(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-[#D4A843] focus:ring-[#D4A843]"
                />
                <span className="text-slate-200">
                  My residential primary address and state of tax residency have not changed (or any change has been submitted via formal profile amendment).
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-[#071A2E] rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedDependents}
                  onChange={(e) => setConfirmedDependents(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-[#D4A843] focus:ring-[#D4A843]"
                />
                <span className="text-slate-200">
                  I understand that prior-year evidence ({selectedTaxYear} W-2s, 1099s) does NOT satisfy {nextTaxYear} requirements and new tax documents will be required in Stage 02.
                </span>
              </label>
            </div>

            <button
              type="button"
              disabled={!canCommission}
              onClick={handleCommission}
              className={`px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xl ${
                canCommission
                  ? 'bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <span>Commission Tax Year {nextTaxYear} Engagement</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
