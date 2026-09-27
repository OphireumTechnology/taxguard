import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  Receipt,
  Car,
  Home,
  Laptop,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  Building,
  Info,
  CreditCard,
  ShieldCheck,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Check,
  X,
  Clock,
  Download
} from 'lucide-react';
import {
  ExpenseItem,
  CashTransactionItem,
  MileageLogItem,
  FixedAssetRecord,
  ExpenseCategory
} from '../../../types/clientPortal';
import {
  MOCK_EXPENSES,
  MOCK_CASH_TRANSACTIONS,
  MOCK_MILEAGE,
  MOCK_FIXED_ASSETS
} from '../../../services/clientPortalService';

interface ExpensesViewProps {
  selectedTaxYear?: number;
  onOpenUpload?: (category: string, year: number) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  selectedTaxYear = 2025,
  onOpenUpload
}) => {
  const [subModule, setSubModule] = useState<'expenses' | 'cash' | 'mileage' | 'allocations' | 'assets' | 'import'>('expenses');

  // State collections
  const [expenses, setExpenses] = useState<ExpenseItem[]>(MOCK_EXPENSES);
  const [cashTransactions, setCashTransactions] = useState<CashTransactionItem[]>(MOCK_CASH_TRANSACTIONS);
  const [mileageLogs, setMileageLogs] = useState<MileageLogItem[]>(MOCK_MILEAGE);
  const [fixedAssets, setFixedAssets] = useState<FixedAssetRecord[]>(MOCK_FIXED_ASSETS);

  // Form toggles
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddCashOpen, setIsAddCashOpen] = useState(false);
  const [isAddMileageOpen, setIsAddMileageOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // New Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    amount: '',
    category: 'office_expense' as ExpenseCategory,
    entityName: 'Perotti Advisory Group, LLC',
    paymentMethod: 'business_card' as ExpenseItem['paymentMethod'],
    businessPurpose: '',
    notes: '',
    receiptFileName: ''
  });

  // New Cash Transaction Form State
  const [cashForm, setCashForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    direction: 'outflow' as 'inflow' | 'outflow',
    transactionType: 'cash_expense' as CashTransactionItem['transactionType'],
    counterparty: '',
    businessPurpose: '',
    entityName: 'Perotti Advisory Group, LLC',
    explanationWhenNoReceipt: '',
    clientPerjuryCertified: false,
    signerLegalName: 'Robert Perotti'
  });

  // New Mileage Form State
  const [mileageForm, setMileageForm] = useState({
    date: new Date().toISOString().split('T')[0],
    vehicleDescription: '2023 Ford F-150 Lightning (Business Vehicle)',
    startLocation: '',
    endLocation: '',
    businessPurpose: '',
    startingOdometer: '',
    endingOdometer: ''
  });

  // Business Allocations State
  const [homeOfficeSqFt, setHomeOfficeSqFt] = useState('320');
  const [homeTotalSqFt, setHomeTotalSqFt] = useState('2400');
  const [cellPhoneBusinessPercent, setCellPhoneBusinessPercent] = useState('75');
  const [vehicleBusinessPercent, setVehicleBusinessPercent] = useState('80');

  // Handle Add Expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.vendor || !expenseForm.amount || !expenseForm.businessPurpose) {
      alert('Please fill out Vendor, Amount, and Business Purpose.');
      return;
    }

    const newExpense: ExpenseItem = {
      id: `exp_${Date.now()}`,
      clientId: 'user_client_1',
      taxYear: selectedTaxYear,
      entityName: expenseForm.entityName,
      date: expenseForm.date,
      vendor: expenseForm.vendor,
      amount: parseFloat(expenseForm.amount) || 0,
      currency: 'USD',
      paymentMethod: expenseForm.paymentMethod,
      category: expenseForm.category,
      businessPurpose: expenseForm.businessPurpose,
      receiptFileName: expenseForm.receiptFileName || undefined,
      notes: expenseForm.notes || undefined,
      classificationOrigin: 'client_entered',
      professionalReviewStatus: 'unreviewed',
      createdAt: new Date().toISOString()
    };

    setExpenses(prev => [newExpense, ...prev]);
    setIsAddExpenseOpen(false);
    setExpenseForm({
      date: new Date().toISOString().split('T')[0],
      vendor: '',
      amount: '',
      category: 'office_expense',
      entityName: 'Perotti Advisory Group, LLC',
      paymentMethod: 'business_card',
      businessPurpose: '',
      notes: '',
      receiptFileName: ''
    });
    setFeedbackNotice(`Expense of $${newExpense.amount.toFixed(2)} for ${newExpense.vendor} recorded and queued for CPA review.`);
  };

  // Handle Add Cash Transaction
  const handleSaveCashTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashForm.counterparty || !cashForm.amount || !cashForm.businessPurpose) {
      alert('Please fill out Source/Recipient, Amount, and Business Purpose.');
      return;
    }
    if (!cashForm.clientPerjuryCertified) {
      alert('You must check the certification under penalty of perjury to record this cash transaction.');
      return;
    }

    const newCash: CashTransactionItem = {
      id: `cash_${Date.now()}`,
      clientId: 'user_client_1',
      taxYear: selectedTaxYear,
      entityName: cashForm.entityName,
      date: cashForm.date,
      amount: parseFloat(cashForm.amount) || 0,
      direction: cashForm.direction,
      transactionType: cashForm.transactionType,
      counterparty: cashForm.counterparty,
      businessPurpose: cashForm.businessPurpose,
      explanationWhenNoReceipt: cashForm.explanationWhenNoReceipt || 'No external vendor receipt generated for this cash transaction.',
      clientPerjuryCertified: true,
      certifiedTimestamp: new Date().toISOString(),
      signerLegalName: cashForm.signerLegalName,
      status: 'submitted_to_cpa'
    };

    setCashTransactions(prev => [newCash, ...prev]);
    setIsAddCashOpen(false);
    setCashForm({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      direction: 'outflow',
      transactionType: 'cash_expense',
      counterparty: '',
      businessPurpose: '',
      entityName: 'Perotti Advisory Group, LLC',
      explanationWhenNoReceipt: '',
      clientPerjuryCertified: false,
      signerLegalName: 'Robert Perotti'
    });
    setFeedbackNotice(`Certified cash transaction of $${newCash.amount.toFixed(2)} submitted for CPA review.`);
  };

  // Handle Add Mileage
  const handleSaveMileage = (e: React.FormEvent) => {
    e.preventDefault();
    const startOdo = parseFloat(mileageForm.startingOdometer) || 0;
    const endOdo = parseFloat(mileageForm.endingOdometer) || 0;
    const miles = Math.max(0, endOdo - startOdo);

    if (miles <= 0 || !mileageForm.businessPurpose) {
      alert('Ending odometer must be greater than starting odometer, and business purpose is required.');
      return;
    }

    const newMil: MileageLogItem = {
      id: `mil_${Date.now()}`,
      clientId: 'user_client_1',
      taxYear: selectedTaxYear,
      date: mileageForm.date,
      vehicleDescription: mileageForm.vehicleDescription,
      startLocation: mileageForm.startLocation || 'Office',
      endLocation: mileageForm.endLocation || 'Client Destination',
      businessPurpose: mileageForm.businessPurpose,
      startingOdometer: startOdo,
      endingOdometer: endOdo,
      totalMiles: miles,
      standardMileageRate: 0.67,
      calculatedDeduction: miles * 0.67,
      substantiationStatus: 'logged'
    };

    setMileageLogs(prev => [newMil, ...prev]);
    setIsAddMileageOpen(false);
    setMileageForm({
      date: new Date().toISOString().split('T')[0],
      vehicleDescription: '2023 Ford F-150 Lightning (Business Vehicle)',
      startLocation: '',
      endLocation: '',
      businessPurpose: '',
      startingOdometer: '',
      endingOdometer: ''
    });
    setFeedbackNotice(`Logged ${miles} business miles ($${(miles * 0.67).toFixed(2)} deduction at 67¢/mi).`);
  };

  const totalExpenseAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
  const totalCashOutflow = cashTransactions.filter(c => c.direction === 'outflow').reduce((sum, item) => sum + item.amount, 0);
  const totalMileageDeduction = mileageLogs.reduce((sum, item) => sum + item.calculatedDeduction, 0);

  return (
    <div className="space-y-6" id="client-expenses-workspace">
      {/* Module Navigation Header */}
      <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#0B2748] pb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
              Substantiation &amp; Bookkeeping Gate &bull; IRC § 162 &amp; § 274
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">
              Expense Entry, Cash Transactions &amp; Substantiation
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Client entries are preserved separately from AI suggestions and require professional CPA review before affecting final tax returns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-[#0B2748] border border-[#1E3A5F] text-xs font-semibold text-slate-200">
              Tax Year: <strong className="text-[#E2BD67]">{selectedTaxYear}</strong>
            </span>
          </div>
        </div>

        {/* Sub-Tab Selectors */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { key: 'expenses', label: 'Business Expenses', icon: DollarSign, count: expenses.length },
            { key: 'cash', label: 'Cash Transactions', icon: Receipt, count: cashTransactions.length },
            { key: 'mileage', label: 'Vehicle Mileage', icon: Car, count: mileageLogs.length },
            { key: 'allocations', label: 'Business-Use Allocations', icon: Home },
            { key: 'assets', label: 'Property & Assets (§ 179)', icon: Laptop, count: fixedAssets.length },
            { key: 'import', label: 'Spreadsheet / Bank Import', icon: FileSpreadsheet }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subModule === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSubModule(tab.key as typeof subModule)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#0D2340] text-white font-bold border border-[#C99A3D]/60 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#0A1F38]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C99A3D]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-[#C99A3D] text-[#06172C] font-bold' : 'bg-[#0B2748] text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {feedbackNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button type="button" onClick={() => setFeedbackNotice(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 1. EXPENSES TAB */}
      {/* --------------------------------------------------------------------- */}
      {subModule === 'expenses' && (
        <div className="space-y-5">
          {/* Top Metric Bar & Action */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
              <div className="text-slate-400">Total Deductible Expenses Logged</div>
              <div className="font-serif text-2xl font-bold text-white mt-1">
                ${totalExpenseAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Across {expenses.length} substantiated entries</div>
            </div>

            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
              <div className="text-slate-400">CPA Review Status</div>
              <div className="font-serif text-2xl font-bold text-emerald-400 mt-1">
                {expenses.filter(e => e.professionalReviewStatus === 'accountant_approved').length} Approved
              </div>
              <div className="text-[11px] text-amber-400 mt-0.5">
                {expenses.filter(e => e.professionalReviewStatus === 'unreviewed').length} Awaiting Professional Review
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex flex-col justify-between">
              <div className="text-slate-400">Add New Expense Item</div>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(!isAddExpenseOpen)}
                className="w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddExpenseOpen ? 'Cancel Expense Entry' : 'Enter Business Expense'}</span>
              </button>
            </div>
          </div>

          {/* Add Expense Form Drawer */}
          {isAddExpenseOpen && (
            <form onSubmit={handleSaveExpense} className="rounded-2xl bg-[#07172B] border-2 border-[#C99A3D] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#0B2748] pb-3">
                <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#C99A3D]" />
                  <span>Substantiated Business Expense Entry</span>
                </h3>
                <span className="text-[11px] text-slate-400">All fields required for IRS deduction integrity</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Vendor / Payee *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dell Technologies, Google Cloud"
                    value={expenseForm.vendor}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Amount ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tax Category *</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  >
                    <option value="advertising">Advertising &amp; Marketing</option>
                    <option value="vehicle_mileage">Car &amp; Truck Expenses</option>
                    <option value="commissions_fees">Commissions &amp; Merchant Fees</option>
                    <option value="contract_labor">Contract Labor (1099-NEC)</option>
                    <option value="depreciation_section_179">Depreciation &amp; Section 179 Expensing</option>
                    <option value="employee_benefits">Employee Benefits</option>
                    <option value="insurance">Insurance (Other than Health)</option>
                    <option value="legal_professional">Legal &amp; Professional Services</option>
                    <option value="office_expense">Office Expenses</option>
                    <option value="rent_lease_vehicles_machinery">Rent or Lease: Vehicles &amp; Machinery</option>
                    <option value="rent_lease_other_business_property">Rent or Lease: Commercial Property</option>
                    <option value="repairs_maintenance">Repairs &amp; Maintenance</option>
                    <option value="supplies">Supplies &amp; Materials</option>
                    <option value="taxes_licenses">Taxes &amp; Municipal Licenses</option>
                    <option value="travel">Travel (100% Deductible)</option>
                    <option value="meals_50_percent">Business Meals (50% Deductible)</option>
                    <option value="utilities">Utilities &amp; Telecommunications</option>
                    <option value="other_expenses">Other Deductible Expenses</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Applicable Business Entity</label>
                  <select
                    value={expenseForm.entityName}
                    onChange={(e) => setExpenseForm({ ...expenseForm, entityName: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  >
                    <option value="Perotti Advisory Group, LLC">Perotti Advisory Group, LLC (S-Corp)</option>
                    <option value="Robert & Sarah Perotti (Schedule C)">Robert &amp; Sarah Perotti (Schedule C Consulting)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Payment Method</label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  >
                    <option value="business_card">Business Credit / Debit Card</option>
                    <option value="bank_transfer">ACH / Bank Transfer</option>
                    <option value="check">Company Check</option>
                    <option value="personal_funds_reimbursable">Personal Funds (Accountable Plan Reimbursement)</option>
                    <option value="cash">Cash (Requires Perjury Substantiation)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Specific Business Purpose * (IRC § 162 Requirement)
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Describe direct commercial purpose, client project, or business necessity..."
                    value={expenseForm.businessPurpose}
                    onChange={(e) => setExpenseForm({ ...expenseForm, businessPurpose: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Receipt File Attachment
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Receipt filename (e.g. Invoice_Dell_2025.pdf)"
                      value={expenseForm.receiptFileName}
                      onChange={(e) => setExpenseForm({ ...expenseForm, receiptFileName: e.target.value })}
                      className="flex-1 bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                    />
                    <button
                      type="button"
                      onClick={() => onOpenUpload && onOpenUpload('receipt', selectedTaxYear)}
                      className="px-3 py-2 rounded-xl bg-[#0B2748] hover:bg-[#11355F] text-white border border-[#1E3A5F] flex items-center gap-1"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#C99A3D]" />
                      <span>Upload</span>
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Receipts required for all individual expenses of $75 or greater.</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#0B2748]">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow"
                >
                  Save &amp; Queue for CPA Review
                </button>
              </div>
            </form>
          )}

          {/* Expense Records List */}
          <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#0B2748] pb-3">
              <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                <span>Substantiated Business Expenses</span>
              </h3>
              <span className="text-xs text-slate-400">
                Sorted by date &bull; {expenses.length} total entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E3A5F] text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Vendor / Payee</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Business Purpose</th>
                    <th className="py-2.5 px-3">Classification Origin</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">CPA Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0B2748]">
                  {expenses.map((item) => (
                    <tr key={item.id} className="hover:bg-[#06172C] transition-colors">
                      <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{item.date}</td>
                      <td className="py-3 px-3 font-semibold text-white">
                        <div>{item.vendor}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{item.entityName}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300 capitalize">
                        <span className="px-2 py-0.5 rounded bg-[#0B2748] text-slate-200 border border-[#1E3A5F] text-[11px]">
                          {item.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={item.businessPurpose}>
                        <div>{item.businessPurpose}</div>
                        {item.receiptFileName && (
                          <div className="text-[10px] text-[#E2BD67] flex items-center gap-1 mt-0.5">
                            <Receipt className="w-3 h-3" />
                            <span>{item.receiptFileName}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.classificationOrigin === 'client_entered'
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            : item.classificationOrigin === 'ai_suggested'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {item.classificationOrigin === 'client_entered' ? 'Client-Provided' : item.classificationOrigin === 'ai_suggested' ? 'AI Suggested' : 'Imported'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-serif font-bold text-[#E2BD67] whitespace-nowrap">
                        ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.professionalReviewStatus === 'accountant_approved' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3" /> Approved
                          </span>
                        ) : item.professionalReviewStatus === 'adjusted_by_accountant' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            Adjusted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0B2748] text-slate-300 border border-[#1E3A5F]">
                            <Clock className="w-3 h-3" /> Unreviewed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. CASH TRANSACTIONS WITH PERJURY CERTIFICATION (Prompt Section 6) */}
      {/* --------------------------------------------------------------------- */}
      {subModule === 'cash' && (
        <div className="space-y-5">
          {/* Statutory Notice Banner */}
          <div className="p-4 rounded-2xl bg-[#06172C] border-2 border-amber-500/40 text-xs text-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#E2BD67] text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Mandatory Cash Substantiation &amp; Perjury Attestation (IRC § 6001)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Under federal tax law, all cash receipts and cash expenditures require rigorous contemporaneous substantiation. Cash entries must identify source or recipient, commercial purpose, and include an explicit certification executed under penalties of perjury. Cash entries cannot bypass accountant review.
            </p>
          </div>

          {/* Metric Bar & Add Cash Trigger */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
              <div className="text-slate-400">Total Cash Outflows (Substantiated)</div>
              <div className="font-serif text-2xl font-bold text-white mt-1">
                ${totalCashOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
              <div className="text-slate-400">Total Cash Inflows (Schedule C / Gross)</div>
              <div className="font-serif text-2xl font-bold text-emerald-400 mt-1">
                ${cashTransactions.filter(c => c.direction === 'inflow').reduce((s, i) => s + i.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex flex-col justify-between">
              <div className="text-slate-400">Record New Cash Movement</div>
              <button
                type="button"
                onClick={() => setIsAddCashOpen(!isAddCashOpen)}
                className="w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddCashOpen ? 'Cancel Cash Entry' : 'Log Certified Cash Transaction'}</span>
              </button>
            </div>
          </div>

          {/* Add Cash Transaction Modal/Form */}
          {isAddCashOpen && (
            <form onSubmit={handleSaveCashTransaction} className="rounded-2xl bg-[#07172B] border-2 border-[#C99A3D] p-6 shadow-xl space-y-4">
              <div className="border-b border-[#0B2748] pb-3">
                <h3 className="font-serif text-lg font-bold text-white">
                  Contemporaneous Cash Transaction Record
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Record cash income, cash expenses, petty cash, owner draws, or deposits.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={cashForm.date}
                    onChange={(e) => setCashForm({ ...cashForm, date: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cash Movement Direction *</label>
                  <select
                    value={cashForm.direction}
                    onChange={(e) => setCashForm({ ...cashForm, direction: e.target.value as any })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  >
                    <option value="outflow">Cash Outflow (Expenditure / Withdrawal / Distribution)</option>
                    <option value="inflow">Cash Inflow (Income / Owner Contribution / Deposit)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Amount ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={cashForm.amount}
                    onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Transaction Type *</label>
                  <select
                    value={cashForm.transactionType}
                    onChange={(e) => setCashForm({ ...cashForm, transactionType: e.target.value as any })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  >
                    <option value="cash_expense">Cash Expense (Direct business purchase)</option>
                    <option value="cash_income">Cash Income (Client consulting / service fee)</option>
                    <option value="petty_cash_activity">Petty Cash Activity</option>
                    <option value="owner_contribution">Owner Capital Contribution</option>
                    <option value="owner_distribution">Owner Distribution / Draw</option>
                    <option value="reimbursement">Employee / Officer Reimbursement</option>
                    <option value="bank_deposit">Bank Cash Deposit</option>
                    <option value="cash_withdrawal">Bank Cash Withdrawal</option>
                    <option value="other_cash_movement">Other Cash Movement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Counterparty (Source or Recipient) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Builders, Municipal Clerk"
                    value={cashForm.counterparty}
                    onChange={(e) => setCashForm({ ...cashForm, counterparty: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Entity / Taxpayer</label>
                  <input
                    type="text"
                    value={cashForm.entityName}
                    onChange={(e) => setCashForm({ ...cashForm, entityName: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Business Purpose *</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Detailed explanation of the exact commercial purpose..."
                    value={cashForm.businessPurpose}
                    onChange={(e) => setCashForm({ ...cashForm, businessPurpose: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Explanation When No External Receipt Exists
                  </label>
                  <textarea
                    rows={2}
                    placeholder="State reason why vendor receipt was unavailable (e.g. machine failure, private seller)..."
                    value={cashForm.explanationWhenNoReceipt}
                    onChange={(e) => setCashForm({ ...cashForm, explanationWhenNoReceipt: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C99A3D]"
                  />
                </div>
              </div>

              {/* Mandatory Perjury Attestation Checkbox */}
              <div className="p-4 rounded-xl bg-[#040E1B] border border-[#C99A3D]/40 space-y-2 text-xs">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={cashForm.clientPerjuryCertified}
                    onChange={(e) => setCashForm({ ...cashForm, clientPerjuryCertified: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-[#C99A3D] focus:ring-[#C99A3D]"
                  />
                  <div className="text-slate-200 leading-relaxed">
                    <strong className="text-white">Client Certification Under Penalties of Perjury:</strong> I declare that I have examined this cash transaction entry and to the best of my knowledge and belief, it represents an actual, legitimate business transaction that took place on the stated date for the stated purpose.
                  </div>
                </label>

                <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Signer: <strong className="text-slate-200">{cashForm.signerLegalName}</strong></span>
                  <span className="font-mono text-emerald-400">Timestamp logged upon submission</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#0B2748]">
                <button
                  type="button"
                  onClick={() => setIsAddCashOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!cashForm.clientPerjuryCertified}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow disabled:opacity-50"
                >
                  Submit Certified Cash Record
                </button>
              </div>
            </form>
          )}

          {/* Cash Transactions List */}
          <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-5 shadow-lg space-y-4">
            <h3 className="font-serif text-lg font-bold text-white">
              Recorded Cash Transactions &amp; Substantiation Dossier
            </h3>

            <div className="space-y-3">
              {cashTransactions.map((cash) => (
                <div key={cash.id} className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                        cash.direction === 'inflow' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {cash.direction === 'inflow' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                      </span>
                      <div>
                        <span className="font-bold text-white text-sm">{cash.counterparty}</span>
                        <span className="text-slate-400 text-[11px] ml-2 font-mono">({cash.date})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-base font-serif font-bold ${cash.direction === 'inflow' ? 'text-emerald-400' : 'text-[#E2BD67]'}`}>
                        {cash.direction === 'inflow' ? '+' : '-'}${cash.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cash.status === 'verified_by_accountant'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        {cash.status === 'verified_by_accountant' ? 'CPA Verified' : 'Awaiting Review'}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-300 pl-8">{cash.businessPurpose}</p>
                  {cash.explanationWhenNoReceipt && (
                    <div className="text-[11px] text-slate-400 italic pl-8">
                      Receipt Note: {cash.explanationWhenNoReceipt}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[#1E3A5F]/60 pl-8 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Certified under penalties of perjury by {cash.signerLegalName || 'Client'}</span>
                    </div>
                    {cash.cpaAuditNotes && (
                      <span className="text-slate-300">CPA Note: {cash.cpaAuditNotes}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. MILEAGE LOGGING (Standard Mileage Rate at 67¢/mile) */}
      {/* --------------------------------------------------------------------- */}
      {subModule === 'mileage' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
              <div className="text-slate-400">Total Business Mileage Logged</div>
              <div className="font-serif text-2xl font-bold text-white mt-1">
                {mileageLogs.reduce((s, i) => s + i.totalMiles, 0).toLocaleString()} Miles
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">IRS Standard Rate: 67¢ / mile</div>
            </div>

            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
              <div className="text-slate-400">Total Calculated Tax Deduction</div>
              <div className="font-serif text-2xl font-bold text-[#E2BD67] mt-1">
                ${totalMileageDeduction.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5">Applies to Schedule C / Form 1040 Line 9</div>
            </div>

            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex flex-col justify-between">
              <div className="text-slate-400">Log Trip</div>
              <button
                type="button"
                onClick={() => setIsAddMileageOpen(!isAddMileageOpen)}
                className="w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddMileageOpen ? 'Cancel' : 'Add Mileage Entry'}</span>
              </button>
            </div>
          </div>

          {/* Add Mileage Drawer */}
          {isAddMileageOpen && (
            <form onSubmit={handleSaveMileage} className="rounded-2xl bg-[#07172B] border-2 border-[#C99A3D] p-6 shadow-xl space-y-4 text-xs">
              <h3 className="font-serif text-lg font-bold text-white">Log Business Trip Mileage</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={mileageForm.date}
                    onChange={(e) => setMileageForm({ ...mileageForm, date: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Vehicle Description</label>
                  <input
                    type="text"
                    value={mileageForm.vehicleDescription}
                    onChange={(e) => setMileageForm({ ...mileageForm, vehicleDescription: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Starting Odometer</label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={mileageForm.startingOdometer}
                    onChange={(e) => setMileageForm({ ...mileageForm, startingOdometer: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ending Odometer</label>
                  <input
                    type="number"
                    placeholder="e.g. 15230"
                    value={mileageForm.endingOdometer}
                    onChange={(e) => setMileageForm({ ...mileageForm, endingOdometer: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Start Location</label>
                  <input
                    type="text"
                    placeholder="Office or Origin"
                    value={mileageForm.startLocation}
                    onChange={(e) => setMileageForm({ ...mileageForm, startLocation: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">End Location / Client Site</label>
                  <input
                    type="text"
                    placeholder="Destination"
                    value={mileageForm.endLocation}
                    onChange={(e) => setMileageForm({ ...mileageForm, endLocation: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Business Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. On-site project walkthrough, meeting client executive"
                  value={mileageForm.businessPurpose}
                  onChange={(e) => setMileageForm({ ...mileageForm, businessPurpose: e.target.value })}
                  className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMileageOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-[#C99A3D] text-[#06172C]"
                >
                  Save Mileage Log
                </button>
              </div>
            </form>
          )}

          {/* Mileage Log Table */}
          <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-5 shadow-lg space-y-4">
            <h3 className="font-serif text-lg font-bold text-white">Contemporaneous Vehicle Mileage Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E3A5F] text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Trip Route</th>
                    <th className="py-2.5 px-3">Business Purpose</th>
                    <th className="py-2.5 px-3 text-right">Miles</th>
                    <th className="py-2.5 px-3 text-right">Deduction (@ 67¢)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0B2748]">
                  {mileageLogs.map((m) => (
                    <tr key={m.id} className="hover:bg-[#06172C]">
                      <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{m.date}</td>
                      <td className="py-3 px-3 text-white font-medium">{m.vehicleDescription}</td>
                      <td className="py-3 px-3 text-slate-300">{m.startLocation} &rarr; {m.endLocation}</td>
                      <td className="py-3 px-3 text-slate-300">{m.businessPurpose}</td>
                      <td className="py-3 px-3 text-right font-bold text-white">{m.totalMiles}</td>
                      <td className="py-3 px-3 text-right font-serif font-bold text-[#E2BD67]">
                        ${m.calculatedDeduction.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {m.substantiationStatus === 'verified_by_accountant' ? 'Verified' : 'Logged'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. BUSINESS-USE ALLOCATIONS (Home Office, Phone, Vehicle) */}
      {/* --------------------------------------------------------------------- */}
      {subModule === 'allocations' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6 text-xs">
          <div className="border-b border-[#0B2748] pb-4">
            <h3 className="font-serif text-xl font-bold text-white">
              Business-Use Percentage Allocations
            </h3>
            <p className="text-slate-300 mt-1">
              Statutory allocations for mixed-use personal and commercial assets under IRC § 280A and § 280F.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Home Office Deduction */}
            <div className="p-5 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Home className="w-4 h-4 text-[#C99A3D]" />
                <span>Home Office Deduction (Form 8829)</span>
              </div>
              <p className="text-slate-400">
                Principal place of business used exclusively and regularly for client advisory work.
              </p>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Dedicated Office Sq. Footage</label>
                <input
                  type="number"
                  value={homeOfficeSqFt}
                  onChange={(e) => setHomeOfficeSqFt(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Total Home Sq. Footage</label>
                <input
                  type="number"
                  value={homeTotalSqFt}
                  onChange={(e) => setHomeTotalSqFt(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] text-slate-300">
                Business Use Percentage: <strong className="text-[#E2BD67]">
                  {((parseFloat(homeOfficeSqFt) || 0) / (parseFloat(homeTotalSqFt) || 1) * 100).toFixed(1)}%
                </strong>
              </div>
            </div>

            {/* Cell Phone & Internet */}
            <div className="p-5 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Laptop className="w-4 h-4 text-[#C99A3D]" />
                <span>Mobile Phone &amp; Internet</span>
              </div>
              <p className="text-slate-400">
                Substantiated percentage of monthly telecommunication bills allocated to business usage.
              </p>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Business Usage Percentage (%)</label>
                <input
                  type="number"
                  max={100}
                  min={0}
                  value={cellPhoneBusinessPercent}
                  onChange={(e) => setCellPhoneBusinessPercent(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] text-slate-300">
                Applied Deduction: <strong className="text-emerald-400">{cellPhoneBusinessPercent}%</strong> of invoices
              </div>
            </div>

            {/* Vehicle Commercial Percentage */}
            <div className="p-5 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Car className="w-4 h-4 text-[#C99A3D]" />
                <span>Vehicle Commercial Use</span>
              </div>
              <p className="text-slate-400">
                Apportionment of vehicle depreciation, insurance, and maintenance for primary business vehicle.
              </p>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Commercial Use Percentage (%)</label>
                <input
                  type="number"
                  max={100}
                  min={0}
                  value={vehicleBusinessPercent}
                  onChange={(e) => setVehicleBusinessPercent(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] text-slate-300">
                Vehicle Method: <strong className="text-white">Actual Expenses + Section 179</strong>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex items-center justify-between">
            <span className="text-slate-300">Changes will be transmitted to workpaper adjustments upon your confirmation.</span>
            <button
              type="button"
              onClick={() => setFeedbackNotice('Business use allocations updated and saved to workpapers.')}
              className="px-4 py-2 rounded-xl bg-[#C99A3D] text-[#06172C] font-bold text-xs hover:brightness-105"
            >
              Save Allocations
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 5. PROPERTY & FIXED ASSETS (§ 179) */}
      {/* --------------------------------------------------------------------- */}
      {subModule === 'assets' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5 text-xs">
          <div className="border-b border-[#0B2748] pb-4">
            <h3 className="font-serif text-xl font-bold text-white">
              Property &amp; Fixed Asset Depreciable Records
            </h3>
            <p className="text-slate-300 mt-1">
              Capital purchases eligible for IRC § 179 immediate expensing and Form 4562 depreciation schedules.
            </p>
          </div>

          <div className="space-y-3">
            {fixedAssets.map((asset) => (
              <div key={asset.id} className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-bold text-white text-sm">{asset.assetDescription}</div>
                  <div className="font-serif font-bold text-[#E2BD67] text-base">
                    Cost Basis: ${asset.costBasis.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 pt-1">
                  <div>Acquired: <strong className="text-white">{asset.acquisitionDate}</strong></div>
                  <div>Business Use: <strong className="text-white">{asset.businessUsePercentage}%</strong></div>
                  <div>Section 179: <strong className="text-emerald-400">{asset.section179ElectionRequested ? 'Elected (100%)' : 'None'}</strong></div>
                  <div>Schedule: <strong className="text-white">Form 4562 Line 6</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 6. SPREADSHEET / BANK FEED IMPORT (Section 5 requirement) */}
      {/* --------------------------------------------------------------------- */}
      {subModule === 'import' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6 text-xs">
          <div className="border-b border-[#0B2748] pb-4">
            <h3 className="font-serif text-xl font-bold text-white">
              Bulk Spreadsheet &amp; Bank Feed Import
            </h3>
            <p className="text-slate-300 mt-1">
              Upload CSV, XLSX, QBO, or OFX statements to stage multiple expenses for OCR verification and category mapping.
            </p>
          </div>

          <div className="p-6 rounded-2xl border-2 border-dashed border-[#1E3A5F] bg-[#06172C] text-center space-y-3">
            <FileSpreadsheet className="w-10 h-10 text-[#C99A3D] mx-auto" />
            <div className="font-bold text-white text-sm">Drag &amp; Drop Expense Spreadsheet (CSV, XLSX, QBO, OFX)</div>
            <p className="text-slate-400 max-w-md mx-auto text-[11px]">
              Expected columns: Date, Payee/Vendor, Amount, Category/Memo, Payment Method. Our parser maps columns automatically.
            </p>
            <button
              type="button"
              onClick={() => {
                setFeedbackNotice('Mock CSV imported: 8 transactions staged and auto-classified with AI confidence tags.');
                setSubModule('expenses');
              }}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow"
            >
              Simulate CSV Import (Chase Business 2025.csv)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
