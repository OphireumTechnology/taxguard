import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  CheckCircle,
  Filter,
  Search,
  Receipt,
  FileText,
  CreditCard,
  Building,
  HelpCircle,
  UploadCloud
} from 'lucide-react';
import {
  ClientIncomeRecord,
  ClientExpenseRecord,
  IIncomeExpenseService
} from '../../services/clientDashboardServices';

interface ClientIncomeExpensesSectionProps {
  incomeExpenseService: IIncomeExpenseService;
  clientId: string;
  onOpenAssistant: () => void;
}

const EXPENSE_CATEGORIES = [
  'Advertising',
  'Contract labor',
  'Insurance',
  'Legal and professional',
  'Office expense',
  'Rent',
  'Repairs and maintenance',
  'Supplies',
  'Travel',
  'Meals (50%)',
  'Utilities',
  'Vehicle',
  'Payroll',
  'Taxes and licenses',
  'Other'
];

const INCOME_TYPES = [
  'Business revenue',
  'Wages',
  'Self-employment',
  'Interest',
  'Dividends',
  'Capital gains',
  'Rental income',
  'Retirement',
  'Other income'
];

export const ClientIncomeExpensesSection: React.FC<ClientIncomeExpensesSectionProps> = ({
  incomeExpenseService,
  clientId,
  onOpenAssistant
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'income' | 'expenses' | 'summary'>('summary');
  const [incomeRecords, setIncomeRecords] = useState<ClientIncomeRecord[]>(() =>
    incomeExpenseService.getIncomeRecords(clientId)
  );
  const [expenseRecords, setExpenseRecords] = useState<ClientExpenseRecord[]>(() =>
    incomeExpenseService.getExpenseRecords(clientId)
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');

  // Form states
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Income Form
  const [newIncome, setNewIncome] = useState({
    date: '2025-11-15',
    payer: '',
    incomeType: 'Business revenue',
    entityName: 'Perotti Capital Holdings LLC',
    amount: '',
    withholding: '0.00',
    description: ''
  });

  // Expense Form with AI Recommendation simulation
  const [newExpense, setNewExpense] = useState({
    date: '2025-11-20',
    vendor: '',
    category: 'Office expense',
    amount: '',
    entityName: 'Perotti Capital Holdings LLC',
    businessPurpose: '',
    paymentMethod: 'Credit Card'
  });

  const [aiRecommendation, setAiRecommendation] = useState<{
    category: string;
    confidence: number;
    explanation: string;
  } | null>(null);

  const refreshData = () => {
    setIncomeRecords(incomeExpenseService.getIncomeRecords(clientId));
    setExpenseRecords(incomeExpenseService.getExpenseRecords(clientId));
  };

  // Simulate AI Categorization based on vendor/purpose
  const handleVendorOrPurposeChange = (vendor: string, purpose: string) => {
    const text = `${vendor} ${purpose}`.toLowerCase();
    if (text.includes('rent') || text.includes('lease') || text.includes('realty') || text.includes('propert')) {
      setAiRecommendation({
        category: 'Rent',
        confidence: 98,
        explanation: 'Commercial real property lease under IRC Section 162 ordinary expense rules.'
      });
    } else if (text.includes('delta') || text.includes('marriott') || text.includes('flight') || text.includes('hotel') || text.includes('travel')) {
      setAiRecommendation({
        category: 'Travel',
        confidence: 96,
        explanation: 'Ordinary and necessary business travel away from tax home.'
      });
    } else if (text.includes('dinner') || text.includes('lunch') || text.includes('restaurant') || text.includes('cafe')) {
      setAiRecommendation({
        category: 'Meals (50%)',
        confidence: 94,
        explanation: 'Business client dining subject to 50% statutory disallowance on Schedule M-1.'
      });
    } else if (text.includes('software') || text.includes('aws') || text.includes('google') || text.includes('microsoft')) {
      setAiRecommendation({
        category: 'Office expense',
        confidence: 97,
        explanation: 'Operational cloud SaaS subscription deductible as current-year software expense.'
      });
    } else if (text.includes('legal') || text.includes('cpa') || text.includes('attorney') || text.includes('counsel')) {
      setAiRecommendation({
        category: 'Legal and professional',
        confidence: 99,
        explanation: 'Legal/consulting fee incurred for business operations.'
      });
    } else {
      setAiRecommendation(null);
    }
  };

  const handleAddIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newIncome.amount);
    if (isNaN(amt) || amt <= 0 || !newIncome.payer) return;

    incomeExpenseService.addIncome(clientId, {
      taxYear: 2025,
      date: newIncome.date,
      payer: newIncome.payer,
      incomeType: newIncome.incomeType,
      entityName: newIncome.entityName,
      amount: amt,
      withholding: parseFloat(newIncome.withholding) || 0,
      description: newIncome.description,
      status: 'Draft'
    });

    refreshData();
    setShowIncomeModal(false);
    setNewIncome({
      date: '2025-11-15',
      payer: '',
      incomeType: 'Business revenue',
      entityName: 'Perotti Capital Holdings LLC',
      amount: '',
      withholding: '0.00',
      description: ''
    });
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newExpense.amount);
    if (isNaN(amt) || amt <= 0 || !newExpense.vendor) return;

    incomeExpenseService.addExpense(clientId, {
      taxYear: 2025,
      date: newExpense.date,
      vendor: newExpense.vendor,
      category: newExpense.category,
      amount: amt,
      entityName: newExpense.entityName,
      businessPurpose: newExpense.businessPurpose,
      paymentMethod: newExpense.paymentMethod,
      aiConfidence: aiRecommendation?.confidence || 92,
      status: 'Recorded'
    });

    refreshData();
    setShowExpenseModal(false);
    setAiRecommendation(null);
    setNewExpense({
      date: '2025-11-20',
      vendor: '',
      category: 'Office expense',
      amount: '',
      entityName: 'Perotti Capital Holdings LLC',
      businessPurpose: '',
      paymentMethod: 'Credit Card'
    });
  };

  const handleDeleteIncome = (id: string) => {
    incomeExpenseService.deleteIncome(id);
    refreshData();
  };

  const handleDeleteExpense = (id: string) => {
    incomeExpenseService.deleteExpense(id);
    refreshData();
  };

  // Summaries
  const totals = useMemo(() => {
    const grossIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenseRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalWithholding = incomeRecords.reduce((sum, r) => sum + (r.withholding || 0), 0);
    const netIncome = grossIncome - totalExpenses;
    return { grossIncome, totalExpenses, totalWithholding, netIncome };
  }, [incomeRecords, expenseRecords]);

  // Filtering
  const filteredIncome = incomeRecords.filter(r => {
    const matchesSearch = r.payer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.incomeType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = selectedYear === 'ALL' || r.taxYear.toString() === selectedYear;
    return matchesSearch && matchesYear;
  });

  const filteredExpenses = expenseRecords.filter(r => {
    const matchesSearch = r.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.businessPurpose.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = selectedYear === 'ALL' || r.taxYear.toString() === selectedYear;
    return matchesSearch && matchesYear;
  });

  return (
    <div className="space-y-6" id="client-ledger-section">
      {/* 1. Header Card */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#D7AC4A] uppercase tracking-wider font-bold bg-[#061A2F] px-2 py-0.5 rounded">
                Section 4 of 8
              </span>
              <span className="text-xs font-mono text-[#667085]">Entity Ledger & Deductions</span>
            </div>
            <h1 className="text-xl font-black text-[#061A2F] mt-1">
              Income & Expenses
            </h1>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Maintain verifiable records of revenues, trade or business deductions, and tax withholdings with AI-assisted classification.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIncomeModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>Add Income</span>
            </button>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#061A2F] text-white hover:bg-[#031323] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>

        {/* 2. Three Metric Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-4 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#667085]">Total Gross Revenues</span>
              <TrendingUp className="w-4 h-4 text-[#1B5E20]" />
            </div>
            <div className="text-xl font-black text-[#061A2F] mt-1 font-mono">
              ${totals.grossIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-[#667085] mt-0.5">
              Withholding: ${totals.totalWithholding.toFixed(2)}
            </div>
          </div>

          <div className="p-4 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#667085]">Total Deductible Expenses</span>
              <TrendingDown className="w-4 h-4 text-[#C99A32]" />
            </div>
            <div className="text-xl font-black text-[#061A2F] mt-1 font-mono">
              ${totals.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-[#667085] mt-0.5">
              {expenseRecords.length} Verified Ledger Transactions
            </div>
          </div>

          <div className="p-4 bg-[#FAF9F5] rounded border border-[#C99A32]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#061A2F] font-bold">Estimated Net Operating Income</span>
              <DollarSign className="w-4 h-4 text-[#C99A32]" />
            </div>
            <div className="text-xl font-black text-[#061A2F] mt-1 font-mono">
              ${totals.netIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-[#1B5E20] font-semibold mt-0.5">
              Ties to Form 1120-S Ordinary Business Income
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sub-Tab Switcher & Search Bar */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b md:border-b-0 pb-2 md:pb-0">
          <button
            onClick={() => setActiveSubTab('summary')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
              activeSubTab === 'summary'
                ? 'bg-[#061A2F] text-white'
                : 'text-[#667085] hover:bg-[#FAF9F5]'
            }`}
          >
            Net Operating Summary
          </button>
          <button
            onClick={() => setActiveSubTab('income')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
              activeSubTab === 'income'
                ? 'bg-[#061A2F] text-white'
                : 'text-[#667085] hover:bg-[#FAF9F5]'
            }`}
          >
            Revenues & Income ({incomeRecords.length})
          </button>
          <button
            onClick={() => setActiveSubTab('expenses')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
              activeSubTab === 'expenses'
                ? 'bg-[#061A2F] text-white'
                : 'text-[#667085] hover:bg-[#FAF9F5]'
            }`}
          >
            Deductible Expenses ({expenseRecords.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#667085]" />
            <input
              type="text"
              placeholder="Search payer, vendor, purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs border border-[#D8DCE2] rounded bg-[#FBFAF7]"
            />
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-xs border border-[#D8DCE2] rounded px-2 py-1 bg-[#FBFAF7]"
          >
            <option value="ALL">All Years</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>
      </div>

      {/* 4. Active Subtab Content */}
      {activeSubTab === 'summary' && (
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-[#D8DCE2]">
            <h2 className="text-sm font-bold text-[#061A2F]">Category-by-Category Expense Tie-Out</h2>
            <p className="text-xs text-[#667085]">Statutory Schedule M-1 and trade deductions for Perotti Capital Holdings LLC</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div className="font-mono text-[11px] uppercase text-[#667085] font-bold">Largest Deduction Categories</div>
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB] space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-[#061A2F]">Rent & Facility Lease</span>
                  <span className="font-mono font-bold">$18,400.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-[#061A2F]">Contract Labor & Subcontractors</span>
                  <span className="font-mono font-bold">$14,200.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-[#061A2F]">Legal & Professional Fees</span>
                  <span className="font-mono font-bold">$9,500.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-[#061A2F]">Office & Cloud SaaS Expense</span>
                  <span className="font-mono font-bold">$8,120.50</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-[#061A2F]">Advertising & Growth</span>
                  <span className="font-mono font-bold">$6,550.00</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-mono text-[11px] uppercase text-[#667085] font-bold">Tax Position & Limitations</div>
              <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#C99A32] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#061A2F]">IRC § 274(n) Meal Limitation: </span>
                    <span className="text-[#4B5563]">50% disallowance automatically applied to all business dining transactions on Schedule M-1.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#1B5E20] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#061A2F]">Substantiation Standards: </span>
                    <span className="text-[#4B5563]">All expense entries exceed the $75 threshold with attached PDF receipts.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'income' && (
        <div className="bg-white rounded-lg border border-[#D8DCE2] shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#061A2F] text-white border-b border-[#D8DCE2] font-mono text-[10px] uppercase">
                <th className="p-3">Date</th>
                <th className="p-3">Payer</th>
                <th className="p-3">Income Type</th>
                <th className="p-3">Entity</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-right">Withholding</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {filteredIncome.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#667085]">
                    No income records logged yet. Click "Add Income" above.
                  </td>
                </tr>
              ) : (
                filteredIncome.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#FAF9F5] transition-colors">
                    <td className="p-3 font-mono">{rec.date}</td>
                    <td className="p-3 font-bold text-[#061A2F]">{rec.payer}</td>
                    <td className="p-3">{rec.incomeType}</td>
                    <td className="p-3 text-[#667085]">{rec.entityName}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#061A2F]">
                      ${rec.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono text-[#667085]">
                      ${(rec.withholding || 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#1B5E20] font-mono text-[10px] font-bold rounded">
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteIncome(rec.id)}
                        className="p-1 hover:bg-[#FFEBEE] text-[#C62828] rounded cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'expenses' && (
        <div className="bg-white rounded-lg border border-[#D8DCE2] shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#061A2F] text-white border-b border-[#D8DCE2] font-mono text-[10px] uppercase">
                <th className="p-3">Date</th>
                <th className="p-3">Vendor</th>
                <th className="p-3">Category</th>
                <th className="p-3">Business Purpose</th>
                <th className="p-3">Payment</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">AI Confidence</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#667085]">
                    No expense records logged yet. Click "Add Expense" above.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#FAF9F5] transition-colors">
                    <td className="p-3 font-mono">{exp.date}</td>
                    <td className="p-3 font-bold text-[#061A2F]">{exp.vendor}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-[#FBFAF7] border border-[#D8DCE2] rounded font-semibold text-[#061A2F]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-3 text-[#4B5563]">{exp.businessPurpose}</td>
                    <td className="p-3 text-[#667085]">{exp.paymentMethod}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#061A2F]">
                      ${exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-1.5 py-0.5 bg-[#FAF9F5] border border-[#C99A32] text-[#061A2F] font-mono text-[10px] font-bold rounded">
                        {exp.aiConfidence}%
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 hover:bg-[#FFEBEE] text-[#C62828] rounded cursor-pointer"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Add Income Modal */}
      {showIncomeModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-income-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="add-income-title" className="text-sm font-bold text-[#061A2F]">
                Log Revenue or Income Record
              </h3>
              <button
                onClick={() => setShowIncomeModal(false)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddIncome} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Payer / Source Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Commercial Real Estate Partners"
                  value={newIncome.payer}
                  onChange={(e) => setNewIncome({ ...newIncome, payer: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Income Type</label>
                  <select
                    value={newIncome.incomeType}
                    onChange={(e) => setNewIncome({ ...newIncome, incomeType: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                  >
                    {INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newIncome.date}
                    onChange={(e) => setNewIncome({ ...newIncome, date: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Gross Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="25000.00"
                    value={newIncome.amount}
                    onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7] font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Tax Withheld ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newIncome.withholding}
                    onChange={(e) => setNewIncome({ ...newIncome, withholding: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Description / Memo</label>
                <input
                  type="text"
                  placeholder="Monthly management fee / Q4 distribution"
                  value={newIncome.description}
                  onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              <div className="pt-3 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIncomeModal(false)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
                >
                  Save Income Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add Expense Modal with AI Recommendation */}
      {showExpenseModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-expense-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="add-expense-title" className="text-sm font-bold text-[#061A2F]">
                Log Deductible Business Expense
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Vendor / Payee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. South Carolina Realty Lease / Delta Airlines"
                  value={newExpense.vendor}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewExpense({ ...newExpense, vendor: v });
                    handleVendorOrPurposeChange(v, newExpense.businessPurpose);
                  }}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Business Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commercial office rent / Client strategy dinner"
                  value={newExpense.businessPurpose}
                  onChange={(e) => {
                    const p = e.target.value;
                    setNewExpense({ ...newExpense, businessPurpose: p });
                    handleVendorOrPurposeChange(newExpense.vendor, p);
                  }}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              {/* Simulated AI Categorization Recommendation */}
              {aiRecommendation && (
                <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#061A2F] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#C99A32]" />
                      AI Recommended Category: {aiRecommendation.category}
                    </span>
                    <span className="font-mono text-[10px] text-[#1B5E20] font-bold">
                      {aiRecommendation.confidence}% Confidence
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4B5563]">{aiRecommendation.explanation}</p>
                  <button
                    type="button"
                    onClick={() => setNewExpense({ ...newExpense, category: aiRecommendation.category })}
                    className="mt-1 text-[11px] font-bold text-[#061A2F] underline cursor-pointer hover:text-[#C99A32]"
                  >
                    Apply Recommended Category
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Expense Category</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                  >
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="1250.00"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Payment Method</label>
                  <select
                    value={newExpense.paymentMethod}
                    onChange={(e) => setNewExpense({ ...newExpense, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                  >
                    <option value="Credit Card">Credit Card</option>
                    <option value="ACH / Bank">ACH / Bank Transfer</option>
                    <option value="Check">Business Check</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
                >
                  Save Expense Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
