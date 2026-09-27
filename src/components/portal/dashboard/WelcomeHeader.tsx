import React from 'react';
import { UploadCloud, Calendar, ShieldCheck, Award } from 'lucide-react';
import { User } from '../../../types';

interface WelcomeHeaderProps {
  currentUser: User | null;
  onOpenUpload: () => void;
  onBookConsultation: () => void;
}

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({
  currentUser,
  onOpenUpload,
  onBookConsultation
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Michael';

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 py-2">
      {/* Left: Greeting & Return Context */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0D2340] border border-[#183458] text-[#C6A15B] font-semibold text-[11px]">
            <ShieldCheck className="w-3 h-3 text-[#C6A15B]" />
            Secure Client Portal
          </span>
          <span className="text-slate-400 hidden sm:inline">&bull;</span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            IRS e-File Certified Partner
          </span>
        </div>

        <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
          {getGreeting()}, {firstName} <span className="inline-block animate-wave">👋</span>
        </h1>

        <div className="text-xs sm:text-sm text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Your 2025 Individual Tax Return is currently under review.</span>
          <span className="text-slate-500 hidden sm:inline">&bull;</span>
          <span>
            Assigned Advisor: <strong className="text-[#C6A15B] font-semibold">Desmond Hinds</strong>
          </span>
        </div>
      </div>

      {/* Right: Primary Action Buttons */}
      <div className="flex items-center gap-3 w-full sm:w-auto flex-shrink-0">
        <button
          type="button"
          onClick={onOpenUpload}
          className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A15B]"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Documents</span>
        </button>

        <button
          type="button"
          onClick={onBookConsultation}
          className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl bg-[#0D2340] hover:bg-[#132E52] border border-[#183458] hover:border-[#C6A15B]/40 text-slate-200 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A15B]"
        >
          <Calendar className="w-4 h-4 text-[#C6A15B]" />
          <span>Book Consultation</span>
        </button>
      </div>
    </div>
  );
};
