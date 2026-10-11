import { DashboardApplicationShell } from '../layout/DashboardApplicationShell';
import { useAdminProviderReadiness } from '../../hooks/useAdminProviderReadiness';
import { AdminOperationalPanel } from './AdminOperationalPanel';
/**
 * A/R Tax Services, LLC — Practice Administration Console
 * Read-only reported provider configuration and controlled unavailable integrations.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  Layers,
  Activity,
  RefreshCw,
  Search,
  History,
  Briefcase
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const PracticeAdminWorkspace: React.FC = () => {
  const { currentUser, authLifecycleState } = useApp();
  const [activeTab, setActiveTab] = useState<'providers' | 'users' | 'workload' | 'billing' | 'jobs' | 'search' | 'retention' | 'audit'>('providers');
  const [refresh, setRefresh] = useState(0);
  const readiness = useAdminProviderReadiness(currentUser, authLifecycleState, refresh);
  if (!readiness.allowed) return <p role="alert">An active administrator session with tenant context is required.</p>;

  return (
    <DashboardApplicationShell workspace="admin" navigation={(<aside className="w-60 bg-[#071A2E] border-r border-slate-700/60 flex flex-col justify-between shrink-0">
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Administration
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('providers')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'providers' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Provider Readiness</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'users' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Practice Staff &amp; Roles</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('workload')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'workload' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Caseload &amp; Tasks</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'billing' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Catalog &amp; Invoicing</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('jobs')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'jobs' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Durable Job Queue</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'search' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Global Practice Search</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('retention')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'retention' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Retention &amp; Rollover</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'audit' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Compliance Audit Log</span>
            </button>
          </div>

          <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 font-mono space-y-1">
            <div>Environment: <span className="text-white">Read-only administration</span></div>
            <div>Postgres / Supabase: <span className="text-slate-300">Not verified by this workspace</span></div>
          </div>
        </aside>)} >
      <main className="flex-1 overflow-y-auto p-6 space-y-6"><AdminOperationalPanel tab={activeTab} status={readiness.status} providers={readiness.providers} onRefresh={() => setRefresh(value => value + 1)}/></main>

    </DashboardApplicationShell>
  );
};
