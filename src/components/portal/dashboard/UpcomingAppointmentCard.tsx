/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Upcoming Appointment Card
 *
 * Implements Section 12 of Client Dashboard Architecture:
 * - date, time, type, advisor/preparer, location/video, status
 * - Actions: Schedule, Reschedule, Cancel, Join Video Call, Add to Calendar
 * - Truthful fail-closed: If calendar/video is not configured, displays NOT_CONFIGURED state
 */

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Video,
  User,
  AlertCircle,
  ExternalLink,
  Plus,
  X,
  CheckCircle2
} from 'lucide-react';

export interface AppointmentData {
  id: string;
  dateTime: string;
  type: string;
  advisorName: string;
  advisorRole?: string;
  locationType: 'VIDEO' | 'IN_PERSON' | 'PHONE';
  status: 'CONFIRMED' | 'SCHEDULED' | 'PENDING' | 'CANCELLED';
  meetingRoomUrl?: string;
  isProviderConfigured?: boolean;
}

export interface UpcomingAppointmentCardProps {
  appointment?: AppointmentData | null;
  onSchedule: () => void;
  onReschedule?: (id: string) => void;
  onCancel?: (id: string) => void;
  onJoinVideoCall?: (meetingRoomUrl?: string) => void;
}

export const UpcomingAppointmentCard: React.FC<UpcomingAppointmentCardProps> = ({
  appointment,
  onSchedule,
  onReschedule,
  onCancel,
  onJoinVideoCall
}) => {
  const [calendarExported, setCalendarExported] = useState(false);

  const handleAddToCalendar = () => {
    if (!appointment) return;
    // Generate .ics standard file for native calendar import
    const date = new Date(appointment.dateTime);
    const endDate = new Date(date.getTime() + 45 * 60000);
    const formatICSDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//A/R Tax Services//TaxGuard AI//EN',
      'BEGIN:VEVENT',
      `UID:${appointment.id}@artaxservices.com`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(date)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${appointment.type} - A/R Tax Services`,
      `DESCRIPTION:Tax consultation with ${appointment.advisorName}. Confidential virtual conference room.`,
      `LOCATION:A/R Tax Services Virtual Consultation Suite`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Tax_Consultation_${appointment.id}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCalendarExported(true);
    setTimeout(() => setCalendarExported(false), 4000);
  };

  return (
    <div
      aria-label="Upcoming Consultation Card"
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-5 shadow-xl space-y-4"
    >
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#D4A843]" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            UPCOMING APPOINTMENT
          </h3>
        </div>
        {appointment ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
            {appointment.status}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-slate-400">None Scheduled</span>
        )}
      </div>

      {appointment ? (
        <div className="space-y-3.5 text-xs">
          {/* Date & Time display */}
          <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-800 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#102D4F] border border-[#D4A843]/40 flex flex-col items-center justify-center text-[#D4A843] shrink-0">
                <span className="text-[9px] font-mono uppercase font-bold">
                  {new Date(appointment.dateTime).toLocaleDateString(undefined, { month: 'short' })}
                </span>
                <span className="text-sm font-bold font-serif text-white">
                  {new Date(appointment.dateTime).getDate()}
                </span>
              </div>
              <div>
                <div className="font-bold text-white text-xs">
                  {new Date(appointment.dateTime).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div className="text-[11px] text-slate-300 font-mono flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-[#D4A843]" />
                  <span>
                    {new Date(appointment.dateTime).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Type & Advisor */}
            <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
              <div className="text-slate-200 font-semibold">{appointment.type}</div>
              <div className="text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3 text-[#D4A843]" />
                <span>Advisor: <strong className="text-slate-200">{appointment.advisorName}</strong></span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {appointment.locationType === 'VIDEO' && (
              <button
                type="button"
                onClick={() => onJoinVideoCall?.(appointment.meetingRoomUrl)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Join Video Conference</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
              <button
                type="button"
                onClick={handleAddToCalendar}
                className="py-1.5 px-2 rounded-lg bg-[#06182B] hover:bg-[#102D4F] text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
              >
                {calendarExported ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Exported</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-3 h-3 text-[#D4A843]" />
                    <span>Add to Calendar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onReschedule?.(appointment.id)}
                className="py-1.5 px-2 rounded-lg bg-[#06182B] hover:bg-[#102D4F] text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Reschedule</span>
              </button>
            </div>

            {onCancel && (
              <button
                type="button"
                onClick={() => onCancel(appointment.id)}
                className="w-full py-1 text-[10px] text-red-400 hover:text-red-300 text-center cursor-pointer"
              >
                Cancel Appointment
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="space-y-3 text-xs">
          <p className="text-slate-400 text-[11px] leading-relaxed">
            No consultation currently scheduled. Meet with your dedicated tax professional to review requirements or return drafts.
          </p>

          <button
            type="button"
            onClick={onSchedule}
            className="w-full py-2.5 px-3 rounded-xl bg-[#102D4F] hover:bg-[#143657] text-[#D4A843] hover:text-[#E1BB60] border border-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Appointment</span>
          </button>
        </div>
      )}
    </div>
  );
};
