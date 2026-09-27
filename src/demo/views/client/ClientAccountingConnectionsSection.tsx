import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  Lock,
  Download,
  Settings,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Plus,
  Trash2,
  Info
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientAccountingConnectionsSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
}

export const ClientAccountingConnectionsSection: React.FC<ClientAccountingConnectionsSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant
}) => {
  const [activeTab, setActiveTab] = useState<'cloud_software' | 'coa_mapping' | 'manual_import' | 'sync_logs'>('cloud_software');
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Accounting software connections
  const [connections, setConnections] = useState([
    {
      id: 'conn_qbo_01',
      softwareName: 'Intuit QuickBooks Online (Advanced)',
      logo: 'QBO',
      companyRealmId: '9130352948102948',
      entityTarget: 'Perotti Capital Holdings LLC',
      status: 'Connected & Synced' as 'Connected & Synced' | 'Reauth Required' | 'Disconnected',
      syncDirection: 'Read-Only Pull to A/R Tax Workpapers',
      lastSync: 'Today at 04:30 AM EST',
      nextSync: 'Tomorrow at 04:30 AM EST',
      chartOfAccountsCount: 68,
      classesTracked: 4,
      locationsTracked: 2,
      projectsTracked: 3,
      scope: 'General Ledger, Trial Balance, Invoices, Vendor Expenses, Balance Sheet'
    },
    {
      id: 'conn_xero_02',
      softwareName: 'Xero Accounting',
      logo: 'XRO',
      companyRealmId: 'palmetto-point-prod',
      entityTarget: 'Palmetto Point Real Estate Partners, LLC',
      status: 'Connected & Synced',
      syncDirection: 'Read-Only Pull to A/R Tax Workpapers',
      lastSync: 'Yesterday at 11:15 PM EST',
      nextSync: 'Tonight at 11:15 PM EST',
      chartOfAccountsCount: 42,
      classesTracked: 0,
      locationsTracked: 1,
      projectsTracked: 2,
      scope: 'General Ledger, Asset Register, Rent Roll Invoicing'
    }
  ]);

  // Chart of accounts tax line mapping preview
  const coaMappings = [
    { qboCode: '4010', qboName: 'Advisory & Fee Income', taxSchedule: 'Form 1120-S Page 1', taxLine: 'Line 1a (Gross Receipts)', status: 'Verified' },
    { qboCode: '5010', qboName: 'Officer Salary - Michael', taxSchedule: 'Form 1120-S Page 1', taxLine: 'Line 7 (Compensation of Officers)', status: 'Verified' },
    { qboCode: '5120', qboName: 'Officer Health Plan', taxSchedule: 'Form 1120-S Page 1', taxLine: 'Line 7 / Form 1040 Line 17 (Self-Employed Health)', status: 'Verified' },
    { qboCode: '6200', qboName: 'Legal & Accounting', taxSchedule: 'Form 1120-S Page 1', taxLine: 'Line 19 (Other Deductions - Professional)', status: 'Verified' },
    { qboCode: '6300', qboName: 'Facility Rent', taxSchedule: 'Form 1120-S Page 1', taxLine: 'Line 11 (Rents)', status: 'Verified' },
    { qboCode: '6380', qboName: '50% Client Meals', taxSchedule: 'Schedule M-1', taxLine: 'Line 4b (Travel & Entertainment M-1 Adjustment)', status: 'Verified' },
    { qboCode: '6500', qboName: 'Depreciation Expense', taxSchedule: 'Form 1120-S & Form 4562', taxLine: 'Line 14 (Depreciation not claimed on Form 1125-A)', status: 'Verified' }
  ];

  // Sync log entries
  const syncLogs = [
    { timestamp: '2026-02-19 04:30:12', software: 'QBO', event: 'Scheduled Daily Sync', itemsSynced: '68 COA accounts, 1,248 ledger entries', status: 'Success' },
    { timestamp: '2026-02-18 23:15:04', software: 'Xero', event: 'Nightly Trial Balance Pull', itemsSynced: '42 COA accounts, 412 transactions', status: 'Success' },
    { timestamp: '2026-02-17 14:10:22', software: 'QBO', event: 'Manual Reconciliation Sync', itemsSynced: '14 newly classified entries', status: 'Success' }
  ];

  const handleTriggerSync = (name: string) => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setActionNotice(`Accounting synchronization completed for ${name}. Trial balance reconciled with zero variances.`);
      demoDataStore.logAudit({
        user: 'Michael Perotti',
        role: 'client',
        action: 'Triggered Accounting Software Re-Sync',
        record: name,
        result: 'Success (Simulated)',
        reason: 'Client refreshed cloud ledger mapping'
      });
      setTimeout(() => setActionNotice(null), 5000);
    }, 1200);
  };

  const handleUploadWorkbook = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setActionNotice(`Workbook "${file.name}" uploaded successfully. Mapped 54 raw trial balance rows.`);
      demoDataStore.logAudit({
        user: 'Michael Perotti',
        role: 'client',
        action: 'Uploaded Accounting File (Excel/IIF)',
        record: file.name,
        result: 'Success (Simulated)',
        reason: 'Offline bookkeeping file ingestion'
      });
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  return (
    <div className="space-y-6" id="client-accounting-connections-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Accounting Software Bridge
              </span>
              <span className="text-xs text-[#667085]">QuickBooks &bull; Xero &bull; Trial Balance Ingestion</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Accounting Software Connections &amp; COA Mapping
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Automated read-only synchronization of general ledgers, trial balance charts, class tags, and tax schedule bridges.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTriggerSync('All Linked Platforms')}
              disabled={isSyncing}
              className="px-3.5 py-2 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync All Ledgers</span>
            </button>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{actionNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Tax mapping updated</span>
          </div>
        )}

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">QBO Integration</span>
            <span className="text-base font-bold text-[#1B5E20] mt-0.5 block flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active Read-Only
            </span>
            <span className="text-[10px] text-[#667085]">Realm: 9130352948102948</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Chart of Accounts</span>
            <span className="text-base font-bold text-[#061A2F] mt-0.5 block">110 Total Accounts</span>
            <span className="text-[10px] text-[#667085]">100% Tax Line Mapped</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Class &amp; Location Tags</span>
            <span className="text-base font-bold text-[#061A2F] mt-0.5 block">5 Classes &bull; 3 Locations</span>
            <span className="text-[10px] text-[#667085]">Used for State Apportionment</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Schedule M-1 Bridge</span>
            <span className="text-base font-bold text-[#1B5E20] mt-0.5 block">Automated Tie-Out</span>
            <span className="text-[10px] text-[#667085]">Book vs Tax Reconciliation</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D8DCE2] bg-white px-4 rounded-t-lg">
        {[
          { id: 'cloud_software', label: 'Cloud Software Connections', icon: Layers },
          { id: 'coa_mapping', label: 'Chart of Accounts Tax Mapping', icon: FileSpreadsheet },
          { id: 'manual_import', label: 'Manual File Import (Excel / IIF)', icon: UploadCloud },
          { id: 'sync_logs', label: 'Synchronization Audit Logs', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#061A2F] text-[#061A2F]'
                  : 'border-transparent text-[#667085] hover:text-[#061A2F]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C99A32]' : 'text-[#667085]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CLOUD SOFTWARE */}
      {activeTab === 'cloud_software' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4">
          <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#061A2F]">Connected Cloud Accounting Systems</h3>
              <p className="text-xs text-[#667085]">Synchronized with Intuit and Xero developer APIs.</p>
            </div>
            <button
              onClick={() => alert('Add Accounting Platform modal: QBO, Xero, FreshBooks, Wave.')}
              className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Another Software</span>
            </button>
          </div>

          <div className="space-y-4">
            {connections.map(conn => (
              <div key={conn.id} className="border border-[#D8DCE2] rounded-lg p-5 bg-[#FBFAF7] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-[#061A2F] text-[#E8C66A] flex items-center justify-center font-bold font-mono text-xs">
                      {conn.logo}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[#061A2F]">{conn.softwareName}</h4>
                        <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-bold">
                          {conn.status}
                        </span>
                      </div>
                      <div className="text-xs text-[#667085]">
                        Entity: <strong className="text-[#061A2F]">{conn.entityTarget}</strong> &bull; Realm ID: <span className="font-mono">{conn.companyRealmId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTriggerSync(conn.softwareName)}
                      className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F] flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Re-Sync Now</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[#667085]">
                  <div>
                    <span className="text-[10px] font-mono uppercase block">Integration Mode</span>
                    <span className="text-[#061A2F] font-semibold">{conn.syncDirection}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase block">Last Sync Execution</span>
                    <span className="text-[#061A2F] font-mono text-[11px]">{conn.lastSync}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase block">COA Mapped Accounts</span>
                    <span className="text-[#1B5E20] font-bold font-mono">{conn.chartOfAccountsCount} Accounts</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase block">Apportionment Dimensions</span>
                    <span className="text-[#061A2F] font-medium">{conn.classesTracked} Classes &bull; {conn.locationsTracked} Locations</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: COA TAX MAPPING */}
      {activeTab === 'coa_mapping' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4">
          <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#061A2F]">Chart of Accounts to Statutory Tax Lines</h3>
              <p className="text-xs text-[#667085]">Direct bridge connecting bookkeeping categories to Form 1120-S and Schedule M-1.</p>
            </div>
            <span className="px-2.5 py-1 bg-[#FAF9F5] border border-[#C99A32] text-[#061A2F] rounded text-xs font-bold">
              100% Mapped to 2025 Return
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-[#D8DCE2]">
              <thead className="bg-[#FBFAF7] border-b border-[#D8DCE2] text-[#667085] uppercase text-[10px] font-mono">
                <tr>
                  <th className="p-3">QBO / Ledger Code</th>
                  <th className="p-3">Bookkeeping Account Name</th>
                  <th className="p-3">Tax Return Form</th>
                  <th className="p-3">Statutory Schedule &amp; Line</th>
                  <th className="p-3">Bridge State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DCE2]">
                {coaMappings.map(item => (
                  <tr key={item.qboCode} className="hover:bg-[#FAF9F5]">
                    <td className="p-3 font-mono text-[#061A2F] font-bold">{item.qboCode}</td>
                    <td className="p-3 font-medium text-[#061A2F]">{item.qboName}</td>
                    <td className="p-3 text-[#4B5563]">{item.taxSchedule}</td>
                    <td className="p-3 font-mono font-medium text-[#061A2F]">{item.taxLine}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-semibold">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MANUAL IMPORT */}
      {activeTab === 'manual_import' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-6">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Manual Ledger &amp; Trial Balance Ingestion</h3>
            <p className="text-xs text-[#667085]">
              Upload raw trial balance workbooks, QuickBooks Desktop exports (.IIF / .QBW backup), or CSV transaction registers.
            </p>
          </div>

          <div className="border-2 border-dashed border-[#D8DCE2] rounded-lg p-8 text-center bg-[#FBFAF7] hover:bg-[#FAF9F5] transition-colors">
            <UploadCloud className="w-10 h-10 text-[#C99A32] mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#061A2F]">Drag and Drop Accounting Files Here</h4>
            <p className="text-xs text-[#667085] mt-1 max-w-md mx-auto">
              Supports Excel (.xlsx, .xls), CSV, QuickBooks (.IIF), and Xero GL exports up to 100MB.
            </p>
            <div className="mt-4">
              <label className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded cursor-pointer hover:bg-[#0A2544] inline-block">
                <span>Select Accounting File</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.iif"
                  onChange={handleUploadWorkbook}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYNC LOGS */}
      {activeTab === 'sync_logs' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Synchronization History &amp; API Event Logs</h3>
            <p className="text-xs text-[#667085]">Immutable technical telemetry of data transmissions between accounting platforms.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-[#D8DCE2]">
              <thead className="bg-[#FBFAF7] border-b border-[#D8DCE2] text-[#667085] uppercase text-[10px] font-mono">
                <tr>
                  <th className="p-3">Execution Time</th>
                  <th className="p-3">Platform</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Items Transferred</th>
                  <th className="p-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DCE2]">
                {syncLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF9F5]">
                    <td className="p-3 font-mono text-[#667085]">{log.timestamp}</td>
                    <td className="p-3 font-bold text-[#061A2F]">{log.software}</td>
                    <td className="p-3 text-[#4B5563]">{log.event}</td>
                    <td className="p-3 font-mono text-[#061A2F]">{log.itemsSynced}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-semibold">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
