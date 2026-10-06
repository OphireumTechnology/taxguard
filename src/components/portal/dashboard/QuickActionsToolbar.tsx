/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Quick Actions Toolbar
 *
 * Implements:
 * - Section 11: Quick Actions toolbar contextually displaying authorized actions
 *   based on the current authoritative stage.
 */

import React from 'react';
import {
  UploadCloud,
  FileCheck,
  FileQuestion,
  MessageSquare,
  Calendar,
  Eye,
  CheckCircle2,
  PenTool,
  Send,
  Download,
  AlertCircle
} from 'lucide-react';

export interface QuickActionsToolbarProps {
  authoritativeStage: number;
  pendingRequestsCount: number;
  onUploadDocument: () => void;
  onViewChecklist: () => void;
  onOpenQuestionnaire: () => void;
  onOpenRequests?: () => void;
  onSendMessage?: () => void;
  onScheduleAppointment?: () => void;
  onReviewReturn?: () => void;
  onApproveReturn?: () => void;
  onSignForms?: () => void;
  onViewFilingStatus?: () => void;
  onDownloadRecords?: () => void;
}

export const QuickActionsToolbar: React.FC<QuickActionsToolbarProps> = ({
  authoritativeStage,
  pendingRequestsCount,
  onUploadDocument,
  onViewChecklist,
  onOpenQuestionnaire,
  onOpenRequests,
  onSendMessage,
  onScheduleAppointment,
  onReviewReturn,
  onApproveReturn,
  onSignForms,
  onViewFilingStatus,
  onDownloadRecords
}) => {
  return (
    <div className="rounded-xl bg-[#071A2E] border border-slate-800 p-3 shadow-md">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2.5 px-1 flex items-center justify-between">
        <span>Quick Actions</span>
        <span className="text-[10px] text-[#D4A843]">Authorized Actions for Your Stage</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Always available in intake/collection */}
        <button
          type="button"
          onClick={onUploadDocument}
          className="px-3 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-white text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <UploadCloud className="w-3.5 h-3.5 text-[#D4A843]" />
          <span>Upload Document</span>
        </button>

        <button
          type="button"
          onClick={onViewChecklist}
          className="px-3 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-white text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <FileCheck className="w-3.5 h-3.5 text-[#D4A843]" />
          <span>Document Checklist</span>
        </button>

        <button
          type="button"
          onClick={onOpenQuestionnaire}
          className="px-3 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-white text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <FileQuestion className="w-3.5 h-3.5 text-[#D4A843]" />
          <span>Tax Questionnaire</span>
        </button>

        {/* Action: Open Requests if pending */}
        {pendingRequestsCount > 0 && onOpenRequests && (
          <button
            type="button"
            onClick={onOpenRequests}
            className="px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-200 text-xs font-semibold border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer animate-pulse"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Respond to Request ({pendingRequestsCount})</span>
          </button>
        )}

        {/* Action: Messages */}
        {onSendMessage && (
          <button
            type="button"
            onClick={onSendMessage}
            className="px-3 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-white text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-300" />
            <span>Send Message</span>
          </button>
        )}

        {/* Action: Schedule Appointment */}
        {onScheduleAppointment && (
          <button
            type="button"
            onClick={onScheduleAppointment}
            className="px-3 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-white text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-300" />
            <span>Schedule Consultation</span>
          </button>
        )}

        {/* Contextual actions for later stages */}
        {authoritativeStage >= 6 && onReviewReturn && (
          <button
            type="button"
            onClick={onReviewReturn}
            className="px-3 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-white text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>Review Return</span>
          </button>
        )}

        {authoritativeStage === 10 && onApproveReturn && (
          <button
            type="button"
            onClick={onApproveReturn}
            className="px-3 py-1.5 rounded-lg bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approve Return</span>
          </button>
        )}

        {authoritativeStage === 11 && onSignForms && (
          <button
            type="button"
            onClick={onSignForms}
            className="px-3 py-1.5 rounded-lg bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Sign Form 8879</span>
          </button>
        )}

        {authoritativeStage >= 12 && onViewFilingStatus && (
          <button
            type="button"
            onClick={onViewFilingStatus}
            className="px-3 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-white text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-purple-400" />
            <span>View Filing Status</span>
          </button>
        )}

        {authoritativeStage >= 15 && onDownloadRecords && (
          <button
            type="button"
            onClick={onDownloadRecords}
            className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-semibold border border-emerald-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download Tax Package</span>
          </button>
        )}
      </div>
    </div>
  );
};
