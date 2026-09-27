import React from 'react';
import { FileText, ChevronRight, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { DocumentItem } from '../../../types';

interface RecentDocumentsProps {
  documents: DocumentItem[];
  onViewAll: () => void;
}

export const RecentDocuments: React.FC<RecentDocumentsProps> = ({
  documents,
  onViewAll
}) => {
  const displayDocs = [
    {
      id: 'd1',
      title: '2025 Form W-2 (Wage and Tax Statement)',
      category: 'W-2',
      status: 'received',
      statusLabel: 'Received',
      statusColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      time: 'Uploaded today'
    },
    {
      id: 'd2',
      title: 'Business Bank Statement (Jan-Nov)',
      category: 'Bank Statement',
      status: 'review',
      statusLabel: 'Needs Review',
      statusColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      time: 'Uploaded yesterday'
    },
    {
      id: 'd3',
      title: '2025 Tax Organizer & Questionnaire',
      category: 'Organizer',
      status: 'complete',
      statusLabel: 'Complete',
      statusColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      time: 'Sep 10'
    },
    {
      id: 'd4',
      title: 'Prior Year Form 1040 (2024 Return)',
      category: 'Prior Return',
      status: 'verified',
      statusLabel: 'Verified',
      statusColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      time: 'Jan 18'
    }
  ];

  return (
    <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-4">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between border-b border-[#183458] pb-3">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
              Document Vault
            </span>
            <h3 className="font-serif text-base font-bold text-white">Recent Documents</h3>
          </div>
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] flex items-center gap-1"
          >
            <span>View all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Documents list */}
        <div className="space-y-2.5">
          {displayDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-3 rounded-xl bg-[#06172C] border border-[#183458] flex items-center justify-between gap-3 hover:border-[#1E3A5F] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#0D2340] border border-[#183458] flex items-center justify-center text-[#C6A15B] flex-shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-[240px]">
                    {doc.title}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {doc.time} &bull; {doc.category}
                  </div>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${doc.statusColor}`}>
                {doc.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-[#183458]">
        <button
          type="button"
          onClick={onViewAll}
          className="w-full text-center text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] py-1"
        >
          View Document Center &rarr;
        </button>
      </div>
    </div>
  );
};
