/**
 * A/R Tax Services, LLC - Intake & Client Services Demonstration Workspace
 * Lead pipeline, Conflict of Interest checks, Engagement letter proposals, Client onboarding.
 */

import React, { useState } from 'react';
import { Sparkles, UserPlus, CheckCircle, FileText, Search } from 'lucide-react';

interface IntakeDashboardViewProps {
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
  onOpenAiAssistant: () => void;
}

export const IntakeDashboardView: React.FC<IntakeDashboardViewProps> = ({ 
  activeNavId, 
  onSelectNav, 
  onOpenAiAssistant 
}) => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'conflict' | 'proposals'>('pipeline');
  const [conflictResult, setConflictResult] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');

  const currentTab = activeNavId && activeNavId !== 'default' ? activeNavId : activeTab;

  const handleConflictCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchName.trim()) return;
    setConflictResult(`Zero conflicts identified for "${searchName}". Clearance granted to issue engagement letter under AICPA Code of Professional Conduct.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-neutral-300 p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            A/R Tax Services, LLC • Client Onboarding &amp; Intake Practice
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            Client Intake &amp; Conflict Clearance Workspace
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Intake Assistant</span>
          </button>
        </div>
      </div>

      {/* Tab: Pipeline / Overview */}
      {(currentTab === 'pipeline' || currentTab === 'overview') && (
        <div className="border border-neutral-300 p-4 space-y-3 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Active Prospective Client Inquiries
          </h3>
          <div className="space-y-2">
            <div className="p-3 border border-neutral-200 flex justify-between items-center">
              <div>
                <strong>Palmetto Medical Diagnostics LLC</strong>
                <div className="text-[11px] text-neutral-600">Needs: Multi-state Partnership (Form 1065) + Monthly CAS Bookkeeping</div>
              </div>
              <span className="border border-black px-2 py-0.5 font-bold text-[10px]">Proposal Sent</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Conflict */}
      {currentTab === 'conflict' && (
        <div className="border border-neutral-300 p-5 space-y-4 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            AICPA Conflict-of-Interest &amp; Independence Verification
          </h3>
          <form onSubmit={handleConflictCheck} className="flex gap-2 max-w-md">
            <input
              type="text"
              placeholder="Search prospective entity or individual..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-neutral-300 text-xs"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-black text-white font-bold uppercase hover:bg-neutral-800"
            >
              Run Check
            </button>
          </form>

          {conflictResult && (
            <div className="p-3 border border-black bg-neutral-50 font-medium text-black">
              {conflictResult}
            </div>
          )}
        </div>
      )}

      {/* Tab: Proposals */}
      {currentTab === 'proposals' && (
        <div className="border border-neutral-300 p-5 space-y-3 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Executed Engagement Letters &amp; Retainer Agreements
          </h3>
          <p className="text-neutral-700">
            Standard scope of work: Preparation of Form 1120-S, SC1120S, Schedule K-1s, and quarterly consulting.
          </p>
        </div>
      )}
    </div>
  );
};
