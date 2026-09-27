import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  EyeOff, 
  Lock, 
  CheckCircle2, 
  MessageSquare, 
  Send,
  AlertCircle
} from 'lucide-react';
import { MeetingDocumentReview } from '../../types/consultationRoom';
import { BrandedButton } from '../ui/BrandedButton';

export interface WatermarkedDocumentReviewerProps {
  documents: MeetingDocumentReview[];
  clientName: string;
  clientEmail: string;
  referenceCode: string;
  isHost: boolean;
  onAcknowledgeDocument: (documentId: string) => Promise<void>;
  onAddNote: (documentId: string, noteText: string, isInternal: boolean) => Promise<void>;
  onLogAuditEvent: (action: string, metadata?: any) => void;
}

export const WatermarkedDocumentReviewer: React.FC<WatermarkedDocumentReviewerProps> = ({
  documents,
  clientName,
  clientEmail,
  referenceCode,
  isHost,
  onAcknowledgeDocument,
  onAddNote,
  onLogAuditEvent
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(
    documents.length > 0 ? documents[0].id : ''
  );
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [newNoteText, setNewNoteText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [ackSuccess, setAckSuccess] = useState(false);

  // Live formatted timestamp for dynamic watermark
  const [watermarkTime, setWatermarkTime] = useState(() => new Date().toUTCString());

  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkTime(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Privacy Shield: Blur when window loses focus
  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true);
      onLogAuditEvent('document_view_refocused');
    };
    const handleBlur = () => {
      setIsWindowFocused(false);
      onLogAuditEvent('privacy_blur_activated');
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        setIsWindowFocused(false);
        onLogAuditEvent('privacy_blur_activated');
      } else {
        setIsWindowFocused(true);
        onLogAuditEvent('document_view_refocused');
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const activeDoc = documents.find(d => d.id === selectedDocId) || documents[0];

  // Mask client email for watermark e.g. "m.***@example.com"
  const maskedEmail = clientEmail.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => {
    return `${first}${'*'.repeat(Math.min(5, middle.length))}${domain}`;
  });

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'in') setZoomLevel(prev => Math.min(180, prev + 15));
    if (direction === 'out') setZoomLevel(prev => Math.max(70, prev - 15));
    if (direction === 'reset') setZoomLevel(100);
  };

  const handleAcknowledge = async () => {
    if (!activeDoc) return;
    try {
      setIsSubmittingAck(true);
      await onAcknowledgeDocument(activeDoc.documentId || activeDoc.id);
      setAckSuccess(true);
      setTimeout(() => setAckSuccess(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !activeDoc) return;
    try {
      await onAddNote(activeDoc.documentId || activeDoc.id, newNoteText.trim(), isInternalNote);
      setNewNoteText('');
    } catch (err) {
      console.error(err);
    }
  };

  if (!activeDoc) {
    return (
      <div className="p-8 text-center bg-[#FBF8F1] border border-[#D8C9A5] rounded-2xl text-[#10233D]">
        <FileText className="w-8 h-8 mx-auto text-[#C99A3D] mb-2" />
        <h4 className="font-serif font-bold">No Documents Loaded for Review</h4>
        <p className="text-xs text-[#52657B] mt-1">
          Your advisor has not attached any confidential tax documents to this session.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#081E36] border border-[#244567] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full max-h-[780px]">
      {/* Document Review Header & Selector */}
      <div className="bg-[#06172C] p-3.5 border-b border-[#244567] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#0D2746] text-[#E2B957] border border-[#244567]">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-[#F7F1E5] flex items-center gap-2">
              <span>{activeDoc.title}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#0D2746] text-[#E2B957] border border-[#B98B32]">
                Tax Year {activeDoc.taxYear}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Ref: <strong className="text-white">{referenceCode}</strong> &bull; Protected under IRC § 7216
            </div>
          </div>
        </div>

        {/* Multi-document switcher */}
        {documents.length > 1 && (
          <div className="flex items-center gap-1.5 bg-[#0D2746] p-1 rounded-xl border border-[#244567]">
            {documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => {
                  setSelectedDocId(doc.id);
                  setCurrentPage(1);
                  onLogAuditEvent('document_switched', { documentId: doc.id });
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  doc.id === activeDoc.id
                    ? 'bg-[#C99A3D] text-[#06172C]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {doc.docType}
              </button>
            ))}
          </div>
        )}

        {/* Zoom & Page Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0D2746] px-2 py-1 rounded-lg border border-[#244567]">
            <button
              onClick={() => handleZoom('out')}
              className="p-1 text-slate-300 hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-[#E2B957] px-1">{zoomLevel}%</span>
            <button
              onClick={() => handleZoom('in')}
              className="p-1 text-slate-300 hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom('reset')}
              className="p-1 text-slate-300 hover:text-white rounded ml-1"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#0D2746] px-2 py-1 rounded-lg border border-[#244567]">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-300">
              Page {currentPage} of {activeDoc.totalPages}
            </span>
            <button
              disabled={currentPage >= activeDoc.totalPages}
              onClick={() => setCurrentPage(prev => Math.min(activeDoc.totalPages, prev + 1))}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-40"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Review Area: Split Screen (Protected Viewer + Notes Sidebar) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative">
        {/* Document Viewer Viewport */}
        <div className="lg:col-span-8 p-6 overflow-auto bg-[#030D19] flex items-center justify-center relative select-none">
          {/* PRIVACY SHIELD: When Window loses focus */}
          {!isWindowFocused && (
            <div className="absolute inset-0 z-50 bg-[#06172C]/95 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#0D2746] border border-[#B98B32] flex items-center justify-center text-[#E2B957]">
                <EyeOff className="w-7 h-7" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#F7F1E5]">
                Confidential Document Obscured
              </h3>
              <p className="text-xs text-[#EAD7A3] max-w-sm">
                Document contents are automatically shielded while your browser window or tab is not active. Click back to resume review.
              </p>
            </div>
          )}

          {/* Render Document Page Card */}
          <div
            className="transition-transform duration-150 origin-top bg-[#FBF8F1] border-2 border-[#D8C9A5] rounded-xl shadow-2xl p-8 relative overflow-hidden text-[#10233D] max-w-xl w-full"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          >
            {/* DYNAMIC REPEATING WATERMARK OVERLAY */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-around rotate-[-25deg] scale-125 opacity-25 select-none"
            >
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="whitespace-nowrap text-center font-mono font-bold tracking-widest text-[#06172C] text-xs py-4"
                >
                  A/R TAX SERVICES &bull; {(clientName || 'AUTHORIZED CLIENT').toUpperCase()} &bull; {maskedEmail} &bull; {referenceCode} &bull; {watermarkTime} &bull; CONFIDENTIAL IRC § 7216
                </div>
              ))}
            </div>

            {/* Document Content */}
            <div className="relative z-10 space-y-6">
              <div className="border-b-2 border-[#10233D] pb-3 flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-[#52657B]">
                    Department of the Treasury &bull; Internal Revenue Service
                  </span>
                  <h2 className="font-serif text-xl font-bold tracking-tight text-[#10233D]">
                    {activeDoc.title}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="font-serif text-2xl font-black text-[#10233D]">{activeDoc.taxYear}</span>
                  <div className="text-[10px] font-mono text-[#52657B]">OMB No. 1545-0008</div>
                </div>
              </div>

              {/* Sample Tax Form Fields */}
              <div className="bg-white/80 p-4 rounded-xl border border-[#D8C9A5] font-mono text-xs space-y-3 leading-relaxed">
                {activeDoc.sampleContent ? (
                  activeDoc.sampleContent.split('\n').map((line, idx) => (
                    <div key={idx} className="flex justify-between border-b border-dashed border-[#D8C9A5] pb-1">
                      <span className="text-[#52657B]">{line.split(':')[0]}:</span>
                      <span className="font-bold text-[#10233D]">{line.split(':')[1]}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[#52657B]">Authorized tax return document loaded for review.</p>
                )}
              </div>

              <div className="pt-2 text-[10px] text-[#52657B] font-mono border-t border-[#D8C9A5] flex justify-between">
                <span>Page {currentPage} of {activeDoc.totalPages}</span>
                <span>Security Token: {referenceCode}</span>
                <span>Verification: MATCHED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Review Notes & Client Acknowledgment */}
        <div className="lg:col-span-4 bg-[#06172C] border-l border-[#244567] flex flex-col justify-between p-4 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h4 className="font-serif text-sm font-bold text-[#E2B957] flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <span>Advisor & Client Review Log</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Notes recorded during consultation are filed to client dossier.
              </p>
            </div>

            {/* Notes List */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {activeDoc.reviewerNotes && activeDoc.reviewerNotes.length > 0 ? (
                activeDoc.reviewerNotes.map(note => (
                  <div
                    key={note.id}
                    className={`p-2.5 rounded-xl text-xs space-y-1 border ${
                      note.isInternal
                        ? 'bg-[#0D2746] border-[#B98B32] text-[#F7F1E5]'
                        : 'bg-[#081E36] border-[#244567] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-[#E2B957]">{note.authorName}</span>
                      {note.isInternal && (
                        <span className="px-1.5 py-0.2 rounded bg-[#C99A3D] text-[#06172C] font-bold text-[9px]">
                          CPA INTERNAL
                        </span>
                      )}
                    </div>
                    <p className="leading-snug">{note.text}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No review notes recorded yet.
                </div>
              )}
            </div>

            {/* Add Note Form */}
            <form onSubmit={handleAddNoteSubmit} className="space-y-2 pt-2 border-t border-[#244567]">
              <textarea
                rows={2}
                value={newNoteText}
                onChange={e => setNewNoteText(e.target.value)}
                placeholder="Add observation or client inquiry..."
                className="w-full p-2 rounded-xl text-xs bg-[#081E36] border border-[#244567] text-white placeholder-slate-400 outline-none focus:border-[#C99A3D]"
              />
              {isHost && (
                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={e => setIsInternalNote(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#C99A3D]"
                  />
                  <span>Mark as internal CPA review note</span>
                </label>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newNoteText.trim()}
                  className="px-3 py-1.5 rounded-lg bg-[#0D2746] hover:bg-[#14375D] border border-[#244567] text-[#E2B957] text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Log Note</span>
                </button>
              </div>
            </form>
          </div>

          {/* Client Document Acknowledgment Action */}
          <div className="pt-4 border-t border-[#244567] space-y-3 mt-4">
            {activeDoc.clientAcknowledged ? (
              <div className="p-3 bg-[#138A67]/20 border border-[#138A67] rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold">Client Acknowledged</div>
                  <div className="text-[10px] text-emerald-200">
                    Timestamp: {activeDoc.clientAcknowledgmentTimestamp ? new Date(activeDoc.clientAcknowledgmentTimestamp).toLocaleTimeString() : 'Verified'}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <BrandedButton
                  size="md"
                  variant="primary"
                  isLoading={isSubmittingAck}
                  onClick={handleAcknowledge}
                  className="w-full"
                >
                  Acknowledge & Confirm Form Review
                </BrandedButton>
                <p className="text-[10px] text-slate-400 mt-1 text-center">
                  Records mutual client review for e-file compliance gate.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
