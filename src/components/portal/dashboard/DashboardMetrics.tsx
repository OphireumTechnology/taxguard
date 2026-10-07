/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Dashboard Summary Metrics Cards
 *
 * Implements Section 10 of Client Dashboard Architecture:
 * - DOCUMENTS (received, missing, need replacement)
 * - REQUESTS (open, overdue)
 * - MESSAGES (unread)
 * - APPOINTMENTS (next appointment)
 * - PAYMENTS (balance, payment status)
 *
 * Every number is strictly computed from authoritative data.
 * Zero-Data Rule: no decorative fake counts.
 */

import React from 'react';
import {
  FolderLock,
  AlertCircle,
  MessageSquare,
  Calendar,
  CreditCard,
  ChevronRight,
  FileCheck,
  CheckCircle2
} from 'lucide-react';

export interface DashboardMetricsProps {
  // Documents
  docsReceived: number;
  docsMissing: number;
  docsNeedReplacement: number;
  // Requests
  requestsOpen: number;
  requestsOverdue: number;
  // Messages
  unreadMessagesCount: number;
  // Appointments
  nextAppointmentDate?: string;
  nextAppointmentType?: string;
  // Payments
  unpaidBalance: number;
  paymentStatus: 'PAID' | 'PENDING' | 'OVERDUE' | 'SETTLED';
  // Nav callbacks
  onNavigateToDocuments: () => void;
  onNavigateToRequests: () => void;
  onNavigateToMessages: () => void;
  onNavigateToAppointments: () => void;
  onNavigateToPayments: () => void;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  docsReceived,
  docsMissing,
  docsNeedReplacement,
  requestsOpen,
  requestsOverdue,
  unreadMessagesCount,
  nextAppointmentDate,
  nextAppointmentType,
  unpaidBalance,
  paymentStatus,
  onNavigateToDocuments,
  onNavigateToRequests,
  onNavigateToMessages,
  onNavigateToAppointments,
  onNavigateToPayments
}) => {
  return (
    <div
      aria-label="Dashboard Metrics Summary"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5"
    >
      {/* 1. DOCUMENTS */}
      <div
        onClick={onNavigateToDocuments}
        className="p-4 rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] hover:border-[#D4A843]/50 transition-all cursor-pointer flex flex-col justify-between shadow-md space-y-2.5 group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[#D4A843]">
            DOCUMENTS
          </span>
          <div className="w-7 h-7 rounded-lg bg-[#102D4F] text-[#D4A843] flex items-center justify-center">
            <FolderLock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold font-serif text-white">
            {docsReceived}
          </div>
          <div className="text-[11px] text-slate-300 font-mono mt-0.5 space-x-1">
            <span className="text-emerald-400 font-semibold">{docsReceived} Received</span>
            <span>&bull;</span>
            <span className={docsMissing > 0 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
              {docsMissing} Missing
            </span>
            {docsNeedReplacement > 0 && (
              <>
                <span>&bull;</span>
                <span className="text-red-400 font-semibold">{docsNeedReplacement} Replace</span>
              </>
            )}
          </div>
        </div>

        <div className="pt-1 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-[#D4A843] font-medium group-hover:translate-x-0.5 transition-transform">
          <span>View documents</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* 2. REQUESTS */}
      <div
        onClick={onNavigateToRequests}
        className="p-4 rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] hover:border-[#D4A843]/50 transition-all cursor-pointer flex flex-col justify-between shadow-md space-y-2.5 group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-amber-400">
            REQUESTS
          </span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold font-serif text-white">
            {requestsOpen}
          </div>
          <div className="text-[11px] text-slate-300 font-mono mt-0.5 space-x-1">
            <span className={requestsOpen > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
              {requestsOpen} Open
            </span>
            <span>&bull;</span>
            <span className={requestsOverdue > 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
              {requestsOverdue} Overdue
            </span>
          </div>
        </div>

        <div className="pt-1 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-[#D4A843] font-medium group-hover:translate-x-0.5 transition-transform">
          <span>Review requests</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* 3. MESSAGES */}
      <div
        onClick={onNavigateToMessages}
        className="p-4 rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] hover:border-[#D4A843]/50 transition-all cursor-pointer flex flex-col justify-between shadow-md space-y-2.5 group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-blue-400">
            MESSAGES
          </span>
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold font-serif text-white">
            {unreadMessagesCount}
          </div>
          <div className="text-[11px] text-slate-300 font-mono mt-0.5">
            {unreadMessagesCount > 0 ? (
              <span className="text-blue-300 font-semibold">{unreadMessagesCount} unread message{unreadMessagesCount > 1 ? 's' : ''}</span>
            ) : (
              <span className="text-slate-400">Inbox is up to date</span>
            )}
          </div>
        </div>

        <div className="pt-1 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-[#D4A843] font-medium group-hover:translate-x-0.5 transition-transform">
          <span>Open inbox</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* 4. APPOINTMENTS */}
      <div
        onClick={onNavigateToAppointments}
        className="p-4 rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] hover:border-[#D4A843]/50 transition-all cursor-pointer flex flex-col justify-between shadow-md space-y-2.5 group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-emerald-400">
            APPOINTMENTS
          </span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          <div className="text-sm font-bold font-mono text-white truncate">
            {nextAppointmentDate ? (
              new Date(nextAppointmentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            ) : (
              'None Booked'
            )}
          </div>
          <div className="text-[11px] text-slate-300 truncate mt-0.5">
            {nextAppointmentDate ? (
              nextAppointmentType || 'Tax Consultation'
            ) : (
              'Schedule a 1-on-1 session'
            )}
          </div>
        </div>

        <div className="pt-1 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-[#D4A843] font-medium group-hover:translate-x-0.5 transition-transform">
          <span>{nextAppointmentDate ? 'Manage' : 'Schedule'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* 5. PAYMENTS */}
      <div
        onClick={onNavigateToPayments}
        className="p-4 rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] hover:border-[#D4A843]/50 transition-all cursor-pointer flex flex-col justify-between shadow-md space-y-2.5 group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[#D4A843]">
            PAYMENTS
          </span>
          <div className="w-7 h-7 rounded-lg bg-[#102D4F] text-[#D4A843] flex items-center justify-center">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold font-serif text-white">
            ${unpaidBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-300 font-mono mt-0.5">
            {unpaidBalance === 0 ? (
              <span className="text-emerald-400 font-semibold">Account Settled</span>
            ) : (
              <span className="text-amber-400 font-semibold">{paymentStatus}</span>
            )}
          </div>
        </div>

        <div className="pt-1 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-[#D4A843] font-medium group-hover:translate-x-0.5 transition-transform">
          <span>View billing</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
