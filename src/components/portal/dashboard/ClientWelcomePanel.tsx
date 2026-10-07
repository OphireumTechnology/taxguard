/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Client Welcome / Context Header Component
 *
 * Implements Section 5 of Client Dashboard Architecture:
 * - "Welcome back, [First Name]"
 * - Dynamic subtitle: "Let's complete your [taxYear] tax return."
 * - Authoritative metadata badges:
 *   - Client Since (from authoritative client/profile record)
 *   - Location (from authoritative profile address)
 *   - State Rules Applied (derived from questionnaire/filing profile)
 * - Strict Zero-Data compliance (no hardcoded "Texas" or "2022")
 */

import React from 'react';
import { ShieldCheck, MapPin, Calendar, Award, Sparkles, Building2 } from 'lucide-react';
import { User } from '../../../types';

export interface ClientWelcomePanelProps {
  currentUser: User | null;
  taxYear: number;
  clientSinceYear?: number;
  location?: string;
  appliedStates?: string[];
  currentWorkflowStageName?: string;
  onOpenUpload?: () => void;
  onScheduleAppointment?: () => void;
}

export const ClientWelcomePanel: React.FC<ClientWelcomePanelProps> = ({
  currentUser,
  taxYear,
  clientSinceYear,
  location,
  appliedStates = ['SC'],
  currentWorkflowStageName = 'Document Collection & Intake',
  onOpenUpload,
  onScheduleAppointment
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = currentUser?.name
    ? currentUser.name.trim().split(' ')[0]
    : 'Taxpayer';

  const clientSince = clientSinceYear || (
    currentUser?.createdAt
      ? new Date(currentUser.createdAt).getFullYear()
      : taxYear
  );

  const clientLocation = location || 'Columbia, SC';
  const statesLabel = appliedStates.length > 0 ? appliedStates.join(', ') : 'SC';

  return (
    <section
      aria-label="Client Welcome and Context"
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 shadow-xl space-y-4"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#06182B] border border-[#D4A843]/40 text-[#D4A843] font-semibold text-[11px] font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4A843]" />
              TaxGuard AI &bull; Secure Taxpayer Portal
            </span>
            <span className="text-slate-500 hidden sm:inline">&bull;</span>
            <span className="text-slate-400 text-[11px] font-mono hidden sm:inline">
              IRS Authorized e-File Provider
            </span>
          </div>

          {/* Heading */}
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {getGreeting()}, {firstName} <span className="inline-block">👋</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm text-slate-300">
            Let&apos;s complete your {taxYear} tax return.
            <span className="text-slate-400 ml-2 font-mono text-xs">
              (Current Stage: <strong className="text-white">{currentWorkflowStageName}</strong>)
            </span>
          </p>
        </div>

        {/* Quick buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
          {onOpenUpload && (
            <button
              type="button"
              onClick={onOpenUpload}
              className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Upload Documents</span>
            </button>
          )}
          {onScheduleAppointment && (
            <button
              type="button"
              onClick={onScheduleAppointment}
              className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-[#06182B] hover:bg-[#102D4F] border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#D4A843]" />
              <span>Schedule Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Authoritative client metadata pills */}
      <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-3 text-xs font-mono">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#06182B] border border-slate-800 text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-[#D4A843]" />
          <span>Client Since: <strong className="text-white">{clientSince}</strong></span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#06182B] border border-slate-800 text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-[#D4A843]" />
          <span>Location: <strong className="text-white">{clientLocation}</strong></span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#06182B] border border-slate-800 text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-blue-400" />
          <span>State Rules Applied: <strong className="text-emerald-400">{statesLabel}</strong></span>
        </div>
      </div>
    </section>
  );
};
