import React from 'react';
import { Calendar, Video, Clock, User, ChevronRight } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface UpcomingAppointmentProps {
  onReschedule: () => void;
}

export const UpcomingAppointment: React.FC<UpcomingAppointmentProps> = ({ onReschedule }) => {
  const { setCurrentPage } = useApp();

  return (
    <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#183458] pb-3">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
              Consultation Schedule
            </span>
            <h3 className="font-serif text-base font-bold text-white">Upcoming Appointment</h3>
          </div>
          <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase">
            Confirmed
          </div>
        </div>

        {/* Date / Time Card */}
        <div className="p-4 rounded-xl bg-[#06172C] border border-[#183458] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0D2340] border border-[#C6A15B]/30 flex flex-col items-center justify-center text-[#C6A15B] flex-shrink-0">
            <span className="text-[10px] uppercase font-bold">SEP</span>
            <span className="text-base font-serif font-bold text-white">18</span>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-white">
              September 18, 2026 &bull; 10:30 AM EST
            </div>
            <div className="text-[11px] text-slate-300">
              Tax Planning &amp; Compliance Review Consultation
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <User className="w-3 h-3 text-[#C6A15B]" />
              <span>With Founder <strong>Desmond Hinds</strong> (45 Mins)</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          High-definition confidential video room hosted directly inside the portal with end-to-end security.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-[#183458] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrentPage('virtual_consultation_room')}
          className="px-4 py-2 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Video className="w-3.5 h-3.5" />
          <span>Join Meeting Room</span>
        </button>

        <button
          type="button"
          onClick={onReschedule}
          className="text-xs font-semibold text-slate-300 hover:text-white"
        >
          Reschedule
        </button>
      </div>
    </div>
  );
};
