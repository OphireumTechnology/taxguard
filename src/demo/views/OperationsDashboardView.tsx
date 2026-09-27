/**
 * A/R Tax Services, LLC - Practice Operations Demonstration Workspace
 * Firmwide workflow board, Staff capacity matrix, Filing season bottleneck alerts, Deadlines.
 */

import React, { useState, useEffect } from 'react';
import { DemoEngagement } from '../types';
import { demoDataStore } from '../services/DemoDataService';
import { Sparkles, Activity, Users, AlertTriangle, Calendar, CheckCircle } from 'lucide-react';

interface OperationsDashboardViewProps {
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
  onOpenAiAssistant: () => void;
}

export const OperationsDashboardView: React.FC<OperationsDashboardViewProps> = ({ 
  activeNavId, 
  onSelectNav, 
  onOpenAiAssistant 
}) => {
  const [engagements, setEngagements] = useState<DemoEngagement[]>([]);
  const [activeTab, setActiveTab] = useState<'board' | 'capacity' | 'deadlines'>('board');

  const currentTab = activeNavId && activeNavId !== 'default' ? activeNavId : activeTab;

  const refresh = () => {
    setEngagements(demoDataStore.getEngagements());
  };

  useEffect(() => {
    refresh();
    return demoDataStore.subscribe(refresh);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-neutral-300 p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            A/R Tax Services, LLC • Practice Operations Command
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            Firmwide Workflow &amp; Capacity Command Center
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Operations Assistant</span>
          </button>
        </div>
      </div>

      {/* Tab: Board / Overview */}
      {(currentTab === 'board' || currentTab === 'overview') && (
        <div className="space-y-4">
          <div className="border border-neutral-300 p-4 bg-white space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black">
              Firmwide Return Pipeline ({engagements.length} Engagements)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-mono uppercase text-neutral-600">
                    <th className="p-2.5">Client</th>
                    <th className="p-2.5">Return Form</th>
                    <th className="p-2.5">Work Cycle Stage</th>
                    <th className="p-2.5">Current Status</th>
                    <th className="p-2.5">Assigned Staff</th>
                    <th className="p-2.5">Deadline</th>
                    <th className="p-2.5">Bottleneck Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {engagements.map((e) => (
                    <tr key={e.id} className="hover:bg-neutral-50">
                      <td className="p-2.5 font-bold text-black">{e.clientName}</td>
                      <td className="p-2.5 font-mono text-black">{e.formType}</td>
                      <td className="p-2.5 font-bold text-black">{e.currentStage}</td>
                      <td className="p-2.5">
                        <span className="border border-neutral-300 px-1.5 py-0.5 text-[10px] font-mono">
                          {e.currentStatus}
                        </span>
                      </td>
                      <td className="p-2.5 text-neutral-700">{e.assignedStaff}</td>
                      <td className="p-2.5 font-mono text-neutral-600">{e.statutoryDeadline}</td>
                      <td className="p-2.5">
                        <span className="border border-black px-1.5 py-0.5 text-[10px] font-mono uppercase">
                          Normal Flow
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Capacity */}
      {currentTab === 'capacity' && (
        <div className="border border-neutral-300 p-5 space-y-4 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Staff Workload &amp; Capacity Utilization (Tax Season Pacing)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
              <span className="font-bold text-black uppercase">Elena Rostova, CPA</span>
              <div className="text-[11px] text-neutral-600">Active Reviews: 3 returns &bull; Utilization: 78%</div>
            </div>
            <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
              <span className="font-bold text-black uppercase">Marcus Vance, EA</span>
              <div className="text-[11px] text-neutral-600">Active Returns: 4 returns &bull; Utilization: 82%</div>
            </div>
            <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
              <span className="font-bold text-black uppercase">Sarah Jenkins</span>
              <div className="text-[11px] text-neutral-600">Active Bookkeeping: 5 ledgers &bull; Utilization: 65%</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Deadlines */}
      {currentTab === 'deadlines' && (
        <div className="border border-neutral-300 p-5 space-y-3 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Filing Season Statutory Deadlines (Calendar Year 2026)
          </h3>
          <div className="space-y-2">
            <div className="p-2.5 border border-neutral-200 flex justify-between">
              <span><strong>March 15, 2026:</strong> Partnerships (Form 1065) &amp; S-Corporations (Form 1120-S)</span>
              <span className="font-mono text-neutral-500 font-bold">12 Days Remaining</span>
            </div>
            <div className="p-2.5 border border-neutral-200 flex justify-between">
              <span><strong>April 15, 2026:</strong> Individuals (Form 1040) &amp; C-Corporations (Form 1120)</span>
              <span className="font-mono text-neutral-500 font-bold">43 Days Remaining</span>
            </div>
            <div className="p-2.5 border border-neutral-200 flex justify-between">
              <span><strong>May 15, 2026:</strong> Tax-Exempt Organizations (Form 990)</span>
              <span className="font-mono text-neutral-500 font-bold">73 Days Remaining</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
