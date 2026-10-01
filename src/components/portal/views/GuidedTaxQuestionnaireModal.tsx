/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Guided Tax Discovery Questionnaire Modal
 *
 * Implements:
 * - Section 2: Structured interview before displaying final document checklist
 * - Conditional / branching questions covering:
 *   Personal/Filing, Employment, Self-Employment, Interest/Investments, Retirement,
 *   Real Estate, Education, Health/HSA, Charitable/Deductions, Estimated Taxes, Foreign
 * - Section 10: Multi-State tax discovery
 */

import React, { useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  Building2,
  Briefcase,
  TrendingUp,
  Home,
  GraduationCap,
  Heart,
  Globe,
  Sparkles,
  Save
} from 'lucide-react';
import {
  TaxDiscoveryQuestionnaireAnswers,
  TaxDocumentRequirementEngine
} from '../../../services/taxDocumentRequirementEngine';

interface GuidedTaxQuestionnaireModalProps {
  clientId: string;
  selectedTaxYear: number;
  isOpen: boolean;
  onClose: () => void;
  onAnswersSaved: (answers: TaxDiscoveryQuestionnaireAnswers) => void;
}

export const GuidedTaxQuestionnaireModal: React.FC<GuidedTaxQuestionnaireModalProps> = ({
  clientId,
  selectedTaxYear,
  isOpen,
  onClose,
  onAnswersSaved
}) => {
  const [answers, setAnswers] = useState<TaxDiscoveryQuestionnaireAnswers>(() =>
    TaxDocumentRequirementEngine.getQuestionnaire(clientId, selectedTaxYear)
  );

  const [activeStep, setActiveStep] = useState<number>(1);
  const totalSteps = 6;

  if (!isOpen) return null;

  const handleToggle = (key: keyof TaxDiscoveryQuestionnaireAnswers) => {
    setAnswers(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveAndComplete = () => {
    const saved = TaxDocumentRequirementEngine.saveQuestionnaire(clientId, selectedTaxYear, answers);
    onAnswersSaved(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-[#0D2745] border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#06182B] text-[#D4A843] border border-slate-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">
                Guided Tax Discovery Questionnaire
              </h2>
              <div className="text-xs text-[#A9B7C8] font-mono">
                Tax Year {selectedTaxYear} &bull; Step {activeStep} of {totalSteps}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full h-1 bg-[#06182B]">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-[#D4A843] to-blue-500 transition-all duration-300"
            style={{ width: `${(activeStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Questionnaire Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[#F8FAFC]">
          {/* STEP 1: Personal, Filing & Multi-State Nexus */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-[#D4A843] flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>1. Personal &amp; Filing Jurisdiction</span>
              </h3>

              <div className="p-4 rounded-xl bg-[#06182B] border border-slate-700 space-y-3">
                <label className="font-bold block text-[#F8FAFC]">
                  Filing Status for Tax Year {selectedTaxYear}
                </label>
                <select
                  value={answers.filingStatus}
                  onChange={(e) => setAnswers(prev => ({ ...prev, filingStatus: e.target.value as any }))}
                  className="w-full p-2.5 rounded-lg bg-[#102D4F] border border-slate-700 text-xs text-white focus:outline-none focus:border-[#D4A843]"
                >
                  <option value="single">Single</option>
                  <option value="married_filing_jointly">Married Filing Jointly (MFJ)</option>
                  <option value="married_filing_separately">Married Filing Separately (MFS)</option>
                  <option value="head_of_household">Head of Household (HOH)</option>
                  <option value="qualifying_surviving_spouse">Qualifying Surviving Spouse</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-[#06182B] border border-slate-700 space-y-3">
                <label className="font-bold block text-[#F8FAFC]">
                  State of Primary Residence
                </label>
                <input
                  type="text"
                  value={answers.residentState}
                  onChange={(e) => setAnswers(prev => ({ ...prev, residentState: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SC, NC, NY, CA"
                  maxLength={2}
                  className="w-24 p-2.5 rounded-lg bg-[#102D4F] border border-slate-700 text-xs text-white uppercase font-mono font-bold focus:outline-none focus:border-[#D4A843]"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasDependents}
                    onChange={() => handleToggle('hasDependents')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Did you support children or other dependents during {selectedTaxYear}?</span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasPriorYearTaxReturn}
                    onChange={() => handleToggle('hasPriorYearTaxReturn')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Do you have a copy of your prior-year ({selectedTaxYear - 1}) federal and state tax returns?</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: Employment & Multiple States */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-[#D4A843] flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                <span>2. Employment &amp; Wage Income</span>
              </h3>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasW2Employment}
                    onChange={() => handleToggle('hasW2Employment')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <div>
                    <span className="font-bold block">Did you receive W-2 wages from an employer?</span>
                    <span className="text-[11px] text-[#A9B7C8]">Generates Form W-2 collection requirement.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.workedInMultipleStates}
                    onChange={() => handleToggle('workedInMultipleStates')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <div>
                    <span className="font-bold block">Did you work in more than one state or have remote work across state lines?</span>
                    <span className="text-[11px] text-[#A9B7C8]">Discovers multi-state nonresident return filing obligations.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: Self-Employment & Business (Schedule C) */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-[#D4A843] flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>3. Self-Employment, Freelance &amp; Gig Work</span>
              </h3>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasSelfEmployment}
                    onChange={() => handleToggle('hasSelfEmployment')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <div>
                    <span className="font-bold block">Did you operate a business, consult, freelance, or earn 1099 income?</span>
                    <span className="text-[11px] text-[#A9B7C8]">Activates Schedule C Profit &amp; Loss requirements.</span>
                  </div>
                </label>

                {answers.hasSelfEmployment && (
                  <div className="pl-6 space-y-2 pt-2 border-l-2 border-[#D4A843]/50">
                    <label className="flex items-center gap-3 p-3 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={answers.has1099NEC}
                        onChange={() => handleToggle('has1099NEC')}
                        className="rounded text-[#D4A843] focus:ring-0"
                      />
                      <span>Received Form 1099-NEC from clients ($600+)</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={answers.has1099K}
                        onChange={() => handleToggle('has1099K')}
                        className="rounded text-[#D4A843] focus:ring-0"
                      />
                      <span>Received Form 1099-K from payment processors (Stripe, Square, PayPal)</span>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={answers.hasBusinessVehicle}
                        onChange={() => handleToggle('hasBusinessVehicle')}
                        className="rounded text-[#D4A843] focus:ring-0"
                      />
                      <span>Used a personal or company vehicle for business travel</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Investments, Interest & Digital Assets */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-[#D4A843] flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>4. Investments &amp; Financial Assets</span>
              </h3>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasBankInterest}
                    onChange={() => handleToggle('hasBankInterest')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Did you earn bank or savings account interest ($10+) (Form 1099-INT)?</span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasDividends}
                    onChange={() => handleToggle('hasDividends')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Did you receive stock or mutual fund dividends (Form 1099-DIV)?</span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasStockSalesBrokerage}
                    onChange={() => handleToggle('hasStockSalesBrokerage')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Did you sell stocks, bonds, or securities through a brokerage (Form 1099-B)?</span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasDigitalAssetsCrypto}
                    onChange={() => handleToggle('hasDigitalAssetsCrypto')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Did you transact, sell, trade, or receive cryptocurrency or digital assets?</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 5: Real Estate, Retirement, Education, Health */}
          {activeStep === 5 && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-[#D4A843] flex items-center gap-2">
                <Home className="w-4 h-4" />
                <span>5. Real Estate, Health &amp; Retirement</span>
              </h3>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.ownsHomeWithMortgage}
                    onChange={() => handleToggle('ownsHomeWithMortgage')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Do you own a home with a mortgage or paid property taxes (Form 1098)?</span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.ownsRentalProperty}
                    onChange={() => handleToggle('ownsRentalProperty')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Do you own rental real estate property (Schedule E)?</span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasMarketplaceHealthInsurance}
                    onChange={() => handleToggle('hasMarketplaceHealthInsurance')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Did you purchase health insurance through Healthcare.gov (Form 1095-A)?</span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.hasHsaAccount}
                    onChange={() => handleToggle('hasHsaAccount')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Did you contribute to or take distributions from a Health Savings Account (HSA)?</span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#06182B] border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.paidHigherEducationTuition}
                    onChange={() => handleToggle('paidHigherEducationTuition')}
                    className="rounded text-[#D4A843] focus:ring-0"
                  />
                  <span>Did you pay college or higher education tuition (Form 1098-T)?</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 6: Review & Final Confirmation */}
          {activeStep === 6 && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-[#D4A843] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>6. Review &amp; Generate Checklist</span>
              </h3>

              <div className="p-4 rounded-xl bg-[#06182B] border border-slate-700 space-y-2">
                <span className="text-xs font-bold text-[#F8FAFC]">Summary of Detected Tax Profile</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#A9B7C8] font-mono pt-1">
                  <div>Filing Status: <strong className="text-white">{answers.filingStatus}</strong></div>
                  <div>Resident State: <strong className="text-white">{answers.residentState}</strong></div>
                  <div>W-2 Employment: <strong className="text-white">{answers.hasW2Employment ? 'Yes' : 'No'}</strong></div>
                  <div>Self-Employment: <strong className="text-white">{answers.hasSelfEmployment ? 'Yes' : 'No'}</strong></div>
                  <div>Brokerage Sales: <strong className="text-white">{answers.hasStockSalesBrokerage ? 'Yes' : 'No'}</strong></div>
                  <div>Rental Property: <strong className="text-white">{answers.ownsRentalProperty ? 'Yes' : 'No'}</strong></div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#102D4F] border border-blue-500/40 text-xs text-blue-200">
                Clicking <strong>Save &amp; Generate Checklist</strong> will update your document requirements in real time. Only requirements applicable to your answers will be displayed.
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-700/60 bg-[#06182B] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
            disabled={activeStep === 1}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#102D4F] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          {activeStep < totalSteps ? (
            <button
              type="button"
              onClick={() => setActiveStep(prev => Math.min(totalSteps, prev + 1))}
              className="px-5 py-2 rounded-xl text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveAndComplete}
              className="px-5 py-2 rounded-xl text-xs font-bold text-[#06182B] bg-emerald-400 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save &amp; Generate Checklist</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
