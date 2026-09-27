import React, { useState } from 'react';
import {
  CheckCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Save,
  Send,
  HelpCircle,
  Paperclip,
  RotateCcw,
  AlertCircle,
  Info,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { ClientOrganizerState, IOrganizerService } from '../../services/clientDashboardServices';

interface ClientOrganizerSectionProps {
  organizerService: IOrganizerService;
  clientId: string;
  onNavigateToVault: () => void;
  onOpenAssistant: () => void;
}

const SECTION_COMPLIANCE_TIPS: Record<number, string> = {
  1: 'IRC § 6109 requires positive taxpayer identification number reporting on all corporate and pass-through returns.',
  2: 'Determines applicable statutory tax rate brackets and standard/itemized limitation thresholds.',
  5: 'Form W-2 wage reporting must tie out to Social Security Administration and IRS wage transcripts.',
  7: 'Treas. Reg. § 1.162-1 requires trade or business expenses to be ordinary, necessary, and substantiated.',
  9: 'IRS Form 1040/1120 mandates disclosure of all digital asset acquisitions, sales, exchanges, or rewards.',
  15: 'Schedule A itemized deductions subject to statutory limits including state and local tax (SALT) $10,000 cap.',
  16: 'IRC § 170 requires contemporaneous written acknowledgment for any single contribution of $250 or more.',
  17: 'FinCEN Form 114 (FBAR) mandatory for foreign aggregate financial accounts exceeding $10,000 at any time.',
  18: 'Multi-state nexus and apportionment require revenue breakdown across jurisdictions to prevent double taxation.',
  19: 'IRC § 6654 penalties apply if quarterly estimated tax payments fail to meet safe-harbor thresholds (90% / 110%).',
  21: 'Treasury Circular 230 and IRS e-file mandates require taxpayer authorization before electronic transmission.'
};

export const ClientOrganizerSection: React.FC<ClientOrganizerSectionProps> = ({
  organizerService,
  clientId,
  onNavigateToVault,
  onOpenAssistant
}) => {
  const [organizer, setOrganizer] = useState<ClientOrganizerState>(() =>
    organizerService.getOrganizer(clientId)
  );
  const [activeStep, setActiveStep] = useState<number>(() => organizer.activeSectionId || 1);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Form field state for the current active section
  const currentSection = organizer.sections.find(s => s.id === activeStep) || organizer.sections[0];

  const handleUpdateField = (key: string, value: any) => {
    const updated = organizerService.updateField(clientId, activeStep, key, value);
    setOrganizer(updated);
  };

  const handleSaveDraft = () => {
    organizerService.saveDraft(clientId, activeStep);
    setSaveNotice('Draft progress saved successfully to encrypted client vault.');
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const handleNextStep = () => {
    handleSaveDraft();
    if (activeStep < 21) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 1) {
      setActiveStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    const result = organizerService.submitOrganizer(clientId);
    if (result.success) {
      setOrganizer(organizerService.getOrganizer(clientId));
      setSaveNotice('Tax Organizer successfully submitted to your assigned CPA review team!');
      setTimeout(() => setSaveNotice(null), 5000);
    } else {
      alert(result.error || 'Failed to submit organizer.');
    }
  };

  const handleReopen = () => {
    const result = organizerService.reopenOrganizer(clientId);
    if (result.success) {
      setOrganizer(organizerService.getOrganizer(clientId));
      setSaveNotice('Tax Organizer reopened for client modifications.');
      setTimeout(() => setSaveNotice(null), 3500);
    }
  };

  const currentValues = currentSection.data || {};

  return (
    <div className="space-y-6" id="client-organizer-section">
      {/* 1. Header Card */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#D7AC4A] uppercase tracking-wider font-bold bg-[#061A2F] px-2 py-0.5 rounded">
                Section 3 of 8
              </span>
              <span className="text-xs font-mono text-[#667085]">Tax Year {organizer.taxYear}</span>
            </div>
            <h1 className="text-xl font-black text-[#061A2F] mt-1">
              Tax Organizer
            </h1>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Comprehensive 21-section intake interview ensuring all eligible deductions, credits, and disclosures are captured.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAssistant}
              className="flex items-center gap-2 px-3 py-2 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>Organizer Guidance</span>
            </button>
            <button
              onClick={handleSaveDraft}
              className="flex items-center gap-2 px-3 py-2 bg-[#061A2F] text-white hover:bg-[#031323] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Progress</span>
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[#667085]">Overall Progress:</span>
            <div className="w-40 sm:w-60 bg-[#E5E7EB] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#061A2F] h-full rounded-full transition-all duration-300"
                style={{ width: `${organizer.completionPercentage}%` }}
              />
            </div>
            <span className="font-bold text-[#061A2F] font-mono">{organizer.completionPercentage}%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#667085]">Status:</span>
            <span className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded ${
              organizer.status === 'Submitted'
                ? 'bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9]'
                : 'bg-[#FFF8E1] text-[#B78103] border border-[#FFE082]'
            }`}>
              {organizer.status === 'Submitted' ? 'Submitted to CPA' : 'In Progress (Draft)'}
            </span>
            {organizer.status === 'Submitted' && (
              <button
                onClick={handleReopen}
                className="text-[11px] text-[#061A2F] hover:text-[#C99A32] underline font-bold ml-2 cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reopen Before Staff Review
              </button>
            )}
          </div>
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] text-[#1B5E20] rounded text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* 2. Main 21-Section Stepper & Form Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Step Navigation Sidebar (21 Sections) */}
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-4 shadow-xs lg:col-span-1 max-h-[700px] overflow-y-auto">
          <div className="text-[10px] font-mono text-[#667085] uppercase tracking-wider font-bold pb-2 border-b border-[#D8DCE2] mb-2">
            21 Tax Questionnaire Modules
          </div>
          <div className="space-y-1">
            {organizer.sections.map((s) => {
              const isCurrent = s.id === activeStep;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStep(s.id)}
                  className={`w-full flex items-center justify-between p-2 rounded text-left text-xs transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#061A2F] text-[#E8C66A] font-bold shadow-xs'
                      : s.isCompleted
                      ? 'text-[#1A2028] hover:bg-[#FAF9F5]'
                      : 'text-[#667085] hover:bg-[#FAF9F5]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-[10px] opacity-75">{s.id}.</span>
                    <span className="truncate">{s.title}</span>
                  </div>
                  {s.isCompleted && (
                    <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${isCurrent ? 'text-[#E8C66A]' : 'text-[#1B5E20]'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Questionnaire Body */}
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 shadow-xs lg:col-span-3 flex flex-col justify-between">
          <div>
            {/* Active Section Header */}
            <div className="pb-4 border-b border-[#D8DCE2] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono text-[#C99A32] uppercase font-bold">
                  Module {currentSection.id} of 21
                </span>
                <h2 className="text-lg font-bold text-[#061A2F] mt-0.5">
                  {currentSection.title}
                </h2>
                <p className="text-xs text-[#667085] mt-0.5">
                  {currentSection.description}
                </p>
              </div>

              <button
                onClick={onNavigateToVault}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] text-xs font-semibold text-[#061A2F] rounded transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Paperclip className="w-3.5 h-3.5 text-[#C99A32]" />
                <span>Attach Document</span>
              </button>
            </div>

            {/* Compliance Tip */}
            {SECTION_COMPLIANCE_TIPS[currentSection.id] && (
              <div className="my-4 p-3 bg-[#FAF9F5] border-l-3 border-[#C99A32] rounded-r text-xs flex items-start gap-2 text-[#4B5563]">
                <Info className="w-4 h-4 text-[#C99A32] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#061A2F] font-semibold">Why is this requested? </strong>
                  {SECTION_COMPLIANCE_TIPS[currentSection.id]}
                </div>
              </div>
            )}

            {/* Dynamic Question Fields for the Active Section */}
            <div className="py-4 space-y-4">
              {/* Section 1: Personal Information */}
              {currentSection.id === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-[#061A2F] block mb-1">Taxpayer Full Legal Name</label>
                    <input
                      type="text"
                      value={currentValues.legalName || 'Michael Perotti'}
                      onChange={(e) => handleUpdateField('legalName', e.target.value)}
                      className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#061A2F] block mb-1">Social Security Number / ITIN (Masked)</label>
                    <input
                      type="text"
                      disabled
                      value="***-**-8842"
                      className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#F3F4F6] text-[#667085] cursor-not-allowed font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#061A2F] block mb-1">Date of Birth</label>
                    <input
                      type="text"
                      value={currentValues.dob || '1978-04-12'}
                      onChange={(e) => handleUpdateField('dob', e.target.value)}
                      className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#061A2F] block mb-1">Primary Occupation</label>
                    <input
                      type="text"
                      value={currentValues.occupation || 'Managing Member / Executive'}
                      onChange={(e) => handleUpdateField('occupation', e.target.value)}
                      className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                    />
                  </div>
                </div>
              )}

              {/* Section 7: Business Activity */}
              {currentSection.id === 7 && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-[#061A2F] block mb-1">Principal Business Name</label>
                      <input
                        type="text"
                        value={currentValues.businessName || 'Perotti Capital Holdings LLC'}
                        onChange={(e) => handleUpdateField('businessName', e.target.value)}
                        className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#061A2F] block mb-1">Federal Employer ID (EIN)</label>
                      <input
                        type="text"
                        disabled
                        value="84-3928190"
                        className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#F3F4F6] text-[#667085] font-mono cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-[#061A2F] block mb-1">Principal Business Activity & NAICS Description</label>
                    <textarea
                      rows={2}
                      value={currentValues.activityDesc || 'Commercial Real Estate Investment & Management Services'}
                      onChange={(e) => handleUpdateField('activityDesc', e.target.value)}
                      className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                    />
                  </div>
                </div>
              )}

              {/* Section 9: Digital Assets (Conditional Question) */}
              {currentSection.id === 9 && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-[#FBFAF7] border border-[#D8DCE2] rounded">
                    <label className="font-bold text-[#061A2F] block mb-2">
                      At any time during 2025, did you (a) receive (as a reward, award or payment for property or services); or (b) sell, exchange, gift or otherwise dispose of a digital asset (or a financial interest in a digital asset)?
                    </label>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="radio"
                          name="digitalAssets"
                          checked={currentValues.hasDigitalAssets === 'yes'}
                          onChange={() => handleUpdateField('hasDigitalAssets', 'yes')}
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="radio"
                          name="digitalAssets"
                          checked={currentValues.hasDigitalAssets === 'no' || !currentValues.hasDigitalAssets}
                          onChange={() => handleUpdateField('hasDigitalAssets', 'no')}
                        />
                        <span>No</span>
                      </label>
                    </div>
                  </div>

                  {currentValues.hasDigitalAssets === 'yes' && (
                    <div className="p-4 bg-white border border-[#C99A32] rounded space-y-3">
                      <div className="text-xs font-bold text-[#061A2F]">Digital Asset Transaction Details</div>
                      <p className="text-[11px] text-[#667085]">
                        Please upload exchange transaction history or Form 1099-DA from Coinbase, Kraken, or other custodial platforms.
                      </p>
                      <textarea
                        rows={3}
                        placeholder="Detail exchanges, wallets, staking rewards, or capital gain/loss summaries..."
                        value={currentValues.digitalAssetNotes || ''}
                        onChange={(e) => handleUpdateField('digitalAssetNotes', e.target.value)}
                        className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Section 16: Charitable Contributions (Conditional Question) */}
              {currentSection.id === 16 && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-[#FBFAF7] border border-[#D8DCE2] rounded">
                    <label className="font-bold text-[#061A2F] block mb-2">
                      Did you make cash or non-cash charitable donations to qualified 501(c)(3) organizations in 2025?
                    </label>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="radio"
                          name="charity"
                          checked={currentValues.hasCharity === 'yes' || currentValues.hasCharity === undefined}
                          onChange={() => handleUpdateField('hasCharity', 'yes')}
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="radio"
                          name="charity"
                          checked={currentValues.hasCharity === 'no'}
                          onChange={() => handleUpdateField('hasCharity', 'no')}
                        />
                        <span>No</span>
                      </label>
                    </div>
                  </div>

                  {currentValues.hasCharity !== 'no' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold text-[#061A2F] block mb-1">Total Cash Donations (With Bank / Written Receipts)</label>
                        <input
                          type="text"
                          value={currentValues.cashDonations || '$12,500.00'}
                          onChange={(e) => handleUpdateField('cashDonations', e.target.value)}
                          className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7] font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-[#061A2F] block mb-1">Non-Cash Donations (Goods, Securities, Appraisals)</label>
                        <input
                          type="text"
                          value={currentValues.nonCashDonations || '$0.00'}
                          onChange={(e) => handleUpdateField('nonCashDonations', e.target.value)}
                          className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7] font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Section 18: Multi-state Activity (Conditional Question) */}
              {currentSection.id === 18 && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-[#FBFAF7] border border-[#D8DCE2] rounded">
                    <label className="font-bold text-[#061A2F] block mb-2">
                      Did Perotti Capital Holdings LLC or its affiliates conduct business, own real estate, or have remote employees outside South Carolina?
                    </label>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="radio"
                          name="multistate"
                          checked={currentValues.hasMultistate === 'yes'}
                          onChange={() => handleUpdateField('hasMultistate', 'yes')}
                        />
                        <span>Yes (Apportionment Required)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="radio"
                          name="multistate"
                          checked={currentValues.hasMultistate === 'no' || !currentValues.hasMultistate}
                          onChange={() => handleUpdateField('hasMultistate', 'no')}
                        />
                        <span>No (100% South Carolina Single State)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 19: Estimated Payments */}
              {currentSection.id === 19 && (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F]">
                    Estimated tax payments made for Tax Year 2025 will be credited against final liability on Form 1120-S and SC1120S.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-[#061A2F] block mb-1">Total Federal Estimated Payments (IRS EFTPS)</label>
                      <input
                        type="text"
                        value={currentValues.fedEstimated || '$40,000.00'}
                        onChange={(e) => handleUpdateField('fedEstimated', e.target.value)}
                        className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7] font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#061A2F] block mb-1">Total South Carolina DOR Estimated Payments</label>
                      <input
                        type="text"
                        value={currentValues.stateEstimated || '$10,000.00'}
                        onChange={(e) => handleUpdateField('stateEstimated', e.target.value)}
                        className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7] font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Section 21: Review & Electronic Consent */}
              {currentSection.id === 21 && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-[#FAF9F5] border border-[#061A2F] rounded space-y-2">
                    <div className="text-xs font-bold text-[#061A2F]">
                      Electronic Signature & Accuracy Certification
                    </div>
                    <p className="text-[11px] text-[#4B5563] leading-relaxed">
                      Under penalties of perjury, I declare that I have examined this tax organizer, including all accompanying schedules and statements, and to the best of my knowledge and belief, it is true, correct, and complete. I authorize A/R Tax Services, LLC to prepare the designated tax returns based upon these disclosures.
                    </p>
                    <label className="flex items-center gap-2 pt-2 cursor-pointer font-bold text-[#061A2F]">
                      <input
                        type="checkbox"
                        checked={currentValues.consentConfirmed || false}
                        onChange={(e) => handleUpdateField('consentConfirmed', e.target.checked)}
                      />
                      <span>I confirm accuracy and authorize preparation of 2025 tax returns.</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Generic fallback for other sections */}
              {![1, 7, 9, 16, 18, 19, 21].includes(currentSection.id) && (
                <div className="space-y-3 text-xs">
                  <p className="text-[#4B5563]">
                    Please answer the questions below regarding your {currentSection.title.toLowerCase()}.
                  </p>
                  <div>
                    <label className="font-semibold text-[#061A2F] block mb-1">
                      Did you have any activity, gains, losses, or notable transactions in this category during 2025?
                    </label>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="radio"
                          name={`active_${currentSection.id}`}
                          checked={currentValues.hasActivity !== 'no'}
                          onChange={() => handleUpdateField('hasActivity', 'yes')}
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="radio"
                          name={`active_${currentSection.id}`}
                          checked={currentValues.hasActivity === 'no'}
                          onChange={() => handleUpdateField('hasActivity', 'no')}
                        />
                        <span>No</span>
                      </label>
                    </div>
                  </div>
                  <div className="pt-2">
                    <label className="font-semibold text-[#061A2F] block mb-1">Additional Notes / Clarifications for CPA</label>
                    <textarea
                      rows={3}
                      placeholder="Add any details, changes from prior year, or questions..."
                      value={currentValues.notes || ''}
                      onChange={(e) => handleUpdateField('notes', e.target.value)}
                      className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stepper Navigation Footer */}
          <div className="pt-5 border-t border-[#D8DCE2] flex items-center justify-between gap-3 mt-6">
            <button
              onClick={handlePrevStep}
              disabled={activeStep === 1}
              className="px-4 py-2 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] text-xs font-bold text-[#061A2F] rounded flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Previous Module
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveDraft}
                className="px-4 py-2 bg-white hover:bg-[#FAF9F5] border border-[#D8DCE2] text-xs font-bold text-[#061A2F] rounded cursor-pointer"
              >
                Save Draft
              </button>

              {activeStep < 21 ? (
                <button
                  onClick={handleNextStep}
                  className="px-5 py-2 bg-[#061A2F] hover:bg-[#031323] text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer"
                >
                  <span>Save & Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-[#C99A32] hover:bg-[#B78A2A] text-white text-xs font-bold uppercase tracking-wider rounded flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Completed Organizer</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
