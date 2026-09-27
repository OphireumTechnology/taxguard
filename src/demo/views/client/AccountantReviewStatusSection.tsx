/**
 * A/R Tax Services, LLC - Accountant Review Status & Notes Workspace
 * Compliance with Sections 18, 19 & 30: Document review state, reviewer sign-off,
 * and strict isolation between private practitioner notes and client-visible notes.
 */

import React, { useState } from 'react';
import {
  Eye,
  CheckCircle2,
  AlertTriangle,
  Lock,
  MessageSquare,
  ShieldCheck,
  FileText,
  UserCheck,
  Clock,
  Send,
  Sparkles
} from 'lucide-react';

export interface DocumentReviewState {
  documentId: string;
  filename: string;
  formType: string;
  taxYear: number;
  uploadedDate: string;
  reviewerName: string;
  classificationApproved: boolean;
  filenameApproved: boolean;
  fieldsVerified: boolean;
  status: 'Approved' | 'In Review' | 'Revision Requested';
  clientVisibleNotes: string[];
  privateAccountantNotes: string[]; // Isolated to practitioner view
}

const INITIAL_REVIEW_DOCS: DocumentReviewState[] = [
  {
    documentId: 'rev-1',
    filename: '2025_W2_ApexTechnologyPartners_DH_XXXX.pdf',
    formType: 'Form W-2 Wage Statement',
    taxYear: 2025,
    uploadedDate: '2026-02-14',
    reviewerName: 'Desmond Hinds, CPA',
    classificationApproved: true,
    filenameApproved: true,
    fieldsVerified: true,
    status: 'Approved',
    clientVisibleNotes: [
      'Wage amount ties out cleanly to prior year salary adjustments; Box 1 and Box 2 verified.'
    ],
    privateAccountantNotes: [
      'INTERNAL NOTE: SSA wage cross-check completed. Matches payroll withholding schedules exactly.'
    ]
  },
  {
    documentId: 'rev-2',
    filename: '2025_1099NEC_HighlandConsulting_DH_XXXX.pdf',
    formType: 'Form 1099-NEC Nonemployee Compensation',
    taxYear: 2025,
    uploadedDate: '2026-02-16',
    reviewerName: 'Desmond Hinds, CPA',
    classificationApproved: true,
    filenameApproved: true,
    fieldsVerified: true,
    status: 'Approved',
    clientVisibleNotes: [
      'Form 1099-NEC verified for Schedule C sole proprietorship consulting income.'
    ],
    privateAccountantNotes: [
      'INTERNAL NOTE: Check if self-employment tax deduction applies and verify QBI deduction eligibility.'
    ]
  },
  {
    documentId: 'rev-3',
    filename: '2025_K1_PinnacleRealEstateFundLP_DH_XXXX.pdf',
    formType: 'Schedule K-1 (Form 1065)',
    taxYear: 2025,
    uploadedDate: '2026-02-22',
    reviewerName: 'Desmond Hinds, CPA',
    classificationApproved: false,
    filenameApproved: true,
    fieldsVerified: false,
    status: 'In Review',
    clientVisibleNotes: [
      'Reviewing Box 20 Code Z Section 199A QBI statement footnotes with our pass-through specialist.'
    ],
    privateAccountantNotes: [
      'INTERNAL NOTE: Suspended passive activity loss carryforwards from 2024 need verification before finalizing 8582.'
    ]
  }
];

export const AccountantReviewStatusSection: React.FC = () => {
  const [docs, setDocs] = useState<DocumentReviewState[]>(INITIAL_REVIEW_DOCS);
  const [selectedDocId, setSelectedDocId] = useState<string>(INITIAL_REVIEW_DOCS[0].documentId);
  const [newClientNote, setNewClientNote] = useState('');
  const [isStaffView, setIsStaffView] = useState(false); // Demonstrates isolation

  const selectedDoc = docs.find(d => d.documentId === selectedDocId) || docs[0];

  const handleAddClientNote = () => {
    if (!newClientNote.trim()) return;
    setDocs(prev => prev.map(d => {
      if (d.documentId === selectedDocId) {
        return {
          ...d,
          clientVisibleNotes: [...d.clientVisibleNotes, newClientNote.trim()]
        };
      }
      return d;
    }));
    setNewClientNote('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#0A2544]" />
              <h2 className="text-xl font-bold text-neutral-900">Accountant Document Review Status</h2>
            </div>
            <p className="text-sm text-neutral-600 mt-1">
              Real-time review checkpoints, practitioner verification milestones, and transparent client advisory notes.
            </p>
          </div>

          {/* Demonstration Staff View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsStaffView(!isStaffView)}
              className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors flex items-center gap-1.5 ${
                isStaffView
                  ? 'bg-[#061A2F] text-white border-[#061A2F]'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isStaffView ? 'Staff Mode Active' : 'Client Mode Active'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document List */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-500 font-semibold px-1">
            Reviewed Documents ({docs.length})
          </h3>

          <div className="space-y-2">
            {docs.map((doc) => {
              const isSelected = doc.documentId === selectedDocId;
              return (
                <button
                  key={doc.documentId}
                  onClick={() => setSelectedDocId(doc.documentId)}
                  className={`w-full p-3.5 border rounded-lg text-left transition-all shadow-xs ${
                    isSelected
                      ? 'border-[#0A2544] bg-[#0A2544]/5 ring-1 ring-[#0A2544]'
                      : 'border-neutral-300 bg-white hover:border-neutral-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 truncate">
                      {doc.filename}
                    </span>
                    <span
                      className={`px-2 py-0.2 text-[10px] font-mono font-bold rounded ${
                        doc.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-600 mt-1 truncate">
                    {doc.formType}
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-neutral-500 border-t border-neutral-200 pt-1.5">
                    <span>Reviewer: {doc.reviewerName}</span>
                    <span>Uploaded: {doc.uploadedDate}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Document Details & Notes */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 rounded">
                  {selectedDoc.formType}
                </span>
                <span className="text-xs font-mono text-neutral-500">
                  Assigned Reviewer: <strong>{selectedDoc.reviewerName}</strong>
                </span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 mt-2">
                {selectedDoc.filename}
              </h3>
            </div>

            {/* Checkpoints Checklist */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-2.5">
              <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-600 font-bold">
                Review Verification Milestones:
              </h4>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-white border border-neutral-200 rounded">
                  <span className="font-semibold text-neutral-800">Form Classification Approved</span>
                  {selectedDoc.classificationApproved ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold font-mono">In Progress</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white border border-neutral-200 rounded">
                  <span className="font-semibold text-neutral-800">Standard Filename Confirmed</span>
                  {selectedDoc.filenameApproved ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold font-mono">In Progress</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white border border-neutral-200 rounded">
                  <span className="font-semibold text-neutral-800">Extracted Financial Numbers Tied Out</span>
                  {selectedDoc.fieldsVerified ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold font-mono">Pending Specialist</span>
                  )}
                </div>
              </div>
            </div>

            {/* Client-Visible Advisory Notes */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-700 font-bold flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#0A2544]" />
                <span>Accountant Notes for Taxpayer (Visible to Client):</span>
              </h4>

              {selectedDoc.clientVisibleNotes.map((note, index) => (
                <div
                  key={index}
                  className="p-3 bg-neutral-50 border border-neutral-300 rounded text-xs text-neutral-800"
                >
                  {note}
                </div>
              ))}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newClientNote}
                  onChange={(e) => setNewClientNote(e.target.value)}
                  placeholder="Add advisory note or question for your tax preparer..."
                  className="flex-1 px-3 py-1.5 border border-neutral-300 rounded text-xs"
                />
                <button
                  onClick={handleAddClientNote}
                  className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-semibold rounded hover:bg-[#0A2544] flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </div>
            </div>

            {/* Private Accountant Notes (Staff-Only Isolated Section - Section 30) */}
            {isStaffView && (
              <div className="p-4 bg-rose-50/50 border border-rose-300 rounded-lg space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-rose-900 font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-rose-700" />
                    <span>Private Practitioner Notes (Strict Internal Isolation):</span>
                  </h4>
                  <span className="px-1.5 py-0.2 bg-rose-200 text-rose-900 text-[10px] font-bold rounded">
                    Staff Only
                  </span>
                </div>

                <p className="text-[11px] text-rose-800">
                  These internal working notes are never accessible to client users or exposed in external API payloads.
                </p>

                {selectedDoc.privateAccountantNotes.map((note, index) => (
                  <div
                    key={index}
                    className="p-2.5 bg-white border border-rose-200 rounded font-mono text-xs text-rose-900"
                  >
                    {note}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
