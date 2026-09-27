/**
 * A/R Tax Services, LLC - Compliance & Security Demonstration Workspace
 * IRC § 7216 Consents, PTIN/EFIN Credentials, Immutable Audit Trail, Retention Schedule.
 */

import React, { useState, useEffect } from 'react';
import { DemoAuditEvent } from '../types';
import { demoDataStore } from '../services/DemoDataService';
import { ShieldCheck, Lock, FileText, Sparkles, Key, CheckCircle, ShieldAlert, History } from 'lucide-react';
import { AuditEventViewer, AIGovernancePanel, TaxResolutionCenter } from '../../taxguard';

interface ComplianceDashboardViewProps {
  onOpenAiAssistant: () => void;
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
}

export const ComplianceDashboardView: React.FC<ComplianceDashboardViewProps> = ({ 
  onOpenAiAssistant,
  activeNavId,
  onSelectNav
}) => {
  const [auditLogs, setAuditLogs] = useState<DemoAuditEvent[]>([]);
  const validTabs = ['audit', 'resolution', 'taxguard_audit', 'ai_governance', 'irc7216', 'credentials', 'retention'];
  const [activeTabState, setActiveTabState] = useState<'audit' | 'resolution' | 'taxguard_audit' | 'ai_governance' | 'irc7216' | 'credentials' | 'retention'>('audit');
  const activeTab = (activeNavId && validTabs.includes(activeNavId))
    ? (activeNavId as 'audit' | 'resolution' | 'taxguard_audit' | 'ai_governance' | 'irc7216' | 'credentials' | 'retention')
    : activeTabState;

  const handleSelectTab = (tabId: 'audit' | 'resolution' | 'taxguard_audit' | 'ai_governance' | 'irc7216' | 'credentials' | 'retention') => {
    setActiveTabState(tabId);
    if (onSelectNav) {
      onSelectNav(tabId);
    }
  };

  const refresh = () => {
    setAuditLogs(demoDataStore.getAuditLogs());
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
            A/R Tax Services, LLC • Ethics, Compliance &amp; Information Security
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            Regulatory Compliance &amp; Immutable Audit Trail Workspace
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Compliance Auditor</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-300 flex flex-wrap gap-1 text-xs">
        {[
          { id: 'audit', label: 'Immutable Practice Audit Trail' },
          { id: 'resolution', label: 'Tax Resolution, Notice Defense & OIC' },
          { id: 'taxguard_audit', label: 'TaxGuard Cryptographic Audit Ledger' },
          { id: 'ai_governance', label: 'TaxGuard AI Safety & Model Controls' },
          { id: 'irc7216', label: 'IRC § 7216 Consent Registry' },
          { id: 'credentials', label: 'IRS PTIN / EFIN Credentials' },
          { id: 'retention', label: 'Document Retention & Destruction' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleSelectTab(tab.id as any)}
            className={`px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-black text-black font-bold'
                : 'border-transparent text-neutral-600 hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Resolution & Notice Defense */}
      {activeTab === 'resolution' && (
        <div className="pt-1">
          <TaxResolutionCenter userRole="compliance" />
        </div>
      )}

      {/* Tab: Audit */}
      {activeTab === 'audit' && (
        <div className="border border-neutral-300 overflow-x-auto bg-white">
          <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-black">
              System Audit Logs ({auditLogs.length} Events)
            </span>
            <span className="text-[10px] font-mono text-neutral-500">
              SHA-256 Chained Integrity Verified
            </span>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-white text-[10px] font-mono uppercase text-neutral-600">
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">User</th>
                <th className="p-2.5">Role</th>
                <th className="p-2.5">Action Executed</th>
                <th className="p-2.5">Target Record</th>
                <th className="p-2.5">Result</th>
                <th className="p-2.5">Compliance Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50">
                  <td className="p-2.5 font-mono text-neutral-500 text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-2.5 font-bold text-black">{log.user}</td>
                  <td className="p-2.5 font-mono text-[11px] uppercase">{log.role}</td>
                  <td className="p-2.5 font-medium text-black">{log.action}</td>
                  <td className="p-2.5 text-neutral-700 font-mono text-[11px]">{log.record}</td>
                  <td className="p-2.5">
                    <span className="border border-black px-1.5 py-0.5 text-[10px] font-mono font-bold bg-neutral-100">
                      {log.result}
                    </span>
                  </td>
                  <td className="p-2.5 text-neutral-600 text-[11px]">{log.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: TaxGuard Audit Ledger */}
      {activeTab === 'taxguard_audit' && (
        <div className="border border-neutral-300 p-5 bg-white">
          <AuditEventViewer userRole="compliance" />
        </div>
      )}

      {/* Tab: AI Governance */}
      {activeTab === 'ai_governance' && (
        <div className="border border-neutral-300 p-5 bg-white">
          <AIGovernancePanel userRole="compliance" />
        </div>
      )}

      {/* Tab: 7216 */}
      {activeTab === 'irc7216' && (
        <div className="border border-neutral-300 p-5 space-y-4 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            IRC § 7216 Disclosure &amp; Use Consent Registry
          </h3>
          <p className="text-neutral-700">
            Treasury regulations prohibit disclosure or use of tax return information without prior affirmative signed consent.
          </p>
          <div className="space-y-2">
            <div className="p-3 border border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div>
                <strong>Michael Perotti (Perotti Capital Holdings LLC)</strong>
                <div className="text-[11px] text-neutral-600">Consent for Tax Planning &amp; Advisory Analysis: Signed 01/14/2026</div>
              </div>
              <span className="border border-black px-2 py-0.5 font-bold text-[10px]">Active &amp; On File</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Credentials */}
      {activeTab === 'credentials' && (
        <div className="border border-neutral-300 p-5 space-y-4 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            IRS Practitioner Credentials &amp; Electronic Filing Identification Numbers (EFIN)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 border border-neutral-200 space-y-1">
              <span className="font-bold text-black uppercase">Firm EFIN</span>
              <div className="font-mono text-sm">EFIN: 58-XXXXXX (Authorized IRS e-file Provider)</div>
              <div className="text-[11px] text-neutral-600">Status: Active &bull; Security Level: High</div>
            </div>
            <div className="p-3 border border-neutral-200 space-y-1">
              <span className="font-bold text-black uppercase">Preparer PTINs</span>
              <div className="font-mono text-sm">Elena Rostova, CPA: P0189XXXX</div>
              <div className="font-mono text-sm">Marcus Vance, EA: P0245XXXX</div>
              <div className="text-[11px] text-neutral-600">Status: Renewed for 2026 Filing Season</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Retention */}
      {activeTab === 'retention' && (
        <div className="border border-neutral-300 p-5 space-y-4 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Document Retention &amp; Secure Destruction Schedule
          </h3>
          <p className="text-neutral-700">
            Mandatory 7-year retention policy for all tax workpapers, client source documents, and signed Form 8879 authorizations.
          </p>
        </div>
      )}
    </div>
  );
};
