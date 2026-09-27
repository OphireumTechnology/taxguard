import React from 'react';
import { 
  X, 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare, 
  HelpCircle, 
  ShieldCheck, 
  Clock, 
  ExternalLink 
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTab
}) => {
  const { setCurrentPage } = useApp();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="bg-[#0A1F38] border border-[#183458] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-100 relative">
        <div className="flex items-center justify-between border-b border-[#183458] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C6A15B]/15 border border-[#C6A15B]/30 flex items-center justify-center text-[#C6A15B]">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 id="help-modal-title" className="font-serif text-lg font-bold text-white">
                Client Advisory & Support
              </h3>
              <p className="text-xs text-slate-400">
                Direct access to your dedicated tax team in Columbia, SC
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#132E52] transition-colors"
            aria-label="Close help modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="tel:678-205-9486"
            className="p-3.5 rounded-xl bg-[#06172C] border border-[#183458] hover:border-[#C6A15B]/50 transition-colors group block"
          >
            <div className="flex items-center gap-2.5 mb-1 text-[#C6A15B]">
              <Phone className="w-4 h-4" />
              <span className="text-xs font-bold text-white group-hover:text-[#C6A15B] transition-colors">
                678-205-9486
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Direct telephone line &bull; Mon-Fri 8:30 AM - 6:00 PM EST
            </p>
          </a>

          <a
            href="mailto:dhinds@artaxservices.com"
            className="p-3.5 rounded-xl bg-[#06172C] border border-[#183458] hover:border-[#C6A15B]/50 transition-colors group block"
          >
            <div className="flex items-center gap-2.5 mb-1 text-[#C6A15B]">
              <Mail className="w-4 h-4" />
              <span className="text-xs font-bold text-white group-hover:text-[#C6A15B] transition-colors">
                dhinds@artaxservices.com
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Desmond Hinds, Founder &amp; Senior Managing Accountant
            </p>
          </a>
        </div>

        {/* Quick Help Actions */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Fast Assistance</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onNavigateToTab) onNavigateToTab('messages');
              }}
              className="p-3 rounded-xl bg-[#06172C] hover:bg-[#132E52] border border-[#183458] text-left flex items-center justify-between transition-colors text-xs text-slate-200"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#C6A15B]" />
                <span>Send Advisor Message</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onNavigateToTab) onNavigateToTab('appointments');
              }}
              className="p-3 rounded-xl bg-[#06172C] hover:bg-[#132E52] border border-[#183458] text-left flex items-center justify-between transition-colors text-xs text-slate-200"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-[#C6A15B]" />
                <span>Book 45-Min Call</span>
              </div>
              <span className="text-[10px] text-slate-400">Calendar</span>
            </button>
          </div>
        </div>

        {/* Common Questions */}
        <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#183458] space-y-2 text-xs">
          <div className="font-semibold text-white">Frequently Asked Questions</div>
          <div className="space-y-1.5 text-slate-300 text-[11px]">
            <div>
              <strong className="text-white">How do I sign Form 8879?</strong> Go to Deliverables in the sidebar, open the certified return, and tap "Sign Form 8879 E-File Authorization".
            </div>
            <div>
              <strong className="text-white">What format should documents be in?</strong> PDF is preferred for statements and returns; high-resolution smartphone photos (JPG/PNG) are accepted.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#183458] text-[11px] text-slate-400">
          <div className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>IRS Circular 230 Protected Session</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#132E52] hover:bg-[#1B3F70] text-xs font-semibold text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
