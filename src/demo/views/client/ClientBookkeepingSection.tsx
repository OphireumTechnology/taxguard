import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Lock,
  Plus,
  HelpCircle,
  Clock,
  Sparkles,
  Download,
  UploadCloud,
  ChevronRight,
  Eye,
  Edit3,
  Split,
  RefreshCw,
  Info
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';
import { DemoTransaction } from '../../types';

export interface ClientBookkeepingItem extends DemoTransaction {
  normalizedPayee: string;
  accountSource: string;
  debitCredit: 'Debit' | 'Credit';
  sourceDocRef?: string;
  reviewStatus: 'Approved' | 'Review Required' | 'Client Clarification' | 'Uncategorized';
  reconciliationStatus: 'Reconciled' | 'Pending Bank Feed' | 'Difference Found';
  taxScheduleRelevance?: string;
  taxRelevance?: string;
  isPeriodLocked?: boolean;
  clientQuestion?: string;
}

interface ClientBookkeepingSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
  onNavigateToVault?: () => void;
}

export const ClientBookkeepingSection: React.FC<ClientBookkeepingSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant,
  onNavigateToVault
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Uncategorized' | 'Approved' | 'Review Required' | 'Split'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('2025-Q4');
  const [selectedTxnIds, setSelectedTxnIds] = useState<string[]>([]);
  
  // Correction proposal modal state
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedTxnForCorrection, setSelectedTxnForCorrection] = useState<ClientBookkeepingItem | null>(null);
  const [proposedCategory, setProposedCategory] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitBusinessAmount, setSplitBusinessAmount] = useState<number>(0);
  const [splitPersonalAmount, setSplitPersonalAmount] = useState<number>(0);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Transactions list from demo store or seed
  const rawTransactions = useMemo(() => {
    return demoDataStore.getTransactions().filter(t => t.clientId === clientId);
  }, [clientId]);

  // Enhanced demo bookkeeping transactions with robust metadata
  const [bookkeepingTxns, setBookkeepingTxns] = useState<ClientBookkeepingItem[]>([
    {
      id: 'txn_bk_01',
      clientId,
      date: '2025-12-18',
      amount: 4250.00,
      description: 'AMEX CORP • COLUMBIA EXECUTIVE SUITES',
      normalizedPayee: 'Columbia Executive Suites LLC',
      category: 'Rent & Lease of Business Facilities',
      type: 'debit',
      confidence: 98,
      account: 'Operating Checking ••4912',
      status: 'Matched',
      receiptAttached: true,
      taxRelevance: 'Deductible (IRC § 162)',
      accountSource: 'Operating Checking ••4912',
      debitCredit: 'Debit',
      sourceDocRef: 'DOC-2025-LEASE-01.pdf',
      reviewStatus: 'Approved',
      reconciliationStatus: 'Reconciled',
      taxScheduleRelevance: 'Form 1120-S Line 11 (Rents)',
      isPeriodLocked: true
    },
    {
      id: 'txn_bk_02',
      clientId,
      date: '2025-12-22',
      amount: 850.00,
      description: 'DELTA AIR • TICKET 0062489012 ATL-DCA',
      normalizedPayee: 'Delta Air Lines',
      category: 'Business Travel (Airfare)',
      type: 'debit',
      confidence: 95,
      account: 'Corporate Amex ••3008',
      status: 'Matched',
      receiptAttached: true,
      taxRelevance: 'Deductible (IRC § 274)',
      accountSource: 'Corporate Amex ••3008',
      debitCredit: 'Debit',
      sourceDocRef: 'DOC-2025-TRAVEL-REC-44.pdf',
      reviewStatus: 'Approved',
      reconciliationStatus: 'Reconciled',
      taxScheduleRelevance: 'Form 1120-S Line 19 (Other Deductions)',
      isPeriodLocked: true
    },
    {
      id: 'txn_bk_03',
      clientId,
      date: '2025-12-29',
      amount: 14500.00,
      description: 'WIRE IN • PALMETTO HEALTH PARTNERS ADVISORY',
      normalizedPayee: 'Palmetto Health Partners',
      category: 'Gross Receipts / Advisory Fees',
      type: 'credit',
      confidence: 99,
      account: 'Operating Checking ••4912',
      status: 'Matched',
      receiptAttached: true,
      taxRelevance: 'Taxable Gross Receipts',
      accountSource: 'Operating Checking ••4912',
      debitCredit: 'Credit',
      sourceDocRef: 'INV-2025-089.pdf',
      reviewStatus: 'Approved',
      reconciliationStatus: 'Reconciled',
      taxScheduleRelevance: 'Form 1120-S Line 1a (Gross Receipts)',
      isPeriodLocked: true
    },
    {
      id: 'txn_bk_04',
      clientId,
      date: '2026-01-08',
      amount: 620.00,
      description: 'RUTH CHRIS STEAK HOUSE • CHARLOTTE NC',
      normalizedPayee: "Ruth's Chris Steak House",
      category: 'Business Meals (50% Limitation under § 274(n))',
      type: 'debit',
      confidence: 82,
      account: 'Corporate Amex ••3008',
      status: 'Needs Review',
      receiptAttached: false,
      taxRelevance: '50% Disallowed Non-Deductible (M-1 Book-Tax Adjustment)',
      accountSource: 'Corporate Amex ••3008',
      debitCredit: 'Debit',
      sourceDocRef: 'Pending Receipt Upload',
      reviewStatus: 'Review Required',
      reconciliationStatus: 'Reconciled',
      taxScheduleRelevance: 'Schedule M-1 Line 4b (Travel & Entertainment)',
      isPeriodLocked: false,
      clientQuestion: 'Please confirm names of prospective client attendees and business purpose discussed.'
    },
    {
      id: 'txn_bk_05',
      clientId,
      date: '2026-01-14',
      amount: 1850.00,
      description: 'APPLE STORE ONLINE • MACBOOK DOCK & MONITORS',
      normalizedPayee: 'Apple Inc.',
      category: 'Computer Equipment (De Minimis Safe Harbor § 1.263(a)-1(f))',
      type: 'debit',
      confidence: 88,
      account: 'Corporate Amex ••3008',
      status: 'Needs Review',
      receiptAttached: true,
      taxRelevance: 'Immediate Expense (De Minimis < $2,500)',
      accountSource: 'Corporate Amex ••3008',
      debitCredit: 'Debit',
      sourceDocRef: 'DOC-2026-APPLE-490.pdf',
      reviewStatus: 'Review Required',
      reconciliationStatus: 'Pending Bank Feed',
      taxScheduleRelevance: 'Form 1120-S Line 19 (Office & Tech Expense)',
      isPeriodLocked: false
    },
    {
      id: 'txn_bk_06',
      clientId,
      date: '2026-01-19',
      amount: 3200.00,
      description: 'FIRST CITIZENS COMMERCIAL LOAN • PMT 004819',
      normalizedPayee: 'First Citizens Bank',
      category: 'Split: Principal Paydown ($2,400) & Interest Expense ($800)',
      type: 'debit',
      confidence: 94,
      account: 'Operating Checking ••4912',
      status: 'Categorized',
      receiptAttached: true,
      taxRelevance: 'Interest Deductible / Principal Balance Sheet Reduction',
      accountSource: 'Operating Checking ••4912',
      debitCredit: 'Debit',
      sourceDocRef: 'LOAN-STMT-JAN-2026.pdf',
      reviewStatus: 'Approved',
      reconciliationStatus: 'Reconciled',
      taxScheduleRelevance: 'Form 1120-S Line 13 (Interest Expense)',
      isPeriodLocked: false
    },
    {
      id: 'txn_bk_07',
      clientId,
      date: '2026-01-24',
      amount: 980.00,
      description: 'CHEVRON 00492 • FUEL & CONVENIENCE',
      normalizedPayee: 'Chevron Station 00492',
      category: 'Uncategorized Expense / Personal Review Required',
      type: 'debit',
      confidence: 65,
      account: 'Operating Checking ••4912',
      status: 'Exception',
      receiptAttached: false,
      taxRelevance: 'Potentially Personal Non-Deductible',
      accountSource: 'Operating Checking ••4912',
      debitCredit: 'Debit',
      sourceDocRef: 'None attached',
      reviewStatus: 'Client Clarification',
      reconciliationStatus: 'Pending Bank Feed',
      taxScheduleRelevance: 'Pending Owner Clarification',
      isPeriodLocked: false,
      clientQuestion: 'Was this fuel for business fleet vehicle or personal commuting?'
    }
  ]);

  const filteredTxns = useMemo(() => {
    return bookkeepingTxns.filter(t => {
      const matchesSearch = 
        (t.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.normalizedPayee?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.category?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = 
        statusFilter === 'ALL' ? true :
        statusFilter === 'Uncategorized' ? t.category.includes('Uncategorized') :
        statusFilter === 'Approved' ? t.reviewStatus === 'Approved' :
        statusFilter === 'Review Required' ? (t.reviewStatus === 'Review Required' || t.reviewStatus === 'Client Clarification') :
        statusFilter === 'Split' ? t.category.includes('Split') : true;

      return matchesSearch && matchesStatus;
    });
  }, [bookkeepingTxns, searchQuery, statusFilter]);

  const handleOpenCorrection = (txn: typeof bookkeepingTxns[0]) => {
    setSelectedTxnForCorrection(txn);
    setProposedCategory(txn.category);
    setCorrectionNote('');
    setIsSplitMode(false);
    setSplitBusinessAmount(txn.amount);
    setSplitPersonalAmount(0);
    setIsCorrectionModalOpen(true);
  };

  const handleSaveCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxnForCorrection) return;

    if (selectedTxnForCorrection.isPeriodLocked) {
      alert('This transaction is in an accountant-approved, locked accounting period (2025-Q4). Changes will be submitted as an adjustment request to Elena Rostova, CPA.');
    }

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Submitted Bookkeeping Classification Proposal',
      record: `Txn: ${selectedTxnForCorrection.id} (${selectedTxnForCorrection.normalizedPayee})`,
      result: 'Success (Simulated)',
      reason: isSplitMode 
        ? `Split: $${splitBusinessAmount} Business, $${splitPersonalAmount} Personal. Note: ${correctionNote}`
        : `Proposed Category: ${proposedCategory}. Note: ${correctionNote}`
    });

    setActionSuccessNotice(`Classification proposal for "${selectedTxnForCorrection.normalizedPayee}" submitted to CPA Elena Rostova.`);
    setIsCorrectionModalOpen(false);
    setTimeout(() => setActionSuccessNotice(null), 5000);
  };

  const toggleSelectAll = () => {
    if (selectedTxnIds.length === filteredTxns.length) {
      setSelectedTxnIds([]);
    } else {
      setSelectedTxnIds(filteredTxns.map(t => t.id));
    }
  };

  return (
    <div className="space-y-6" id="client-bookkeeping-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Books of Account
              </span>
              <span className="text-xs text-[#667085]">Verified Transaction Register &amp; General Ledger</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Bookkeeping &amp; Transaction Register
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Review classified business receipts, vendor disbursements, credit card activity, and split schedules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('Simulated CSV export generated for active register.')}
              className="px-3.5 py-2 border border-[#D8DCE2] hover:border-[#061A2F] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer text-[#061A2F]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            {onOpenAssistant && (
              <button
                onClick={onOpenAssistant}
                className="p-2 border border-[#C99A32] text-[#C99A32] hover:bg-[#FAF9F5] rounded transition-colors"
                title="Ask TaxGuard about tax deductibility"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Action Notice */}
        {actionSuccessNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{actionSuccessNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Logged to audit trail</span>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Locked Period</span>
            <span className="text-base font-bold text-[#061A2F] mt-0.5 block flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#1B5E20]" />
              2025 Closed &amp; Locked
            </span>
            <span className="text-[10px] text-[#667085]">Period ending Dec 31, 2025</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Current Open Period</span>
            <span className="text-base font-bold text-[#061A2F] mt-0.5 block">2026-Q1 (In Review)</span>
            <span className="text-[10px] text-[#1B5E20]">Bank Feeds Synchronized</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Client Questions Pending</span>
            <span className="text-base font-bold text-[#C99A32] mt-0.5 block">2 Items</span>
            <span className="text-[10px] text-[#667085]">Requires business purpose note</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Chart of Accounts Mapping</span>
            <span className="text-base font-bold text-[#1B5E20] mt-0.5 block">100% Tied</span>
            <span className="text-[10px] text-[#667085]">Direct Schedule C/1120-S Bridge</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#667085] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by payee, description, or category..."
              className="w-full pl-9 pr-3 py-1.5 border border-[#D8DCE2] rounded text-xs focus:outline-none focus:border-[#061A2F]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="p-1.5 border border-[#D8DCE2] rounded text-xs bg-white text-[#061A2F]"
          >
            <option value="ALL">All Categories &amp; Statuses</option>
            <option value="Approved">Approved by CPA</option>
            <option value="Review Required">Clarification Required</option>
            <option value="Split">Split Transactions</option>
            <option value="Uncategorized">Uncategorized</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {selectedTxnIds.length > 0 && (
            <button
              onClick={() => alert(`Bulk confirmation requested for ${selectedTxnIds.length} transactions.`)}
              className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded"
            >
              Bulk Clarify ({selectedTxnIds.length})
            </button>
          )}
          <span className="text-xs text-[#667085] font-mono">
            Showing {filteredTxns.length} of {bookkeepingTxns.length} records
          </span>
        </div>
      </div>

      {/* Transaction Register Table */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FBFAF7] border-b border-[#D8DCE2] text-[#667085] uppercase text-[10px] font-mono">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedTxnIds.length > 0 && selectedTxnIds.length === filteredTxns.length}
                    onChange={toggleSelectAll}
                    className="rounded text-[#061A2F]"
                  />
                </th>
                <th className="p-3">Posting Date</th>
                <th className="p-3">Payee / Description</th>
                <th className="p-3">Account</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3">Chart of Accounts Category</th>
                <th className="p-3">Tax Relevance</th>
                <th className="p-3">Review State</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8DCE2]">
              {filteredTxns.map(txn => {
                const isSelected = selectedTxnIds.includes(txn.id);
                return (
                  <tr key={txn.id} className={`hover:bg-[#FAF9F5] ${isSelected ? 'bg-[#FAF9F5]' : ''}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedTxnIds(prev =>
                            prev.includes(txn.id) ? prev.filter(i => i !== txn.id) : [...prev, txn.id]
                          );
                        }}
                        className="rounded text-[#061A2F]"
                      />
                    </td>
                    <td className="p-3 font-mono text-[#061A2F] whitespace-nowrap">
                      {txn.date}
                      {txn.isPeriodLocked && (
                        <span title="Period locked" className="ml-1 text-[#1B5E20]">🔒</span>
                      )}
                    </td>
                    <td className="p-3 max-w-xs">
                      <div className="font-bold text-[#061A2F] truncate">{txn.normalizedPayee}</div>
                      <div className="text-[10px] text-[#667085] font-mono truncate">{txn.description}</div>
                      {txn.clientQuestion && (
                        <div className="mt-1 p-1.5 bg-[#FFFDE7] border border-[#FFF59D] rounded text-[10px] text-[#795548] font-medium flex items-start gap-1">
                          <HelpCircle className="w-3 h-3 text-[#F57F17] flex-shrink-0 mt-0.5" />
                          <span>{txn.clientQuestion}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[#667085] whitespace-nowrap">{txn.accountSource}</td>
                    <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                      txn.debitCredit === 'Credit' ? 'text-[#1B5E20]' : 'text-[#061A2F]'
                    }`}>
                      {txn.debitCredit === 'Credit' ? '+' : '-'}${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-[#061A2F]">{txn.category}</div>
                      <div className="text-[10px] text-[#667085]">{txn.taxScheduleRelevance}</div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] px-2 py-0.5 bg-[#FBFAF7] border border-[#D8DCE2] rounded text-[#4B5563]">
                        {txn.taxRelevance}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        txn.reviewStatus === 'Approved'
                          ? 'bg-[#E8F5E9] text-[#1B5E20] border-[#C8E6C9]'
                          : txn.reviewStatus === 'Client Clarification'
                          ? 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2]'
                          : 'bg-[#FFFDE7] text-[#F57F17] border-[#FFF59D]'
                      }`}>
                        {txn.reviewStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenCorrection(txn)}
                        className="px-2.5 py-1 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-[11px] font-medium text-[#061A2F]"
                      >
                        {txn.reviewStatus === 'Approved' ? 'Suggest Adjustment' : 'Clarify / Classify'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-[#FBFAF7] border-t border-[#D8DCE2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#667085]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#061A2F]" />
            <span>
              <strong>Professional Standard:</strong> Client changes to general ledger entries submit correction requests to Elena Rostova, CPA. Locked periods cannot be altered directly.
            </span>
          </div>
          <span className="font-mono text-[11px]">Reconciliation Engine v4.2 • Trial Balance in Balance</span>
        </div>
      </div>

      {/* CORRECTION / CLARIFICATION MODAL */}
      {isCorrectionModalOpen && selectedTxnForCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="border-b border-[#D8DCE2] pb-3">
              <div className="text-[10px] font-mono uppercase text-[#C99A32] font-bold">
                {selectedTxnForCorrection.isPeriodLocked ? 'Locked Period Adjustment' : 'Transaction Clarification'}
              </div>
              <h3 className="text-sm font-bold text-[#061A2F] mt-0.5">
                Clarify Classification: {selectedTxnForCorrection.normalizedPayee}
              </h3>
              <p className="text-xs text-[#667085]">
                Amount: ${selectedTxnForCorrection.amount.toFixed(2)} on {selectedTxnForCorrection.date}
              </p>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4 text-xs">
              {selectedTxnForCorrection.clientQuestion && (
                <div className="p-3 bg-[#FFFDE7] border border-[#FFF59D] rounded text-xs text-[#795548]">
                  <strong className="block text-[#5D4037] mb-1">Accountant Question:</strong>
                  {selectedTxnForCorrection.clientQuestion}
                </div>
              )}

              <div className="flex items-center justify-between bg-[#FBFAF7] p-3 rounded border border-[#E5E7EB]">
                <div>
                  <div className="font-bold text-[#061A2F]">Split Transaction</div>
                  <div className="text-[11px] text-[#667085]">Split between Business Expense and Owner Personal Draw</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSplitMode(!isSplitMode)}
                  className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                    isSplitMode ? 'bg-[#061A2F] text-white border-[#061A2F]' : 'bg-white text-[#061A2F] border-[#D8DCE2]'
                  }`}
                >
                  {isSplitMode ? 'Split Mode Active' : 'Enable Split'}
                </button>
              </div>

              {isSplitMode ? (
                <div className="space-y-3 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-[#061A2F] mb-1">Business Deductible ($)</label>
                      <input
                        type="number"
                        value={splitBusinessAmount}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setSplitBusinessAmount(val);
                          setSplitPersonalAmount(Math.max(0, selectedTxnForCorrection.amount - val));
                        }}
                        className="w-full p-2 border border-[#D8DCE2] rounded bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#061A2F] mb-1">Personal Draw ($)</label>
                      <input
                        type="number"
                        value={splitPersonalAmount}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setSplitPersonalAmount(val);
                          setSplitBusinessAmount(Math.max(0, selectedTxnForCorrection.amount - val));
                        }}
                        className="w-full p-2 border border-[#D8DCE2] rounded bg-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-[#667085] flex justify-between">
                    <span>Total: ${selectedTxnForCorrection.amount.toFixed(2)}</span>
                    <span className="text-[#1B5E20] font-semibold">Tied to transaction total</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-[#061A2F] mb-1">Suggested Bookkeeping Account</label>
                  <select
                    value={proposedCategory}
                    onChange={e => setProposedCategory(e.target.value)}
                    className="w-full p-2 border border-[#D8DCE2] rounded bg-white"
                    required
                  >
                    <option value="Rent & Lease of Business Facilities">Rent &amp; Lease of Business Facilities</option>
                    <option value="Business Travel (Airfare & Lodging)">Business Travel (Airfare &amp; Lodging)</option>
                    <option value="Business Meals (50% Disallowance)">Business Meals (50% Disallowance)</option>
                    <option value="Office & Tech Supplies (De Minimis)">Office &amp; Tech Supplies (De Minimis)</option>
                    <option value="Legal & Professional Fees">Legal &amp; Professional Fees</option>
                    <option value="Owner Distribution / Personal Draw">Owner Distribution / Personal Draw (Non-Deductible)</option>
                    <option value="Loan Principal Payment">Loan Principal Payment (Liability Reduction)</option>
                    <option value="Vehicle Operating Expenses">Vehicle Operating Expenses</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-[#061A2F] mb-1">Client Business Note / Substantiation</label>
                <textarea
                  value={correctionNote}
                  onChange={e => setCorrectionNote(e.target.value)}
                  placeholder="State the business purpose, client attendee names, or reason for this entry..."
                  className="w-full p-2 border border-[#D8DCE2] rounded bg-white h-20"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8DCE2]">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="px-4 py-2 border border-[#D8DCE2] rounded text-[#667085] hover:text-[#061A2F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white font-bold rounded hover:bg-[#0A2544]"
                >
                  Submit Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
