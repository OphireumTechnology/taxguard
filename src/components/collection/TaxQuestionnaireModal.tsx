/**
 * A/R Tax Services, LLC — TaxGuard AI
 * Personalized Tax Questionnaire Modal (Tax-Year Aware)
 *
 * Implements:
 * - 28+ comprehensive tax fact topics
 * - Persistence to server-side authority
 * - Dynamic generation of case-specific document requirements
 * - Tailored checklist so irrelevant requirements are never shown
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Save,
  X,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Building2,
  DollarSign,
  Briefcase,
  Home,
  Globe,
  Heart
} from 'lucide-react';
import { TaxQuestionnaireAnswers } from '../../server/taxguard/taxQuestionnaire';

interface TaxQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  taxYear: number;
  onSaved?: () => void;
}

export const TaxQuestionnaireModal: React.FC<TaxQuestionnaireModalProps> = ({
  isOpen,
  onClose,
  clientId,
  taxYear,
  onSaved
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [answers, setAnswers] = useState<TaxQuestionnaireAnswers>({
    filingStatus: 'single',
    hasDependents: false,
    dependentCount: 0,
    hasW2Employment: true,
    hasMultipleEmployers: false,
    hasSelfEmployment: false,
    hasScheduleCActivity: false,
    hasPartnershipInterests: false,
    hasSCorporationInterests: false,
    hasCCorporationInterests: false,
    hasRentalProperties: false,
    hasBusinessAccountingRecords: false,
    hasInterestIncome: false,
    hasDividendIncome: false,
    hasSecuritiesTrades: false,
    hasCapitalGainsOrLosses: false,
    hasDigitalAssetsOrCrypto: false,
    hasRetirementDistributions: false,
    hasSocialSecurityBenefits: false,
    hasMarketplaceInsurance: false,
    hasHSA: false,
    hasEducationExpenses: false,
    hasMortgageOrRealEstateTaxes: false,
    hasItemizedDeductions: false,
    hasEstimatedTaxPayments: false,
    hasPriorYearFederalReturn: true,
    hasPriorYearStateReturn: false,
    hasForeignIncomeOrAssets: false,
    hasForeignBankAccounts: false,
    hasMultiStateIncome: false,
    hasPartYearResidency: false,
    stateOfResidency: 'SC',
    additionalStates: []
  });

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setErrorMessage(null);
    fetch(`/api/stage-two-three/questionnaire/${taxYear}?clientId=${encodeURIComponent(clientId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.questionnaire?.answers) {
          setAnswers(data.questionnaire.answers);
        }
      })
      .catch(() => {
        // Fallback to defaults
      })
      .finally(() => setLoading(false));
  }, [isOpen, taxYear, clientId]);

  if (!isOpen) return null;

  const handleToggle = (field: keyof TaxQuestionnaireAnswers) => {
    setAnswers(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/stage-two-three/questionnaire/${taxYear}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, answers })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save questionnaire.');
      }
      setSuccessMessage('Tax questionnaire saved! Your required document checklist has been updated.');
      onSaved?.();
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving questionnaire.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0D2745] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-[#071A2E] border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#D4A843]/10 border border-[#D4A843]/30">
              <FileText className="w-5 h-5 text-[#D4A843]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Personalized Tax Questionnaire</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#102D4F] text-[#D4A843] border border-[#D4A843]/30">
                  Tax Year {taxYear}
                </span>
              </h2>
              <p className="text-xs text-[#A9B7C8] mt-0.5">
                Answer these questions to tailor your required documents. Irrelevant documents will be automatically omitted.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Filing & Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4A843] font-bold">
              <Building2 className="w-4 h-4" />
              <span>1. Filing Status & Household</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-[#06182B] p-4 rounded-xl border border-slate-700/50">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-slate-300 font-medium">Anticipated Filing Status</span>
                <select
                  value={answers.filingStatus}
                  onChange={e => setAnswers(prev => ({ ...prev, filingStatus: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-[#0D2745] border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-[#D4A843]"
                >
                  <option value="single">Single</option>
                  <option value="married_filing_jointly">Married Filing Jointly</option>
                  <option value="married_filing_separately">Married Filing Separately</option>
                  <option value="head_of_household">Head of Household</option>
                  <option value="qualifying_surviving_spouse">Qualifying Surviving Spouse</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-300 font-medium">State of Primary Residency</span>
                <input
                  type="text"
                  maxLength={2}
                  value={answers.stateOfResidency}
                  onChange={e => setAnswers(prev => ({ ...prev, stateOfResidency: e.target.value.toUpperCase() }))}
                  placeholder="SC"
                  className="w-full px-3 py-2 bg-[#0D2745] border border-slate-700 rounded-lg text-xs font-mono text-white uppercase focus:outline-hidden focus:border-[#D4A843]"
                />
              </label>

              <div className="sm:col-span-2 flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasDependents')}>
                <span className="text-xs text-slate-200">Did you support any dependents (children or relatives)?</span>
                <input
                  type="checkbox"
                  checked={answers.hasDependents}
                  onChange={() => {}}
                  className="w-4 h-4 rounded-sm text-[#D4A843] bg-slate-900 border-slate-700"
                />
              </div>

              {answers.hasDependents && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">Number of Dependents:</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={answers.dependentCount || 1}
                    onChange={e => setAnswers(prev => ({ ...prev, dependentCount: Number(e.target.value) }))}
                    className="w-16 px-2 py-1 bg-[#0D2745] border border-slate-700 rounded-md text-xs text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Employment & Income */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4A843] font-bold">
              <Briefcase className="w-4 h-4" />
              <span>2. Employment & Business Activity</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#06182B] p-4 rounded-xl border border-slate-700/50 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasW2Employment')}>
                <span className="text-slate-200 font-medium">Earned wages reported on Form W-2</span>
                <input type="checkbox" checked={answers.hasW2Employment} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasMultipleEmployers')}>
                <span className="text-slate-200">Had multiple employers during the tax year</span>
                <input type="checkbox" checked={answers.hasMultipleEmployers} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasSelfEmployment')}>
                <span className="text-slate-200 font-medium">Independent contractor / 1099 gig income</span>
                <input type="checkbox" checked={answers.hasSelfEmployment} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasScheduleCActivity')}>
                <span className="text-slate-200">Sole Proprietorship / Single-Member LLC business</span>
                <input type="checkbox" checked={answers.hasScheduleCActivity} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasPartnershipInterests')}>
                <span className="text-slate-200">Partnership interests (Form 1065 / Schedule K-1)</span>
                <input type="checkbox" checked={answers.hasPartnershipInterests} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasSCorporationInterests')}>
                <span className="text-slate-200">S Corporation shareholder (Form 1120-S / Schedule K-1)</span>
                <input type="checkbox" checked={answers.hasSCorporationInterests} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasBusinessAccountingRecords')}>
                <span className="text-slate-200">Maintained formal bookkeeping / trial balance</span>
                <input type="checkbox" checked={answers.hasBusinessAccountingRecords} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasRentalProperties')}>
                <span className="text-slate-200">Owned and operated rental real estate properties</span>
                <input type="checkbox" checked={answers.hasRentalProperties} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
            </div>
          </div>

          {/* Section 3: Investments & Capital */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4A843] font-bold">
              <DollarSign className="w-4 h-4" />
              <span>3. Investments, Banking & Digital Assets</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#06182B] p-4 rounded-xl border border-slate-700/50 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasInterestIncome')}>
                <span className="text-slate-200">Earned interest from bank accounts or CDs (1099-INT)</span>
                <input type="checkbox" checked={answers.hasInterestIncome} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasDividendIncome')}>
                <span className="text-slate-200">Received dividends or mutual fund distributions (1099-DIV)</span>
                <input type="checkbox" checked={answers.hasDividendIncome} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasSecuritiesTrades')}>
                <span className="text-slate-200">Sold stocks, bonds, or securities (1099-B)</span>
                <input type="checkbox" checked={answers.hasSecuritiesTrades} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasDigitalAssetsOrCrypto')}>
                <span className="text-slate-200 font-medium">Sold, converted, or earned cryptocurrency / digital assets</span>
                <input type="checkbox" checked={answers.hasDigitalAssetsOrCrypto} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
            </div>
          </div>

          {/* Section 4: Healthcare, Deductions & Real Estate */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4A843] font-bold">
              <Heart className="w-4 h-4" />
              <span>4. Healthcare, Home & Deductions</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#06182B] p-4 rounded-xl border border-slate-700/50 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasMarketplaceInsurance')}>
                <span className="text-slate-200">Enrolled in Health Insurance Marketplace (Form 1095-A)</span>
                <input type="checkbox" checked={answers.hasMarketplaceInsurance} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasHSA')}>
                <span className="text-slate-200">Made contributions or took distributions from an HSA</span>
                <input type="checkbox" checked={answers.hasHSA} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasMortgageOrRealEstateTaxes')}>
                <span className="text-slate-200">Paid mortgage interest or real estate property taxes (1098)</span>
                <input type="checkbox" checked={answers.hasMortgageOrRealEstateTaxes} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasEducationExpenses')}>
                <span className="text-slate-200">Paid college tuition or higher education fees (1098-T)</span>
                <input type="checkbox" checked={answers.hasEducationExpenses} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
            </div>
          </div>

          {/* Section 5: Cross-Border, Prior Returns & Payments */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4A843] font-bold">
              <Globe className="w-4 h-4" />
              <span>5. Prior-Year Returns, Estimated Taxes & Foreign Accounts</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#06182B] p-4 rounded-xl border border-slate-700/50 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasPriorYearFederalReturn')}>
                <span className="text-slate-200">Filed prior year federal income tax return</span>
                <input type="checkbox" checked={answers.hasPriorYearFederalReturn} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasEstimatedTaxPayments')}>
                <span className="text-slate-200 font-medium">Made quarterly estimated tax payments (1040-ES)</span>
                <input type="checkbox" checked={answers.hasEstimatedTaxPayments} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasForeignBankAccounts')}>
                <span className="text-slate-200">Held financial accounts in a foreign country (FBAR)</span>
                <input type="checkbox" checked={answers.hasForeignBankAccounts} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#0D2745] transition cursor-pointer" onClick={() => handleToggle('hasMultiStateIncome')}>
                <span className="text-slate-200">Earned income or lived in more than one state</span>
                <input type="checkbox" checked={answers.hasMultiStateIncome} onChange={() => {}} className="w-4 h-4 rounded-sm text-[#D4A843]" />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between">
            <div className="text-[11px] text-slate-400">
              Answers are securely saved under tenant authority and generate tailored compliance items.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save & Update Checklist'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
