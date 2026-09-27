import React, { useState } from 'react';
import { HelpCircle, Send, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { AdvisorRequest } from '../../../types';

interface RequestsViewProps {
  requests: AdvisorRequest[];
  onRespond?: (requestId: string, responseText: string) => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({ requests, onRespond }) => {
  const [replies, setReplies] = useState<{ [key: string]: string }>({});
  const [submittedIds, setSubmittedIds] = useState<{ [key: string]: boolean }>({});

  const sampleRequests: AdvisorRequest[] = requests.length > 0 ? requests : [
    {
      id: 'req_1',
      clientId: 'client_1',
      advisorName: 'Desmond Hinds',
      question: 'Regarding the $14,250 consulting income deposit in October: Was this received under your personal SSN or under Perotti Consulting EIN?',
      status: 'pending',
      createdAt: '2026-03-12',
      taxYear: 2025
    },
    {
      id: 'req_2',
      clientId: 'client_1',
      advisorName: 'Elena Rostova, CPA',
      question: 'Please confirm total business vehicle mileage for 2025: Does the 18,420 mile figure include personal commuting, or is that 100% substantiated business log?',
      status: 'answered',
      response: 'Confirmed 100% business miles using MileIQ log. Commuting was in a separate personal vehicle.',
      createdAt: '2026-03-08',
      taxYear: 2025
    }
  ];

  const handleSendResponse = (reqId: string) => {
    const text = replies[reqId];
    if (!text || !text.trim()) return;

    if (onRespond) onRespond(reqId, text);
    setSubmittedIds(prev => ({ ...prev, [reqId]: true }));
  };

  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-7 rounded-2xl bg-[#0A1F38] border border-[#183458] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
            Inquiries &amp; Information Clarifications
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mt-1">
            Advisor Clarification Requests
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Questions posed by your CPA preparation team to ensure accurate deduction calculations and IRS compliance.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {sampleRequests.map((req) => {
          const isSubmitted = submittedIds[req.id] || req.status === 'answered' || req.status === 'resolved';

          return (
            <div
              key={req.id}
              className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] space-y-4 shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#183458] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#C6A15B]/15 text-[#C6A15B] flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">Inquiry from {req.advisorName}</span>
                    <span className="text-[10px] text-slate-400 block">TY {req.taxYear || 2025} &bull; Received {req.createdAt}</span>
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase self-start sm:self-auto ${
                  isSubmitted
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  {isSubmitted ? 'Answered' : 'Response Needed'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#06172C] border border-[#183458] text-xs text-slate-200 leading-relaxed font-medium">
                &ldquo;{req.question}&rdquo;
              </div>

              {isSubmitted ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Your Submitted Response:</span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    {replies[req.id] || req.response || 'Response recorded and forwarded to CPA team.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Your Response to Advisor:
                  </label>
                  <textarea
                    rows={3}
                    value={replies[req.id] || ''}
                    onChange={(e) => setReplies({ ...replies, [req.id]: e.target.value })}
                    placeholder="Provide details or clarification..."
                    className="w-full bg-[#06172C] border border-[#183458] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C6A15B]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSendResponse(req.id)}
                      disabled={!replies[req.id]?.trim()}
                      className="px-5 py-2 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      <span>Submit Response</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
