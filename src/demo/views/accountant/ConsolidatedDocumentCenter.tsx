/**
 * A/R Tax Services, LLC - Consolidated Client Document Result & Document Center
 * Section 7, 8, 9, 10: Complete document registry, 34 metadata fields, search, filters,
 * split-screen visual preview, AI extraction analysis, and human-in-the-loop override controls.
 */

import React, { useState } from 'react';
import { 
  FolderOpen, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  RotateCw, 
  AlertTriangle, 
  FileText, 
  Copy, 
  Send, 
  Edit3, 
  ShieldAlert, 
  Sparkles,
  Download,
  Lock,
  MessageSquare,
  Maximize2,
  Minimize2,
  ExternalLink,
  Tag,
  Clock
} from 'lucide-react';
import { ConsolidatedDocument, ExtractedField } from '../../types/accountantCenter';
import { accountantCenterService } from '../../services/AccountantCenterService';

interface ConsolidatedDocumentCenterProps {
  isDark: boolean;
}

export const ConsolidatedDocumentCenter: React.FC<ConsolidatedDocumentCenterProps> = ({ isDark }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<string>('ALL');
  const [filterMismatchOnly, setFilterMismatchOnly] = useState(false);
  const [filterDuplicateOnly, setFilterDuplicateOnly] = useState(false);
  const [activeModalDoc, setActiveModalDoc] = useState<ConsolidatedDocument | null>(null);

  // Edit / Override state inside modal
  const [isEditingData, setIsEditingData] = useState(false);
  const [overrideFieldLabel, setOverrideFieldLabel] = useState('');
  const [overrideVerifiedValue, setOverrideVerifiedValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  // Reclassify state
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [newClassificationType, setNewClassificationType] = useState('');
  const [reclassifyReason, setReclassifyReason] = useState('');

  // Note edits
  const [privateNoteText, setPrivateNoteText] = useState('');
  const [clientNoteText, setClientNoteText] = useState('');

  const documents = accountantCenterService.getDocuments();
  const client = accountantCenterService.getSelectedClient();
  const taxYear = accountantCenterService.getSelectedTaxYear();

  // Filter logic
  const filteredDocs = documents.filter(doc => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = 
        doc.id.toLowerCase().includes(q) ||
        doc.documentType.toLowerCase().includes(q) ||
        doc.payerEmployer.toLowerCase().includes(q) ||
        doc.sourceFile.toLowerCase().includes(q) ||
        doc.formNumber.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (selectedCategory !== 'ALL' && !doc.category.includes(selectedCategory)) {
      return false;
    }

    if (selectedReviewStatus !== 'ALL' && doc.reviewStatus !== selectedReviewStatus) {
      return false;
    }

    if (filterMismatchOnly && doc.taxYearMatchStatus === 'Matched') {
      return false;
    }

    if (filterDuplicateOnly && doc.duplicateStatus === 'Not Duplicate') {
      return false;
    }

    return true;
  });

  const handleOpenDocModal = (doc: ConsolidatedDocument) => {
    setActiveModalDoc(doc);
    setPrivateNoteText(doc.accountantNotes || '');
    setClientNoteText(doc.clientVisibleNotes || '');
    setIsEditingData(false);
    setIsReclassifying(false);
  };

  const handleApprove = () => {
    if (!activeModalDoc) return;
    accountantCenterService.approveDocument(activeModalDoc.id);
    setActiveModalDoc(prev => prev ? { ...prev, reviewStatus: 'Approved', reviewer: 'Marcus Vance, EA' } : null);
  };

  const handleReject = () => {
    if (!activeModalDoc) return;
    const reason = prompt('Please specify the accountant rationale for document rejection:');
    if (!reason) return;
    accountantCenterService.rejectDocument(activeModalDoc.id, reason);
    setActiveModalDoc(prev => prev ? { ...prev, reviewStatus: 'Rejected' } : null);
  };

  const handleToggleDuplicate = () => {
    if (!activeModalDoc) return;
    const isDup = activeModalDoc.duplicateStatus === 'Duplicate' || activeModalDoc.duplicateStatus === 'Possible Duplicate';
    accountantCenterService.markDuplicate(activeModalDoc.id, !isDup);
    setActiveModalDoc(prev => prev ? { 
      ...prev, 
      duplicateStatus: isDup ? 'Not Duplicate' : 'Duplicate',
      qualityStatus: isDup ? 'Complete' : 'Duplicate'
    } : null);
  };

  const handleRequestReplacement = () => {
    if (!activeModalDoc) return;
    const reason = prompt('Reason for requesting replacement document from client (e.g. illegible scan, missing pages, wrong year):');
    if (!reason) return;
    accountantCenterService.requestReplacement(activeModalDoc.id, reason);
    setActiveModalDoc(prev => prev ? { ...prev, reviewStatus: 'Needs Correction' } : null);
    alert('Replacement request registered in Missing Document Center and scheduled for client notification.');
  };

  const handleSaveNotes = () => {
    if (!activeModalDoc) return;
    accountantCenterService.updateDocumentNotes(activeModalDoc.id, privateNoteText, clientNoteText);
    setActiveModalDoc(prev => prev ? { ...prev, accountantNotes: privateNoteText, clientVisibleNotes: clientNoteText } : null);
    alert('Accountant notes saved.');
  };

  const handleApplyOverride = () => {
    if (!activeModalDoc || !overrideFieldLabel || !overrideVerifiedValue || !overrideReason) {
      alert('Please specify the field label, the verified value, and the documentation rationale.');
      return;
    }
    accountantCenterService.overrideExtractedField(activeModalDoc.id, overrideFieldLabel, overrideVerifiedValue, overrideReason);
    setIsEditingData(false);
    setOverrideFieldLabel('');
    setOverrideVerifiedValue('');
    setOverrideReason('');
    // Refresh modal doc
    const updated = accountantCenterService.getDocumentById(activeModalDoc.id);
    if (updated) setActiveModalDoc({ ...updated });
  };

  const handleApplyReclassification = () => {
    if (!activeModalDoc || !newClassificationType || !reclassifyReason) {
      alert('Please enter the target document classification type and explanation.');
      return;
    }
    accountantCenterService.reclassifyDocument(
      activeModalDoc.id,
      newClassificationType,
      newClassificationType,
      activeModalDoc.category,
      reclassifyReason
    );
    setIsReclassifying(false);
    const updated = accountantCenterService.getDocumentById(activeModalDoc.id);
    if (updated) setActiveModalDoc({ ...updated });
  };

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
            Section 7 &bull; Consolidated Client Document Result
          </div>
          <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
            Document Center &amp; AI Extraction Repository
          </h2>
          <p className={`text-xs ${textSecondary} mt-0.5`}>
            Consolidated intake for <strong>{client.name}</strong> &bull; Filing Cycle: <strong className="font-mono">CY{taxYear}</strong>. Review, override AI extractions, manage duplicates, and certify workpaper inputs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 bg-neutral-100 dark:bg-neutral-800 border rounded border-neutral-300 dark:border-neutral-700">
            Showing <strong>{filteredDocs.length}</strong> of <strong>{documents.length}</strong> records
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 border rounded-lg shadow-sm ${cardBg} space-y-3`}>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Document ID, form number, employer, institution, or source file..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="text-xs py-1.5 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded focus:outline-none"
          >
            <option value="ALL">All Document Categories</option>
            <option value="01 — Income">01 — Income (W-2, 1099, SSA)</option>
            <option value="02 — Business">02 — Business (P&amp;L, Expenses)</option>
            <option value="03 — Rental">03 — Rental Property</option>
            <option value="04 — Investments">04 — Investments &amp; Capital Gains</option>
            <option value="05 — Deductions">05 — Deductions &amp; Itemized</option>
            <option value="06 — Tax Payments">06 — Payments &amp; Withholding</option>
            <option value="08 — International">08 — Foreign &amp; FBAR</option>
          </select>

          <select
            value={selectedReviewStatus}
            onChange={e => setSelectedReviewStatus(e.target.value)}
            className="text-xs py-1.5 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded focus:outline-none"
          >
            <option value="ALL">All Review Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Accountant Review Required">Review Required</option>
            <option value="Needs Correction">Needs Correction</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-200 dark:border-neutral-800 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={filterMismatchOnly}
              onChange={e => setFilterMismatchOnly(e.target.checked)}
              className="rounded text-black focus:ring-0"
            />
            <span>Tax-Year Mismatch Only</span>
          </label>

          <span className="text-neutral-300 dark:text-neutral-700">|</span>

          <label className="flex items-center gap-1.5 cursor-pointer text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={filterDuplicateOnly}
              onChange={e => setFilterDuplicateOnly(e.target.checked)}
              className="rounded text-black focus:ring-0"
            />
            <span>Duplicates Only</span>
          </label>
        </div>
      </div>

      {/* CONSOLIDATED DOCUMENTS TABLE (Section 7, 8, 9) */}
      <div className={`border rounded-lg shadow-sm overflow-x-auto ${cardBg}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500">
              <th className="p-3">Doc ID &amp; Type</th>
              <th className="p-3">Payer / Employer / Source</th>
              <th className="p-3">Tax Period</th>
              <th className="p-3 text-right">Federal / Gross</th>
              <th className="p-3 text-right">Federal WH</th>
              <th className="p-3 text-center">AI Conf.</th>
              <th className="p-3">Quality &amp; Match</th>
              <th className="p-3">Review Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filteredDocs.map((doc) => (
              <tr 
                key={doc.id}
                className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
              >
                <td className="p-3">
                  <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <span>{doc.formNumber}</span>
                    {doc.duplicateStatus !== 'Not Duplicate' && (
                      <span className="px-1.5 py-0.2 bg-red-100 text-red-800 text-[9px] font-mono rounded font-bold">
                        DUP
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                    {doc.id} &bull; {doc.sourceFile}
                  </div>
                </td>

                <td className="p-3">
                  <div className="font-medium text-neutral-800 dark:text-neutral-200">
                    {doc.payerEmployer}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {doc.category.split('—')[1] || doc.category}
                  </div>
                </td>

                <td className="p-3 font-mono text-[11px]">
                  <span className={doc.taxPeriod.includes('2025') ? 'text-neutral-800 dark:text-neutral-300' : 'text-amber-600 font-bold'}>
                    {doc.taxPeriod}
                  </span>
                </td>

                <td className="p-3 font-mono text-right font-medium text-neutral-900 dark:text-white">
                  ${doc.federalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>

                <td className="p-3 font-mono text-right text-neutral-600 dark:text-neutral-400">
                  {doc.federalWithholding > 0 
                    ? `$${doc.federalWithholding.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
                    : '—'}
                </td>

                <td className="p-3 text-center font-mono">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    doc.aiConfidence >= 90
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : doc.aiConfidence >= 75
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  }`}>
                    {doc.aiConfidence.toFixed(1)}%
                  </span>
                </td>

                <td className="p-3">
                  <div className="flex flex-col gap-1">
                    {doc.taxYearMatchStatus !== 'Matched' && (
                      <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Year Mismatch</span>
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {doc.qualityStatus}
                    </span>
                  </div>
                </td>

                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    doc.reviewStatus === 'Approved'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : doc.reviewStatus === 'Rejected'
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      : doc.reviewStatus === 'Needs Correction'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {doc.reviewStatus === 'Approved' && <CheckCircle className="w-3 h-3" />}
                    <span>{doc.reviewStatus}</span>
                  </span>
                </td>

                <td className="p-3 text-right">
                  <button
                    onClick={() => handleOpenDocModal(doc)}
                    className="px-2.5 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 rounded text-xs font-bold uppercase hover:opacity-90 flex items-center gap-1 ml-auto"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                </td>
              </tr>
            ))}

            {filteredDocs.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-neutral-500 font-mono text-xs">
                  No documents match the specified filter criteria for client {client.name} (TY{taxYear}).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 10: DOCUMENT PREVIEW + AI EXTRACTION PANEL MODAL */}
      {activeModalDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className={`w-full max-w-5xl max-h-[92vh] overflow-y-auto border rounded-xl shadow-2xl ${
            isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
          }`}>
            {/* Modal Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between sticky top-0 bg-inherit z-10">
              <div>
                <div className="text-[10px] font-mono uppercase text-neutral-500">
                  Document Inspection Dossier &bull; {activeModalDoc.id}
                </div>
                <h3 className="text-base font-bold uppercase">
                  {activeModalDoc.documentType} — {activeModalDoc.payerEmployer}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  activeModalDoc.reviewStatus === 'Approved'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {activeModalDoc.reviewStatus}
                </span>

                <button
                  onClick={() => setActiveModalDoc(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split Screen Grid (Section 10) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200 dark:divide-neutral-800">
              {/* LEFT: Simulated Visual Document Preview */}
              <div className="p-5 space-y-4 bg-neutral-100/50 dark:bg-neutral-950/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>Visual Document Scan ({activeModalDoc.sourceFile})</span>
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    Page {activeModalDoc.pageNumber} of {activeModalDoc.totalPages}
                  </span>
                </div>

                {/* Document Facsimile Box */}
                <div className="border-2 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 rounded shadow-inner space-y-4 font-mono text-xs">
                  <div className="border-b pb-2 flex justify-between items-start">
                    <div>
                      <div className="text-[10px] text-neutral-400">FORM / DOCUMENT TITLE</div>
                      <div className="font-bold text-sm text-black dark:text-white">{activeModalDoc.formNumber}</div>
                      <div className="text-[10px] text-neutral-500">{activeModalDoc.taxPeriod} Wage and Tax Statement</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-neutral-400">OMB No. 1545-0008</div>
                      <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{activeModalDoc.taxYear}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50/50 dark:bg-neutral-800/40">
                      <span className="text-[9px] text-neutral-500 block">a Employee's Social Security Number</span>
                      <span className="font-bold text-black dark:text-white">{client.ssnEinMasked}</span>
                    </div>
                    <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50/50 dark:bg-neutral-800/40">
                      <span className="text-[9px] text-neutral-500 block">b Employer Identification Number (EIN)</span>
                      <span className="font-bold text-black dark:text-white">XX-XXX8921</span>
                    </div>
                  </div>

                  <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded">
                    <span className="text-[9px] text-neutral-500 block">c Employer's Name, Address, and ZIP</span>
                    <span className="font-bold text-black dark:text-white">{activeModalDoc.payerEmployer}</span>
                    <span className="text-[10px] text-neutral-500 block">100 Innovation Way, Columbia, SC 29201</span>
                  </div>

                  {/* Highlighted Boxes with OCR extraction tags */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 border-2 border-emerald-500/80 bg-emerald-50/30 dark:bg-emerald-950/20 rounded relative">
                      <span className="text-[9px] text-emerald-800 dark:text-emerald-300 font-bold block">
                        Box 1 Wages, tips, other compensation
                      </span>
                      <span className="text-base font-bold text-black dark:text-white">
                        ${activeModalDoc.federalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="absolute top-1 right-1 px-1 text-[8px] bg-emerald-600 text-white rounded">
                        OCR {activeModalDoc.aiConfidence.toFixed(0)}%
                      </span>
                    </div>

                    <div className="p-2 border-2 border-blue-500/80 bg-blue-50/30 dark:bg-blue-950/20 rounded relative">
                      <span className="text-[9px] text-blue-800 dark:text-blue-300 font-bold block">
                        Box 2 Federal income tax withheld
                      </span>
                      <span className="text-base font-bold text-black dark:text-white">
                        ${activeModalDoc.federalWithholding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="absolute top-1 right-1 px-1 text-[8px] bg-blue-600 text-white rounded">
                        OCR
                      </span>
                    </div>
                  </div>

                  <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded">
                    <span className="text-[9px] text-neutral-500 block">e Employee's Name and Address</span>
                    <span className="font-bold text-black dark:text-white">{client.name}</span>
                  </div>
                </div>

                {/* Source Traceability Footer */}
                <div className="p-3 border rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 space-y-1.5 text-xs font-mono">
                  <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Source-to-Return Traceability Link</span>
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    Source: <strong className="text-neutral-800 dark:text-neutral-200">{activeModalDoc.sourceFile}</strong> &bull; Page {activeModalDoc.pageNumber} &bull; Box 1 &bull; Extracted: ${activeModalDoc.federalAmount.toFixed(2)} &bull; Verified By: {activeModalDoc.reviewer || 'Pending'}
                  </div>
                </div>
              </div>

              {/* RIGHT: AI Document Analysis & Accountant Override Panel */}
              <div className="p-5 space-y-5">
                {/* AI Analysis Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>AI Document Analysis</span>
                    </h4>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800">
                      Confidence: {activeModalDoc.aiConfidence.toFixed(1)}%
                    </span>
                  </div>

                  <div className="p-3 border rounded border-neutral-200 dark:border-neutral-800 space-y-1.5 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-neutral-500 block font-mono">DOCUMENT TYPE</span>
                        <span className="font-bold">{activeModalDoc.documentType}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block font-mono">TAX YEAR</span>
                        <span className="font-mono font-bold">{activeModalDoc.taxYear}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block font-mono">IDENTIFIED TAXPAYER</span>
                        <span className="font-bold">{activeModalDoc.taxpayer}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block font-mono">PAYER / EMPLOYER</span>
                        <span className="font-bold">{activeModalDoc.payerEmployer}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Extracted Fields Table with Override State */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                      Extracted Fields &amp; Accountant Overrides
                    </h4>
                    <button
                      onClick={() => setIsEditingData(!isEditingData)}
                      className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingData ? 'Cancel Override' : 'Override Value'}</span>
                    </button>
                  </div>

                  {isEditingData && (
                    <div className="p-3 border rounded border-blue-400 bg-blue-50 dark:bg-blue-950/40 space-y-2 text-xs">
                      <div className="font-bold text-blue-900 dark:text-blue-200">
                        Record Human-in-the-Loop Override
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Field Label (e.g. Box 1 Wages)"
                          value={overrideFieldLabel}
                          onChange={e => setOverrideFieldLabel(e.target.value)}
                          className="p-1.5 text-xs bg-white dark:bg-neutral-900 border rounded"
                        />
                        <input
                          type="text"
                          placeholder="Verified Value"
                          value={overrideVerifiedValue}
                          onChange={e => setOverrideVerifiedValue(e.target.value)}
                          className="p-1.5 text-xs bg-white dark:bg-neutral-900 border rounded"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Accountant Rationale / Source Document Basis"
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        className="w-full p-1.5 text-xs bg-white dark:bg-neutral-900 border rounded"
                      />
                      <button
                        onClick={handleApplyOverride}
                        className="px-3 py-1 bg-blue-700 text-white rounded text-xs font-bold uppercase"
                      >
                        Apply Override to Return
                      </button>
                    </div>
                  )}

                  <div className="border rounded border-neutral-200 dark:border-neutral-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-neutral-50 dark:bg-neutral-800/60 text-[10px] font-mono uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                          <th className="p-2">Field</th>
                          <th className="p-2">AI Original</th>
                          <th className="p-2">Accountant Verified</th>
                          <th className="p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {activeModalDoc.extractedFields.map((field, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                            <td className="p-2 font-medium">{field.label}</td>
                            <td className="p-2 font-mono text-neutral-600 dark:text-neutral-400">
                              {typeof field.originalAiValue === 'number' 
                                ? `$${field.originalAiValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
                                : field.originalAiValue}
                            </td>
                            <td className="p-2 font-mono font-bold text-black dark:text-white">
                              {typeof field.verifiedValue === 'number'
                                ? `$${field.verifiedValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                : field.verifiedValue}
                              {field.isModified && (
                                <span className="block text-[9px] text-amber-600 font-normal">
                                  Overridden: {field.modificationReason}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center font-mono">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                field.isModified ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {field.isModified ? 'OVERRIDDEN' : 'CONFIRMED'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes Section: Private Accountant Note vs Client Visible Note */}
                <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase text-neutral-500 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-600" />
                      <span>Accountant Private Note (Internal Eyes Only — Never Shown to Client)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={privateNoteText}
                      onChange={e => setPrivateNoteText(e.target.value)}
                      placeholder="Enter internal audit, review, or statutory reconciliation notes..."
                      className="w-full mt-1 p-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase text-neutral-500 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-blue-600" />
                      <span>Client-Visible Note (Visible in Client Document Center)</span>
                    </label>
                    <textarea
                      rows={1}
                      value={clientNoteText}
                      onChange={e => setClientNoteText(e.target.value)}
                      placeholder="Optional message visible to taxpayer in portal..."
                      className="w-full mt-1 p-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleSaveNotes}
                    className="px-3 py-1 bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 rounded text-xs font-bold uppercase hover:opacity-90"
                  >
                    Save Notes
                  </button>
                </div>

                {/* Primary Action Buttons (Section 10) */}
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border rounded border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-2">
                  <button
                    onClick={handleApprove}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold uppercase hover:bg-emerald-700 flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Approve Document</span>
                  </button>

                  <button
                    onClick={() => setIsReclassifying(!isReclassifying)}
                    className="px-3 py-1.5 border border-neutral-400 dark:border-neutral-600 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Change Classification
                  </button>

                  <button
                    onClick={handleToggleDuplicate}
                    className="px-3 py-1.5 border border-neutral-400 dark:border-neutral-600 rounded text-xs font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{activeModalDoc.duplicateStatus !== 'Not Duplicate' ? 'Unmark Duplicate' : 'Mark Duplicate'}</span>
                  </button>

                  <button
                    onClick={handleRequestReplacement}
                    className="px-3 py-1.5 border border-amber-400 text-amber-800 dark:text-amber-300 rounded text-xs font-bold uppercase hover:bg-amber-50 dark:hover:bg-amber-950"
                  >
                    Request Replacement
                  </button>

                  <button
                    onClick={handleReject}
                    className="px-3 py-1.5 border border-red-400 text-red-700 dark:text-red-400 rounded text-xs font-bold uppercase hover:bg-red-50 dark:hover:bg-red-950 ml-auto flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>

                {isReclassifying && (
                  <div className="p-3 border rounded border-amber-400 bg-amber-50 dark:bg-amber-950/40 space-y-2 text-xs">
                    <div className="font-bold text-amber-900 dark:text-amber-200">
                      Reclassify Document Type
                    </div>
                    <input
                      type="text"
                      placeholder="New Classification (e.g. Form 1099-NEC, Form 1098, Schedule C P&L)"
                      value={newClassificationType}
                      onChange={e => setNewClassificationType(e.target.value)}
                      className="w-full p-1.5 text-xs bg-white dark:bg-neutral-900 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="Accountant Reason for Reclassification"
                      value={reclassifyReason}
                      onChange={e => setReclassifyReason(e.target.value)}
                      className="w-full p-1.5 text-xs bg-white dark:bg-neutral-900 border rounded"
                    />
                    <button
                      onClick={handleApplyReclassification}
                      className="px-3 py-1 bg-amber-700 text-white rounded text-xs font-bold uppercase"
                    >
                      Confirm Reclassification
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
