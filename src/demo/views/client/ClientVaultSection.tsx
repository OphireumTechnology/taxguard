import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Camera,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  MessageSquare,
  HelpCircle,
  X,
  FileCheck,
  Send
} from 'lucide-react';
import { ClientDocumentItem, IDocumentService } from '../../services/clientDashboardServices';
import { CameraScannerModal } from '../../components/CameraScannerModal';

interface ClientVaultSectionProps {
  documentService?: IDocumentService;
  vaultService?: IDocumentService;
  clientId: string;
  onOpenAssistant: () => void;
}

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'docx', 'xlsx', 'csv', 'ofx', 'qfx'];
const FORBIDDEN_EXTENSIONS = ['exe', 'bat', 'sh', 'cmd', 'scr', 'js', 'py', 'php', 'zip', 'tar', 'gz'];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const ClientVaultSection: React.FC<ClientVaultSectionProps> = ({
  documentService,
  vaultService,
  clientId,
  onOpenAssistant
}) => {
  const activeService = (documentService || vaultService)!;
  const [documents, setDocuments] = useState<ClientDocumentItem[]>(() =>
    activeService.getDocuments(clientId)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Modals & Drawers
  const [selectedDocForSummary, setSelectedDocForSummary] = useState<ClientDocumentItem | null>(null);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<ClientDocumentItem | null>(null);
  const [selectedDocForQuestion, setSelectedDocForQuestion] = useState<ClientDocumentItem | null>(null);
  const [questionInput, setQuestionInput] = useState('');
  const [correctionInput, setCorrectionInput] = useState('');
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  const refreshDocs = () => {
    setDocuments(activeService.getDocuments(clientId));
  };

  // Upload handler with validation
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadSuccess(null);

    const file = files[0];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    // File validation
    if (FORBIDDEN_EXTENSIONS.includes(extension)) {
      setUploadError(`Security policy error: .${extension} files are strictly prohibited. Executables, scripts, and archives are not permitted.`);
      return;
    }

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setUploadError(`Unsupported file format .${extension}. Allowed formats: PDF, JPG, PNG, TIFF, DOCX, XLSX, CSV, OFX, QFX.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`File exceeds maximum size of 25MB. Current size: ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }

    // Process valid file
    activeService.uploadDocument(clientId, file);
    refreshDocs();
    setUploadSuccess(`"${file.name}" uploaded successfully. Automated anti-malware verification completed.`);
    setTimeout(() => setUploadSuccess(null), 5000);
  };

  const handleCameraCapture = (imageDataUrl: string) => {
    const dummyFile = new File(['simulated-scan-bytes'], `Camera_Scan_${Date.now()}.pdf`, {
      type: 'application/pdf'
    });
    activeService.uploadDocument(clientId, dummyFile);
    refreshDocs();
    setIsCameraOpen(false);
    setUploadSuccess('Document captured and saved to vault successfully.');
    setTimeout(() => setUploadSuccess(null), 5000);
  };

  const handleRemoveDraft = (id: string) => {
    const result = activeService.removeDraftDocument(id);
    if (result.success) {
      refreshDocs();
    } else {
      alert(result.error || 'Cannot remove this document.');
    }
  };

  const handleProposeCorrection = () => {
    if (!selectedDocForSummary || !correctionInput.trim()) return;
    activeService.proposeClassificationCorrection(
      selectedDocForSummary.id,
      correctionInput.trim(),
      'Michael Perotti (Client)'
    );
    setCorrectionSuccess(true);
    setCorrectionInput('');
    refreshDocs();
    setTimeout(() => setCorrectionSuccess(false), 4000);
  };

  const handleAddQuestion = () => {
    if (!selectedDocForQuestion || !questionInput.trim()) return;
    activeService.addDocumentQuestion(
      selectedDocForQuestion.id,
      questionInput.trim(),
      'Michael Perotti (Client)'
    );
    setQuestionInput('');
    refreshDocs();
    // update current selected doc
    const updated = activeService.getDocumentById(selectedDocForQuestion.id);
    if (updated) setSelectedDocForQuestion(updated);
  };

  // Filtering
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.documentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.issuer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = selectedYear === 'ALL' || doc.taxYear.toString() === selectedYear;
    const matchesCategory = selectedCategory === 'ALL' || doc.documentType.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesYear && matchesCategory;
  });

  return (
    <div className="space-y-6" id="client-vault-section">
      {/* 1. Header & Security Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#D7AC4A] uppercase tracking-wider font-bold bg-[#061A2F] px-2 py-0.5 rounded">
                Section 2 of 8
              </span>
              <span className="text-xs font-mono text-[#667085]">AES-256 Encrypted Storage</span>
            </div>
            <h1 className="text-xl font-black text-[#061A2F] mt-1">
              Document Vault
            </h1>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Securely transmit source workpapers, tax statements, and receipts directly to your assigned CPA review team.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCameraOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>Scan with Camera</span>
            </button>
            <button
              onClick={onOpenAssistant}
              className="flex items-center gap-2 px-3 py-2 bg-[#061A2F] text-white hover:bg-[#031323] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Vault Help</span>
            </button>
          </div>
        </div>

        {/* Security Simulation Banner */}
        <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C99A32] flex-shrink-0" />
            <span className="font-semibold text-[#061A2F]">Simulated document-security result — Demo only</span>
          </div>
          <span className="text-[11px] text-[#667085] hidden md:inline">
            Validation Rule: Executables, binaries, and scripts are blocked.
          </span>
        </div>
      </div>

      {/* 2. Drag & Drop Upload Zone */}
      <div className="bg-white rounded-lg border border-dashed border-[#C99A32] p-6 text-center hover:bg-[#FAF9F5] transition-colors relative">
        <input
          type="file"
          id="vault-file-upload-input"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          multiple
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-[#FAF9F5] border border-[#D8DCE2] flex items-center justify-center text-[#061A2F] mb-3">
            <UploadCloud className="w-6 h-6 text-[#C99A32]" />
          </div>
          <h2 className="text-sm font-bold text-[#061A2F]">
            Drag and drop tax documents here, or click to browse
          </h2>
          <p className="text-xs text-[#667085] mt-1 max-w-md">
            Accepted: PDF, JPG, PNG, TIFF, DOCX, XLSX, CSV, OFX, QFX (Max 25MB). All files undergo simulated anti-malware verification.
          </p>
        </div>
      </div>

      {/* Upload Feedback Messages */}
      {uploadError && (
        <div className="p-3 bg-[#FFEBEE] border border-[#FFCDD2] text-[#C62828] rounded text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
      {uploadSuccess && (
        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] text-[#1B5E20] rounded text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* 3. Search & Filter Bar */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#667085]" />
          <input
            type="text"
            placeholder="Search documents by name, type, or issuer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D8DCE2] rounded bg-[#FBFAF7] focus:outline-none focus:border-[#C99A32]"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#667085]">
            <Filter className="w-3.5 h-3.5" />
            <span>Tax Year:</span>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-xs border border-[#D8DCE2] rounded px-2 py-1.5 bg-[#FBFAF7] text-[#061A2F]"
          >
            <option value="ALL">All Years</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-[#D8DCE2] rounded px-2 py-1.5 bg-[#FBFAF7] text-[#061A2F]"
          >
            <option value="ALL">All Document Types</option>
            <option value="W-2">W-2</option>
            <option value="1099">1099</option>
            <option value="K-1">Schedule K-1</option>
            <option value="Bank">Bank Statement</option>
            <option value="Receipt">Receipt</option>
            <option value="Notice">Notice</option>
          </select>
        </div>
      </div>

      {/* 4. Documents Table */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#061A2F] text-white border-b border-[#D8DCE2] font-mono text-[10px] uppercase">
                <th className="p-3">File Name</th>
                <th className="p-3">Detected Type</th>
                <th className="p-3">Tax Year</th>
                <th className="p-3">Upload Date</th>
                <th className="p-3">Security & Status</th>
                <th className="p-3">Review Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#667085]">
                    No documents found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const isDraft = doc.reviewStatus === 'Pending Review' || doc.reviewStatus === 'Draft';
                  return (
                    <tr key={doc.id} className="hover:bg-[#FAF9F5] transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#061A2F] flex-shrink-0" />
                          <div>
                            <div className="font-bold text-[#061A2F]">{doc.fileName}</div>
                            <div className="text-[10px] text-[#667085] font-mono">{doc.fileSize} • {doc.entityName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-[#061A2F]">{doc.documentType}</span>
                        {doc.confidenceScore && (
                          <div className="text-[10px] font-mono text-[#667085]">
                            {doc.confidenceScore}% AI Confidence
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono">{doc.taxYear}</td>
                      <td className="p-3 text-[#667085] font-mono">{doc.uploadDate}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] font-mono text-[10px] font-bold rounded inline-block">
                          {doc.securityCheckStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded inline-block ${
                          doc.reviewStatus === 'Approved'
                            ? 'bg-[#E8F5E9] text-[#1B5E20]'
                            : 'bg-[#FFF8E1] text-[#B78103]'
                        }`}>
                          {doc.reviewStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedDocForPreview(doc)}
                            className="p-1 hover:bg-[#FAF9F5] text-[#061A2F] rounded"
                            title="Preview Document"
                            aria-label="Preview Document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedDocForSummary(doc)}
                            className="p-1 hover:bg-[#FAF9F5] text-[#C99A32] rounded"
                            title="View AI Extraction Summary"
                            aria-label="View AI Extraction Summary"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedDocForQuestion(doc)}
                            className="p-1 hover:bg-[#FAF9F5] text-[#061A2F] rounded"
                            title="Ask Question / Clarification"
                            aria-label="Ask Question"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => alert(`Simulated secure download of ${doc.fileName}`)}
                            className="p-1 hover:bg-[#FAF9F5] text-[#667085] rounded"
                            title="Download File"
                            aria-label="Download File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {isDraft && (
                            <button
                              onClick={() => handleRemoveDraft(doc.id)}
                              className="p-1 hover:bg-[#FFEBEE] text-[#C62828] rounded"
                              title="Remove Draft Document"
                              aria-label="Remove Draft Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Document Summary / Extraction Drawer */}
      {selectedDocForSummary && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="extraction-summary-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#C99A32]" />
                <h3 id="extraction-summary-title" className="text-sm font-bold text-[#061A2F]">
                  Document Extraction & Classification Summary
                </h3>
              </div>
              <button
                onClick={() => setSelectedDocForSummary(null)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
                <div>
                  <span className="text-[#667085] block text-[10px] font-mono">FILE NAME</span>
                  <span className="font-bold text-[#061A2F]">{selectedDocForSummary.fileName}</span>
                </div>
                <div>
                  <span className="text-[#667085] block text-[10px] font-mono">DETECTED TYPE</span>
                  <span className="font-bold text-[#061A2F]">{selectedDocForSummary.documentType}</span>
                </div>
                <div>
                  <span className="text-[#667085] block text-[10px] font-mono">TAX YEAR</span>
                  <span className="font-bold text-[#061A2F]">{selectedDocForSummary.taxYear}</span>
                </div>
                <div>
                  <span className="text-[#667085] block text-[10px] font-mono">AI CONFIDENCE</span>
                  <span className="font-bold text-[#1B5E20]">{selectedDocForSummary.confidenceScore}% (High)</span>
                </div>
                <div>
                  <span className="text-[#667085] block text-[10px] font-mono">ISSUER / INSTITUTION</span>
                  <span className="font-bold text-[#061A2F]">{selectedDocForSummary.issuer}</span>
                </div>
                <div>
                  <span className="text-[#667085] block text-[10px] font-mono">KEY EXTRACTED AMOUNT</span>
                  <span className="font-bold text-[#061A2F]">{selectedDocForSummary.keyAmounts || 'N/A'}</span>
                </div>
              </div>

              {/* Propose Classification Correction */}
              <div className="pt-2 border-t border-[#D8DCE2]">
                <div className="text-[11px] font-bold text-[#061A2F] mb-1">
                  Propose Classification Correction
                </div>
                <p className="text-[10px] text-[#667085] mb-2">
                  Clients may propose classification corrections. Elena Rostova, CPA conducts the final technical review.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Schedule K-1 instead of 1099-DIV"
                    value={correctionInput}
                    onChange={(e) => setCorrectionInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                  />
                  <button
                    onClick={handleProposeCorrection}
                    disabled={!correctionInput.trim()}
                    className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Submit
                  </button>
                </div>
                {correctionSuccess && (
                  <div className="mt-2 text-[11px] text-[#1B5E20] font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Correction submitted to CPA review queue.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#D8DCE2] flex justify-end">
              <button
                onClick={() => setSelectedDocForSummary(null)}
                className="px-4 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Document Preview Modal */}
      {selectedDocForPreview && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="document-preview-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#061A2F]" />
                <h3 id="document-preview-title" className="text-sm font-bold text-[#061A2F]">
                  Document Preview: {selectedDocForPreview.fileName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDocForPreview(null)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#FBFAF7] border border-[#D8DCE2] rounded p-8 text-center min-h-[220px] flex flex-col items-center justify-center">
              <FileText className="w-12 h-12 text-[#C99A32] mb-3" />
              <div className="font-mono text-xs font-bold text-[#061A2F]">{selectedDocForPreview.fileName}</div>
              <div className="text-[11px] text-[#667085] mt-1">
                Document Type: {selectedDocForPreview.documentType} • Tax Year {selectedDocForPreview.taxYear}
              </div>
              <div className="mt-4 px-3 py-1 bg-white border border-[#D8DCE2] rounded text-[11px] text-[#667085]">
                Certified Proof of Deposit / Source Workpaper • Retained under statutory 7-year schedule
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => alert(`Simulated secure download of ${selectedDocForPreview.fileName}`)}
                className="px-3 py-1.5 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] text-xs font-bold text-[#061A2F] rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download File
              </button>
              <button
                onClick={() => setSelectedDocForPreview(null)}
                className="px-4 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Document Question Thread Drawer */}
      {selectedDocForQuestion && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="document-question-thread-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <div>
                <h3 id="document-question-thread-title" className="text-sm font-bold text-[#061A2F]">
                  Document Clarification Thread
                </h3>
                <div className="text-[11px] text-[#667085]">{selectedDocForQuestion.fileName}</div>
              </div>
              <button
                onClick={() => setSelectedDocForQuestion(null)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 p-2 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
              {selectedDocForQuestion.questions && selectedDocForQuestion.questions.length > 0 ? (
                selectedDocForQuestion.questions.map((q) => (
                  <div key={q.id} className="p-2.5 bg-white rounded border border-[#D8DCE2] text-xs space-y-1">
                    <div className="flex items-center justify-between font-mono text-[10px] text-[#667085]">
                      <span className="font-bold text-[#061A2F]">{q.author}</span>
                      <span>{q.timestamp || q.date}</span>
                    </div>
                    <p className="text-[#1A2028]">{q.question}</p>
                    {q.response && (
                      <div className="mt-1.5 p-2 bg-[#FAF9F5] border-l-2 border-[#C99A32] rounded text-[11px] text-[#061A2F]">
                        <strong>Response: </strong>{q.response}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-[#667085] text-xs">
                  No questions logged for this document yet.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#D8DCE2]">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask your CPA a question about this document..."
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
                <button
                  onClick={handleAddQuestion}
                  disabled={!questionInput.trim()}
                  className="px-3 py-2 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
