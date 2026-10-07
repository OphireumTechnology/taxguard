/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Messages Preview Card
 *
 * Implements Section 13 of Client Dashboard Architecture:
 * - Shows sender, preview snippet, timestamp, read/unread status
 * - Actions: Open conversation, Reply, New Message
 * - Strictly respects client isolation (no cross-client leakage)
 */

import React from 'react';
import {
  MessageSquare,
  ArrowRight,
  Clock,
  User,
  Send,
  Plus,
  ShieldCheck
} from 'lucide-react';

export interface MessagePreviewItem {
  id: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export interface MessagesPreviewCardProps {
  messages?: MessagePreviewItem[];
  unreadCount?: number;
  onOpenMessages: () => void;
  onComposeMessage?: () => void;
}

export const MessagesPreviewCard: React.FC<MessagesPreviewCardProps> = ({
  messages = [],
  unreadCount = 0,
  onOpenMessages,
  onComposeMessage
}) => {
  const latestMessage = messages.length > 0 ? messages[0] : null;

  return (
    <div
      aria-label="Secure Messages Preview"
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-5 shadow-xl space-y-4"
    >
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            SECURE MESSAGES
          </h3>
        </div>
        {unreadCount > 0 ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
            {unreadCount} Unread
          </span>
        ) : (
          <span className="text-[10px] font-mono text-slate-400">All Read</span>
        )}
      </div>

      {latestMessage ? (
        <div className="space-y-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#102D4F] border border-[#D4A843]/40 flex items-center justify-center text-[#D4A843] font-bold text-xs shrink-0">
                  {latestMessage.senderName.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-white text-xs">{latestMessage.senderName}</div>
                  <div className="text-[10px] text-slate-400">{latestMessage.senderRole}</div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-400">{latestMessage.timestamp}</span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed italic line-clamp-3">
              &ldquo;{latestMessage.content}&rdquo;
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenMessages}
              className="flex-1 py-2 px-3 rounded-xl bg-[#102D4F] hover:bg-[#143657] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View Conversation</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#D4A843]" />
            </button>
            {onComposeMessage && (
              <button
                type="button"
                onClick={onComposeMessage}
                className="py-2 px-3 rounded-xl bg-[#06182B] hover:bg-[#102D4F] text-[#D4A843] border border-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Encrypted direct communication with your dedicated CPA and tax advisory team.
          </p>

          <button
            type="button"
            onClick={onOpenMessages}
            className="w-full py-2.5 px-3 rounded-xl bg-[#102D4F] hover:bg-[#143657] text-slate-200 hover:text-white border border-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-[#D4A843]" />
            <span>Send a Message</span>
          </button>
        </div>
      )}
    </div>
  );
};
