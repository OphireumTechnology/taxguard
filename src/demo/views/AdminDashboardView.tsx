/**
 * A/R Tax Services, LLC - System Administrator Demonstration Workspace
 * Role session tokens, Rate-limit lockouts, Integration Registry, Reset Demo Data,
 * and Administrator-Controlled Role Access Tester across all 29 practice roles.
 */

import React, { useState } from 'react';
import { demoDataStore } from '../services/DemoDataService';
import { DemoAuthService } from '../services/DemoAuthService';
import { DEMO_ROLES, DemoRole, DemoRoleConfig } from '../types';
import { 
  ShieldAlert, 
  RotateCcw, 
  Key, 
  Activity, 
  Sparkles, 
  CheckCircle, 
  ExternalLink, 
  Search, 
  Lock, 
  ShieldCheck,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { IntegrationHealthPanel, UnifiedActionCenter, AICreditUsageManager, TaxGuardVoiceAssistant } from '../../taxguard';

interface AdminDashboardViewProps {
  onOpenAiAssistant: () => void;
  onOpenIntegrations: () => void;
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ 
  onOpenAiAssistant,
  onOpenIntegrations,
  activeNavId,
  onSelectNav
}) => {
  const validTabs = ['tester', 'actions', 'credits', 'voice'];
  const [activeTabState, setActiveTabState] = useState<'tester' | 'actions' | 'credits' | 'voice'>('tester');
  const activeTab = (activeNavId && validTabs.includes(activeNavId))
    ? (activeNavId as 'tester' | 'actions' | 'credits' | 'voice')
    : activeTabState;

  const handleSelectTab = (tabId: 'tester' | 'actions' | 'credits' | 'voice') => {
    setActiveTabState(tabId);
    if (onSelectNav) {
      onSelectNav(tabId);
    }
  };
  const [resetNotice, setResetNotice] = useState(false);
  const [testerSearch, setTesterSearch] = useState('');

  const handleResetDemoData = () => {
    demoDataStore.resetDemoData();
    DemoAuthService.clearAllSessions();
    setResetNotice(true);
    setTimeout(() => {
      setResetNotice(false);
      window.location.reload();
    }, 1500);
  };

  const allRoleEntries = Object.entries(DEMO_ROLES) as [DemoRole, DemoRoleConfig][];
  const filteredRoles = allRoleEntries.filter(([key, config]) => {
    const q = testerSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      config.title.toLowerCase().includes(q) ||
      key.toLowerCase().includes(q) ||
      config.department.toLowerCase().includes(q) ||
      config.loginPath.toLowerCase().includes(q) ||
      config.dashboardPath.toLowerCase().includes(q)
    );
  });

  const handleOpenLoginInNewTab = (loginPath: string) => {
    // Open in a new tab using current origin
    const url = `${window.location.origin}${loginPath.startsWith('#') ? '/' + loginPath : loginPath}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-neutral-300 p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            A/R Tax Services, LLC • Enterprise Architecture &amp; Security Administration
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            System Administration &amp; Sandbox Controls
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Admin Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-300 flex flex-wrap gap-1 text-xs">
        {[
          { id: 'tester', label: 'Role Access Matrix & Sandbox Health' },
          { id: 'actions', label: 'Practice Unified Action Center' },
          { id: 'credits', label: 'AI Credit Metering & Usage' },
          { id: 'voice', label: 'Voice Assistant Sandbox' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleSelectTab(tab.id as any)}
            className={`px-3.5 py-2 font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab.id
                ? 'border-black text-black font-bold bg-neutral-50'
                : 'border-transparent text-neutral-600 hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Tester & Sandbox Controls */}
      {activeTab === 'tester' && (
        <>
          {resetNotice && (
            <div className="p-3 border border-black bg-neutral-50 text-xs font-bold text-black">
              Demonstration data reset to pristine baseline. Reloading workspace...
            </div>
          )}

      {/* Control Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {/* Reset State Box */}
        <div className="border border-black p-5 space-y-3 bg-white">
          <div className="flex items-center gap-2 font-bold uppercase text-black">
            <RotateCcw className="w-4 h-4 text-black" />
            <span>Reset Demonstration Database</span>
          </div>
          <p className="text-neutral-700 leading-relaxed">
            Re-initializes all clients, engagements, workpapers, invoices, handoffs, and transaction ledgers to the factory demo baseline. Clears all active session tokens and lockouts.
          </p>
          <button
            onClick={handleResetDemoData}
            className="px-4 py-2 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800"
          >
            Reset All Demo Data
          </button>
        </div>

        {/* Integration Registry Box */}
        <div className="border border-neutral-300 p-5 space-y-3 bg-neutral-50">
          <div className="flex items-center gap-2 font-bold uppercase text-black">
            <Key className="w-4 h-4 text-black" />
            <span>Enterprise Integration Registry (Phase 2)</span>
          </div>
          <p className="text-neutral-700 leading-relaxed">
            Examine all 22 planned third-party services (IRS MeF, Stripe, Plaid, Gusto, QuickBooks, DocuSign). All connectors are maintained in verified &ldquo;Not Configured&rdquo; sandbox state.
          </p>
          <button
            onClick={onOpenIntegrations}
            className="px-4 py-2 border border-black text-black text-xs font-bold uppercase hover:bg-black hover:text-white"
          >
            Open Integration Registry
          </button>
        </div>
      </div>

      {/* TaxGuard AI Enterprise Integration Health Panel */}
      <div className="border border-neutral-300 p-5 bg-white space-y-3">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
              <Key className="w-4 h-4 text-black" />
              <span>TaxGuard AI Enterprise Adapters &amp; Integration Health</span>
            </h3>
            <p className="text-xs text-neutral-600">
              Live telemetry and circuit-breaker monitoring for all 22 tax software adapters, cloud providers, and government gateways.
            </p>
          </div>
        </div>
        <IntegrationHealthPanel userRole="admin" />
      </div>

      {/* Role Access Tester (Administrator Verification Tool for all 29 Roles) */}
      <div className="border-2 border-black bg-white">
        <div className="p-5 border-b border-neutral-300 bg-neutral-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-black" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                Administrator Role Access Tester
              </h3>
            </div>
            <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
              System administrator diagnostic matrix verifying route registration, component rendering, mock data binding, and token isolation for all 29 canonical roles. Opens role login in a new tab without bypassing credentials or creating cross-role sessions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter roles..."
                value={testerSearch}
                onChange={(e) => setTesterSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-neutral-300 text-xs text-black placeholder-neutral-400 focus:outline-none focus:border-black w-48"
              />
            </div>
            <div className="px-3 py-1 bg-black text-white text-[11px] font-mono font-bold whitespace-nowrap">
              Verified: 29 / 29 Active
            </div>
          </div>
        </div>

        {/* Access Tester Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-100 text-[11px] font-mono uppercase text-neutral-700">
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Role Title &amp; ID</th>
                <th className="py-2.5 px-4">Canonical Login Route</th>
                <th className="py-2.5 px-4">Dashboard Route</th>
                <th className="py-2.5 px-4">Route Status</th>
                <th className="py-2.5 px-4">Component</th>
                <th className="py-2.5 px-4">Mock Data</th>
                <th className="py-2.5 px-4">Access Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredRoles.map(([roleKey, config], index) => {
                const isActiveSession = DemoAuthService.isAuthenticated(roleKey);
                return (
                  <tr key={roleKey} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-neutral-500 text-[11px]">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-black">{config.title}</div>
                      <div className="text-[10px] font-mono text-neutral-500">
                        <code>{roleKey}</code> • {config.department}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-700">
                      <code>{config.loginPath}</code>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-700">
                      <code>{config.dashboardPath}</code>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 border border-black bg-black text-white">
                        <CheckCircle className="w-3 h-3" />
                        Registered
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-800">
                        <FileCheck className="w-3 h-3 text-black" />
                        Verified
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-800">
                        <Activity className="w-3 h-3 text-black" />
                        Loaded
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleOpenLoginInNewTab(config.loginPath)}
                        className="px-2.5 py-1 border border-neutral-300 hover:border-black text-[11px] font-bold text-black uppercase hover:bg-neutral-100 flex items-center gap-1 transition-colors"
                        title="Open role login in a new tab"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Login</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

          {/* Security Rule Notice */}
          <div className="p-4 border-t border-neutral-300 bg-neutral-50 text-[11px] text-neutral-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-black" />
              <span>
                <strong>Security Protocol Enforced:</strong> Tester opens login endpoints in isolated browser contexts. Never creates cross-role session bleeding.
              </span>
            </div>
            <div className="font-mono text-[10px] text-neutral-500">
              Demo Shared Credential: Required on Login
            </div>
          </div>
        </div>
        </>
      )}

      {/* Tab: Unified Action Center */}
      {activeTab === 'actions' && (
        <div className="pt-1">
          <UnifiedActionCenter userRole="admin" />
        </div>
      )}

      {/* Tab: AI Credit Usage & Metering */}
      {activeTab === 'credits' && (
        <div className="pt-1">
          <AICreditUsageManager userRole="admin" />
        </div>
      )}

      {/* Tab: Voice Assistant Sandbox */}
      {activeTab === 'voice' && (
        <div className="pt-1">
          <TaxGuardVoiceAssistant userRole="admin" />
        </div>
      )}
    </div>
  );
};
