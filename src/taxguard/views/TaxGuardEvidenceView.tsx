/**
 * TaxGuard AI – Evidence & Workpaper Provenance Library
 * Complete immutable trace connecting accounting entries, tax line items,
 * and reviewer decisions back to original documents and pixel coordinates.
 */

import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  CheckCircle2, 
  ShieldCheck, 
  FileText
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { EvidenceLibraryItem, DocumentCategory } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardEvidenceView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [items] = useState<EvidenceLibraryItem[]>(() =>
    TaxGuardStorageService.getEvidenceLibrary(userRole, userRole === 'client' ? 'client_henze_001' : undefined)
  );
  const [selectedItem, setSelectedItem] = useState<EvidenceLibraryItem | null>(items[0] || null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredItems = items.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (searchTerm && 
      !item.documentName.toLowerCase().includes(searchTerm.toLowerCase()) && 
      !item.extractedFieldKey.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !item.workflowUsages.join(' ').toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* Header bar */}
      <div className="bg-white border border-[#D8DCE2] p-5 rounded-xs shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
            <Database className="w-4 h-4 text-[#C99A32]" />
            <span>Statutory Evidence & Workpaper Provenance Library</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable trace connecting every reported tax number and accounting adjustment to source OCR evidentiary records.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search field or document..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-xs text-xs outline-hidden focus:border-[#C99A32] w-52"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent font-medium text-[#061A2F] outline-hidden cursor-pointer"
            >
              <option value="all">All Evidence Types ({items.length})</option>
              <option value="W-2">W-2 Wage Statements</option>
              <option value="1099-NEC">1099-NEC Forms</option>
              <option value="Bank Statement">Bank Statements</option>
              <option value="Receipt">Expense Receipts</option>
              <option value="Schedule K-1">Schedule K-1</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Library Items & Provenance Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Items List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Recorded Evidentiary Artifacts ({filteredItems.length})
          </div>

          {filteredItems.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-4 rounded-xs border cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-white border-[#C99A32] shadow-sm ring-1 ring-[#C99A32]/40' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-xs bg-slate-100 text-slate-600">
                      {item.category}
                    </span>
                    <h3 className="text-xs font-bold text-[#061A2F] mt-1">{item.extractedFieldKey}</h3>
                    <div className="text-[11px] font-mono text-[#C99A32] mt-0.5">
                      {typeof item.extractedValue === 'number' ? `$${item.extractedValue.toLocaleString()}` : item.extractedValue}
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Locked</span>
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Doc: {item.documentName} (p. {item.pageNumber})</span>
                  <span>TY{item.taxYear}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Item Provenance Inspector */}
        <div className="lg:col-span-7">
          {selectedItem ? (
            <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-6 space-y-6">
              {/* Top Banner */}
              <div className="border-b border-slate-200 pb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#C99A32] bg-[#061A2F] px-2 py-0.5 rounded-xs">
                      {selectedItem.id}
                    </span>
                    <span className="text-xs text-slate-500">
                      Engagement: {selectedItem.engagementId} (TY{selectedItem.taxYear})
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#061A2F] mt-1.5">{selectedItem.extractedFieldKey}</h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Client: {selectedItem.clientName}
                  </p>
                </div>

                <span className="text-xs font-bold uppercase text-purple-900 bg-purple-50 border border-purple-200 px-2 py-1 rounded-xs">
                  Reviewer Certified
                </span>
              </div>

              {/* Provenance Map Card */}
              <div className="border border-slate-200 rounded-xs bg-slate-50/50 p-4 space-y-3 text-xs">
                <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C99A32]" />
                  <span>Immutable Chain-of-Custody & Evidence Trail</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 p-2.5 rounded-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Source File</span>
                    <span className="font-semibold text-slate-800">{selectedItem.documentName}</span>
                    <span className="text-slate-500 block text-[11px]">Page {selectedItem.pageNumber}</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-2.5 rounded-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Extracted Value</span>
                    <span className="font-mono font-bold text-[#061A2F]">
                      {typeof selectedItem.extractedValue === 'number' ? `$${selectedItem.extractedValue.toLocaleString()}` : selectedItem.extractedValue}
                    </span>
                    <span className="text-slate-500 block text-[11px]">Key: {selectedItem.extractedFieldKey}</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-2.5 rounded-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Certified Reviewer</span>
                    <span className="font-semibold text-slate-800">{selectedItem.provenanceTrail.verifiedBy}</span>
                    <span className="text-slate-500 block text-[11px]">{selectedItem.provenanceTrail.verifiedAt}</span>
                  </div>

                  <div className="bg-white border border-slate-200 p-2.5 rounded-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">SHA-256 Digest Checksum</span>
                    <span className="font-mono text-[10px] text-slate-600 break-all">{selectedItem.provenanceTrail.sha256Hash}</span>
                  </div>
                </div>
              </div>

              {/* Workflow Usages */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
                  Authorized Workpaper & Tax Form Mappings
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.workflowUsages.map((usage, i) => (
                    <span key={i} className="font-mono text-xs bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xs text-[#061A2F] font-semibold">
                      {usage}
                    </span>
                  ))}
                </div>
              </div>

              {/* Statutory Explanation & Regulatory Ties */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
                  Practitioner Audit Workpaper Notes
                </span>
                <div className="border border-slate-200 p-3 rounded-xs bg-white text-slate-700 leading-relaxed">
                  Verified against Form 1040 line item mappings and general ledger transactions. In accordance with Treasury Department Circular No. 230 § 10.22, due diligence has been exercised to ensure absolute accuracy of this line item. Retention Category: {selectedItem.retentionCategory}.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xs p-12 text-center text-slate-400 text-xs">
              Select an evidentiary item to inspect its provenance trace and SHA-256 verification hash.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
