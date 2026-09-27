import React, { useState } from 'react';
import {
  Landmark,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  Building2,
  Activity,
  FileText,
  X
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientBankConnectionsSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
  onNavigateToBookkeeping?: () => void;
}

export const ClientBankConnectionsSection: React.FC<ClientBankConnectionsSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant,
  onNavigateToBookkeeping
}) => {
  // Connections state
  const [connections, setConnections] = useState([
    {
      id: 'bank_conn_01',
      institutionName: 'First Citizens Bank & Trust Company',
      institutionLogo: 'FCB',
      status: 'Healthy' as 'Healthy' | 'Needs Reauth' | 'Revoked' | 'Provider Outage',
      connectionMode: 'READ-ONLY AGGREGATION (OAUTH 2.0)',
      authorizedEntity: 'Perotti Capital Holdings LLC',
      authorizedAccounts: [
        {
          id: 'acc_01',
          name: 'Commercial Operating Checking',
          mask: '••••4912',
          type: 'Checking',
          balance: '$184,520.44',
          lastSync: 'Today at 06:00 AM EST',
          status: 'Active'
        },
        {
          id: 'acc_02',
          name: 'Commercial Money Market Sweep',
          mask: '••••8820',
          type: 'Money Market',
          balance: '$350,000.00',
          lastSync: 'Today at 06:00 AM EST',
          status: 'Active'
        }
      ],
      grantedScopes: ['Read Account Identification', 'Read Posted Transactions', 'Read Account Balances', 'Read Statement PDFs'],
      consentDate: '2025-01-10',
      consentExpires: '2026-01-10 (Auto-Renewed)',
      lastSuccessfulImport: '2026-02-19 06:00:14 EST',
      nextScheduledImport: '2026-02-20 06:00:00 EST',
      totalImportedTxns: 1248,
      syncSchedule: 'Daily at 06:00 EST'
    },
    {
      id: 'bank_conn_02',
      institutionName: 'American Express Corporate Cards',
      institutionLogo: 'AXP',
      status: 'Healthy',
      connectionMode: 'READ-ONLY AGGREGATION (OAUTH 2.0)',
      authorizedEntity: 'Perotti Capital Holdings LLC',
      authorizedAccounts: [
        {
          id: 'acc_03',
          name: 'Business Platinum Corporate Card',
          mask: '••••3008',
          type: 'Credit Card',
          balance: '$12,480.90',
          lastSync: 'Today at 06:00 AM EST',
          status: 'Active'
        }
      ],
      grantedScopes: ['Read Corporate Card Transactions', 'Read Monthly PDF Statements'],
      consentDate: '2025-02-01',
      consentExpires: '2026-02-01',
      lastSuccessfulImport: '2026-02-19 06:00:22 EST',
      nextScheduledImport: '2026-02-20 06:00:00 EST',
      totalImportedTxns: 842,
      syncSchedule: 'Daily at 06:00 EST'
    }
  ]);

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [wizardConsentAccepted, setWizardConsentAccepted] = useState(false);
  const [wizardEntity, setWizardEntity] = useState('Perotti Capital Holdings LLC');
  const [wizardDateRange, setWizardDateRange] = useState('2025-01-01 to Present');
  const [isSimulatingSync, setIsSimulatingSync] = useState(false);

  // Notice state
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Unbind Modal
  const [unbindModalOpen, setUnbindModalOpen] = useState(false);
  const [connToUnbind, setConnToUnbind] = useState<typeof connections[0] | null>(null);

  const handleManualSync = (id: string, name: string) => {
    setIsSimulatingSync(true);
    setTimeout(() => {
      setIsSimulatingSync(false);
      setActionNotice(`Manual feed refresh completed for ${name}. 14 new transactions imported into Bookkeeping register.`);
      demoDataStore.logAudit({
        user: 'Michael Perotti',
        role: 'client',
        action: 'Manual Bank Feed Refresh',
        record: name,
        result: 'Success (Simulated)',
        reason: 'Client requested real-time statement sync'
      });
      setTimeout(() => setActionNotice(null), 5000);
    }, 1000);
  };

  const handleConfirmUnbind = () => {
    if (!connToUnbind) return;

    setConnections(prev =>
      prev.map(c =>
        c.id === connToUnbind.id ? { ...c, status: 'Revoked' } : c
      )
    );

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Revoked Bank Account Connection (Unbound)',
      record: connToUnbind.institutionName,
      result: 'Success (Simulated)',
      reason: 'OAuth token destroyed. Future imports terminated. Prior verified book records preserved.'
    });

    setActionNotice(`Successfully unbound ${connToUnbind.institutionName}. Data access revoked. Historical accounting records remain preserved in your General Ledger.`);
    setUnbindModalOpen(false);
    setConnToUnbind(null);
    setTimeout(() => setActionNotice(null), 6000);
  };

  const handleCompleteWizard = () => {
    const newConn = {
      id: `bank_conn_${Date.now()}`,
      institutionName: selectedInstitution || 'Pinnacle Financial Partners',
      institutionLogo: 'PFP',
      status: 'Healthy' as const,
      connectionMode: 'READ-ONLY AGGREGATION (OAUTH 2.0)',
      authorizedEntity: wizardEntity,
      authorizedAccounts: [
        {
          id: `acc_${Date.now()}`,
          name: 'Business Commercial Checking',
          mask: '••••5591',
          type: 'Checking',
          balance: '$42,500.00',
          lastSync: 'Just now',
          status: 'Active'
        }
      ],
      grantedScopes: ['Read Account Identification', 'Read Posted Transactions', 'Read Account Balances'],
      consentDate: new Date().toISOString().split('T')[0],
      consentExpires: '1 Year from Authorization',
      lastSuccessfulImport: 'Just now (Initial Batch: 85 Txns)',
      nextScheduledImport: 'Tomorrow at 06:00 EST',
      totalImportedTxns: 85,
      syncSchedule: 'Daily at 06:00 EST'
    };

    setConnections(prev => [...prev, newConn]);

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Bound Read-Only Bank Connection',
      record: newConn.institutionName,
      result: 'Success (Simulated)',
      reason: `Initial feed linked for ${wizardEntity}. 85 transactions routed to Bookkeeping workspace.`
    });

    setIsWizardOpen(false);
    setWizardStep(1);
    setSelectedInstitution('');
    setWizardConsentAccepted(false);
    setActionNotice(`Successfully connected ${newConn.institutionName}! 85 transactions imported into your Bookkeeping register.`);
    setTimeout(() => setActionNotice(null), 6000);
  };

  return (
    <div className="space-y-6" id="client-bank-connections-section">
      {/* ABSOLUTE MANDATORY RESTRICTION BANNER */}
      <div className="bg-[#061A2F] border-2 border-[#C99A32] rounded-lg p-4 sm:p-5 text-[#F7F4ED] shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#031323] border border-[#C99A32] flex items-center justify-center flex-shrink-0 text-[#E8C66A]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#E8C66A] font-bold">
                Read-Only Data Access &bull; Fund Transfers Prohibited
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide mt-0.5">
                READ-ONLY DATA ACCESS — FUND TRANSFERS ARE NOT AVAILABLE.
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                This platform links directly with financial aggregators strictly to obtain electronic transaction feeds and statement PDFs for bookkeeping and reconciliation. A/R Tax Services, LLC never has access to your banking passwords and cannot initiate payments, wires, or account transfers.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2 bg-[#FAF9F5] hover:bg-[#E8C66A] text-[#061A2F] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Bank Feed</span>
          </button>
        </div>
      </div>

      {/* Action Notice */}
      {actionNotice && (
        <div className="p-3.5 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
            <span>{actionNotice}</span>
          </div>
          <span className="text-[10px] text-[#667085] font-mono">Immutable audit trail updated</span>
        </div>
      )}

      {/* Connected Financial Institutions List */}
      <div className="space-y-4">
        {connections.map(conn => {
          const isRevoked = conn.status === 'Revoked';
          return (
            <div
              key={conn.id}
              className={`bg-white rounded-lg border p-5 sm:p-6 shadow-xs space-y-4 transition-all ${
                isRevoked ? 'border-red-200 bg-red-50/20 opacity-75' : 'border-[#D8DCE2]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8DCE2] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded bg-[#FBFAF7] border border-[#D8DCE2] flex items-center justify-center font-bold font-mono text-sm text-[#061A2F]">
                    {conn.institutionLogo}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#061A2F]">{conn.institutionName}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        conn.status === 'Healthy'
                          ? 'bg-[#E8F5E9] text-[#1B5E20] border-[#C8E6C9]'
                          : conn.status === 'Revoked'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : 'bg-[#FFFDE7] text-[#F57F17] border-[#FFF59D]'
                      }`}>
                        {conn.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#667085] mt-0.5 flex flex-wrap items-center gap-2">
                      <span>Entity: <strong className="text-[#061A2F]">{conn.authorizedEntity}</strong></span>
                      <span>&bull;</span>
                      <span className="font-mono text-[11px] text-[#1B5E20] font-semibold">{conn.connectionMode}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isRevoked ? (
                    <>
                      <button
                        onClick={() => handleManualSync(conn.id, conn.institutionName)}
                        disabled={isSimulatingSync}
                        className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] text-xs font-medium text-[#061A2F] rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingSync ? 'animate-spin' : ''}`} />
                        <span>Refresh Feed</span>
                      </button>
                      <button
                        onClick={() => {
                          setConnToUnbind(conn);
                          setUnbindModalOpen(true);
                        }}
                        className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Unbind / Revoke</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setConnections(prev =>
                          prev.map(c => c.id === conn.id ? { ...c, status: 'Healthy' } : c)
                        );
                        setActionNotice(`Reauthorized connection to ${conn.institutionName}. Data feed resumed.`);
                      }}
                      className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded"
                    >
                      Reauthorize Feed
                    </button>
                  )}
                </div>
              </div>

              {/* Linked Sub-Accounts */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#667085] tracking-wider block">
                  Authorized Sub-Accounts for Reconciliation
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {conn.authorizedAccounts.map(acc => (
                    <div key={acc.id} className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-[#061A2F]">{acc.name}</div>
                        <div className="text-[11px] font-mono text-[#667085]">
                          {acc.type} &bull; {acc.mask}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-[#061A2F]">{acc.balance}</div>
                        <div className="text-[10px] text-[#667085]">{acc.lastSync}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Audit & Sync Metadata */}
              <div className="border-t border-[#E5E7EB] pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[#667085]">
                <div>
                  <span className="text-[10px] font-mono uppercase block">Granted Scopes</span>
                  <span className="text-[#061A2F] font-medium block truncate" title={conn.grantedScopes.join(', ')}>
                    {conn.grantedScopes.length} Read-Only Scopes
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase block">Last Successful Sync</span>
                  <span className="text-[#061A2F] font-mono text-[11px] block">{conn.lastSuccessfulImport}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase block">Next Scheduled Sync</span>
                  <span className="text-[#061A2F] font-mono text-[11px] block">{conn.nextScheduledImport}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase block">Imported Historical Records</span>
                  <span className="text-[#1B5E20] font-bold font-mono block">{conn.totalImportedTxns} Transactions</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* WIZARD MODAL: CONNECT BANK FEED */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#C99A32] font-bold">
                  Step {wizardStep} of 4: Direct Aggregator Connect
                </span>
                <h3 className="text-sm font-bold text-[#061A2F] mt-0.5">
                  Link Financial Account (Read-Only)
                </h3>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="text-[#667085] hover:text-[#061A2F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Select Financial Institution */}
            {wizardStep === 1 && (
              <div className="space-y-4 text-xs">
                <p className="text-[#667085]">
                  Select your commercial bank or credit card provider to initialize read-only API aggregation:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'First Citizens Bank',
                    'Wells Fargo Commercial',
                    'Bank of America Merrill',
                    'JPMorgan Chase Commercial',
                    'Pinnacle Financial Partners',
                    'American Express Corporate'
                  ].map(bank => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => {
                        setSelectedInstitution(bank);
                        setWizardStep(2);
                      }}
                      className={`p-3 border rounded text-left transition-colors cursor-pointer ${
                        selectedInstitution === bank
                          ? 'border-[#061A2F] bg-[#FAF9F5] font-bold'
                          : 'border-[#D8DCE2] hover:border-[#061A2F]'
                      }`}
                    >
                      <div className="font-bold text-[#061A2F]">{bank}</div>
                      <div className="text-[10px] text-[#667085]">OAuth 2.0 Direct Feed</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Read-Only Disclosure & Consent */}
            {wizardStep === 2 && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded space-y-2">
                  <div className="flex items-center gap-2 text-[#061A2F] font-bold">
                    <ShieldCheck className="w-4 h-4 text-[#C99A32]" />
                    <span>Statutory Data Access Disclosure</span>
                  </div>
                  <p className="text-[11px] text-[#4B5563] leading-relaxed">
                    By proceeding, you authorize A/R Tax Services, LLC to receive <strong>read-only transaction histories and statement copies</strong> from <strong>{selectedInstitution}</strong>.
                  </p>
                  <ul className="text-[11px] list-disc list-inside text-[#667085] space-y-0.5">
                    <li>Zero-Credential Architecture: Bank credentials are never seen or stored.</li>
                    <li>No fund transfer, payment, or withdrawal capabilities exist.</li>
                    <li>Authorization may be revoked at any time.</li>
                  </ul>
                </div>

                <label className="flex items-start gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={wizardConsentAccepted}
                    onChange={e => setWizardConsentAccepted(e.target.checked)}
                    className="mt-0.5 rounded text-[#061A2F]"
                  />
                  <span className="text-[11px] text-[#061A2F] font-medium">
                    I confirm that I am an authorized signor on this account and grant read-only access for bookkeeping and tax preparation.
                  </span>
                </label>

                <div className="flex justify-between pt-2 border-t border-[#D8DCE2]">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-3 py-1.5 border border-[#D8DCE2] rounded text-[#667085]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!wizardConsentAccepted}
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-1.5 bg-[#061A2F] text-white font-bold rounded disabled:opacity-50"
                  >
                    Authorize via Aggregator
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Entity & Date Range Assignment */}
            {wizardStep === 3 && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#061A2F] mb-1">Assign to Business Entity</label>
                  <select
                    value={wizardEntity}
                    onChange={e => setWizardEntity(e.target.value)}
                    className="w-full p-2 border border-[#D8DCE2] rounded bg-white"
                  >
                    <option value="Perotti Capital Holdings LLC">Perotti Capital Holdings LLC (EIN ••-•••2109)</option>
                    <option value="Palmetto Point Real Estate Partners, LLC">Palmetto Point Real Estate Partners, LLC (EIN ••-•••0384)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#061A2F] mb-1">Historical Date Range to Import</label>
                  <select
                    value={wizardDateRange}
                    onChange={e => setWizardDateRange(e.target.value)}
                    className="w-full p-2 border border-[#D8DCE2] rounded bg-white"
                  >
                    <option value="2025-01-01 to Present">Full Tax Year 2025 (Jan 1, 2025 – Present)</option>
                    <option value="Last 90 Days">Last 90 Days Only</option>
                    <option value="Past 2 Years">Past 2 Years (2024 &amp; 2025 for Audit Review)</option>
                  </select>
                </div>

                <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
                  <div className="font-bold text-[#061A2F]">Demonstration Feed Simulation:</div>
                  <div className="text-[11px] text-[#667085] mt-0.5">
                    Will stage 85 demonstration transactions into your Bookkeeping register for period reconciliation.
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-[#D8DCE2]">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-3 py-1.5 border border-[#D8DCE2] rounded text-[#667085]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteWizard}
                    className="px-4 py-1.5 bg-[#061A2F] text-white font-bold rounded"
                  >
                    Complete Linking &amp; Import Transactions
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UNBIND CONFIRMATION MODAL */}
      {unbindModalOpen && connToUnbind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="border-b border-[#D8DCE2] pb-3">
              <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Confirm Unbind: {connToUnbind.institutionName}</span>
              </h3>
            </div>

            <div className="space-y-3 text-xs text-[#4B5563]">
              <p>
                Unbinding this connection will immediately revoke future data synchronization and destroy the active OAuth aggregator token.
              </p>
              <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded text-[11px]">
                <strong className="text-[#061A2F] block mb-1">Preservation of Books of Account:</strong>
                Transactions and bank statements already reconciled into your official accounting ledgers and tax workpapers will remain preserved to comply with IRS statutory recordkeeping requirements (IRC § 6001).
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8DCE2]">
              <button
                type="button"
                onClick={() => setUnbindModalOpen(false)}
                className="px-3 py-1.5 border border-[#D8DCE2] rounded text-[#667085]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnbind}
                className="px-4 py-1.5 bg-red-700 text-white font-bold rounded hover:bg-red-800"
              >
                Confirm Unbind &amp; Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
