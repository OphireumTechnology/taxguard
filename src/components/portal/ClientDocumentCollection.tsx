import React, { useState } from 'react';
import {
  Upload,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Lock,
  ArrowRight,
  Filter,
  Check,
  Cpu
} from 'lucide-react';

interface ClientDocItem {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  securityScan: 'CLEAN' | 'SCANNING' | 'FLAGGED';
  classification: string;
  classificationConfidence: number;
  ocrStatus: 'COMPLETED' | 'PROCESSING' | 'PENDING';
  extractedFields: Record<string, string | number>;
  humanValidation: 'APPROVED' | 'IN_REVIEW' | 'PENDING';
  reviewedBy: string | null;
}

const INITIAL_DOCS: ClientDocItem[] = [
  {
    id: 'DOC-2026-001',
    name: 'W2_Acme_Corporation_2024.pdf',
    type: 'Form W-2',
    size: '1.4 MB',
    uploadDate: '2026-09-21 14:12',
    securityScan: 'CLEAN',
    classification: 'Form W-2 (Wage and Tax Statement)',
    classificationConfidence: 0.98,
    ocrStatus: 'COMPLETED',
    extractedFields: {
      'Box a (SSN)': '***-**-4819',
      'Box b (Employer EIN)': '12-3456789',
      'Box 1 (Wages & Tips)': '$81,500.00',
      'Box 2 (Federal Tax Withheld)': '$12,500.00',
      'Box 15 (State)': 'CA',
      'Box 16 (State Wages)': '$85,000.00',
      'Box 17 (State Tax Withheld)': '$4,800.00',
    },
    humanValidation: 'APPROVED',
    reviewedBy: 'Staff Reviewer (2026-09-21 14:32)',
  },
  {
    id: 'DOC-2026-002',
    name: '1099_INT_JPMorgan_Chase.pdf',
    type: 'Form 1099-INT',
    size: '840 KB',
    uploadDate: '2026-09-21 14:15',
    securityScan: 'CLEAN',
    classification: 'Form 1099-INT (Interest Income)',
    classificationConfidence: 0.99,
    ocrStatus: 'COMPLETED',
    extractedFields: {
      'Payer Name': 'JPMorgan Chase Bank, N.A.',
      'Box 1 (Interest Income)': '$1,420.50',
      'Box 4 (Federal Tax Withheld)': '$0.00',
    },
    humanValidation: 'APPROVED',
    reviewedBy: 'Staff Reviewer (2026-09-21 14:35)',
  },
  {
    id: 'DOC-2026-003',
    name: 'Mortgage_Statement_1098_WellsFargo.pdf',
    type: 'Form 1098',
    size: '1.1 MB',
    uploadDate: '2026-09-22 09:30',
    securityScan: 'CLEAN',
    classification: 'Form 1098 (Mortgage Interest Statement)',
    classificationConfidence: 0.96,
    ocrStatus: 'COMPLETED',
    extractedFields: {
      'Lender': 'Wells Fargo Home Mortgage',
      'Box 1 (Mortgage Interest Paid)': '$14,250.00',
      'Box 2 (Outstanding Principal)': '$385,000.00',
      'Box 5 (Mortgage Insurance Premiums)': '$0.00',
    },
    humanValidation: 'IN_REVIEW',
    reviewedBy: null,
  },
];

export const ClientDocumentCollection: React.FC = () => {
  const [docs, setDocs] = useState<ClientDocItem[]>(INITIAL_DOCS);
  const [selectedDocId, setSelectedDocId] = useState<string>(INITIAL_DOCS[0].id);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const selectedDoc = docs.find(d => d.id === selectedDocId) || docs[0];

  const handleSimulatedUpload = (docType: string) => {
    setIsUploading(true);
    setTimeout(() => {
      const newDoc: ClientDocItem = {
        id: `DOC-2026-00${docs.length + 1}`,
        name: `${docType}_Uploaded_${Date.now().toString().slice(-4)}.pdf`,
        type: docType,
        size: '1.2 MB',
        uploadDate: 'Just now',
        securityScan: 'CLEAN',
        classification: `${docType} Classified`,
        classificationConfidence: 0.97,
        ocrStatus: 'COMPLETED',
        extractedFields: {
          'Status': 'Extraction Successful',
          'A05 Intake': 'Received and Checksum Verified',
          'A06 Classification': `${docType} Confirmed`,
          'A07 OCR': 'Structured Fields Staged',
        },
        humanValidation: 'PENDING',
        reviewedBy: null,
      };
      setDocs(prev => [newDoc, ...prev]);
      setSelectedDocId(newDoc.id);
      setIsUploading(false);
      setUploadSuccess(`Successfully ingested ${newDoc.name}. Passed malware scan & A06 classification.`);
      setTimeout(() => setUploadSuccess(null), 4000);
    }, 1500);
  };

  return (
    <div className="space-y-6" data-testid="client-document-collection-portal">
      {/* Page 5 Banner */}
      <div className="p-5 rounded-2xl bg-[#071A2E] border border-slate-700/80 shadow flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40">
              PAGE 5 &amp; 11 WORKFLOW
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              SECURE CLIENT TAX VAULT
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">Client Document Collection &amp; Intelligence</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated intake, malware scanning, AI document extraction (A05–A11), and verified human reviewer sign-off.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-[#0D2745] text-emerald-400 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> 256-Bit Encrypted Vault
          </span>
        </div>
      </div>

      {uploadSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="p-6 rounded-2xl bg-[#0D2745] border-2 border-dashed border-slate-600 hover:border-[#D4A843] text-center space-y-3 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-[#071A2E] text-[#D4A843] flex items-center justify-center mx-auto shadow-inner">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Drag &amp; Drop Tax Documents Here</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Supports W-2, 1099 (INT, DIV, B, MISC, NEC), Schedule K-1, 1098 Mortgage, Receipts, and Statements (PDF, PNG, JPG up to 50MB)
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {['Upload Form W-2', 'Upload 1099-INT', 'Upload Schedule K-1', 'Upload 1098 Mortgage'].map(btn => (
            <button
              key={btn}
              type="button"
              disabled={isUploading}
              onClick={() => handleSimulatedUpload(btn.replace('Upload ', ''))}
              className="px-3 py-1.5 rounded-lg bg-[#071A2E] hover:bg-slate-700 text-xs text-slate-200 font-semibold border border-slate-600 transition-colors disabled:opacity-50"
            >
              {isUploading ? 'Processing...' : btn}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid: Left List + Right Extracted Data Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Document Table (Col 6) */}
        <div className="lg:col-span-6 bg-[#071A2E] border border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-3 bg-[#0A223D] border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#D4A843]" />
              Collected Documents ({docs.length})
            </span>
            <span className="text-[11px] font-mono text-slate-400">Tax Year 2024</span>
          </div>

          <div className="divide-y divide-slate-800 overflow-y-auto max-h-[480px]">
            {docs.map(doc => {
              const isSelected = doc.id === selectedDocId;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`p-3.5 cursor-pointer transition-colors hover:bg-[#0E2E50] ${
                    isSelected ? 'bg-[#0E2E50] border-l-4 border-l-[#D4A843]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white truncate max-w-[240px]">
                      {doc.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        doc.humanValidation === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {doc.humanValidation}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span className="font-mono text-[#D4A843]">{doc.type}</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
                      <ShieldCheck className="w-3 h-3" /> Malware Scan Clean
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Extracted Fields & AI Processing Pipeline View (Col 6) */}
        <div className="lg:col-span-6 bg-[#071A2E] border border-slate-700 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between border-b border-slate-700 pb-3">
            <div>
              <span className="font-mono text-xs text-[#D4A843] block">{selectedDoc.id}</span>
              <h3 className="text-base font-bold text-white mt-0.5">{selectedDoc.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Classification: <strong className="text-slate-200">{selectedDoc.classification}</strong> ({(selectedDoc.classificationConfidence * 100).toFixed(0)}% confidence)
              </p>
            </div>
            <span className="px-2 py-1 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {selectedDoc.ocrStatus}
            </span>
          </div>

          {/* 7-Step AI Intelligence Flow (Page 5 Visual Architecture) */}
          <div className="p-3 bg-[#0D2745] rounded-xl border border-slate-700/80 space-y-2">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
              Multi-Agent Intake Pipeline (Page 5)
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              <div className="p-1.5 bg-[#071A2E] rounded border border-slate-800 text-center">
                <span className="text-slate-400 block">A05 Intake</span>
                <span className="font-bold text-emerald-400">Passed</span>
              </div>
              <div className="p-1.5 bg-[#071A2E] rounded border border-slate-800 text-center">
                <span className="text-slate-400 block">A06 Classify</span>
                <span className="font-bold text-emerald-400">W-2 Confirmed</span>
              </div>
              <div className="p-1.5 bg-[#071A2E] rounded border border-slate-800 text-center">
                <span className="text-slate-400 block">A07 OCR Extract</span>
                <span className="font-bold text-emerald-400">Structured</span>
              </div>
              <div className="p-1.5 bg-[#071A2E] rounded border border-slate-800 text-center">
                <span className="text-slate-400 block">Human Gate</span>
                <span className={`font-bold ${selectedDoc.humanValidation === 'APPROVED' ? 'text-emerald-400' : 'text-amber-300'}`}>
                  {selectedDoc.humanValidation === 'APPROVED' ? 'Approved' : 'In Review'}
                </span>
              </div>
            </div>
          </div>

          {/* Extracted Structured Key-Value Fields */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-white block">
              Extracted Tax Fields (A07 OCR Extraction Agent)
            </span>
            <div className="divide-y divide-slate-800 rounded-xl bg-[#0A223D] border border-slate-800 p-3 text-xs">
              {Object.entries(selectedDoc.extractedFields).map(([k, v]) => (
                <div key={k} className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-300 font-medium">{k}</span>
                  <span className="font-mono font-bold text-white">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Human Review Status Note */}
          <div className="p-3 bg-[#0A223D] rounded-xl border border-slate-800 text-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Human Validation</span>
              <span className="font-semibold text-slate-200">
                {selectedDoc.reviewedBy || 'Pending assignment to reviewer'}
              </span>
            </div>
            {selectedDoc.humanValidation === 'APPROVED' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
