/**
 * A/R Tax Services, LLC - Accountant Immutable Audit Trail View
 * Section 13: Full audit trail with User, Role, Action, Record, Result, Reason, Timestamp, and Session ID.
 */

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  UserCheck, 
  Download,
  Filter
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';

interface AccountantAuditLogViewProps {
  isDark: boolean;
}

export const AccountantAuditLogView: React.FC<AccountantAuditLogViewProps> = ({ isDark }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const logs = accountantCenterService.getAuditTrail();
  const client = accountantCenterService.getSelectedClient();

  const filtered = logs.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.user.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.record.toLowerCase().includes(q) ||
      l.reason.toLowerCase().includes(q)
    );
  });

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
            Section 13 &bull; Compliance &amp; Security Trail
          </div>
          <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
            Immutable Practice Audit Trail &amp; Access Log
          </h2>
          <p className={`text-xs ${textSecondary} mt-0.5`}>
            Every document override, classification shift, hard-stop waiver, and attestation is recorded with non-repudiation timestamps.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 border rounded font-bold">
            {filtered.length} Audit Events Logged
          </span>
        </div>
      </div>

      {/* Search */}
      <div className={`p-4 border rounded-lg shadow-sm ${cardBg}`}>
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search audit trail by user, action, target record, or statutory rationale..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded focus:outline-none"
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className={`border rounded-lg shadow-sm overflow-x-auto ${cardBg}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
              <th className="p-3">Timestamp</th>
              <th className="p-3">User &amp; Role</th>
              <th className="p-3">Action</th>
              <th className="p-3">Record / Target</th>
              <th className="p-3">Result</th>
              <th className="p-3">Reason / Basis</th>
              <th className="p-3 font-mono text-right">Session ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                <td className="p-3 font-mono text-neutral-500 text-[11px] whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="p-3">
                  <div className="font-bold text-neutral-900 dark:text-white">{log.user}</div>
                  <div className="text-[10px] font-mono text-neutral-500">{log.role}</div>
                </td>
                <td className="p-3 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                  {log.action}
                </td>
                <td className="p-3 font-mono text-neutral-600 dark:text-neutral-400 text-[11px]">
                  {log.record}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded font-mono text-[10px] font-bold">
                    {log.result}
                  </span>
                </td>
                <td className="p-3 text-neutral-700 dark:text-neutral-300 text-[11px] max-w-xs">
                  {log.reason}
                </td>
                <td className="p-3 font-mono text-right text-neutral-400 text-[10px]">
                  {log.sessionId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
