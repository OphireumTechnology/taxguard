import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, Check, X, Cookie } from 'lucide-react';

export const CookiePreferencesModal: React.FC = () => {
  const { cookieModalOpen, setCookieModalOpen, setCookieConsentAccepted } = useApp();
  const [analytics, setAnalytics] = useState(true);
  const [preferences, setPreferences] = useState(true);
  const [marketing, setMarketing] = useState(false);

  if (!cookieModalOpen) return null;

  const handleSave = () => {
    setCookieConsentAccepted(true);
    setCookieModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0D2340] border border-[#1E3A5F] rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#1E3A5F]">
          <div className="flex items-center gap-2 text-[#C6A15B]">
            <Cookie className="w-5 h-5" />
            <h3 className="font-serif text-lg font-bold text-white">Cookie & Privacy Preferences</h3>
          </div>
          <button 
            onClick={() => setCookieModalOpen(false)}
            className="p-1 rounded-lg hover:bg-[#132E52] text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          A/R Tax Services, LLC strictly adheres to state, federal, and GDPR data privacy principles. 
          We never sell personal financial data or documents to third parties. Choose your preferences below:
        </p>

        <div className="space-y-4 text-xs">
          {/* Essential Cookies */}
          <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between">
            <div className="space-y-1 pr-4">
              <div className="font-semibold text-white flex items-center gap-2">
                Essential Security Cookies 
                <span className="text-[10px] bg-[#C6A15B]/20 text-[#C6A15B] px-1.5 py-0.5 rounded">Always Required</span>
              </div>
              <p className="text-slate-400">
                Necessary for secure authentication, CSRF tokens, encrypted sessions, and document upload verification.
              </p>
            </div>
            <input type="checkbox" checked disabled className="h-4 w-4 rounded accent-[#C6A15B]" />
          </div>

          {/* Performance & Analytics */}
          <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between">
            <div className="space-y-1 pr-4">
              <div className="font-semibold text-white">Performance & Anonymized Analytics</div>
              <p className="text-slate-400">
                Helps us monitor server uptime, document processing latency, and portal responsiveness.
              </p>
            </div>
            <input 
              type="checkbox" 
              checked={analytics} 
              onChange={(e) => setAnalytics(e.target.checked)} 
              className="h-4 w-4 rounded accent-[#C6A15B] cursor-pointer" 
            />
          </div>

          {/* Functional Preferences */}
          <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between">
            <div className="space-y-1 pr-4">
              <div className="font-semibold text-white">User Interface Preferences</div>
              <p className="text-slate-400">
                Remembers active tax-year filters, dashboard layouts, and accessibility view states.
              </p>
            </div>
            <input 
              type="checkbox" 
              checked={preferences} 
              onChange={(e) => setPreferences(e.target.checked)} 
              className="h-4 w-4 rounded accent-[#C6A15B] cursor-pointer" 
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1E3A5F]">
          <button
            onClick={() => {
              setAnalytics(true);
              setPreferences(true);
              setMarketing(true);
              handleSave();
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Accept All
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-colors"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
