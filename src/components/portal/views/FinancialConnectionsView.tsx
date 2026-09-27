import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Lock,
  Plus,
  Trash2,
  Clock,
  Check,
  X
} from 'lucide-react';
import { FinancialInstitutionConnector } from '../../../types/clientPortal';
import { MOCK_FINANCIAL_CONNECTORS } from '../../../services/clientPortalService';

export const FinancialConnectionsView: React.FC = () => {
  const [connectors, setConnectors] = useState<FinancialInstitutionConnector[]>(MOCK_FINANCIAL_CONNECTORS);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleDisconnect = (id: string, name: string) => {
    if (confirm(`Are you sure you want to disconnect ${name}? Read-only aggregation tokens will be immediately revoked.`)) {
      setConnectors(prev => prev.filter(c => c.id !== id));
      setActionNotice(`Successfully disconnected ${name}. OAuth access token destroyed.`);
    }
  };

  const handleSyncNow = (id: string, name: string) => {
    setActionNotice(`Initiated read-only statement sync for ${name}. New transactions staged.`);
  };

  return (
    <div className="space-y-6" id="client-financial-connections">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
              Direct Feed Aggregation &bull; Read-Only OAuth 2.0
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">
              Bank &amp; Financial-Source Connections
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Secure bank and processor feeds provide verifiable electronic statements for tax schedule reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(true)}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Financial Institution</span>
            </button>
          </div>
        </div>

        {/* Security Disclosures */}
        <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Zero-Credential Architecture:</strong> Your banking login credentials are never handled or stored by A/R Tax Services, LLC. Connections use read-only OAuth tokens via SOC2 Type II financial aggregators.
            </span>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button type="button" onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connected Financial Institutions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectors.map((conn) => (
          <div
            key={conn.id}
            className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-5 shadow-lg space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-2 border-b border-[#0B2748] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#C99A3D]" />
                  <span className="font-bold text-white text-sm">{conn.institutionName}</span>
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  {conn.accountTypeLabel} &bull; <span className="font-mono text-slate-300">{conn.accountMask}</span>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Check className="w-3 h-3" /> Connected
              </span>
            </div>

            <div className="space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Connection Mode:</span>
                <span className="font-semibold text-white">Read-Only OAuth 2.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sync Frequency:</span>
                <span className="text-white capitalize">{conn.syncFrequency.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Successful Sync:</span>
                <span className="text-[#E2BD67]">{new Date(conn.lastSyncDate).toLocaleString()}</span>
              </div>
              {conn.balance !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Verified Year-End Balance:</span>
                  <span className="font-serif font-bold text-white text-sm">
                    ${conn.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Scope Badges */}
            <div className="space-y-1.5 pt-2 border-t border-[#0B2748]">
              <div className="text-slate-400 font-semibold">Granted Read-Only Scopes:</div>
              <div className="flex flex-wrap gap-1.5">
                {conn.dataScopesRequested.map((scope, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-[#06172C] border border-[#1E3A5F] text-[10px] text-slate-300 font-mono"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-400">
              <strong>Retention Policy:</strong> {conn.retentionPolicy}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#0B2748]">
              <button
                type="button"
                onClick={() => handleSyncNow(conn.id, conn.institutionName)}
                className="px-3 py-1.5 rounded-xl bg-[#0B2748] hover:bg-[#11355F] text-white border border-[#1E3A5F] transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#C99A3D]" />
                <span>Sync Now</span>
              </button>

              <button
                type="button"
                onClick={() => handleDisconnect(conn.id, conn.institutionName)}
                className="px-3 py-1.5 rounded-xl text-rose-300 hover:bg-rose-950/30 border border-rose-500/30 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Connect Modal Simulation */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#07172B] border border-[#C99A3D] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-[#0B2748] pb-3">
              <h3 className="font-serif text-lg font-bold text-white">Connect Financial Institution</h3>
              <button type="button" onClick={() => setIsConnectModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300">
              Select your financial institution or payroll provider to establish a direct, read-only data feed for your tax workpapers:
            </p>

            <div className="space-y-2">
              {[
                { name: 'Bank of America Business', type: 'Bank Checking / Savings' },
                { name: 'Wells Fargo Commercial', type: 'Commercial Operating' },
                { name: 'Square Merchant Processing', type: 'POS & Card Transactions' },
                { name: 'ADP Run / TotalSource', type: 'W-2 & Payroll Feeds' },
                { name: 'Charles Schwab Institutional', type: '1099-B & Investment Schedules' }
              ].map((inst, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const newConn: FinancialInstitutionConnector = {
                      id: `fin_${Date.now()}`,
                      institutionName: inst.name,
                      institutionType: 'bank',
                      accountMask: '•••• ' + Math.floor(1000 + Math.random() * 9000),
                      accountTypeLabel: inst.type,
                      authMethod: 'oauth_2_read_only_aggregator',
                      status: 'connected',
                      lastSyncDate: new Date().toISOString(),
                      syncFrequency: 'daily_automatic',
                      dataScopesRequested: ['read_transactions', 'read_account_statements'],
                      retentionPolicy: 'Encrypted storage with 7-year statutory audit retention.',
                      balance: 15400.00
                    };
                    setConnectors(prev => [...prev, newConn]);
                    setIsConnectModalOpen(false);
                    setActionNotice(`Successfully connected ${inst.name} via OAuth read-only handshake.`);
                  }}
                  className="w-full p-3 rounded-xl bg-[#06172C] border border-[#1E3A5F] hover:border-[#C99A3D] text-left flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-bold text-white">{inst.name}</div>
                    <div className="text-[11px] text-slate-400">{inst.type}</div>
                  </div>
                  <span className="text-[#C99A3D] font-bold text-xs">Connect &rarr;</span>
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 text-center pt-2">
              Protected by 256-bit TLS encryption. Login credentials are encrypted directly with the financial institution.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
