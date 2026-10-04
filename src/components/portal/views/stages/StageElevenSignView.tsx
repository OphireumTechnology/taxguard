/**
 * A/R Tax Services, LLC — Stage 11: Sign Workspace
 * Form 8879 IRS e-File Signature Authorization boundary.
 * Strictly adheres to Phase 13:
 * If no commissioned provider exists: display NOT_CONFIGURED / PROVIDER_BLOCKED.
 * Do NOT fabricate signatures or Form 8879 completion.
 */

import React, { useState } from 'react';
import {
  PenTool,
  ShieldAlert,
  AlertTriangle,
  Clock,
  ArrowRight,
  Lock,
  FileText,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

interface StageElevenSignViewProps {
  clientId: string;
  selectedTaxYear: number;
  clientName?: string;
  userEmail?: string;
}

export const StageElevenSignView: React.FC<StageElevenSignViewProps> = ({
  clientId,
  selectedTaxYear,
  clientName,
  userEmail
}) => {
  const [isProviderConfigured] = useState<boolean>(false); // Strict fail-closed boundary

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 11 of 18 · Sign
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <PenTool className="w-5 h-5 text-[#D4A843]" />
              <span>Form 8879 IRS e-File Signature Authorization</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400 font-bold">PROVIDER_BLOCKED</span>
          </div>
        </div>

        {/* The 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 11: Official electronic execution of IRS Form 8879 and state e-file authorization vouchers.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">Sign your Form 8879 authorization once the secure statutory signature provider is commissioned.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">A/R Tax Services verifies identity authentication compliance per IRS Pub 1345 rules.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Once signed, Stage 12 builds your XML transmission packet for IRS MeF gateway transmission.</p>
          </div>
        </div>
      </div>

      {/* Non-Negotiable Fail-Closed Provider Boundary Banner */}
      <div className="p-6 bg-[#071A2E] border-2 border-amber-500/40 rounded-2xl shadow-xl space-y-4 text-xs">
        <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>STATUTORY E-SIGNATURE PROVIDER STATUS: NOT_CONFIGURED / PROVIDER_BLOCKED</span>
        </div>

        <p className="text-slate-300 leading-relaxed text-xs">
          Per IRS Publication 1345 and TaxGuard non-negotiable architecture, electronic signatures on IRS Form 8879 require a commissioned, tamper-evident digital signature provider with identity verification (KBA/audit trail). 
          <strong> TaxGuard never fabricates e-signatures or simulates statutory completion.</strong>
        </p>

        <div className="p-4 bg-[#0D2745] rounded-xl border border-slate-800 space-y-2 font-mono text-[11px]">
          <div className="text-slate-400 uppercase tracking-wider text-[10px]">Active E-Signature Handoff Manifest</div>
          <div>Document: <span className="text-white">TY {selectedTaxYear} Form 8879 (IRS e-File Signature Authorization)</span></div>
          <div>Authorized Signer: <span className="text-white">{clientName || 'Primary Taxpayer'}</span> ({userEmail || 'Client Account'})</div>
          <div>Provider Integration State: <span className="text-amber-400 font-bold">FAIL_CLOSED (Waiting for Production Commissioning)</span></div>
          <div>Audit Trace: <span className="text-slate-400">SIGN_GATEWAY_BLOCKED_UNCOMMISSIONED</span></div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-[11px] pt-1">
          <Lock className="w-3.5 h-3.5" />
          <span>No unverified signature can enter the filing pipeline. Your return is safe and locked in Stage 10.</span>
        </div>
      </div>
    </div>
  );
};
