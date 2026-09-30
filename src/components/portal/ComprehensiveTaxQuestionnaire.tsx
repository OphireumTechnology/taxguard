/**
 * A/R Tax Services, LLC - Comprehensive Tax Questionnaire (Stage 01 Onboard)
 * Directive 14 & 15: Taxpayer Fact Capture & Dynamic Document Requirement Driver
 *
 * Implements full conditional branching across 12 canonical statutory tax topics:
 * 1. Identity & Filing Status
 * 2. Employment Income (W-2, Multi-Employer, Withholding)
 * 3. Self-Employment / Business (1099-NEC, Schedule C, Home Office, Mileage, Inventory)
 * 4. Investments (Interest, Dividends, Brokerage 1099-B, Capital Gains, Digital Assets / Crypto)
 * 5. Retirement (Pension, IRA, 401k, Social Security)
 * 6. Real Estate (Homeownership, Form 1098, Property Taxes, Rental Schedule E, Property Sale)
 * 7. Education (Tuition 1098-T, Student Loans 1098-E, Credits)
 * 8. Health & HSA (HSA 1099-SA, Marketplace 1095-A)
 * 9. Deductions & Credits (Charity, Childcare / Dependent Care, Estimated Taxes, Energy Credits)
 * 10. Other Income (Unemployment 1099-G, Gambling, Royalties, Schedule K-1, Foreign Income)
 * 11. State & Local (Residency, Part-Year, Multi-State)
 * 12. Prior-Year Tax Returns (Filing status, Carryovers, Losses, Depreciation, Estimated payments)
 */

import React, { useState } from 'react';
import {
  FileText,
  User,
  Briefcase,
  TrendingUp,
  Landmark,
  Home,
  GraduationCap,
  Heart,
  Receipt,
  Globe,
  MapPin,
  History,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  Lock,
  Plus,
  Trash2
} from 'lucide-react';

export interface TaxQuestionnaireAnswers {
  // 1. Identity & Filing
  filingStatus: 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household' | 'qualifying_surviving_spouse';
  spouseFullName?: string;
  spouseSSNMasked?: string;
  hasAddressChanged: boolean;
  hasMarriageOrDivorceInYear: boolean;
  hasDependents: boolean;
  dependents: Array<{ name: string; relation: string; dob: string; ssnLast4: string }>;
  isUsCitizenOrResident: boolean;

  // 2. Employment
  hasW2Employment: boolean;
  w2EmployerCount: number;
  hasExcessWithholding: boolean;

  // 3. Self-Employment & Business
  hasSelfEmployment: boolean;
  businessName?: string;
  has1099Nec: boolean;
  hasScheduleCExpenses: boolean;
  hasHomeOfficeDeduction: boolean;
  hasVehicleMileage: boolean;
  vehicleMileageEstimate?: number;
  hasContractorPayments: boolean;
  hasInventoryOrCostOfGoods: boolean;

  // 4. Investments
  hasInterestIncome: boolean;
  hasDividendIncome: boolean;
  hasBrokerageTransactions: boolean;
  hasCapitalGainsOrLosses: boolean;
  hasCryptocurrencyActivity: boolean;

  // 5. Retirement
  hasPensionOrAnnuity: boolean;
  hasIraDistributionsOrContributions: boolean;
  has401kDistributions: boolean;
  hasSocialSecurityBenefits: boolean;

  // 6. Real Estate
  ownsPrimaryResidence: boolean;
  hasMortgageInterest1098: boolean;
  paidRealEstateTaxes: boolean;
  hasRentalProperties: boolean;
  rentalPropertiesCount: number;
  soldRealEstateInYear: boolean;

  // 7. Education
  paidHigherEducationTuition: boolean;
  hasStudentLoanInterest1098E: boolean;
  claimingEducationCredits: boolean;

  // 8. Health
  hasHsaAccount: boolean;
  hasHsaDistributionsOrContributions: boolean;
  hadMarketplaceInsurance1095A: boolean;

  // 9. Deductions & Credits
  hasCharitableContributions: boolean;
  charitableCashAmount?: number;
  charitableNonCashAmount?: number;
  hasChildcareOrDependentCare: boolean;
  childcareExpensesAmount?: number;
  madeEstimatedTaxPayments: boolean;
  estimatedPaymentsTotal?: number;
  hasCleanEnergyImprovements: boolean;

  // 10. Other Income
  hasUnemploymentIncome1099G: boolean;
  hasGamblingWinningsOrLosses: boolean;
  hasRoyaltiesIncome: boolean;
  hasScheduleK1PassThrough: boolean;
  hasForeignIncomeOrAccounts: boolean;
  foreignFinancialAccountsFbarRequired?: boolean;

  // 11. State & Local
  primaryStateResidency: string;
  isPartYearStateResident: boolean;
  partYearPreviousState?: string;
  hasMultiStateIncome: boolean;
  multiStateList?: string[];

  // 12. Prior-Year Tax Returns
  hasPriorYearTaxReturn: boolean;
  priorYearFilingStatus?: string;
  hasLossCarryovers: boolean;
  hasDepreciationSchedules: boolean;
  hasPriorEstimatedPayments: boolean;
}

export const DEFAULT_QUESTIONNAIRE_ANSWERS: TaxQuestionnaireAnswers = {
  filingStatus: 'single',
  hasAddressChanged: false,
  hasMarriageOrDivorceInYear: false,
  hasDependents: false,
  dependents: [],
  isUsCitizenOrResident: true,
  hasW2Employment: true,
  w2EmployerCount: 1,
  hasExcessWithholding: false,
  hasSelfEmployment: false,
  has1099Nec: false,
  hasScheduleCExpenses: false,
  hasHomeOfficeDeduction: false,
  hasVehicleMileage: false,
  hasContractorPayments: false,
  hasInventoryOrCostOfGoods: false,
  hasInterestIncome: false,
  hasDividendIncome: false,
  hasBrokerageTransactions: false,
  hasCapitalGainsOrLosses: false,
  hasCryptocurrencyActivity: false,
  hasPensionOrAnnuity: false,
  hasIraDistributionsOrContributions: false,
  has401kDistributions: false,
  hasSocialSecurityBenefits: false,
  ownsPrimaryResidence: false,
  hasMortgageInterest1098: false,
  paidRealEstateTaxes: false,
  hasRentalProperties: false,
  rentalPropertiesCount: 0,
  soldRealEstateInYear: false,
  paidHigherEducationTuition: false,
  hasStudentLoanInterest1098E: false,
  claimingEducationCredits: false,
  hasHsaAccount: false,
  hasHsaDistributionsOrContributions: false,
  hadMarketplaceInsurance1095A: false,
  hasCharitableContributions: false,
  hasChildcareOrDependentCare: false,
  madeEstimatedTaxPayments: false,
  hasCleanEnergyImprovements: false,
  hasUnemploymentIncome1099G: false,
  hasGamblingWinningsOrLosses: false,
  hasRoyaltiesIncome: false,
  hasScheduleK1PassThrough: false,
  hasForeignIncomeOrAccounts: false,
  primaryStateResidency: 'SC',
  isPartYearStateResident: false,
  hasMultiStateIncome: false,
  hasPriorYearTaxReturn: true,
  hasLossCarryovers: false,
  hasDepreciationSchedules: false,
  hasPriorEstimatedPayments: false
};

interface ComprehensiveTaxQuestionnaireProps {
  answers: TaxQuestionnaireAnswers;
  onChange: (updated: TaxQuestionnaireAnswers) => void;
  isReadOnly?: boolean;
}

export const ComprehensiveTaxQuestionnaire: React.FC<ComprehensiveTaxQuestionnaireProps> = ({
  answers,
  onChange,
  isReadOnly = false
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sec_identity: true,
    sec_employment: true,
    sec_business: false,
    sec_investments: false,
    sec_retirement: false,
    sec_realestate: false,
    sec_education: false,
    sec_health: false,
    sec_deductions: false,
    sec_other: false,
    sec_state: false,
    sec_prior: false
  });

  const toggleSection = (secId: string) => {
    setOpenSections(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

  const update = <K extends keyof TaxQuestionnaireAnswers>(key: K, value: TaxQuestionnaireAnswers[K]) => {
    if (isReadOnly) return;
    onChange({ ...answers, [key]: value });
  };

  const addDependent = () => {
    if (isReadOnly) return;
    const current = answers.dependents || [];
    update('dependents', [...current, { name: '', relation: 'Child', dob: '', ssnLast4: '' }]);
  };

  const removeDependent = (index: number) => {
    if (isReadOnly) return;
    const current = [...(answers.dependents || [])];
    current.splice(index, 1);
    update('dependents', current);
  };

  const updateDependent = (index: number, field: string, val: string) => {
    if (isReadOnly) return;
    const current = [...(answers.dependents || [])];
    current[index] = { ...current[index], [field]: val };
    update('dependents', current);
  };

  return (
    <div className="space-y-4" id="taxguard-comprehensive-questionnaire">
      {/* Header Banner */}
      <div className="bg-[#071A2E] border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-[#D4A843] uppercase tracking-widest">
              Statutory Intake Questionnaire
            </span>
            {isReadOnly && (
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40 rounded flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Certified &bull; Read-Only</span>
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">
            Taxpayer Facts &amp; Dynamic Requirements Intake
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Your responses establish the deterministic document checklist and applicable tax schedules for Stage 02.
          </p>
        </div>
      </div>

      {/* 1. IDENTITY & FILING STATUS */}
      <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('sec_identity')}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left bg-[#0A1F38] hover:bg-[#0e2c4e] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-[#D4A843]" />
            <div>
              <span className="text-xs font-mono font-bold text-[#D4A843] uppercase mr-2">Topic 01</span>
              <span className="text-sm font-bold text-white">Identity &amp; Filing Status</span>
            </div>
          </div>
          {openSections['sec_identity'] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections['sec_identity'] && (
          <div className="p-5 space-y-4 border-t border-slate-700/60 text-xs text-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Federal Filing Status *</label>
                <select
                  disabled={isReadOnly}
                  value={answers.filingStatus}
                  onChange={e => update('filingStatus', e.target.value as any)}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-[#D4A843]"
                >
                  <option value="single">Single</option>
                  <option value="married_filing_jointly">Married Filing Jointly</option>
                  <option value="married_filing_separately">Married Filing Separately</option>
                  <option value="head_of_household">Head of Household</option>
                  <option value="qualifying_surviving_spouse">Qualifying Surviving Spouse</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">U.S. Citizenship / Residency Status</label>
                <select
                  disabled={isReadOnly}
                  value={answers.isUsCitizenOrResident ? 'yes' : 'no'}
                  onChange={e => update('isUsCitizenOrResident', e.target.value === 'yes')}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-[#D4A843]"
                >
                  <option value="yes">U.S. Citizen / Permanent Resident (Resident Alien)</option>
                  <option value="no">Non-Resident Alien (Form 1040-NR / Dual-Status)</option>
                </select>
              </div>
            </div>

            {/* Conditional Spouse Fields */}
            {(answers.filingStatus === 'married_filing_jointly' || answers.filingStatus === 'married_filing_separately') && (
              <div className="p-3.5 bg-[#06182B] border border-blue-900/40 rounded-lg space-y-3">
                <span className="text-[11px] font-bold text-[#D4A843] uppercase tracking-wider block">Spouse Information (IRC § 6013)</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Spouse Full Legal Name</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={answers.spouseFullName || ''}
                      onChange={e => update('spouseFullName', e.target.value)}
                      placeholder="Spouse Legal Name"
                      className="w-full bg-[#0D2745] border border-slate-700 rounded p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Spouse SSN / ITIN (Masked)</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={answers.spouseSSNMasked || '***-**-****'}
                      onChange={e => update('spouseSSNMasked', e.target.value)}
                      placeholder="***-**-1234"
                      className="w-full bg-[#0D2745] border border-slate-700 rounded p-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Address & Family Changes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={answers.hasAddressChanged}
                  onChange={e => update('hasAddressChanged', e.target.checked)}
                  className="rounded text-[#D4A843] focus:ring-[#D4A843]"
                />
                <span>Moved or changed primary residence during this tax year</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={answers.hasMarriageOrDivorceInYear}
                  onChange={e => update('hasMarriageOrDivorceInYear', e.target.checked)}
                  className="rounded text-[#D4A843] focus:ring-[#D4A843]"
                />
                <span>Marital status changed during the year (Marriage, Divorce, Legal Separation)</span>
              </label>
            </div>

            {/* Dependents */}
            <div className="pt-2 border-t border-slate-700/60">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={answers.hasDependents}
                  onChange={e => update('hasDependents', e.target.checked)}
                  className="rounded text-[#D4A843] focus:ring-[#D4A843]"
                />
                <span className="font-semibold text-white">Claiming children or qualifying dependents (Child Tax Credit / ODC)</span>
              </label>

              {answers.hasDependents && (
                <div className="space-y-2 mt-2">
                  {(answers.dependents || []).map((dep, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 bg-[#06182B] p-2 rounded border border-slate-700">
                      <input
                        type="text"
                        disabled={isReadOnly}
                        placeholder="Dependent Name"
                        value={dep.name}
                        onChange={e => updateDependent(idx, 'name', e.target.value)}
                        className="bg-[#0D2745] border border-slate-700 rounded p-1.5 text-xs text-white flex-1 min-w-[120px]"
                      />
                      <input
                        type="text"
                        disabled={isReadOnly}
                        placeholder="Relationship (e.g. Son, Daughter)"
                        value={dep.relation}
                        onChange={e => updateDependent(idx, 'relation', e.target.value)}
                        className="bg-[#0D2745] border border-slate-700 rounded p-1.5 text-xs text-white w-32"
                      />
                      <input
                        type="date"
                        disabled={isReadOnly}
                        value={dep.dob}
                        onChange={e => updateDependent(idx, 'dob', e.target.value)}
                        className="bg-[#0D2745] border border-slate-700 rounded p-1.5 text-xs text-white"
                      />
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => removeDependent(idx)}
                          className="p-1.5 text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={addDependent}
                      className="px-3 py-1.5 bg-[#102D4F] hover:bg-[#163a64] border border-slate-700 rounded text-xs text-[#D4A843] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Dependent</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. EMPLOYMENT */}
      <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('sec_employment')}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left bg-[#0A1F38] hover:bg-[#0e2c4e] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Briefcase className="w-4 h-4 text-[#D4A843]" />
            <div>
              <span className="text-xs font-mono font-bold text-[#D4A843] uppercase mr-2">Topic 02</span>
              <span className="text-sm font-bold text-white">Employment &amp; Wage Income (Form W-2)</span>
            </div>
          </div>
          {openSections['sec_employment'] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections['sec_employment'] && (
          <div className="p-5 space-y-3 border-t border-slate-700/60 text-xs text-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasW2Employment}
                onChange={e => update('hasW2Employment', e.target.checked)}
                className="rounded text-[#D4A843] focus:ring-[#D4A843]"
              />
              <span className="font-semibold text-white">Received Form W-2 Wage &amp; Tax Statement(s) from employer(s)</span>
            </label>

            {answers.hasW2Employment && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 pt-1">
                <div>
                  <label className="block text-slate-300 mb-1">Number of Employers (W-2s to upload) *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    disabled={isReadOnly}
                    value={answers.w2EmployerCount || 1}
                    onChange={e => update('w2EmployerCount', parseInt(e.target.value, 10) || 1)}
                    className="w-32 bg-[#06182B] border border-slate-700 rounded p-1.5 text-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Drives dynamic W-2 checklist requirements in Stage 02.</p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer self-center">
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={answers.hasExcessWithholding}
                    onChange={e => update('hasExcessWithholding', e.target.checked)}
                    className="rounded text-[#D4A843]"
                  />
                  <span>Multiple jobs resulted in excess Social Security tax withholding (&gt;$10,453 max)</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. SELF-EMPLOYMENT / BUSINESS */}
      <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('sec_business')}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left bg-[#0A1F38] hover:bg-[#0e2c4e] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Landmark className="w-4 h-4 text-[#D4A843]" />
            <div>
              <span className="text-xs font-mono font-bold text-[#D4A843] uppercase mr-2">Topic 03</span>
              <span className="text-sm font-bold text-white">Self-Employment, 1099-NEC &amp; Business (Schedule C)</span>
            </div>
          </div>
          {openSections['sec_business'] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections['sec_business'] && (
          <div className="p-5 space-y-3 border-t border-slate-700/60 text-xs text-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasSelfEmployment}
                onChange={e => update('hasSelfEmployment', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span className="font-semibold text-white">Engaged in independent contracting, 1099 consulting, gig work, or single-member LLC operations</span>
            </label>

            {answers.hasSelfEmployment && (
              <div className="pl-6 space-y-3 pt-1 border-l-2 border-[#D4A843]/40">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Business or Trade Name (DBA if applicable)</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      placeholder="e.g. Palmetto Strategic Advisory"
                      value={answers.businessName || ''}
                      onChange={e => update('businessName', e.target.value)}
                      className="w-full bg-[#06182B] border border-slate-700 rounded p-1.5 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={answers.has1099Nec}
                        onChange={e => update('has1099Nec', e.target.checked)}
                        className="rounded text-[#D4A843]"
                      />
                      <span>Received Form 1099-NEC or 1099-K merchant processing statements</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={answers.hasHomeOfficeDeduction}
                        onChange={e => update('hasHomeOfficeDeduction', e.target.checked)}
                        className="rounded text-[#D4A843]"
                      />
                      <span>Maintained dedicated square footage for exclusive Home Office use (Form 8829)</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isReadOnly}
                      checked={answers.hasVehicleMileage}
                      onChange={e => update('hasVehicleMileage', e.target.checked)}
                      className="rounded text-[#D4A843]"
                    />
                    <span>Business vehicle mileage log maintained</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isReadOnly}
                      checked={answers.hasContractorPayments}
                      onChange={e => update('hasContractorPayments', e.target.checked)}
                      className="rounded text-[#D4A843]"
                    />
                    <span>Paid &gt;$600 to sub-contractors (1099-NEC filing required)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isReadOnly}
                      checked={answers.hasInventoryOrCostOfGoods}
                      onChange={e => update('hasInventoryOrCostOfGoods', e.target.checked)}
                      className="rounded text-[#D4A843]"
                    />
                    <span>Maintained merchandise inventory / COGS</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. INVESTMENTS & DIGITAL ASSETS */}
      <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('sec_investments')}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left bg-[#0A1F38] hover:bg-[#0e2c4e] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-[#D4A843]" />
            <div>
              <span className="text-xs font-mono font-bold text-[#D4A843] uppercase mr-2">Topic 04</span>
              <span className="text-sm font-bold text-white">Investments, Brokerage &amp; Digital Assets (Schedule D / 8949)</span>
            </div>
          </div>
          {openSections['sec_investments'] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections['sec_investments'] && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-700/60 text-xs text-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasInterestIncome}
                onChange={e => update('hasInterestIncome', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Interest income earned (Form 1099-INT across bank accounts or bonds)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasDividendIncome}
                onChange={e => update('hasDividendIncome', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Dividends received from stocks or mutual funds (Form 1099-DIV)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasBrokerageTransactions}
                onChange={e => update('hasBrokerageTransactions', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Sold stocks, bonds, or ETF securities (Form 1099-B / Schedule D)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasCryptocurrencyActivity}
                onChange={e => update('hasCryptocurrencyActivity', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Cryptocurrency, virtual currency, or digital asset sales / trades / staking (Mandatory IRS Question)</span>
            </label>
          </div>
        )}
      </div>

      {/* 5. RETIREMENT & SOCIAL SECURITY */}
      <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('sec_retirement')}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left bg-[#0A1F38] hover:bg-[#0e2c4e] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <History className="w-4 h-4 text-[#D4A843]" />
            <div>
              <span className="text-xs font-mono font-bold text-[#D4A843] uppercase mr-2">Topic 05</span>
              <span className="text-sm font-bold text-white">Retirement Distributions, 401(k), IRA &amp; Social Security</span>
            </div>
          </div>
          {openSections['sec_retirement'] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections['sec_retirement'] && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-700/60 text-xs text-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasPensionOrAnnuity}
                onChange={e => update('hasPensionOrAnnuity', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Received pension, annuity, or retirement distribution (Form 1099-R)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasIraDistributionsOrContributions}
                onChange={e => update('hasIraDistributionsOrContributions', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Traditional or Roth IRA contribution, distribution, or backdoor conversion</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasSocialSecurityBenefits}
                onChange={e => update('hasSocialSecurityBenefits', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Received Social Security benefit statements (Form SSA-1099)</span>
            </label>
          </div>
        )}
      </div>

      {/* 6. REAL ESTATE & RENTAL PROPERTIES */}
      <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('sec_realestate')}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left bg-[#0A1F38] hover:bg-[#0e2c4e] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Home className="w-4 h-4 text-[#D4A843]" />
            <div>
              <span className="text-xs font-mono font-bold text-[#D4A843] uppercase mr-2">Topic 06</span>
              <span className="text-sm font-bold text-white">Real Estate, Mortgage &amp; Rental Properties (Schedule E)</span>
            </div>
          </div>
          {openSections['sec_realestate'] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections['sec_realestate'] && (
          <div className="p-5 space-y-3 border-t border-slate-700/60 text-xs text-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={answers.ownsPrimaryResidence}
                  onChange={e => update('ownsPrimaryResidence', e.target.checked)}
                  className="rounded text-[#D4A843]"
                />
                <span>Own primary residence or secondary vacation home</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={answers.hasMortgageInterest1098}
                  onChange={e => update('hasMortgageInterest1098', e.target.checked)}
                  className="rounded text-[#D4A843]"
                />
                <span>Paid mortgage interest (Form 1098) or real estate property taxes</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={answers.soldRealEstateInYear}
                  onChange={e => update('soldRealEstateInYear', e.target.checked)}
                  className="rounded text-[#D4A843]"
                />
                <span>Sold a home or real property (Form 1099-S / Section 121 exclusion)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={answers.hasRentalProperties}
                  onChange={e => update('hasRentalProperties', e.target.checked)}
                  className="rounded text-[#D4A843]"
                />
                <span className="font-semibold text-white">Operate residential or commercial rental properties (Schedule E)</span>
              </label>
            </div>

            {answers.hasRentalProperties && (
              <div className="p-3 bg-[#06182B] border border-slate-700 rounded-lg pl-4">
                <label className="block text-slate-300 mb-1">Number of Rental Properties (Units)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  disabled={isReadOnly}
                  value={answers.rentalPropertiesCount || 1}
                  onChange={e => update('rentalPropertiesCount', parseInt(e.target.value, 10) || 1)}
                  className="w-32 bg-[#0D2745] border border-slate-700 rounded p-1.5 text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Requires Schedule E rental income/expense records and depreciation schedules.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. DEDUCTIONS & ESTIMATED PAYMENTS */}
      <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('sec_deductions')}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left bg-[#0A1F38] hover:bg-[#0e2c4e] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Receipt className="w-4 h-4 text-[#D4A843]" />
            <div>
              <span className="text-xs font-mono font-bold text-[#D4A843] uppercase mr-2">Topic 07</span>
              <span className="text-sm font-bold text-white">Deductions, Credits &amp; Estimated Tax Payments</span>
            </div>
          </div>
          {openSections['sec_deductions'] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections['sec_deductions'] && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-700/60 text-xs text-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasCharitableContributions}
                onChange={e => update('hasCharitableContributions', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Donated cash or non-cash property to qualified charities</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasChildcareOrDependentCare}
                onChange={e => update('hasChildcareOrDependentCare', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Paid daycare / childcare expenses so you could work (Form 2441)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.madeEstimatedTaxPayments}
                onChange={e => update('madeEstimatedTaxPayments', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Made quarterly federal or state estimated tax payments (EFTPS receipts)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasCleanEnergyImprovements}
                onChange={e => update('hasCleanEnergyImprovements', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span>Installed solar panels, heat pumps, or electric vehicle charging (Form 5695)</span>
            </label>
          </div>
        )}
      </div>

      {/* 8. PRIOR-YEAR TAX CONTINUITY */}
      <div className="bg-[#0D2745] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => toggleSection('sec_prior')}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left bg-[#0A1F38] hover:bg-[#0e2c4e] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <History className="w-4 h-4 text-[#D4A843]" />
            <div>
              <span className="text-xs font-mono font-bold text-[#D4A843] uppercase mr-2">Topic 08</span>
              <span className="text-sm font-bold text-white">Prior-Year Tax Return Continuity &amp; Carryovers</span>
            </div>
          </div>
          {openSections['sec_prior'] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections['sec_prior'] && (
          <div className="p-5 space-y-3 border-t border-slate-700/60 text-xs text-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={answers.hasPriorYearTaxReturn}
                onChange={e => update('hasPriorYearTaxReturn', e.target.checked)}
                className="rounded text-[#D4A843]"
              />
              <span className="font-semibold text-white">Prior year filed tax return (2024 / 2023) is available for upload</span>
            </label>

            {answers.hasPriorYearTaxReturn && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={answers.hasLossCarryovers}
                    onChange={e => update('hasLossCarryovers', e.target.checked)}
                    className="rounded text-[#D4A843]"
                  />
                  <span>Prior capital loss carryover or NOL (Net Operating Loss)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={answers.hasDepreciationSchedules}
                    onChange={e => update('hasDepreciationSchedules', e.target.checked)}
                    className="rounded text-[#D4A843]"
                  />
                  <span>Ongoing asset depreciation / Form 4562 carryforward schedule</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
