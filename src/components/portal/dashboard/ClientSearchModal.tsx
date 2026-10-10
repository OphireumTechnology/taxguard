/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Client-Scoped Search Modal
 *
 * Implements:
 * - Section 5 & 38: Client-scoped search across documents, messages, requests, and tax years
 * - Strict client data boundary: no cross-client search leakage
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  X,
  FileText,
  MessageSquare,
  AlertCircle,
  Calendar,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export interface SearchResultItem {
  id: string;
  type: 'document' | 'message' | 'request' | 'tax_year';
  title: string;
  subtitle: string;
  taxYear?: number;
  targetNav: string;
}

export interface ClientSearchModalProps {
  isOpen: boolean;
  clientId: string;
  currentTaxYear: number;
  availableYears?: number[];
  availableDocuments?: Array<{ id: string; name: string; category?: string; taxYear: number }>;
  availableRequests?: Array<{ id: string; subject: string; status: string; taxYear?: number }>;
  availableMessages?: Array<{ id: string; content: string; sender: string; timestamp: string }>;
  onClose: () => void;
  onNavigateToResult: (targetNav: string, taxYear?: number) => void;
}

export const ClientSearchModal: React.FC<ClientSearchModalProps> = ({
  isOpen,
  clientId,
  currentTaxYear,
  availableYears = [],
  availableDocuments = [],
  availableRequests = [],
  availableMessages = [],
  onClose,
  onNavigateToResult
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [isOpen]);

  const results = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    const matches: SearchResultItem[] = [];

    // Tax Years
    availableYears.forEach((yr) => {
      if (String(yr).includes(term) || `tax year ${yr}`.includes(term)) {
        matches.push({
          id: `ty_${yr}`,
          type: 'tax_year',
          title: `Tax Year ${yr}`,
          subtitle: `Filing Cycle & Records for TY ${yr}`,
          taxYear: yr,
          targetNav: 'home'
        });
      }
    });

    // Client-scoped Documents
    availableDocuments.forEach((doc) => {
      if (
        doc.name.toLowerCase().includes(term) ||
        (doc.category && doc.category.toLowerCase().includes(term))
      ) {
        matches.push({
          id: `doc_${doc.id}`,
          type: 'document',
          title: doc.name,
          subtitle: `Document Vault • ${doc.category || 'Uploaded File'} (TY ${doc.taxYear})`,
          taxYear: doc.taxYear,
          targetNav: 'documents'
        });
      }
    });

    // Client-scoped Requests
    availableRequests.forEach((req) => {
      if (
        req.subject.toLowerCase().includes(term) ||
        req.status.toLowerCase().includes(term)
      ) {
        matches.push({
          id: `req_${req.id}`,
          type: 'request',
          title: req.subject,
          subtitle: `Information Request • Status: ${req.status}`,
          taxYear: req.taxYear || currentTaxYear,
          targetNav: 'requests'
        });
      }
    });

    // Client-scoped Messages
    availableMessages.forEach((msg) => {
      if (msg.content.toLowerCase().includes(term) || msg.sender.toLowerCase().includes(term)) {
        matches.push({
          id: `msg_${msg.id}`,
          type: 'message',
          title: `Message from ${msg.sender}`,
          subtitle: msg.content.slice(0, 75) + '...',
          targetNav: 'messages'
        });
      }
    });

    return matches.slice(0, 10);
  }, [searchTerm, availableDocuments, availableRequests, availableMessages, currentTaxYear, availableYears]);

  if (!isOpen) return null;

  return (
    <dialog ref={dialogRef} onCancel={onClose} aria-label="Search your client records" style={{ width: '100vw', height: '100dvh', maxWidth: 'none', maxHeight: 'none', margin: 0 }} className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#071A2E] border border-slate-700 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col text-xs">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-700/80 flex items-center gap-3 bg-[#06182B]">
          <Search className="w-4 h-4 text-[#D4A843] shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents, requests, messages, tax years..."
            aria-label="Search authorized client records"
            autoFocus
            className="w-full bg-transparent text-white placeholder-slate-400 text-sm outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Client Boundary Note */}
        <div className="px-4 py-2 bg-[#020D1A] text-[10px] font-mono text-slate-400 flex items-center justify-between border-b border-slate-800">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Client Isolated Search (Client ID: {clientId})</span>
          </span>
          <span>No cross-client search leakage</span>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {searchTerm.trim() ? (
            results.length > 0 ? (
              results.map((res) => (
                <div
                  key={res.id}
                  onClick={() => {
                    onNavigateToResult(res.targetNav, res.taxYear);
                    onClose();
                  }}
                  className="p-2.5 rounded-xl hover:bg-[#0D2745] text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-[#102D4F] text-[#D4A843] shrink-0">
                      {res.type === 'document' && <FileText className="w-3.5 h-3.5" />}
                      {res.type === 'request' && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                      {res.type === 'message' && <MessageSquare className="w-3.5 h-3.5 text-blue-400" />}
                      {res.type === 'tax_year' && <Calendar className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate text-xs">{res.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{res.subtitle}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#D4A843] shrink-0" />
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400">
                No matching results found for &ldquo;{searchTerm}&rdquo;.
              </div>
            )
          ) : (
            <div className="p-6 text-center text-slate-400 space-y-1">
              <p className="text-white font-medium">Quick suggestions:</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {['W-2', '1099', '2025', '2024', 'Request', 'Message'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setSearchTerm(chip)}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] hover:bg-slate-700"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
