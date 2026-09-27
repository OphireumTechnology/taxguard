/**
 * TaxGuard AI – Secure Client Intake & Diagnostic Engine
 * Comprehensive Individual & Entity Questionnaire with Grounded AI Follow-Ups
 */

import React, { useState } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  HelpCircle, 
  ShieldCheck, 
  Info, 
  ArrowRight,
  Sparkles,
  Layers,
  Building2,
  UserCheck
} from 'lucide-react';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';

export const TaxGuardIntakeView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [profileType, setProfileType] = useState<'individual' | 'business'>('business');
  const [taxYear, setTaxYear] = useState<number>(2024);
  const [entityName, setEntityName] = useState('Henze Construction, LLC');
  const [ein, setEin] = useState('**-***9821');
  const [filingStatus, setFilingStatus] = useState('Single-Member LLC (Disregarded / Form 1040 Schedule C)');
  const [accountingMethod, setAccountingMethod] = useState<'cash' | 'accrual'>('cash');
  const [hasCrypto, setHasCrypto] = useState<boolean>(false);
  const [hasForeignAccounts, setHasForeignAccounts] = useState<boolean>(false);
  const [hasMultiState, setHasMultiState] = useState<boolean>(true);
  const [hasBoiFiled, setHasBoiFiled] = useState<boolean>(false);
  const [hasVehicleExp, setHasVehicleExp] = useState<boolean>(true);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_prod',
      userId: 'Taxpayer / Intake Staff',
      userEmail: 'intake@artaxservices.com',
      userRole,
      action: 'INTAKE_PROFILE_SAVED',
      recordType: 'case',
      recordId: 'case_2025_001',
      ipAddress: 'Authenticated Session',
      result: 'success',
      riskLevel: 'routine',
      details: `Intake questionnaire updated for ${entityName} (TY ${taxYear}). Multi-state: ${hasMultiState}, BOI: ${hasBoiFiled}`
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-6">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-[#061A2F] uppercase tracking-wide">
              TaxGuard AI Client Intake & Diagnostic Organizer
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Statutory tax profile for Federal and South Carolina Department of Revenue compliance.
            </p>
          </div>

          <div className="inline-flex rounded-xs border border-[#1A365D] overflow-hidden text-xs">
            <button
              onClick={() => setProfileType('business')}
              className={`px-3 py-1.5 font-semibold transition-colors ${
                profileType === 'business' ? 'bg-[#061A2F] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Entity / Business
            </button>
            <button
              onClick={() => setProfileType('individual')}
              className={`px-3 py-1.5 font-semibold transition-colors ${
                profileType === 'individual' ? 'bg-[#061A2F] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Individual (1040)
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Intake responses recorded and committed to append-only audit trail.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#061A2F]">Entity / Taxpayer Legal Name</label>
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xs focus:ring-1 focus:ring-[#C99A32] focus:border-[#C99A32]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#061A2F]">EIN or Masked SSN</label>
              <input
                type="text"
                value={ein}
                onChange={(e) => setEin(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xs font-mono bg-slate-50"
                disabled
              />
              <span className="text-[10px] text-slate-500">Masked for client data protection</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#061A2F]">Target Tax Year</label>
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xs bg-white"
              >
                <option value={2024}>2024 (Current Filing Period)</option>
                <option value={2023}>2023 (Prior Year / Amended)</option>
                <option value={2022}>2022 (Statutory Lookback)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#061A2F]">Entity Classification & Return Type</label>
              <select
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xs bg-white"
              >
                <option value="Single-Member LLC (Disregarded / Form 1040 Schedule C)">Single-Member LLC (Disregarded / Form 1040 Schedule C)</option>
                <option value="S-Corporation (Form 1120-S & Schedule K-1)">S-Corporation (Form 1120-S & Schedule K-1)</option>
                <option value="C-Corporation (Form 1120)">C-Corporation (Form 1120)</option>
                <option value="Partnership (Form 1065 & Schedule K-1)">Partnership (Form 1065 & Schedule K-1)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#061A2F]">Accounting Method</label>
              <select
                value={accountingMethod}
                onChange={(e) => setAccountingMethod(e.target.value as 'cash' | 'accrual')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xs bg-white"
              >
                <option value="cash">Cash Receipts & Disbursements Method</option>
                <option value="accrual">Accrual Method (GAAP / Tax Conformity)</option>
              </select>
            </div>
          </div>

          {/* Regulatory Specific Disclosure Triggers */}
          <div className="border border-slate-200 rounded-xs p-4 bg-[#FAF9F5] space-y-3">
            <div className="text-xs font-bold text-[#061A2F] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#C99A32]" />
              <span>Mandatory Disclosure Gateways</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasMultiState}
                  onChange={(e) => setHasMultiState(e.target.checked)}
                  className="mt-0.5 rounded text-[#061A2F] focus:ring-[#C99A32]"
                />
                <div>
                  <span className="font-semibold text-[#061A2F]">Multi-State Business Nexus</span>
                  <p className="text-[11px] text-slate-500">Operations or remote payroll outside South Carolina (e.g. NC, GA).</p>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasBoiFiled}
                  onChange={(e) => setHasBoiFiled(e.target.checked)}
                  className="mt-0.5 rounded text-[#061A2F] focus:ring-[#C99A32]"
                />
                <div>
                  <span className="font-semibold text-[#061A2F]">FinCEN Beneficial Ownership (BOI) Filed</span>
                  <p className="text-[11px] text-slate-500">Corporate Transparency Act initial report completed.</p>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCrypto}
                  onChange={(e) => setHasCrypto(e.target.checked)}
                  className="mt-0.5 rounded text-[#061A2F] focus:ring-[#C99A32]"
                />
                <div>
                  <span className="font-semibold text-[#061A2F]">Digital Assets / Cryptocurrency</span>
                  <p className="text-[11px] text-slate-500">Transactions involving digital assets, staking, or NFTs in TY {taxYear}.</p>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasVehicleExp}
                  onChange={(e) => setHasVehicleExp(e.target.checked)}
                  className="mt-0.5 rounded text-[#061A2F] focus:ring-[#C99A32]"
                />
                <div>
                  <span className="font-semibold text-[#061A2F]">Commercial Vehicle & Section 179 Property</span>
                  <p className="text-[11px] text-slate-500">Vehicles or machinery placed in service during TY {taxYear}.</p>
                </div>
              </label>
            </div>
          </div>

          {/* AI Grounded Recommended Follow-Up Questions */}
          <div className="border border-[#C99A32]/40 bg-[#FDFCF9] p-4 rounded-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#061A2F]">
              <Sparkles className="w-4 h-4 text-[#D7AC4A]" />
              <span className="uppercase">TaxGuard AI Recommended Follow-Up Investigations</span>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              {hasMultiState && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-xs space-y-1">
                  <div className="font-semibold text-[#061A2F]">
                    Multi-State Payroll & Apportionment Factor Request:
                  </div>
                  <p className="text-[11px] text-slate-600">
                    <strong>Why this is relevant:</strong> South Carolina Code § 12-6-2280 utilizes single gross receipts apportionment. If services or project billings occurred in North Carolina, dual state return filings and withholding reconciliation are required to prevent double-taxation penalties.
                  </p>
                </div>
              )}

              {hasVehicleExp && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-xs space-y-1">
                  <div className="font-semibold text-[#061A2F]">
                    IRC § 274(d) Mileage Log & Depreciation Election:
                  </div>
                  <p className="text-[11px] text-slate-600">
                    <strong>Why this is relevant:</strong> Treasury Regulation § 1.274-5 disallows vehicle deductions lacking contemporaneous records. A written log detailing business vs personal miles is mandatory prior to electing standard mileage rate vs actual Section 179 expensing on Form 4562.
                  </p>
                </div>
              )}

              {!hasBoiFiled && (
                <div className="p-2.5 bg-white border border-amber-300 bg-amber-50/50 rounded-xs space-y-1">
                  <div className="font-semibold text-amber-950">
                    FinCEN Corporate Transparency Act Statutory Deadline Alert:
                  </div>
                  <p className="text-[11px] text-amber-900">
                    <strong>Why this is relevant:</strong> Entities active prior to 2024 must file initial Beneficial Ownership Information reports by January 1, 2025. Civil penalties of up to $591/day apply for non-compliance under 31 U.S.C. § 5336.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2 bg-[#061A2F] hover:bg-[#0A2544] text-[#F7F4ED] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors shadow-xs"
            >
              Save Diagnostic Intake & Commit to Case File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
