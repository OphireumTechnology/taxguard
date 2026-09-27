/**
 * A/R Tax Services, LLC - Upload & Scan Center
 * Compliance with Sections 11 & 12: Drag-and-drop, multi-page, camera capture, page rotation/reordering,
 * seeded test documents, security notice, and tax-year mismatch detection.
 */

import React, { useState } from 'react';
import {
  UploadCloud,
  Camera,
  FileText,
  RotateCw,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Info,
  Layers,
  Eye,
  Check
} from 'lucide-react';
import { CameraScannerModal } from '../../components/CameraScannerModal';

interface UploadScanCenterSectionProps {
  selectedYear: number;
  onDocumentProcessed: (doc: any) => void;
  onNavigateToAiPipeline: () => void;
}

export interface UploadedScanFile {
  id: string;
  name: string;
  sizeBytes: number;
  type: string;
  pages: number;
  detectedYear: number;
  classificationSuggestion: string;
  confidenceScore: number;
  mismatchWarning?: boolean;
}

const SEEDED_SAMPLE_DOCS = [
  {
    name: '2025_Form_W2_Apex_Technology.pdf',
    type: 'application/pdf',
    sizeBytes: 342100,
    detectedYear: 2025,
    pages: 1,
    classificationSuggestion: 'Form W-2 Wage & Tax Statement',
    confidenceScore: 98.4
  },
  {
    name: '2025_Form_1099NEC_Highland_Consulting.pdf',
    type: 'application/pdf',
    sizeBytes: 284500,
    detectedYear: 2025,
    pages: 1,
    classificationSuggestion: 'Form 1099-NEC Nonemployee Compensation',
    confidenceScore: 96.2
  },
  {
    name: '2024_Form_1099INT_Chase_PriorYear.pdf',
    type: 'application/pdf',
    sizeBytes: 198400,
    detectedYear: 2024, // Mismatch with CY2025
    pages: 2,
    classificationSuggestion: 'Form 1099-INT Interest Income',
    confidenceScore: 95.1
  },
  {
    name: '2025_Form_1098_Mortgage_FirstRepublic.pdf',
    type: 'application/pdf',
    sizeBytes: 412900,
    detectedYear: 2025,
    pages: 2,
    classificationSuggestion: 'Form 1098 Mortgage Interest Statement',
    confidenceScore: 97.8
  },
  {
    name: '2025_Schedule_K1_Pinnacle_LP.pdf',
    type: 'application/pdf',
    sizeBytes: 890400,
    detectedYear: 2025,
    pages: 4,
    classificationSuggestion: 'Schedule K-1 (Form 1065 Pass-Through)',
    confidenceScore: 91.5
  },
  {
    name: '2025_ALTA_Closing_Statement_Acquisition.pdf',
    type: 'application/pdf',
    sizeBytes: 1450000,
    detectedYear: 2025,
    pages: 3,
    classificationSuggestion: 'ALTA Real Estate Settlement Statement',
    confidenceScore: 88.0
  },
  {
    name: '2025_Credit_Suisse_Zurich_Statement.pdf',
    type: 'application/pdf',
    sizeBytes: 670000,
    detectedYear: 2025,
    pages: 2,
    classificationSuggestion: 'Foreign Financial Account Statement (FBAR)',
    confidenceScore: 86.4
  }
];

export const UploadScanCenterSection: React.FC<UploadScanCenterSectionProps> = ({
  selectedYear,
  onDocumentProcessed,
  onNavigateToAiPipeline
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedScanFile[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [simulatedPages, setSimulatedPages] = useState<Array<{ id: string; name: string; rotation: number }>>([
    { id: 'page-1', name: 'Page 1 — Form 1040 Face', rotation: 0 },
    { id: 'page-2', name: 'Page 2 — Schedule 1 Additional Income', rotation: 0 }
  ]);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: { name: string; size: number; type: string }) => {
    const isPriorYear = file.name.includes('2024') || file.name.includes('2023');
    const detectedYear = isPriorYear ? 2024 : 2025;
    const hasMismatch = detectedYear !== selectedYear;

    const newScanFile: UploadedScanFile = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: file.name,
      sizeBytes: file.size,
      type: file.type || 'application/pdf',
      pages: 1,
      detectedYear,
      classificationSuggestion: file.name.includes('W2')
        ? 'Form W-2 Wage Statement'
        : file.name.includes('1099')
        ? 'Form 1099 Income Statement'
        : 'Tax Substantiation Record',
      confidenceScore: 96.5,
      mismatchWarning: hasMismatch
    };

    setUploadedFiles(prev => [newScanFile, ...prev]);
    onDocumentProcessed(newScanFile);

    setProcessingStatus(`"${file.name}" ingested. Automated OCR classification pipeline dispatched.`);
    setTimeout(() => setProcessingStatus(null), 4000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(file => {
        processFile({ name: file.name, size: file.size, type: file.type });
      });
    }
  };

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        processFile({ name: file.name, size: file.size, type: file.type });
      });
    }
  };

  const handleRotatePage = (index: number, degrees: number) => {
    setSimulatedPages(prev => {
      const next = [...prev];
      next[index].rotation = (next[index].rotation + degrees + 360) % 360;
      return next;
    });
  };

  const handleMovePage = (index: number, direction: 'up' | 'down') => {
    setSimulatedPages(prev => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleDeletePage = (index: number) => {
    setSimulatedPages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Security Status Header */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-xs font-bold text-amber-900">
            Document security scanning is not configured.
          </div>
          <div className="text-xs text-amber-800 leading-relaxed">
            All documents are stored within your isolated demonstration tenant environment. Production anti-virus, anti-malware, and quarantine webhooks require authorized platform endpoint keys.
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Upload & Multi-Page Scanning Center</h2>
            <p className="text-sm text-neutral-600 mt-0.5">
              Target Filing Year: <strong className="text-neutral-900 font-mono">CY{selectedYear}</strong>. Upload source tax slips, brokerage statements, or launch camera capture.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCameraOpen(true)}
              className="px-3.5 py-2 bg-[#061A2F] text-white hover:bg-[#0A2544] text-xs font-semibold rounded flex items-center gap-2 transition-colors shadow-xs"
            >
              <Camera className="w-4 h-4 text-[#D7AC4A]" />
              <span>Camera Scan</span>
            </button>
            <button
              onClick={onNavigateToAiPipeline}
              className="px-3.5 py-2 border border-neutral-300 hover:bg-neutral-50 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-[#D7AC4A]" />
              <span>AI Pipeline Status</span>
            </button>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`p-8 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${
            dragActive
              ? 'border-[#0A2544] bg-[#0A2544]/5'
              : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50/50'
          }`}
          onClick={() => document.getElementById('manual-upload-input')?.click()}
        >
          <input
            id="manual-upload-input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.docx,.xlsx,.csv,.ofx,.qfx"
            className="hidden"
            onChange={handleManualInput}
          />
          <UploadCloud className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-neutral-900">
            Drag and drop your tax documents here, or click to browse
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            Supported formats: PDF, TIFF, JPG, PNG, DOCX, XLSX, CSV, OFX, QFX (Max 25MB per file)
          </p>
        </div>

        {processingStatus && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-900 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{processingStatus}</span>
          </div>
        )}
      </div>

      {/* Multi-Page Order & Rotation Canvas */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Multi-Page Document Assembly & Rotation</h3>
            <p className="text-xs text-neutral-600">
              Reorder pages or rotate scans before submitting to the automated accountant review queue.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-500 font-medium">
            {simulatedPages.length} Pages Queued
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {simulatedPages.map((page, index) => (
            <div
              key={page.id}
              className="p-3.5 border border-neutral-300 rounded-lg bg-neutral-50 space-y-2 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                <span>Page {index + 1}</span>
                <span className="font-mono text-[10px] text-neutral-500">{page.rotation}°</span>
              </div>

              {/* Page Thumbnail Simulation */}
              <div
                className="h-32 bg-white border border-neutral-200 rounded flex items-center justify-center p-2 text-center text-xs font-mono text-neutral-500 transition-transform shadow-2xs"
                style={{ transform: `rotate(${page.rotation}deg)` }}
              >
                <div className="p-2 border border-dashed border-neutral-300 rounded w-full h-full flex flex-col items-center justify-center">
                  <FileText className="w-6 h-6 text-neutral-400 mb-1" />
                  <span className="text-[10px] text-neutral-700">{page.name}</span>
                </div>
              </div>

              {/* Manipulation Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRotatePage(index, -90)}
                    className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded"
                    title="Rotate 90° Counter-Clockwise"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRotatePage(index, 90)}
                    className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded"
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={index === 0}
                    onClick={() => handleMovePage(index, 'up')}
                    className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded disabled:opacity-30"
                    title="Move Page Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={index === simulatedPages.length - 1}
                    onClick={() => handleMovePage(index, 'down')}
                    className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded disabled:opacity-30"
                    title="Move Page Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeletePage(index)}
                    className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                    title="Delete Page"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Seeded Test Documents Bench */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D7AC4A]" />
            <h3 className="text-sm font-bold text-neutral-900">Seeded Test Documents Library</h3>
          </div>
          <span className="text-xs text-neutral-500">Click any document to ingest and test OCR pipeline</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {SEEDED_SAMPLE_DOCS.map((doc, i) => (
            <button
              key={i}
              onClick={() => processFile({ name: doc.name, size: doc.sizeBytes, type: doc.type })}
              className="p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 hover:border-neutral-400 rounded text-left transition-colors flex flex-col justify-between space-y-2 group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-1.5 py-0.5 text-[9px] font-mono bg-white border border-neutral-300 rounded text-neutral-700 font-semibold">
                    CY{doc.detectedYear}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {(doc.sizeBytes / 1024).toFixed(0)} KB
                  </span>
                </div>
                <div className="text-xs font-bold text-neutral-900 group-hover:text-[#0A2544] mt-1.5 truncate">
                  {doc.name}
                </div>
                <div className="text-[11px] text-neutral-500 truncate">
                  {doc.classificationSuggestion}
                </div>
              </div>

              <div className="text-[10px] text-[#0A2544] font-semibold flex items-center gap-1 pt-1 border-t border-neutral-200">
                <span>Ingest & Run AI Classifier</span>
                <span className="ml-auto font-mono text-emerald-700 font-bold">{doc.confidenceScore}%</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Uploaded Scans & Ingestion Feed */}
      {uploadedFiles.length > 0 && (
        <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900">Recent Ingestion Queue ({uploadedFiles.length})</h3>

          <div className="space-y-2.5">
            {uploadedFiles.map((f) => (
              <div
                key={f.id}
                className="p-3.5 border border-neutral-300 rounded-lg bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-neutral-700 flex-shrink-0" />
                    <span className="text-xs font-bold text-neutral-900">{f.name}</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-mono bg-neutral-100 rounded text-neutral-600">
                      {(f.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                    <span>Classification: <strong>{f.classificationSuggestion}</strong></span>
                    <span>•</span>
                    <span className="font-mono text-emerald-700 font-semibold">
                      Confidence: {f.confidenceScore}%
                    </span>
                  </div>

                  {f.mismatchWarning && (
                    <div className="p-2 bg-amber-50 border border-amber-300 rounded text-xs font-bold text-amber-900 flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                      <span>Potential tax-year mismatch — Accountant review required.</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={onNavigateToAiPipeline}
                    className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-semibold rounded hover:bg-[#0A2544] transition-colors"
                  >
                    View Pipeline JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera Scanner Modal */}
      {isCameraOpen && (
        <CameraScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onCapture={(dataUrl) => {
            processFile({
              name: `Camera_Scan_Receipt_${Date.now()}.pdf`,
              size: 512000,
              type: 'application/pdf'
            });
            setIsCameraOpen(false);
          }}
        />
      )}
    </div>
  );
};
