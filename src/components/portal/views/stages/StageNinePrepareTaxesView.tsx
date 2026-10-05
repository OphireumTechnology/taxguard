/**
 * A/R Tax Services, LLC — Stage 09: Prepare Taxes Workspace
 * Official Form 1040 and state tax preparation calculation engine.
 * Deterministic computation derived strictly from certified Stage 04 records and Stage 05 reconciliations.
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  Layers,
  HelpCircle,
  AlertCircle,
  Building2,
  Calculator,
  FolderOpen
} from 'lucide-react';
import { getStoredToken } from '../../../../services/api';

export interface Form1040Summary {
  taxYear: number;
  filingStatus: string;
  wagesSalariesTips: number;
  taxableInterest: number;
  ordinaryDividends: number;
  qualifiedDividends: number;
  businessIncome: number;
  totalIncome: number;
  adjustmentsToIncome: number;
  adjustedGrossIncome: number;
  deductionType: 'STANDARD' | 'ITEMIZED';
  deductionAmount: number;
  qbiDeduction: number;
  taxableIncome: number;
  taxCalculated: number;
  totalCredits: number;
  totalWithholding: number;
  estimatedPayments: number;
  netRefundOrAmountOwed: number; // Positive = refund, Negative = amount owed
  stateTaxDueOrRefund: number;
  calculationStatus: 'PROVISIONAL' | 'CALCULATED' | 'LOCKED' | 'APPROVED';
  calculatedAt?: string;
}

interface StageNinePrepareTaxesViewProps {
  clientId: string;
  selectedTaxYear: number;
  onNavigateToStageEight?: () => void;
  onNavigateToStageTen?: () => void;
}

export const StageNinePrepareTaxesView: React.FC<StageNinePrepareTaxesViewProps> = ({
  clientId,
  selectedTaxYear,
  onNavigateToStageEight,
  onNavigateToStageTen
}) => {
  const [summary, setSummary] = useState<Form1040Summary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'1040_summary' | 'schedules' | 'state_return'>('1040_summary');

  useEffect(() => {
    let isMounted = true;
    const fetchReturnCalculation = async () => {
      setIsLoading(true);
      try {
        const token = getStoredToken();
        const res = await fetch(`/api/case-authority/tenantA/${clientId}/eng_${selectedTaxYear}_${clientId}/cases/${selectedTaxYear}/1040-calculation`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.calculation) {
            setSummary(data.calculation);
          } else {
            setSummary(null);
          }
        } else {
          setSummary(null);
        }
      } catch {
        if (isMounted) setSummary(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchReturnCalculation();
    return () => {
      isMounted = false;
    };
  }, [clientId, selectedTaxYear]);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 09 of 18 · Prepare Taxes
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <Calculator className="w-5 h-5 text-[#D4A843]" />
              <span>Federal Form 1040 &amp; State Return Preparation</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Status: <strong className="text-white">{summary ? summary.calculationStatus : 'AWAITING_INTAKE'}</strong></span>
          </div>
        </div>

        {/* 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium block">1. What is this stage?</span>
            <span className="text-white font-semibold block">Return Calculation</span>
            <p className="text-[11px] text-slate-300">Deterministically calculates federal taxable income, deductions, and tax liability using certified tax facts.</p>
          </div>
          <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium block">2. Why does it matter?</span>
            <span className="text-white font-semibold block">Accuracy &amp; Optimization</span>
            <p className="text-[11px] text-slate-300">Applies all eligible statutory credits, § 199A QBI deductions, and state adjustments to optimize your legal tax position.</p>
          </div>
          <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium block">3. What is needed to pass?</span>
            <span className="text-white font-semibold block">Math &amp; Cross-Schedule Tie-Out</span>
            <p className="text-[11px] text-slate-300">Schedules A, B, C, D, and Form 1040 line items must match certified Stage 04 records with zero discrepancy.</p>
          </div>
          <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 font-medium block">4. What happens next?</span>
            <span className="text-white font-semibold block">Stage 10: Approve</span>
            <p className="text-[11px] text-slate-300">Elena Rostova, CPA signs the return approval seal before sending Form 8879 for taxpayer authorization.</p>
          </div>
        </div>
      </div>

      {/* Main Preparation Interface */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('1040_summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === '1040_summary'
                  ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md'
                  : 'text-slate-300 hover:text-white bg-[#06182B] border border-slate-700'
              }`}
            >
              Form 1040 Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedules')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'schedules'
                  ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md'
                  : 'text-slate-300 hover:text-white bg-[#06182B] border border-slate-700'
              }`}
            >
              Schedules 1-3 &amp; A-D
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('state_return')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'state_return'
                  ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md'
                  : 'text-slate-300 hover:text-white bg-[#06182B] border border-slate-700'
              }`}
            >
              State Return (SC-1040)
            </button>
          </div>

          {summary && (
            <div className="text-xs font-mono text-right">
              <span className="text-slate-400">Calculated: </span>
              <span className="text-[#D4A843] font-bold">{summary.calculatedAt ? new Date(summary.calculatedAt).toLocaleDateString() : 'Active'}</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Loading authoritative tax preparation calculations...
          </div>
        ) : !summary ? (
          <div className="p-8 text-center bg-[#06182B]/60 rounded-xl border border-dashed border-slate-700 space-y-3">
            <FolderOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-white">
              No Calculated Tax Return Figures on File for Tax Year {selectedTaxYear}
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Tax calculation begins once all required documents are validated in Stage 03 and certified as tax records in Stage 04. No fabricated calculations are displayed under the zero-data rule.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Net Result Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#06182B] rounded-xl border border-slate-700 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Adjusted Gross Income (AGI)</span>
                <div className="text-2xl font-bold text-white font-mono">
                  ${summary.adjustedGrossIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-slate-400">Form 1040, Line 11</span>
              </div>

              <div className="p-4 bg-[#06182B] rounded-xl border border-slate-700 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Total Tax Liability</span>
                <div className="text-2xl font-bold text-amber-300 font-mono">
                  ${summary.taxCalculated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-slate-400">Federal Tax after allowable credits</span>
              </div>

              <div className={`p-4 bg-[#06182B] rounded-xl border space-y-1 ${
                summary.netRefundOrAmountOwed >= 0 ? 'border-emerald-500/50' : 'border-amber-500/50'
              }`}>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  {summary.netRefundOrAmountOwed >= 0 ? 'Estimated Federal Refund' : 'Federal Balance Due'}
                </span>
                <div className={`text-2xl font-bold font-mono ${
                  summary.netRefundOrAmountOwed >= 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  ${Math.abs(summary.netRefundOrAmountOwed).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-slate-400">
                  {summary.netRefundOrAmountOwed >= 0 ? 'Form 1040, Line 35a' : 'Form 1040, Line 37'}
                </span>
              </div>
            </div>

            {/* Line by Line Breakdown Table */}
            <div className="bg-[#06182B] rounded-xl border border-slate-800 overflow-hidden text-xs">
              <div className="px-4 py-3 bg-[#071F36] border-b border-slate-800 font-bold text-white flex justify-between items-center">
                <span>Form 1040 Major Reporting Lines</span>
                <span className="font-mono text-[#D4A843] text-[11px]">TY {selectedTaxYear}</span>
              </div>
              <div className="divide-y divide-slate-800/80 font-mono">
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-300">Wages, Salaries, Tips (Line 1a)</span>
                  <span className="text-white font-bold">${summary.wagesSalariesTips.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-300">Taxable Interest &amp; Ordinary Dividends (Lines 2b &amp; 3b)</span>
                  <span className="text-white font-bold">${(summary.taxableInterest + summary.ordinaryDividends).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-300">Business Income or Loss (Schedule 1, Line 3)</span>
                  <span className="text-white font-bold">${summary.businessIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between bg-[#0B233D]/50">
                  <span className="text-[#D4A843] font-bold">Total Gross Income (Line 9)</span>
                  <span className="text-[#D4A843] font-bold">${summary.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-300">Deduction Method ({summary.deductionType})</span>
                  <span className="text-emerald-400 font-bold">-${summary.deductionAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                {summary.qbiDeduction > 0 && (
                  <div className="px-4 py-2.5 flex justify-between">
                    <span className="text-slate-300">Qualified Business Income Deduction (QBID § 199A)</span>
                    <span className="text-emerald-400 font-bold">-${summary.qbiDeduction.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="px-4 py-2.5 flex justify-between bg-[#0B233D]/50">
                  <span className="text-white font-bold">Taxable Income (Line 15)</span>
                  <span className="text-white font-bold">${summary.taxableIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between">
                  <span className="text-slate-300">Total Payments &amp; Federal Withholding (Line 33)</span>
                  <span className="text-blue-300 font-bold">${(summary.totalWithholding + summary.estimatedPayments).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700/60">
          {onNavigateToStageEight ? (
            <button
              type="button"
              onClick={onNavigateToStageEight}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              &larr; Stage 08: Plan
            </button>
          ) : <div />}

          {onNavigateToStageTen && (
            <button
              type="button"
              onClick={onNavigateToStageTen}
              className="px-4 py-2 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Continue to Stage 10: Approve</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
