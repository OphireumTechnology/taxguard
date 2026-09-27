/**
 * TaxGuard AI – Immutable Append-Only Audit Trail
 * Strict compliance: no modification or deletion controls.
 */

import React, { useState } from 'react';
import { 
  History, 
  ShieldCheck, 
  Lock, 
  Search, 
  Filter, 
  Download,
  AlertCircle
} from 'lucide-react';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';
import { TaxGuardAuditEntry } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardAuditLogView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [logs] = useState<TaxGuardAuditEntry[]>(() => TaxGuardAuditService.getLogs());
  const [filterText, setFilterText] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const filteredLogs = logs.filter(l => {
    if (riskFilter !== 'all' && l.riskLevel !== riskFilter) return false;
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.userId.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.recordId.toLowerCase().includes(q)
    );
  });

  const exportAuditLogJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `TaxGuard_Audit_Log_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <History className="w-4 h-4 text-[#C99A32]" />
              <span>Statutory Compliance & Append-Only Audit Trail</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Cryptographically timestamped event records. Deletion or modification is mathematically prohibited.
            </p>
          </div>

          <button
            onClick={exportAuditLogJson}
            className="px-3 py-1.5 border border-[#1A365D] hover:bg-[#0A2544] text-[#061A2F] hover:text-white text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Immutable JSON</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 text-xs">
          <div className="flex-1 relative">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search by action, user, or details..."
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xs focus:ring-1 focus:ring-[#C99A32]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Risk Level:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-xs bg-white"
            >
              <option value="all">All Risk Levels ({logs.length})</option>
              <option value="routine">Routine</option>
              <option value="material">Material</option>
              <option value="high_risk">High Risk</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                <th className="py-2.5 px-3">Timestamp & ID</th>
                <th className="py-2.5 px-3">Actor & Role</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Risk Level</th>
                <th className="py-2.5 px-3">Details & Audit Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3">
                    <div className="font-mono text-[10px] text-slate-700">
                      {new Date(l.timestamp).toLocaleString()}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">{l.id}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-[#061A2F]">{l.userId}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono">{l.userRole}</div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-xs text-[#061A2F]">
                    {l.action}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-xs font-mono ${
                      l.riskLevel === 'high_risk'
                        ? 'bg-rose-100 text-rose-800'
                        : l.riskLevel === 'material'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {l.riskLevel.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 leading-relaxed text-[11px]">
                    {l.details}
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Correlation: {l.correlationId} • IP: {l.ipAddress}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
