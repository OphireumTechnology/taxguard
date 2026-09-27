/**
 * TaxGuard AI – AI Governance & Risk Management Center (NIST AI RMF 1.0)
 * Emergency AI kill-switch, model inventory, confidence thresholds, and prohibited use case enforcement.
 */

import React, { useState } from 'react';
import { 
  Settings, 
  ShieldAlert, 
  ShieldCheck, 
  Power, 
  Sliders, 
  Lock, 
  AlertTriangle, 
  BookOpen, 
  CheckCircle2, 
  Cpu 
} from 'lucide-react';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';

export const TaxGuardAdminSettingsView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(85);
  const [showConfirmDisable, setShowConfirmDisable] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleToggleAi = () => {
    if (aiEnabled) {
      setShowConfirmDisable(true);
    } else {
      setAiEnabled(true);
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_prod',
        userId: userRole,
        userEmail: 'cpa@artaxservices.com',
        userRole,
        action: 'AI_EMERGENCY_KILLSWITCH_ENGAGED',
        recordType: 'governance',
        recordId: 'gov_killswitch',
        ipAddress: 'Office LAN 10.0.4.1',
        result: 'success',
        riskLevel: 'high_risk',
        details: 'TaxGuard AI engines re-activated by authorized CPA administrator.'
      });
    }
  };

  const confirmDisableAi = () => {
    setAiEnabled(false);
    setShowConfirmDisable(false);
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: userRole,
      userEmail: 'cpa@artaxservices.com',
      userRole,
      action: 'AI_EMERGENCY_KILLSWITCH_ENGAGED',
      recordType: 'governance',
      recordId: 'gov_killswitch',
      ipAddress: 'Office LAN 10.0.4.1',
      result: 'success',
      riskLevel: 'high_risk',
      details: 'TaxGuard AI operations disabled firm-wide. Manual staff workflows remain fully operational.'
    });
  };

  const handleSaveThresholds = () => {
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: userRole,
      userEmail: 'cpa@artaxservices.com',
      userRole,
      action: 'CONFIDENCE_THRESHOLD_UPDATED',
      recordType: 'governance',
      recordId: 'gov_threshold',
      ipAddress: 'Office LAN 10.0.4.1',
      result: 'success',
      riskLevel: 'material',
      details: `OCR confidence triage gate threshold set to ${confidenceThreshold}%.`
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* Emergency Kill Switch Banner */}
      <div className={`p-5 rounded-xs border shadow-xs transition-colors ${
        aiEnabled
          ? 'bg-white border-[#D8DCE2]'
          : 'bg-rose-50 border-rose-300'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Power className={`w-5 h-5 ${aiEnabled ? 'text-emerald-600' : 'text-rose-600'}`} />
              <h2 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide">
                NIST AI RMF Emergency AI Kill-Switch
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              {aiEnabled
                ? 'All AI microservices (OCR extraction, classification, discrepancy heuristics, and research) are currently ACTIVE.'
                : 'EMERGENCY SHUTDOWN ACTIVE: All AI operations are halted firm-wide. Staff manual preparer review remains active.'}
            </p>
          </div>

          <button
            onClick={handleToggleAi}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xs transition-colors shadow-xs ${
              aiEnabled
                ? 'bg-rose-700 hover:bg-rose-800 text-white'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            {aiEnabled ? 'Disable AI Engine Immediately' : 'Re-Enable AI Engine'}
          </button>
        </div>
      </div>

      {showConfirmDisable && (
        <div className="p-4 bg-rose-100 border border-rose-300 rounded-xs text-xs text-rose-900 space-y-2">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-700" />
            <span>Confirm Firm-Wide AI Suspension</span>
          </div>
          <p>
            This action halts all automated document classification, OCR parsing, and research assistance. Staff will be required to execute 100% manual data entry.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowConfirmDisable(false)}
              className="px-3 py-1 border border-slate-400 bg-white text-slate-800 rounded-xs"
            >
              Cancel
            </button>
            <button
              onClick={confirmDisableAi}
              className="px-3 py-1 bg-rose-800 text-white font-bold rounded-xs uppercase"
            >
              Confirm Shutdown
            </button>
          </div>
        </div>
      )}

      {/* NIST AI RMF Governance & Controls */}
      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-5">
        <div className="border-b border-slate-200 pb-3">
          <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#C99A32]" />
            <span>Confidence Thresholds & Human-in-the-Loop Gating</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure automated triage criteria for low-confidence data extraction and material schedules.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Governance parameters updated and logged to audit trail.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-[#061A2F]">Low-Confidence Review Threshold</span>
                <span className="font-mono font-bold text-[#C99A32]">{confidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={95}
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#C99A32]"
              />
              <p className="text-[11px] text-slate-500">
                Any OCR extraction scoring below {confidenceThreshold}% automatically halts and is queued for mandatory staff verification.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xs border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-[#061A2F] uppercase text-[11px]">Prohibited AI Operating Rules:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>AI is strictly prohibited from autonomously signing or filing tax returns.</li>
                <li>AI is prohibited from determining tax elections without CPA confirmation.</li>
                <li>AI is prohibited from overriding verified human reviewer corrections.</li>
                <li>Taxpayer SSNs and financial identifiers are masked prior to external model API calls.</li>
              </ul>
            </div>

            <button
              onClick={handleSaveThresholds}
              className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2544] text-[#F7F4ED] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors"
            >
              Commit Governance Parameters
            </button>
          </div>

          {/* Model Registry */}
          <div className="border border-slate-200 rounded-xs p-4 bg-[#FAF9F5] space-y-3 text-xs">
            <div className="font-bold text-[#061A2F] uppercase text-xs flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#C99A32]" />
              <span>Approved Production Model Registry</span>
            </div>

            <div className="space-y-2.5">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xs space-y-1">
                <div className="flex justify-between font-bold text-[#061A2F]">
                  <span>Gemini 2.5 Flash (Tax Intelligence Tuning)</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">ACTIVE</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Model Version: gemini-2.5-flash-pro-tax-v1 • Provider: Google Cloud Vertex
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Data Classification: Redacted Tax Metadata Only (No Raw SSN)
                </div>
              </div>

              <div className="p-2.5 bg-white border border-slate-200 rounded-xs space-y-1">
                <div className="flex justify-between font-bold text-[#061A2F]">
                  <span>Document AI OCR Pipeline</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">ACTIVE</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Model Version: form-parser-v2 • Provider: Google Cloud
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Classification: Strict Object Storage Sandbox
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
