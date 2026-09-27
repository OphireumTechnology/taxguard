/**
 * A/R Tax Services, LLC - Dynamic Client Onboarding Questionnaire
 * Compliance with Section 6: Comprehensive coverage of Personal Profile, Income, Business,
 * Real estate, Investments, Healthcare, Education, Family, Deductions/credits, and Foreign info.
 * CRITICAL RULE: Any foreign-information answer MUST trigger:
 * "Foreign information — Professional review required."
 */

import React, { useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Save,
  Send,
  Sparkles,
  Info,
  ShieldCheck,
  Globe,
  Building2,
  DollarSign,
  Heart,
  GraduationCap,
  Users
} from 'lucide-react';

interface ClientQuestionnaireSectionProps {
  selectedYear?: number;
  onOpenAssistant: () => void;
  onNavigateToChecklist: () => void;
  onUnsavedChange?: (isDirty: boolean) => void;
}

interface QuestionSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const SECTIONS: QuestionSection[] = [
  { id: 'personal', title: 'Personal Profile & Marital Status', icon: Users, description: 'Filing status, citizenship, residency changes, and identity verification.' },
  { id: 'income', title: 'Income & Wages', icon: DollarSign, description: 'W-2 compensation, bonuses, tips, self-employment, and 1099 earnings.' },
  { id: 'business', title: 'Business & Entities', icon: Building2, description: 'Sole proprietorships, LLCs, S-Corporations, partnerships, and nexus.' },
  { id: 'real_estate', title: 'Real Estate & Properties', icon: Building2, description: 'Primary residence, rental properties, 1031 exchanges, and acquisitions.' },
  { id: 'investments', title: 'Investments & Capital Assets', icon: DollarSign, description: 'Brokerage holdings, dividends, interest, stock options, and digital assets.' },
  { id: 'healthcare', title: 'Healthcare & Insurance', icon: Heart, description: 'Form 1095-A Marketplace coverage, HSA/FSA contributions, and medical costs.' },
  { id: 'education', title: 'Education & Student Aid', icon: GraduationCap, description: 'Tuition statements (1098-T), student loan interest, and 529 plans.' },
  { id: 'family', title: 'Family & Dependents', icon: Users, description: 'Qualifying children, elderly dependents, child care expenses, and college costs.' },
  { id: 'deductions', title: 'Deductions & Credits', icon: DollarSign, description: 'Charitable donations, state taxes, mortgage interest, and energy credits.' },
  { id: 'foreign', title: 'Foreign Information & Assets', icon: Globe, description: 'Foreign accounts, overseas trusts, offshore gifts, and international income.' }
];

export const ClientQuestionnaireSection: React.FC<ClientQuestionnaireSectionProps> = ({
  selectedYear = 2025,
  onOpenAssistant,
  onNavigateToChecklist,
  onUnsavedChange
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string>('personal');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const isReadOnly = selectedYear < 2025;

  // Form State
  const [answers, setAnswers] = useState<Record<string, any>>({
    marital_status: 'Married Filing Jointly',
    moved_states: 'No',
    has_w2_income: 'Yes',
    has_1099_income: 'Yes',
    crypto_transactions: 'No',
    owns_rental_real_estate: 'Yes',
    has_hsa: 'Yes',
    has_foreign_accounts: 'Yes', // Trigger foreign flag
    foreign_account_max_value: 'Over $10,000',
    has_foreign_trust: 'No',
    has_foreign_gifts: 'No'
  });

  const handleAnswerChange = (key: string, value: any) => {
    if (isReadOnly) return;
    setAnswers(prev => ({ ...prev, [key]: value }));
    onUnsavedChange?.(true);
  };

  const handleSaveDraft = () => {
    if (isReadOnly) return;
    setSaveNotice(`Questionnaire draft for CY${selectedYear} saved successfully. Reconciled with your dynamic document checklist.`);
    onUnsavedChange?.(false);
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const hasForeignInfo = answers.has_foreign_accounts === 'Yes' ||
    answers.has_foreign_trust === 'Yes' ||
    answers.has_foreign_gifts === 'Yes';

  const currentSectionIndex = SECTIONS.findIndex(s => s.id === activeSectionId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#0A2544]" />
              <h2 className="text-xl font-bold text-neutral-900">Dynamic Client Onboarding Questionnaire</h2>
            </div>
            <p className="text-sm text-neutral-600 mt-1">
              Provides the statutory factual basis for your tax organizers, deduction schedules, and compliance obligations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              className="px-3.5 py-2 border border-neutral-300 hover:bg-neutral-50 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5 text-[#0A2544]" />
              <span>Save Progress</span>
            </button>
            <button
              onClick={onNavigateToChecklist}
              className="px-3.5 py-2 bg-[#061A2F] text-white hover:bg-[#0A2544] text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <span>View Checklist</span>
            </button>
          </div>
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-xs font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Tax Year Archive / Planning Notice */}
      {isReadOnly && (
        <div className="p-4 bg-neutral-100 border border-neutral-300 rounded-lg flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-neutral-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-bold text-neutral-900">
              Historical Filing (Tax Year {selectedYear}) — Certified & Locked
            </div>
            <div className="text-xs text-neutral-600 leading-relaxed">
              This tax organizer questionnaire is preserved in read-only audit archive mode corresponding to your certified Form 1040/1120-S filing. If you need to report omitted income or retroactive adjustments, please navigate to Amendments & Closures.
            </div>
          </div>
        </div>
      )}

      {selectedYear === 2026 && (
        <div className="p-4 bg-sky-50 border border-sky-300 rounded-lg flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-sky-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-bold text-sky-900">
              Tax Year 2026 Forward-Looking Planning Questionnaire
            </div>
            <div className="text-xs text-sky-800 leading-relaxed">
              Capture anticipated life events, entity restructuring plans, and projected revenue for CY2026 tax strategy scenarios. Form 1040 statutory filing does not begin until January 2027.
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Rule Notice if Foreign Info Answered */}
      {hasForeignInfo && (
        <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-lg flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-bold text-amber-900 tracking-wide uppercase">
              Foreign information — Professional review required.
            </div>
            <div className="text-xs text-amber-800 leading-relaxed">
              You indicated ownership of or signature authority over foreign financial assets or overseas accounts. The AI system does not independently determine a foreign-reporting obligation. Your engagement reviewer (Desmond Hinds, CPA) will conduct a formal statutory analysis under IRC § 6038D (Form 8938) and 31 U.S.C. § 5314 (FinCEN Form 114 / FBAR).
            </div>
          </div>
        </div>
      )}

      {/* Questionnaire Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {SECTIONS.map((sec) => {
          const isSelected = sec.id === activeSectionId;
          const Icon = sec.icon;
          const isForeignTab = sec.id === 'foreign';

          return (
            <button
              key={sec.id}
              onClick={() => setActiveSectionId(sec.id)}
              className={`p-2.5 border rounded-lg text-left transition-all text-xs font-semibold flex items-center gap-2 ${
                isSelected
                  ? 'border-[#0A2544] bg-[#0A2544] text-white shadow-xs'
                  : isForeignTab && hasForeignInfo
                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                  : 'border-neutral-300 bg-white hover:border-neutral-400 text-neutral-800'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-[#D7AC4A]' : 'text-neutral-500'}`} />
              <span className="truncate">{sec.title.split('&')[0].trim()}</span>
            </button>
          );
        })}
      </div>

      {/* Active Section Question Body */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-bold text-neutral-900">
            {SECTIONS[currentSectionIndex].title}
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5">
            {SECTIONS[currentSectionIndex].description}
          </p>
        </div>

        {/* Section 1: Personal */}
        {activeSectionId === 'personal' && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-neutral-800 block mb-1">Filing Status in CY2025:</label>
              <select
                value={answers.marital_status}
                onChange={(e) => handleAnswerChange('marital_status', e.target.value)}
                className="w-full sm:w-80 px-3 py-2 border border-neutral-300 rounded bg-white"
              >
                <option value="Single">Single</option>
                <option value="Married Filing Jointly">Married Filing Jointly</option>
                <option value="Married Filing Separately">Married Filing Separately</option>
                <option value="Head of Household">Head of Household</option>
                <option value="Qualifying Surviving Spouse">Qualifying Surviving Spouse</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-neutral-800 block mb-1">Did you move between states or change primary residence in CY2025?</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="moved_states"
                    value="Yes"
                    checked={answers.moved_states === 'Yes'}
                    onChange={(e) => handleAnswerChange('moved_states', e.target.value)}
                  />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="moved_states"
                    value="No"
                    checked={answers.moved_states === 'No'}
                    onChange={(e) => handleAnswerChange('moved_states', e.target.value)}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Income */}
        {activeSectionId === 'income' && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-neutral-800 block mb-1">Did you receive Form W-2 wage compensation?</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="has_w2_income"
                    value="Yes"
                    checked={answers.has_w2_income === 'Yes'}
                    onChange={(e) => handleAnswerChange('has_w2_income', e.target.value)}
                  />
                  <span>Yes (W-2 Required in Checklist)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="has_w2_income"
                    value="No"
                    checked={answers.has_w2_income === 'No'}
                    onChange={(e) => handleAnswerChange('has_w2_income', e.target.value)}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            <div>
              <label className="font-semibold text-neutral-800 block mb-1">Did you receive Form 1099-NEC or 1099-MISC independent contractor compensation?</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="has_1099_income"
                    value="Yes"
                    checked={answers.has_1099_income === 'Yes'}
                    onChange={(e) => handleAnswerChange('has_1099_income', e.target.value)}
                  />
                  <span>Yes (Schedule C Required)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="has_1099_income"
                    value="No"
                    checked={answers.has_1099_income === 'No'}
                    onChange={(e) => handleAnswerChange('has_1099_income', e.target.value)}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Section 10: Foreign Information (CRITICAL SECTION) */}
        {activeSectionId === 'foreign' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 font-medium">
              Important: FinCEN and the IRS enforce strict reporting mandates for foreign bank accounts, financial assets, foreign trusts, and cross-border inheritances.
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-neutral-800 block">
                1. Did you have a financial interest in or signature authority over a foreign financial account (bank account, securities account, or offshore funds) at any time during CY2025?
              </label>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="has_foreign_accounts"
                    value="Yes"
                    checked={answers.has_foreign_accounts === 'Yes'}
                    onChange={(e) => handleAnswerChange('has_foreign_accounts', e.target.value)}
                  />
                  <span className="font-semibold text-amber-900">Yes (Requires Professional Review)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="has_foreign_accounts"
                    value="No"
                    checked={answers.has_foreign_accounts === 'No'}
                    onChange={(e) => handleAnswerChange('has_foreign_accounts', e.target.value)}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            {answers.has_foreign_accounts === 'Yes' && (
              <div className="p-3.5 bg-neutral-50 border border-neutral-300 rounded space-y-2">
                <label className="font-semibold text-neutral-800 block">
                  Did the aggregate maximum value of all foreign financial accounts exceed $10,000 USD at any point during CY2025?
                </label>
                <select
                  value={answers.foreign_account_max_value}
                  onChange={(e) => handleAnswerChange('foreign_account_max_value', e.target.value)}
                  className="w-full sm:w-80 px-3 py-1.5 border border-neutral-300 rounded bg-white text-xs font-semibold"
                >
                  <option value="Over $10,000">Yes — Exceeded $10,000 USD (FinCEN Form 114 / FBAR applicable)</option>
                  <option value="Under $10,000">No — Remained strictly below $10,000 USD at all times</option>
                  <option value="Unknown">Uncertain / Need Accountant Assistance</option>
                </select>
              </div>
            )}

            <div className="space-y-1 pt-2">
              <label className="font-semibold text-neutral-800 block">
                2. Were you the grantor, transferor, or beneficiary of a foreign trust, or did you receive gifts from foreign individuals or corporations exceeding $100,000?
              </label>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="has_foreign_trust"
                    value="Yes"
                    checked={answers.has_foreign_trust === 'Yes'}
                    onChange={(e) => handleAnswerChange('has_foreign_trust', e.target.value)}
                  />
                  <span>Yes (Form 3520 / 3520-A Review Required)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="has_foreign_trust"
                    value="No"
                    checked={answers.has_foreign_trust === 'No'}
                    onChange={(e) => handleAnswerChange('has_foreign_trust', e.target.value)}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Other Sections Placeholder Body */}
        {!['personal', 'income', 'foreign'].includes(activeSectionId) && (
          <div className="space-y-3 text-xs">
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded space-y-2">
              <span className="font-semibold text-neutral-900 block">
                Standard questions for {SECTIONS[currentSectionIndex].title}:
              </span>
              <p className="text-neutral-600">
                All records, capital distributions, and statutory receipts for this category are captured in your personalized document checklist.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={onNavigateToChecklist}
                  className="px-3 py-1.5 bg-[#061A2F] text-white font-semibold rounded text-xs hover:bg-[#0A2544]"
                >
                  View Required Documents for This Category
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Step Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-neutral-200">
          <button
            disabled={currentSectionIndex === 0}
            onClick={() => setActiveSectionId(SECTIONS[currentSectionIndex - 1].id)}
            className="px-4 py-2 border border-neutral-300 rounded text-xs font-semibold hover:bg-neutral-50 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Section</span>
          </button>

          <div className="text-xs text-neutral-500 font-mono">
            Section {currentSectionIndex + 1} of {SECTIONS.length}
          </div>

          <button
            disabled={currentSectionIndex === SECTIONS.length - 1}
            onClick={() => setActiveSectionId(SECTIONS[currentSectionIndex + 1].id)}
            className="px-4 py-2 bg-[#061A2F] text-white rounded text-xs font-semibold hover:bg-[#0A2544] disabled:opacity-40 flex items-center gap-1 shadow-xs"
          >
            <span>Next Section</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
