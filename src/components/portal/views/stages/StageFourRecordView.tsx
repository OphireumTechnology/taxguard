/**
 * A/R Tax Services, LLC — Stage 04: Record Workspace
 * Displays authoritative recorded tax facts (Wages, Interest, Dividends, Business/1099,
 * Deductions, Withholdings) derived from validated evidence with strict provenance tracking.
 */

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  FileCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  HelpCircle,
  Lock,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { getStoredToken } from '../../../../services/api';

interface TaxRecordItem {
  id: string;
  category: 'wages' | 'interest' | 'dividends' | 'business_income' | 'deductions' | 'withholding' | 'credits';
  subcategory: string;
  description: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  amount: number;
  status: 'PROPOSED' | 'RECORDED' | 'DISPUTED';
  recordedAt?: string;
}

interface StageFourRecordViewProps {
  clientId: string;
  selectedTaxYear: number;
  onNavigateToStageTwo?: () => void;
  onNavigateToStageFive?: () => void;
}

export const StageFourRecordView: React.FC<StageFourRecordViewProps> = ({
  clientId,
  selectedTaxYear,
  onNavigateToStageTwo,
  onNavigateToStageFive
}) => {
  const [records, setRecords] = useState<TaxRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    const loadRecords = async () => {
      setIsLoading(true);
      try {
        const token = getStoredToken();
        const res = await fetch(`/api/case-authority/tenantA/${clientId}/eng_${selectedTaxYear}_${clientId}/cases/${selectedTaxYear}/records`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data.records) && data.records.length > 0) {
            setRecords(data.records.map((r: any) => ({
              id: r.recordId || r.id,
              category: r.category || 'wages',
              subcategory: r.subcategory || 'General Record',
              description: r.description || 'Recorded Tax Item',
              sourceDocumentId: r.sourceDocumentId,
              sourceDocumentName: r.sourceDocumentName,
              amount: Number(r.normalizedValue || r.amount || 0),
              status: r.status || 'RECORDED',
              recordedAt: r.createdAt || r.recordedAt
            })));
          } else {
            setRecords([]);
          }
        } else {
          setRecords([]);
        }
      } catch {
        if (isMounted) setRecords([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadRecords();
    return () => {
      isMounted = false;
    };
  }, [clientId, selectedTaxYear]);

  const filteredRecords = selectedCategory === 'all'
    ? records
    : records.filter(r => r.category === selectedCategory);

  const totalRecorded = records.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 04 of 18 · Record
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <DollarSign className="w-5 h-5 text-[#D4A843]" />
              <span>Certified Tax Records &amp; Source Entries</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Recorded Items: <strong className="text-white">{records.length}</strong></span>
          </div>
        </div>

        {/* The 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 04: Converting validated evidence (W-2s, 1099s, receipts) into certified tax facts.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">Review your recorded source totals below. If you received another document, upload it in Stage 02.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">Accountants verify statutory categorization, schedule ties, and state apportionment.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Stage 05 Reconcile will tie out total recorded amounts against source evidence with $0 variance.</p>
          </div>
        </div>
      </div>

      {/* Category Filter Controls */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-xs">
        {['all', 'wages', 'interest', 'dividends', 'business_income', 'deductions', 'withholding'].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
              selectedCategory === cat
                ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md'
                : 'bg-[#0D2745] text-slate-300 hover:text-white hover:bg-[#102D4F] border border-slate-700/60'
            }`}
          >
            {cat === 'all' ? 'All Records' : cat.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* Main Records List or Truthful Empty State */}
      {isLoading ? (
        <div className="p-12 text-center bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl space-y-3">
          <RefreshCw className="w-6 h-6 text-[#D4A843] animate-spin mx-auto" />
          <p className="text-xs text-slate-300">Loading certified tax records...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-12 text-center bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl space-y-4">
          <FolderOpen className="w-10 h-10 text-slate-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">No Recorded Tax Facts for TY {selectedTaxYear} Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your uploaded tax documents are currently progressing through Stage 02 and Stage 03 validation. Certified records will appear here as accountants confirm figures.
            </p>
          </div>
          {onNavigateToStageTwo && (
            <button
              type="button"
              onClick={onNavigateToStageTwo}
              className="px-4 py-2 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>View Collected Documents</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <h3 className="text-sm font-bold text-white">Verified Tax Fact Ledger</h3>
            <span className="text-xs font-mono font-bold text-emerald-400">
              Total Recorded: ${totalRecorded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="space-y-2.5">
            {filteredRecords.map((rec) => (
              <div
                key={rec.id}
                className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>{rec.description}</span>
                    <span className="text-[10px] font-mono text-[#D4A843]">[{rec.subcategory}]</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>Category: {rec.category}</span>
                    {rec.sourceDocumentName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Source: {rec.sourceDocumentName}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    ${rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {rec.status === 'RECORDED' ? '✓ Verified Record' : 'Proposed Extraction'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
