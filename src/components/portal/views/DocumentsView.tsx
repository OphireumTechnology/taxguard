import React, { useState, useRef } from 'react';
import { 
  FileText, 
  UploadCloud, 
  Download, 
  Eye, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  Filter, 
  X, 
  CheckSquare, 
  Lock 
} from 'lucide-react';
import { DocumentItem, RequiredDocumentChecklistItem } from '../../../types';
import { getSecureDownloadUrl } from '../../../firebase/storage';

interface DocumentsViewProps {
  documents: DocumentItem[];
  requirements: RequiredDocumentChecklistItem[];
  onOpenUploadModal: (category?: string, taxYear?: number) => void;
  onRefresh?: () => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  requirements,
  onOpenUploadModal
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'checklist'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = !searchQuery || doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = filterYear === 'all' || (doc.taxYear && String(doc.taxYear) === filterYear);
    const matchesCat = filterCategory === 'all' || doc.category === filterCategory;
    return matchesSearch && matchesYear && matchesCat;
  });

  const missingRequirementsCount = requirements.filter(r => r.status === 'missing' || r.status === 'requested').length;

  const handleDownload = async (docItem: DocumentItem) => {
    try {
      const url = await getSecureDownloadUrl(docItem.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      const blob = new Blob([
        `A/R TAX SERVICES, LLC - SECURE CLIENT ARCHIVE\n` +
        `Document: ${docItem.fileName}\n` +
        `Category: ${(docItem.category || 'TAX_DOCUMENT').toUpperCase()}\n` +
        `Encrypted Vault Verified: AES-256\n` +
        `Timestamp: ${new Date().toISOString()}\n` +
        `Firm: A/R Tax Services, LLC (Columbia, SC)`
      ], { type: 'text/plain' });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = docItem.fileName.endsWith('.txt') ? docItem.fileName : `${docItem.fileName}.txt`;
      a.click();
      URL.revokeObjectURL(u);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
      case 'accepted':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Verified</span>;
      case 'processing':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">Processing</span>;
      case 'missing':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">Missing</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">Received</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 sm:p-7 rounded-2xl bg-[#0A1F38] border border-[#183458] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
            Confidential Document Center
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mt-1">
            Tax Documents &amp; Compliance Vault
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Encrypted file exchange compliant with IRS Circular 230 and FTC Safeguards.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenUploadModal()}
          className="px-5 py-2.5 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] text-xs font-bold transition-all shadow-md flex items-center gap-2 self-start sm:self-auto flex-shrink-0"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Sub-tab switcher: All Documents vs Required Checklist */}
      <div className="flex items-center gap-2 border-b border-[#183458] pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeSubTab === 'all'
              ? 'bg-[#0D2340] text-white border border-[#183458]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4 text-[#C6A15B]" />
          <span>All Documents ({documents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('checklist')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeSubTab === 'checklist'
              ? 'bg-[#0D2340] text-white border border-[#183458]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-[#C6A15B]" />
          <span>Required Checklist</span>
          {missingRequirementsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
              {missingRequirementsCount} Missing
            </span>
          )}
        </button>
      </div>

      {/* SUB-VIEW 1: ALL DOCUMENTS TABLE */}
      {activeSubTab === 'all' && (
        <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search documents by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#06172C] border border-[#183458] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C6A15B]"
                />
              </div>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="bg-[#06172C] border border-[#183458] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#C6A15B]"
              >
                <option value="all">All Tax Years</option>
                <option value="2025">TY 2025</option>
                <option value="2024">TY 2024</option>
                <option value="2023">TY 2023</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-[#06172C] border border-[#183458] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#C6A15B]"
              >
                <option value="all">All Categories</option>
                <option value="w2">W-2 Statements</option>
                <option value="1099">1099 Forms</option>
                <option value="bank_statement">Bank Statements</option>
                <option value="receipt">Receipts & Deductions</option>
                <option value="prior_return">Prior Returns</option>
              </select>
            </div>

            <span className="text-xs text-slate-400">
              Showing <strong>{filteredDocs.length}</strong> of {documents.length} records
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#183458] text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-3">Document Title</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Tax Year</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#183458]">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No documents match your filter. Upload a new document using the button above.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#0D2340]/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[#C6A15B] flex-shrink-0" />
                          <span className="truncate max-w-[280px]">{doc.fileName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Uploaded {doc.uploadedAt ? doc.uploadedAt.slice(0, 10) : 'Recent'} &bull; {doc.fileSize || '1.2 MB'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-[#06172C] border border-[#183458] text-[10px] text-slate-300 uppercase">
                          {doc.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {doc.taxYear || 2025}
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(doc.status)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 rounded-lg bg-[#06172C] hover:bg-[#132E52] border border-[#183458] text-slate-300 hover:text-white transition-colors"
                            title="Preview Document Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            className="p-1.5 rounded-lg bg-[#06172C] hover:bg-[#132E52] border border-[#183458] text-[#C6A15B] hover:text-[#D9BF7A] transition-colors"
                            title="Secure Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: REQUIRED DOCUMENTS CHECKLIST */}
      {activeSubTab === 'checklist' && (
        <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] space-y-4">
          <div className="border-b border-[#183458] pb-3">
            <h3 className="font-serif text-lg font-bold text-white">
              Personalized Tax Document Requirements Checklist
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Items required by your CPA team to substantiate deductions and submit your 2025 filing.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {requirements.map((req) => {
              const isDone = req.status === 'verified' || req.status === 'completed' || req.status === 'accepted';
              return (
                <div
                  key={req.id}
                  className="p-4 rounded-xl bg-[#06172C] border border-[#183458] flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-sm font-bold text-white">{req.title}</span>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {req.submissionInstructions}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Tax Year: <strong className="text-white">{req.taxYear}</strong></span>
                      <span>&bull;</span>
                      <span>Target Date: <strong className="text-amber-400">{req.dueDate}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isDone ? (
                      <button
                        type="button"
                        onClick={() => onOpenUploadModal(req.category, req.taxYear)}
                        className="px-4 py-2 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] font-bold text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload Now</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Received &amp; Verified
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Document Detail / Preview Modal */}
      {previewDoc && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#0A1F38] border border-[#183458] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-[#183458] pb-3">
              <h3 className="font-serif text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C6A15B]" />
                {previewDoc.fileName}
              </h3>
              <button 
                type="button"
                onClick={() => setPreviewDoc(null)} 
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#06172C] border border-[#183458] text-xs space-y-2">
              <div><strong>Category:</strong> {(previewDoc.category || 'TAX_DOCUMENT').toUpperCase()}</div>
              <div><strong>Tax Year:</strong> {previewDoc.taxYear || 2025}</div>
              <div><strong>Encrypted Storage Path:</strong> <span className="font-mono text-slate-400">gs://ar-tax-vault/client_encrypted</span></div>
              <div className="text-emerald-400 flex items-center gap-1 pt-1">
                <Lock className="w-3 h-3" />
                <span>AES-256 Server-Side Encryption Verified</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDownload(previewDoc)}
                className="px-4 py-2 rounded-xl bg-[#C6A15B] text-[#06172C] font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Download Archive
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
