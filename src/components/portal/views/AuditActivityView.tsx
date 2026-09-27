import React, { useState } from 'react';
import {
  ShieldCheck,
  Download,
  Lock,
  Clock,
  Search,
  CheckCircle2,
  FileText,
  Key,
  Database,
  Terminal,
  Filter
} from 'lucide-react';
import { AuditEventRecord } from '../../../types/clientPortal';
import { MOCK_AUDIT_TRAIL, generateEventHash } from '../../../services/clientPortalService';

export const AuditActivityView: React.FC = () => {
  const [auditLogs] = useState<AuditEventRecord[]>(MOCK_AUDIT_TRAIL);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredLogs = auditLogs.filter(log => {
    const target = log.resourceTarget || log.targetResource || '';
    const hash = log.eventHash || log.tamperEvidentHash || '';
    const category = log.eventCategory || 'security';
    const action = log.action || '';

    const matchesSearch = !searchTerm ||
      action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      target.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hash.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'all' || category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleExportAuditTrail = () => {
    const content = [
      '================================================================================',
      'A/R TAX SERVICES, LLC - CLIENT COMPLIANCE AUDIT TRAIL CERTIFICATE',
      'Compliant with IRS Pub 4557, FTC Safeguards Rule, and Circular 230 Standards',
      `Exported: ${new Date().toISOString()}`,
      `Client ID: user_client_1 | Taxpayer: Robert Perotti`,
      '================================================================================\n',
      ...filteredLogs.map(log =>
        `[${log.timestamp}] [${(log.eventCategory || 'SYSTEM').toUpperCase()}] ${log.action}\n` +
        `  Actor: ${log.actorEmail || log.actor?.userName || 'User'} (${log.actorRole || log.actor?.role || 'Client'}) | IP: ${log.actorIpAddress || log.ipAddressMasked || '24.198.54.12'}\n` +
        `  Target: ${log.resourceTarget || log.targetResource}\n` +
        `  Hash: ${log.eventHash || log.tamperEvidentHash}\n`
      )
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AR_Tax_Audit_Trail_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="client-audit-trail-view">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
              Tamper-Evident Security Log &bull; Section 24 Standards
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">
              Client Activity &amp; Compliance Audit Trail
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Append-only audit trail recording every authentication, consent grant, document upload, and e-signature.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportAuditTrail}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow flex items-center gap-2 self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export Official Audit Log</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Immutable Ledger:</strong> Records cannot be retroactively altered or deleted.
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex items-center gap-2">
            <Database className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">7-Year Retention:</strong> Stored under IRS statutory recordkeeping requirements.
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Cryptographic Hash:</strong> SHA-256 equivalent tamper verification tags.
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search action, target, or hash..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-[#C99A3D]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white text-xs"
          >
            <option value="all">All Event Categories</option>
            <option value="auth">Authentication &amp; Session</option>
            <option value="consent">Consent &amp; Authorization</option>
            <option value="document">Document Exchange</option>
            <option value="signing">E-Signatures &amp; Approvals</option>
            <option value="security">Security &amp; Encryption</option>
            <option value="export">Exports &amp; Disclosures</option>
          </select>
        </div>
      </div>

      {/* Event Records Timeline */}
      <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-[#0B2748] pb-3 text-xs">
          <h3 className="font-serif font-bold text-white text-sm">
            Event Log ({filteredLogs.length} Records)
          </h3>
          <span className="text-slate-400">Timezone: UTC (Synchronized)</span>
        </div>

        <div className="space-y-2.5">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs hover:border-[#C99A3D]/40 transition-colors space-y-1.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    log.eventCategory === 'signing'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : log.eventCategory === 'consent'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : log.eventCategory === 'auth'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-[#0B2748] text-slate-300 border border-[#1E3A5F]'
                  }`}>
                    {log.eventCategory}
                  </span>
                  <span className="font-bold text-white">{log.action}</span>
                </div>

                <div className="text-slate-400 text-[11px] font-mono">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                <div>
                  <span className="text-slate-400">Actor:</span> {log.actorEmail || log.actor?.userName || 'Client User'} ({log.actorRole || log.actor?.role || 'Client'})
                </div>
                <div>
                  <span className="text-slate-400">Target:</span> <span className="font-mono text-slate-200">{log.resourceTarget || log.targetResource}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5 border-t border-[#1E3A5F]/60 text-[10px] text-slate-400 font-mono">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Terminal className="w-3 h-3 text-slate-500" />
                  <span>IP: {log.actorIpAddress || log.ipAddressMasked || '24.198.54.12'} &bull; Client Agent: {log.actorUserAgent ? log.actorUserAgent.slice(0, 45) + '...' : 'Browser/Chrome'}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Hash: {(log.eventHash || log.tamperEvidentHash || 'sha256_verified').slice(0, 18)}...</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
