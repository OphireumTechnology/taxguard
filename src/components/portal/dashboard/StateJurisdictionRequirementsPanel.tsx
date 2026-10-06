/**
 * A/R Tax Services, LLC - TaxGuard AI
 * "STATE / JURISDICTION REQUIREMENTS" Panel
 *
 * Implements:
 * - Section 21: State/Jurisdiction Intelligence based strictly on authoritative client facts
 * - Section 22: State-Specific Requirements Panel matching visual reference architecture
 * - Section 23: 50-State Rule Architecture integration
 * - Taxpayer Nexus Self-Reporting Triggers:
 *   "I moved during this tax year", "I worked in another state",
 *   "I earned income in another state", "I own rental property in another state",
 *   "I operated a business in another state"
 * - Dynamic requirement recomputation upon nexus updates
 */

import React, { useState } from 'react';
import {
  MapPin,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Briefcase,
  Home,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Info,
  X
} from 'lucide-react';

export interface StateJurisdictionItem {
  stateCode: string;
  stateName: string;
  nexusType: 'RESIDENT' | 'NONRESIDENT' | 'PART_YEAR';
  reason: string;
  hasIndividualIncomeTax: boolean;
  filingRequirementStatus: 'APPLICABLE' | 'UNDER_REVIEW' | 'NO_RETURN_REQUIRED' | 'PENDING_FACTS';
  requiredDocuments: string[];
  completenessPercent: number;
  professionalReviewStatus: 'PENDING_REVIEW' | 'VERIFIED' | 'NOT_APPLICABLE';
}

export interface StateJurisdictionRequirementsPanelProps {
  taxYear: number;
  residentState: string;
  workStates?: string[];
  movedDuringYear?: boolean;
  priorStates?: string[];
  jurisdictions?: StateJurisdictionItem[];
  onReportMoved: (fromState: string, moveDate: string) => void;
  onReportWorkInOtherState: (stateCode: string) => void;
  onReportOutOfStateRental: (stateCode: string) => void;
  onReportOutOfStateBusiness: (stateCode: string) => void;
  onReportOtherIncomeState: (stateCode: string) => void;
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' }
];

export const StateJurisdictionRequirementsPanel: React.FC<StateJurisdictionRequirementsPanelProps> = ({
  taxYear,
  residentState = 'SC',
  workStates = [],
  movedDuringYear = false,
  priorStates = [],
  jurisdictions,
  onReportMoved,
  onReportWorkInOtherState,
  onReportOutOfStateRental,
  onReportOutOfStateBusiness,
  onReportOtherIncomeState
}) => {
  const [reportModalType, setReportModalType] = useState<string | null>(null);
  const [selectedStateCode, setSelectedStateCode] = useState<string>('NC');
  const [moveDate, setMoveDate] = useState<string>('2025-06-01');

  // Build resolved list of jurisdictions from client facts if not provided
  const resolvedJurisdictions: StateJurisdictionItem[] = jurisdictions || [
    {
      stateCode: residentState,
      stateName: US_STATES.find(s => s.code === residentState)?.name || residentState,
      nexusType: movedDuringYear ? 'PART_YEAR' : 'RESIDENT',
      reason: movedDuringYear
        ? `Part-year resident of ${residentState} in tax year ${taxYear}.`
        : `Primary domicile & principal residence during tax year ${taxYear}.`,
      hasIndividualIncomeTax: !['TX', 'FL', 'NV', 'WA', 'WY', 'SD', 'AK', 'TN', 'NH'].includes(residentState),
      filingRequirementStatus: 'APPLICABLE',
      requiredDocuments: [`${residentState} Individual Tax Return Schedule`, 'W-2 / Source Withholding'],
      completenessPercent: 75,
      professionalReviewStatus: 'PENDING_REVIEW'
    },
    ...workStates
      .filter(st => st !== residentState)
      .map(st => ({
        stateCode: st,
        stateName: US_STATES.find(s => s.code === st)?.name || st,
        nexusType: 'NONRESIDENT' as const,
        reason: `${st}-source wages reported on Form W-2 / out-of-state work.`,
        hasIndividualIncomeTax: !['TX', 'FL', 'NV', 'WA', 'WY', 'SD', 'AK', 'TN', 'NH'].includes(st),
        filingRequirementStatus: 'APPLICABLE' as const,
        requiredDocuments: [`Form W-2 (${st} Withholding)`, `${st} Nonresident Return Schedule`],
        completenessPercent: 50,
        professionalReviewStatus: 'PENDING_REVIEW' as const
      }))
  ];

  const handleExecuteReport = () => {
    if (!reportModalType || !selectedStateCode) return;
    if (reportModalType === 'moved') {
      onReportMoved(selectedStateCode, moveDate);
    } else if (reportModalType === 'work') {
      onReportWorkInOtherState(selectedStateCode);
    } else if (reportModalType === 'rental') {
      onReportOutOfStateRental(selectedStateCode);
    } else if (reportModalType === 'business') {
      onReportOutOfStateBusiness(selectedStateCode);
    } else if (reportModalType === 'income') {
      onReportOtherIncomeState(selectedStateCode);
    }
    setReportModalType(null);
  };

  return (
    <section
      aria-label="State & Jurisdiction Requirements"
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 shadow-xl space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#D4A843]/15 text-[#D4A843]">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              STATE / JURISDICTION REQUIREMENTS &mdash; {taxYear}
            </h2>
            <p className="text-[11px] text-slate-300">
              Personalized multi-state tax filing requirements derived from your residence, moves, and source income.
            </p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[#D4A843] flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Never inferred solely from IP or browser location</span>
        </div>
      </div>

      {/* Jurisdiction Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {resolvedJurisdictions.map((j) => (
          <div
            key={j.stateCode}
            className="p-4 rounded-xl bg-[#071A2E] border border-slate-800 space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">
                    {j.stateName} ({j.stateCode})
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    j.nexusType === 'RESIDENT'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      : j.nexusType === 'PART_YEAR'
                      ? 'bg-blue-950 text-blue-300 border border-blue-500/30'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                  }`}>
                    {j.nexusType.replace('_', ' ')}
                  </span>
                </div>

                <span className="text-[10px] font-mono font-semibold text-slate-400">
                  {j.hasIndividualIncomeTax ? 'Income Tax Required' : 'No State Income Tax'}
                </span>
              </div>

              <div className="mt-2 text-slate-300 text-xs">
                <strong>Reason:</strong> {j.reason}
              </div>

              <div className="mt-2 text-[11px] text-slate-400 font-mono space-y-1">
                <div>Required Artifacts: <strong className="text-slate-200">{j.requiredDocuments.join(', ')}</strong></div>
                <div className="flex items-center justify-between">
                  <span>Professional Review: <strong className="text-amber-400">{j.professionalReviewStatus.replace('_', ' ')}</strong></span>
                  <span>Completeness: <strong className="text-emerald-400">{j.completenessPercent}%</strong></span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#D4A843] h-1.5 rounded-full"
                style={{ width: `${j.completenessPercent}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Taxpayer Nexus Reporting Strip */}
      <div className="p-3.5 rounded-xl bg-[#071A2E] border border-slate-800 space-y-2 text-xs">
        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
          Do any of these situations apply to you in {taxYear}?
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReportModalType('moved')}
            className="px-2.5 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-slate-200 text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
          >
            &bull; &ldquo;I moved during this tax year&rdquo;
          </button>
          <button
            type="button"
            onClick={() => setReportModalType('work')}
            className="px-2.5 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-slate-200 text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
          >
            &bull; &ldquo;I worked in another state&rdquo;
          </button>
          <button
            type="button"
            onClick={() => setReportModalType('income')}
            className="px-2.5 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-slate-200 text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
          >
            &bull; &ldquo;I earned income in another state&rdquo;
          </button>
          <button
            type="button"
            onClick={() => setReportModalType('rental')}
            className="px-2.5 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-slate-200 text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
          >
            &bull; &ldquo;I own rental property in another state&rdquo;
          </button>
          <button
            type="button"
            onClick={() => setReportModalType('business')}
            className="px-2.5 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-slate-200 text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
          >
            &bull; &ldquo;I operated a business in another state&rdquo;
          </button>
        </div>
      </div>

      {/* Reporting Modal */}
      {reportModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#071A2E] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D4A843]" />
                <span>
                  {reportModalType === 'moved' && 'Report Move to Another State'}
                  {reportModalType === 'work' && 'Report Work in Another State'}
                  {reportModalType === 'income' && 'Report Out-of-State Income'}
                  {reportModalType === 'rental' && 'Report Out-of-State Rental Property'}
                  {reportModalType === 'business' && 'Report Out-of-State Business Nexus'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setReportModalType(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300">
              TaxGuard will dynamically update your document checklist and return preparation rules for Tax Year {taxYear}.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                  Select Applicable State:
                </label>
                <select
                  value={selectedStateCode}
                  onChange={(e) => setSelectedStateCode(e.target.value)}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2.5 text-white font-medium outline-none"
                >
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code} className="bg-[#071A2E] text-white">
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {reportModalType === 'moved' && (
                <div>
                  <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                    Approximate Date of Move in {taxYear}:
                  </label>
                  <input
                    type="date"
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                    className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReportModalType(null)}
                className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReport}
                className="px-4 py-2 rounded-lg bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] font-bold"
              >
                Confirm &amp; Recompute Requirements
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
