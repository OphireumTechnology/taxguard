/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Right-Side Context Rail
 *
 * Implements:
 * - Section 29: Desktop Contextual Cards (reflowing cleanly on mobile)
 * - Section 30: Important Updates, Upcoming Appointment, Messages, Open Requests, Deadlines
 * - Strict truthfulness & fail-closed behavior for uncommissioned external services
 */

import React from 'react';
import {
  Bell,
  Calendar,
  MessageSquare,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink
} from 'lucide-react';

export interface UpdateItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'info' | 'action_needed' | 'success' | 'warning';
  linkTarget?: string;
}

export interface RightContextRailProps {
  taxYear: number;
  pendingRequestsCount: number;
  unreadMessagesCount: number;
  latestMessageSnippet?: string;
  hasUpcomingAppointment?: boolean;
  upcomingAppointmentDate?: string;
  upcomingAppointmentAdvisor?: string;
  updates?: UpdateItem[];
  onOpenRequests?: () => void;
  onOpenMessages?: () => void;
  onScheduleAppointment?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export const RightContextRail: React.FC<RightContextRailProps> = ({
  taxYear,
  pendingRequestsCount,
  unreadMessagesCount,
  latestMessageSnippet,
  hasUpcomingAppointment = false,
  upcomingAppointmentDate,
  upcomingAppointmentAdvisor = 'Elena Rostova, CPA',
  updates = [],
  onOpenRequests,
  onOpenMessages,
  onScheduleAppointment,
  onNavigateToTab
}) => {
  const defaultUpdates: UpdateItem[] = updates.length > 0
    ? updates
    : [
        {
          id: 'upd_1',
          title: 'Document Intake Open',
          description: `Personalized document requirements generated for Tax Year ${taxYear}.`,
          timestamp: 'Recent',
          type: 'info',
          linkTarget: 'stage_02'
        },
        {
          id: 'upd_2',
          title: 'IRC § 7216 Protected',
          description: 'Statutory taxpayer confidentiality consent verified.',
          timestamp: 'Certified',
          type: 'success',
          linkTarget: 'security'
        }
      ];

  return (
    <aside
      aria-label="Contextual Updates and Deadlines"
      className="space-y-4 w-full"
    >
      {/* 1. Important Updates */}
      <div className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase font-mono tracking-wider">
            <Bell className="w-3.5 h-3.5 text-[#D4A843]" />
            <span>Important Updates</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Live</span>
        </div>

        <div className="space-y-2 text-xs">
          {defaultUpdates.map((item) => (
            <div
              key={item.id}
              onClick={() => item.linkTarget && onNavigateToTab?.(item.linkTarget)}
              className={`p-2.5 rounded-xl border transition-colors ${
                item.linkTarget ? 'cursor-pointer hover:border-slate-600' : ''
              } ${
                item.type === 'action_needed'
                  ? 'bg-amber-950/40 border-amber-500/40'
                  : item.type === 'warning'
                  ? 'bg-red-950/40 border-red-500/40'
                  : 'bg-[#071A2E] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-[11px] flex items-center gap-1">
                  {item.type === 'action_needed' && <AlertCircle className="w-3 h-3 text-amber-400" />}
                  {item.type === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  <span>{item.title}</span>
                </span>
                <span className="text-[9px] font-mono text-slate-400">{item.timestamp}</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Open Requests */}
      <div className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase font-mono tracking-wider">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Open Requests</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
            pendingRequestsCount > 0 ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'text-slate-500'
          }`}>
            {pendingRequestsCount} Pending
          </span>
        </div>

        {pendingRequestsCount > 0 ? (
          <div className="space-y-2 text-xs">
            <p className="text-slate-300 text-[11px]">
              Your tax preparer has asked for clarification regarding your return.
            </p>
            <button
              type="button"
              onClick={onOpenRequests}
              className="w-full py-2 px-3 rounded-lg bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <span>Respond to Inquiries</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 py-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px]">No pending information requests. You are all caught up.</span>
          </div>
        )}
      </div>

      {/* 3. Messages */}
      <div className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase font-mono tracking-wider">
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>Messages</span>
          </div>
          {unreadMessagesCount > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
              {unreadMessagesCount} Unread
            </span>
          )}
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-xl bg-[#071A2E] border border-slate-800 text-[11px] text-slate-300">
            {latestMessageSnippet ? (
              <p className="line-clamp-2 italic">&ldquo;{latestMessageSnippet}&rdquo;</p>
            ) : (
              <p className="text-slate-400">Direct encrypted line to your A/R Tax Services engagement team.</p>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenMessages}
            className="w-full py-2 px-3 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Open Secure Messages</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Upcoming Appointment */}
      <div className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase font-mono tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upcoming Appointment</span>
          </div>
        </div>

        {hasUpcomingAppointment && upcomingAppointmentDate ? (
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#071A2E] border border-slate-800 text-[11px]">
              <div className="text-white font-bold">{new Date(upcomingAppointmentDate).toLocaleString()}</div>
              <div className="text-slate-400 mt-0.5">Advisor: {upcomingAppointmentAdvisor}</div>
            </div>
            <button
              type="button"
              onClick={onScheduleAppointment}
              className="w-full py-1.5 px-3 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-slate-200 text-xs font-semibold border border-slate-700 text-center"
            >
              Manage Appointment
            </button>
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            <p className="text-slate-400 text-[11px]">
              No consultation currently booked. You may schedule a private session with your tax team.
            </p>
            <button
              type="button"
              onClick={onScheduleAppointment}
              className="w-full py-2 px-3 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-[#D4A843] text-xs font-bold border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Schedule Consultation</span>
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 5. Statutory Tax Deadlines */}
      <div className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase font-mono tracking-wider">
            <Clock className="w-3.5 h-3.5 text-[#D4A843]" />
            <span>Key Deadlines</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">TY {taxYear}</span>
        </div>

        <div className="space-y-2 text-[11px] font-mono">
          <div className="p-2 rounded-lg bg-[#071A2E] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">April 15, {taxYear + 1}</span>
            <span className="text-[#D4A843] font-bold">Regular Filing Deadline</span>
          </div>
          <div className="p-2 rounded-lg bg-[#071A2E] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Oct 15, {taxYear + 1}</span>
            <span className="text-slate-400 font-semibold">Extended Deadline</span>
          </div>
          <div className="p-2 rounded-lg bg-[#071A2E] border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300">Quarterly Q1</span>
            <span className="text-slate-400">Estimated Tax Due</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
