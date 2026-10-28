/**
 * TaxGuard AI – Draft Tax Workpaper & Schedule Reconciliation
 * Clear watermark: "DRAFT – NOT APPROVED FOR FILING"
 */

import React from 'react';
import { 
  FileSpreadsheet, 
  ShieldAlert, 
  CheckCircle2, 
  Download, 
  QrCode, 
  Lock, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { DraftWorkpaper } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardWorkpapersView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const workpapers = TaxGuardStorageService.getWorkpapers(userRole, userRole === 'client' ? 'client_henze_001' : undefined);
  const wp: DraftWorkpaper = workpapers[0];

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* Draft Workpaper Container with Watermark */}
      <div className="relative bg-white border border-[#D8DCE2] rounded-xs shadow-md p-6 sm:p-8 space-y-6 overflow-hidden">
        {/* Prominent Diagonal Watermark */}
        {wp.isDraft && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 opacity-10">
            <span className="text-4xl sm:text-6xl font-black text-rose-900 rotate-[-25deg] uppercase tracking-widest border-8 border-rose-900 p-6 sm:p-12 text-center">
              DRAFT – NOT APPROVED FOR FILING
            </span>
          </div>
        )}

        {/* Workpaper Header */}
        <div className="border-b-2 border-[#061A2F] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#C99A32] font-bold">
              A/R Tax Services, LLC • Workpaper Dossier
            </div>
            <h1 className="text-lg font-black text-[#061A2F] uppercase tracking-tight">
              Tax Year {wp.taxYear} Form {wp.formType} Lead Workpaper
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Client: <strong>{wp.clientName}</strong> • Engagement ID: {wp.engagementId}
            </p>
          </div>

          <div className="text-right space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-300 text-rose-800 text-[10px] font-bold uppercase rounded-xs font-mono">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>{wp.watermarkText}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Version {wp.version}.0 • Prep: {wp.preparedBy}
            </div>
          </div>
        </div>

        {/* Source Document Index */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-[#061A2F] uppercase tracking-wider">
            1. Source Document Substantive Index
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {wp.sourceDocumentIndex.map((doc) => (
              <div key={doc.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xs flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#061A2F]">{doc.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{doc.category}</div>
                </div>
                {doc.verified ? (
                  <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">
                    Verified
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">
                    Unverified
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Reconciliation Summary Table */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-[#061A2F] uppercase tracking-wider">
            2. Tax Liability & AGI Computation Summary
          </div>
          <div className="border border-slate-200 rounded-xs overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                <tr>
                  <th className="p-2.5">Schedule Item</th>
                  <th className="p-2.5">IRC Statutory Reference</th>
                  <th className="p-2.5 text-right">Computed Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="p-2.5 font-sans font-medium text-slate-800">Total Gross Income (W-2 + Schedule C)</td>
                  <td className="p-2.5 text-slate-500 font-sans">IRC § 61</td>
                  <td className="p-2.5 text-right font-bold text-slate-900">
                    ${wp.scheduleTotals.totalGrossIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-medium text-slate-800">Above-the-Line Adjustments (Deductible SE Tax)</td>
                  <td className="p-2.5 text-slate-500 font-sans">IRC § 62; IRC § 164(f)</td>
                  <td className="p-2.5 text-right text-rose-700 font-bold">
                    -${wp.scheduleTotals.totalAdjustments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="p-2.5 font-sans text-[#061A2F]">Adjusted Gross Income (AGI)</td>
                  <td className="p-2.5 text-slate-500 font-sans">Line 11 Form 1040</td>
                  <td className="p-2.5 text-right text-[#061A2F]">
                    ${wp.scheduleTotals.adjustedGrossIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-medium text-slate-800">Allowable Deductions (Standard Deduction MFJ)</td>
                  <td className="p-2.5 text-slate-500 font-sans">IRC § 63(c)</td>
                  <td className="p-2.5 text-right text-rose-700 font-bold">
                    -${wp.scheduleTotals.totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="p-2.5 font-sans text-[#061A2F]">Taxable Income</td>
                  <td className="p-2.5 text-slate-500 font-sans">Line 15 Form 1040</td>
                  <td className="p-2.5 text-right text-[#061A2F]">
                    ${wp.scheduleTotals.taxableIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-medium text-slate-800">Preliminary Federal Income Tax</td>
                  <td className="p-2.5 text-slate-500 font-sans">IRC § 1 Tax Rate Schedule</td>
                  <td className="p-2.5 text-right font-bold text-slate-900">
                    ${wp.scheduleTotals.preliminaryTaxLiability.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-medium text-slate-800">Total Payments & Withholding Credits</td>
                  <td className="p-2.5 text-slate-500 font-sans">W-2 Box 2 + ES Payments</td>
                  <td className="p-2.5 text-right font-bold text-emerald-700">
                    ${(wp.scheduleTotals.totalFederalWithholding + wp.scheduleTotals.totalEstimatedPayments).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-emerald-50/70 font-bold text-sm">
                  <td className="p-2.5 font-sans text-emerald-950">Estimated Overpayment (Refund Due)</td>
                  <td className="p-2.5 text-emerald-900 font-sans">Line 34 Form 1040</td>
                  <td className="p-2.5 text-right text-emerald-900">
                    ${Math.abs(wp.scheduleTotals.estimatedRefundOrDue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Cryptographic Seal & QR Verification Footer */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xs font-mono">
          <div>
            <div className="text-[10px] text-slate-400">CRYPTOGRAPHIC SHA-256 HASH</div>
            <div className="font-bold text-slate-800 text-[11px]">{wp.cryptographicHash}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-slate-400">PUBLIC VERIFICATION ID</div>
              <div className="font-bold text-[#C99A32]">{wp.qrVerificationId}</div>
            </div>
            <div className="p-1.5 bg-white border border-slate-300 rounded shadow-xs">
              <QrCode className="w-8 h-8 text-[#061A2F]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
