/**
 * TaxGuard AI – Fixed Asset Register & Depreciation Engine
 * Form 4562, Section 179, Bonus Depreciation, MACRS Conventions,
 * and South Carolina State Non-Conformity Addback Engine.
 */

import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Layers, 
  DollarSign, 
  Percent, 
  Calendar,
  Lock,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';

export interface FixedAssetRecord {
  id: string;
  description: string;
  category: 'Machinery & Equipment' | 'Vehicles' | 'Computers & Technology' | 'Furniture & Fixtures' | 'Leasehold Improvements' | 'Commercial Real Property';
  acquisitionDate: string;
  placedInServiceDate: string;
  costBasis: number;
  businessUsePercent: number;
  taxBasis: number;
  bookBasis: number;
  recoveryPeriodYears: number;
  method: 'MACRS 200% DB' | 'MACRS 150% DB' | 'Straight Line';
  convention: 'Half-Year (HY)' | 'Mid-Quarter (MQ)' | 'Mid-Month (MM)';
  section179Amount: number;
  bonusDepreciationAmount: number;
  priorAccumulatedDepr: number;
  currentYearDepr: number;
  scStateDeprAdjustment: number; // South Carolina non-conformity addback
  isDisposed: boolean;
  disposalDate?: string;
  disposalProceeds?: number;
  gainOrLoss?: number;
  recaptureSec1245?: number;
  reviewStatus: 'Draft In Review' | 'Preparer Verified' | 'CPA Approved';
  reviewedBy?: string;
  supportingDoc: string;
}

const INITIAL_ASSETS: FixedAssetRecord[] = [
  {
    id: 'fa_001',
    description: 'Cat 308 CR Mini Hydraulic Excavator',
    category: 'Machinery & Equipment',
    acquisitionDate: '2024-03-15',
    placedInServiceDate: '2024-03-20',
    costBasis: 118500,
    businessUsePercent: 100,
    taxBasis: 118500,
    bookBasis: 118500,
    recoveryPeriodYears: 5,
    method: 'MACRS 200% DB',
    convention: 'Half-Year (HY)',
    section179Amount: 70000,
    bonusDepreciationAmount: 29100, // 60% of remaining $48,500
    priorAccumulatedDepr: 0,
    currentYearDepr: 102980, // $70k + $29.1k + ($19.4k * 20%)
    scStateDeprAdjustment: 77980, // SC caps §179 @ $25k & disallows bonus depr (SC Code § 12-6-40)
    isDisposed: false,
    reviewStatus: 'Preparer Verified',
    reviewedBy: 'Marcus Vance, EA',
    supportingDoc: 'Equipment Bill of Sale & Loan Note'
  },
  {
    id: 'fa_002',
    description: '2024 Ford F-250 Super Duty Service Truck (>6,000 lbs GVWR)',
    category: 'Vehicles',
    acquisitionDate: '2024-01-10',
    placedInServiceDate: '2024-01-15',
    costBasis: 68400,
    businessUsePercent: 92,
    taxBasis: 62928,
    bookBasis: 68400,
    recoveryPeriodYears: 5,
    method: 'MACRS 200% DB',
    convention: 'Half-Year (HY)',
    section179Amount: 30500, // IRC § 280F heavy SUV/truck limitation cap for 2024
    bonusDepreciationAmount: 19457, // 60% of remaining $32,428
    priorAccumulatedDepr: 0,
    currentYearDepr: 52551,
    scStateDeprAdjustment: 27551,
    isDisposed: false,
    reviewStatus: 'Draft In Review',
    supportingDoc: 'Dealership Purchase Contract & Mileage Log'
  },
  {
    id: 'fa_003',
    description: 'Dell Precision 7780 CAD Engineering Server & Workstations',
    category: 'Computers & Technology',
    acquisitionDate: '2024-05-02',
    placedInServiceDate: '2024-05-04',
    costBasis: 18200,
    businessUsePercent: 100,
    taxBasis: 18200,
    bookBasis: 18200,
    recoveryPeriodYears: 5,
    method: 'MACRS 200% DB',
    convention: 'Half-Year (HY)',
    section179Amount: 18200, // 100% expensed under §179
    bonusDepreciationAmount: 0,
    priorAccumulatedDepr: 0,
    currentYearDepr: 18200,
    scStateDeprAdjustment: 0,
    isDisposed: false,
    reviewStatus: 'CPA Approved',
    reviewedBy: 'Elena Rostova, CPA',
    supportingDoc: 'Dell Direct Invoice #INV-8891'
  }
];

export const FixedAssetRegister: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [assets, setAssets] = useState<FixedAssetRecord[]>(INITIAL_ASSETS);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('fa_001');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Form state for adding asset
  const [newDesc, setNewDesc] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newCategory, setNewCategory] = useState<FixedAssetRecord['category']>('Machinery & Equipment');
  const [newRecovery, setNewRecovery] = useState(5);
  const [newSec179, setNewSec179] = useState('');

  const selectedAsset = assets.find(a => a.id === selectedAssetId) || assets[0];

  const totalCost = assets.reduce((sum, a) => sum + a.costBasis, 0);
  const totalTaxBasis = assets.reduce((sum, a) => sum + a.taxBasis, 0);
  const totalCurrentDepr = assets.reduce((sum, a) => sum + a.currentYearDepr, 0);
  const totalSCAdjustment = assets.reduce((sum, a) => sum + a.scStateDeprAdjustment, 0);

  const isScheduleApproved = assets.every(a => a.reviewStatus === 'CPA Approved');

  const handleCertifyAsset = (assetId: string) => {
    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        TaxGuardAuditService.logEvent({
          tenantId: 'tenant_ar_tax_prod',
          userId: userRole,
          userEmail: `${userRole}@artaxservices.com`,
          userRole,
          action: 'FIXED_ASSET_SCHEDULE_APPROVED',
          recordType: 'workpaper',
          recordId: assetId,
          ipAddress: '127.0.0.1 (authenticated)',
          result: 'success',
          riskLevel: 'material',
          details: `Certified Form 4562 asset "${a.description}" with $${a.currentYearDepr.toLocaleString()} current tax depreciation.`
        });
        return {
          ...a,
          reviewStatus: 'CPA Approved',
          reviewedBy: 'Elena Rostova, CPA'
        };
      }
      return a;
    }));
    setActionNotice('Asset schedule certified and locked into Form 4562 workpaper.');
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(newCost) || 0;
    const sec179 = parseFloat(newSec179) || 0;
    const remaining = Math.max(0, cost - sec179);
    const bonus = remaining * 0.6; // 60% 2024 bonus depreciation
    const baseDepr = (remaining - bonus) * 0.2; // 20% year 1 MACRS 5yr HY
    const currentDepr = sec179 + bonus + baseDepr;

    const newRecord: FixedAssetRecord = {
      id: `fa_${Date.now().toString().slice(-4)}`,
      description: newDesc || 'New Capital Equipment Asset',
      category: newCategory,
      acquisitionDate: '2024-06-01',
      placedInServiceDate: '2024-06-05',
      costBasis: cost,
      businessUsePercent: 100,
      taxBasis: cost,
      bookBasis: cost,
      recoveryPeriodYears: newRecovery,
      method: 'MACRS 200% DB',
      convention: 'Half-Year (HY)',
      section179Amount: sec179,
      bonusDepreciationAmount: bonus,
      priorAccumulatedDepr: 0,
      currentYearDepr: currentDepr,
      scStateDeprAdjustment: Math.max(0, currentDepr - Math.min(25000, sec179) - (cost * 0.2)),
      isDisposed: false,
      reviewStatus: 'Draft In Review',
      supportingDoc: 'Capital Expenditure Invoice (Pending Match)'
    };

    setAssets(prev => [...prev, newRecord]);
    setShowAddModal(false);
    setSelectedAssetId(newRecord.id);
    setActionNotice(`Added asset "${newRecord.description}". Placed in "Draft In Review" state.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Summary */}
      <div className="border border-neutral-300 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#C99A32] font-bold tracking-wider">
              A/R Tax Services, LLC • Depreciation &amp; Capital Recovery Engine
            </div>
            <h2 className="text-base font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#061A2F]" />
              <span>Fixed Asset Register &amp; Form 4562 Lead Schedule</span>
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Section 179 expense election, 60% Bonus Depreciation calculation, MACRS conventions, and SC Code § 12-6-40 state addback.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isScheduleApproved && (
              <span className="px-2.5 py-1 bg-rose-50 border border-rose-300 text-rose-800 text-[10px] font-bold uppercase font-mono flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-rose-600" />
                <span>DRAFT – NOT APPROVED FOR FILING</span>
              </span>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Fixed Asset</span>
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-3 bg-neutral-50 border border-neutral-200">
            <div className="text-[10px] uppercase font-mono text-neutral-500">Total Asset Cost</div>
            <div className="text-base font-bold font-mono text-neutral-900">${totalCost.toLocaleString()}</div>
            <div className="text-[10px] text-neutral-500">{assets.length} Registered Assets</div>
          </div>
          <div className="p-3 bg-neutral-50 border border-neutral-200">
            <div className="text-[10px] uppercase font-mono text-neutral-500">Total Tax Depr. Basis</div>
            <div className="text-base font-bold font-mono text-neutral-900">${totalTaxBasis.toLocaleString()}</div>
            <div className="text-[10px] text-neutral-500">Post Business-Use Ratio</div>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200">
            <div className="text-[10px] uppercase font-mono text-emerald-800 font-bold">2024 Federal Tax Depr.</div>
            <div className="text-base font-bold font-mono text-emerald-800">${totalCurrentDepr.toLocaleString()}</div>
            <div className="text-[10px] text-emerald-700 font-medium">Form 4562 Line 22</div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200">
            <div className="text-[10px] uppercase font-mono text-amber-800 font-bold">SC State Depreciation Addback</div>
            <div className="text-base font-bold font-mono text-amber-900">${totalSCAdjustment.toLocaleString()}</div>
            <div className="text-[10px] text-amber-700">SC Form 1120S-WH / Line 3</div>
          </div>
        </div>
      </div>

      {/* Asset Table & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Master Asset Register */}
        <div className="lg:col-span-2 border border-neutral-300 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <h3 className="text-sm font-bold text-[#061A2F] uppercase">Capital Asset Register</h3>
            <span className="text-xs text-neutral-500 font-mono">Tax Year 2024 Active Schedule</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-700 font-mono text-[11px]">
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Category / Recovery</th>
                  <th className="py-2.5 px-3 text-right">Cost</th>
                  <th className="py-2.5 px-3 text-right">Sec 179</th>
                  <th className="py-2.5 px-3 text-right">60% Bonus</th>
                  <th className="py-2.5 px-3 text-right">2024 Depr.</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {assets.map(asset => (
                  <tr 
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedAssetId === asset.id ? 'bg-neutral-100 font-semibold' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-neutral-900 font-medium">
                      {asset.description}
                      <div className="text-[10px] text-neutral-500 font-mono">Placed: {asset.placedInServiceDate}</div>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600">
                      {asset.category}
                      <div className="text-[10px] font-mono text-neutral-500">{asset.recoveryPeriodYears}yr • {asset.convention}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-900">${asset.costBasis.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700">${asset.section179Amount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sky-700">${asset.bonusDepreciationAmount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">${asset.currentYearDepr.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 font-bold uppercase font-mono ${
                        asset.reviewStatus === 'CPA Approved' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : asset.reviewStatus === 'Preparer Verified'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {asset.reviewStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Selected Asset In-Depth Schedule & Verification */}
        <div className="border border-neutral-300 bg-white p-5 space-y-4">
          <div className="border-b border-neutral-200 pb-3">
            <div className="text-[10px] font-mono uppercase text-neutral-500">Asset Detail Audit</div>
            <h3 className="text-sm font-bold text-[#061A2F]">{selectedAsset.description}</h3>
            <div className="text-xs text-neutral-600 font-mono mt-0.5">Asset ID: {selectedAsset.id}</div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Acquisition / Placed Date:</span>
              <span className="font-mono font-semibold">{selectedAsset.acquisitionDate} / {selectedAsset.placedInServiceDate}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Business Use Percentage:</span>
              <span className="font-mono font-bold text-neutral-900">{selectedAsset.businessUsePercent}%</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Depreciation Method:</span>
              <span className="font-semibold text-neutral-900">{selectedAsset.method}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Averaging Convention:</span>
              <span className="font-semibold text-neutral-900">{selectedAsset.convention}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">IRC § 179 Expense:</span>
              <span className="font-mono font-bold text-emerald-700">${selectedAsset.section179Amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">IRC § 168(k) 60% Bonus Depr:</span>
              <span className="font-mono font-bold text-sky-700">${selectedAsset.bonusDepreciationAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600 font-bold">2024 Total Fed Tax Deduction:</span>
              <span className="font-mono font-bold text-neutral-950">${selectedAsset.currentYearDepr.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-amber-800 font-medium">SC State Addition (Add-Back):</span>
              <span className="font-mono font-bold text-amber-900">${selectedAsset.scStateDeprAdjustment.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-600">Substantiating Source Document:</span>
              <span className="text-[11px] font-mono text-neutral-800">{selectedAsset.supportingDoc}</span>
            </div>
            <div className="flex justify-between py-1 items-center">
              <span className="text-neutral-600">Reviewer Certification:</span>
              <span className="font-bold text-[10px] uppercase font-mono">{selectedAsset.reviewStatus}</span>
            </div>
          </div>

          <div className="pt-2">
            {selectedAsset.reviewStatus !== 'CPA Approved' ? (
              <button
                onClick={() => handleCertifyAsset(selectedAsset.id)}
                className="w-full py-2 bg-[#061A2F] hover:bg-neutral-800 text-white text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>CPA Quality Sign-Off on Asset</span>
              </button>
            ) : (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Form 4562 Lead Schedule Certified ({selectedAsset.reviewedBy})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-bold text-[#061A2F] uppercase">Add New Fixed Capital Asset</h3>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-500 hover:text-black">✕</button>
            </div>

            <form onSubmit={handleAddAsset} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-neutral-800">Asset Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Caterpillar Skid Steer Loader"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full p-2 border border-neutral-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-800">Cost Basis ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="45000"
                    value={newCost}
                    onChange={e => setNewCost(e.target.value)}
                    className="w-full p-2 border border-neutral-300 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-800">Section 179 ($)</label>
                  <input
                    type="number"
                    placeholder="25000"
                    value={newSec179}
                    onChange={e => setNewSec179(e.target.value)}
                    className="w-full p-2 border border-neutral-300 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-800">Asset Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as any)}
                  className="w-full p-2 border border-neutral-300"
                >
                  <option value="Machinery & Equipment">Machinery &amp; Equipment (5 or 7 yr)</option>
                  <option value="Vehicles">Vehicles &gt;6,000 lbs GVWR (5 yr)</option>
                  <option value="Computers & Technology">Computers &amp; Technology (5 yr)</option>
                  <option value="Furniture & Fixtures">Furniture &amp; Fixtures (7 yr)</option>
                  <option value="Leasehold Improvements">Qualified Leasehold Improvements (15 yr)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-neutral-300 text-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#061A2F] text-white font-bold uppercase hover:bg-neutral-800"
                >
                  Save to Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
