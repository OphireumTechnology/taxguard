import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Trash2, 
  Copy, 
  Check, 
  Printer, 
  ThumbsUp, 
  ThumbsDown, 
  RotateCcw, 
  HelpCircle, 
  BookOpen, 
  ShieldAlert, 
  ExternalLink,
  ChevronDown,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  generateAssistantResponse, 
  checkGuardrails, 
  SUGGESTED_QUESTIONS, 
  AssistantResponse, 
  AssistantContext,
  MANDATORY_REFUSAL_MESSAGE 
} from './assistantKnowledge';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sources?: AssistantResponse['sources'];
  timestamp: string;
  isRefusal?: boolean;
  feedback?: 'positive' | 'negative';
}

interface PublicV2AssistantPageProps {
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2AssistantPage: React.FC<PublicV2AssistantPageProps> = ({
  onNavigate,
  onOpenConsultation
}) => {
  const [context, setContext] = useState<AssistantContext>({
    taxYear: '2025',
    jurisdiction: 'Federal (IRS)',
    profile: 'individual'
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Simulate realistic typing / response generation with knowledge engine
    setTimeout(() => {
      const response = generateAssistantResponse(query, context);
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.answer,
        sources: response.sources,
        isRefusal: response.refusal,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintMessage = (text: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>A/R Accounting Guidance Assistant — Print Document</title>
          <style>
            body { font-family: monospace, sans-serif; padding: 40px; color: #000; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 20px; }
            .meta { font-size: 11px; margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
            .content { white-space: pre-wrap; font-size: 13px; }
            .footer { font-size: 10px; margin-top: 40px; border-top: 1px solid #000; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>A/R Tax Services, LLC — Accounting Guidance Transcript</h1>
          <div class="meta">
            <div>Tax Year Context: ${context.taxYear}</div>
            <div>Jurisdiction: ${context.jurisdiction}</div>
            <div>Profile: ${context.profile}</div>
            <div>Generated: ${new Date().toLocaleString()}</div>
          </div>
          <div class="content">${text.replace(/#/g, '')}</div>
          <div class="footer">
            Educational guidance only. Not formal tax, legal, or investment advice.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleFeedback = (id: string, type: 'positive' | 'negative') => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, feedback: type } : msg))
    );
  };

  const handleClearConversation = () => {
    setMessages([]);
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-white text-black flex flex-col">
      {/* Header bar */}
      <div className="border-b border-black bg-white px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-black">
                A/R Accounting Guidance Assistant
              </h1>
              <span className="px-2 py-0.5 bg-black text-white text-[10px] font-mono uppercase tracking-wider font-semibold">
                Demonstration
              </span>
            </div>
            <p className="text-xs text-neutral-600 font-sans mt-0.5 max-w-2xl">
              Educational information regarding U.S. federal and state taxation, bookkeeping, payroll accounting, and statutory reporting.
            </p>
          </div>

          {/* Context Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Tax Year */}
            <div className="flex items-center border border-black bg-white px-2 py-1">
              <label htmlFor="tax-year-select" className="text-[10px] font-mono uppercase text-neutral-500 mr-1.5">Tax Year:</label>
              <select
                id="tax-year-select"
                value={context.taxYear}
                onChange={(e) => setContext({ ...context, taxYear: e.target.value as any })}
                className="bg-transparent font-mono font-bold text-black outline-none cursor-pointer"
              >
                <option value="2025">2025 (Upcoming)</option>
                <option value="2024">2024 (Active)</option>
                <option value="2023">2023 (Prior Year)</option>
              </select>
            </div>

            {/* Jurisdiction */}
            <div className="flex items-center border border-black bg-white px-2 py-1">
              <label htmlFor="jurisdiction-select" className="text-[10px] font-mono uppercase text-neutral-500 mr-1.5">Jurisdiction:</label>
              <select
                id="jurisdiction-select"
                value={context.jurisdiction}
                onChange={(e) => setContext({ ...context, jurisdiction: e.target.value })}
                className="bg-transparent font-medium text-black outline-none cursor-pointer"
              >
                <option value="Federal (IRS)">Federal (IRS)</option>
                <option value="California (FTB)">California (FTB)</option>
                <option value="New York (DTF)">New York (DTF)</option>
                <option value="Texas (Comptroller)">Texas (Comptroller)</option>
                <option value="Florida (DOR)">Florida (DOR)</option>
                <option value="Washington (DOR)">Washington (DOR)</option>
                <option value="Illinois (DOR)">Illinois (DOR)</option>
              </select>
            </div>

            {/* Profile */}
            <div className="flex items-center border border-black bg-white px-2 py-1">
              <label htmlFor="profile-select" className="text-[10px] font-mono uppercase text-neutral-500 mr-1.5">Profile:</label>
              <select
                id="profile-select"
                value={context.profile}
                onChange={(e) => setContext({ ...context, profile: e.target.value as any })}
                className="bg-transparent font-medium text-black outline-none cursor-pointer"
              >
                <option value="individual">Individual</option>
                <option value="self_employed">Self-Employed / Sole Prop</option>
                <option value="business">Business Entity (Corp / LLC)</option>
              </select>
            </div>

            {/* Source panel toggle */}
            <button
              onClick={() => setShowSourcesPanel(!showSourcesPanel)}
              className={`px-3 py-1 border border-black text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showSourcesPanel ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Approved Sources</span>
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleClearConversation}
                className="px-2.5 py-1 border border-neutral-300 text-neutral-600 hover:text-black hover:border-black text-xs flex items-center gap-1"
                title="Clear current transcript"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white border border-black min-h-[550px] shadow-sm">
          {/* Scrollable message log */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
            {messages.length === 0 ? (
              /* Empty State */
              <div className="py-8 px-2 max-w-3xl mx-auto space-y-8">
                <div className="border border-black p-6 bg-neutral-50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-black" />
                    <h2 className="text-base font-bold text-black tracking-tight">
                      U.S. Accounting & Tax Guidance Workspace
                    </h2>
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed">
                    This interactive assistant provides objective, citation-backed educational guidance on United States tax return preparation, bookkeeping standards, payroll mechanics, entity pass-through reporting, and record retention.
                  </p>
                  <div className="border-t border-neutral-200 pt-3 text-[11px] text-neutral-600">
                    <strong className="text-black">Compliance Boundary:</strong> Educational guidance only. Queries concerning non-U.S. tax codes, tax evasion, fraudulent records, or investment trading advice are strictly redirected.
                  </div>
                </div>

                {/* Suggested Questions Grid */}
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-black">
                      Suggested Inquiries (Select to Explore)
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">10 Topics Available</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SUGGESTED_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(q)}
                        className="text-left p-3 border border-neutral-300 hover:border-black hover:bg-neutral-50 text-xs text-black font-medium transition-all group flex items-start justify-between"
                      >
                        <span className="pr-2 leading-snug">{q}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black flex-shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Message List */
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`border ${
                    msg.sender === 'user' 
                      ? 'border-neutral-400 bg-neutral-50 ml-6 sm:ml-16' 
                      : msg.isRefusal 
                        ? 'border-black bg-neutral-100 mr-4 sm:mr-12' 
                        : 'border-black bg-white mr-2 sm:mr-8'
                  } p-4 sm:p-5 space-y-3 transition-colors`}
                >
                  {/* Sender Header */}
                  <div className="flex items-center justify-between border-b border-neutral-200 pb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono uppercase font-bold text-[11px] ${
                        msg.sender === 'user' ? 'text-neutral-700' : 'text-black'
                      }`}>
                        {msg.sender === 'user' ? 'Client / Taxpayer Inquiry' : 'A/R Accounting Guidance Assistant'}
                      </span>
                      {msg.isRefusal && (
                        <span className="px-1.5 py-0.2 bg-black text-white text-[9px] font-mono">
                          Compliance Refusal
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-neutral-500">{msg.timestamp}</span>
                  </div>

                  {/* Body Text */}
                  <div className="text-xs text-black leading-relaxed space-y-3">
                    {msg.text.split('\n\n').map((paragraph, pIdx) => {
                      if (paragraph.startsWith('### ')) {
                        return <h3 key={pIdx} className="text-sm font-bold text-black border-b border-neutral-200 pb-1 pt-1">{paragraph.replace('### ', '')}</h3>;
                      }
                      if (paragraph.startsWith('#### ')) {
                        return <h4 key={pIdx} className="text-xs font-bold uppercase tracking-wider text-black pt-1">{paragraph.replace('#### ', '')}</h4>;
                      }
                      if (paragraph.includes('|')) {
                        // Simple table renderer
                        const rows = paragraph.split('\n').filter(r => !r.includes(':---'));
                        return (
                          <div key={pIdx} className="overflow-x-auto my-3 border border-black">
                            <table className="min-w-full divide-y divide-black text-[11px]">
                              <tbody>
                                {rows.map((r, rIdx) => (
                                  <tr key={rIdx} className={rIdx === 0 ? 'bg-neutral-100 font-bold' : 'divide-x divide-neutral-200'}>
                                    {r.split('|').filter(c => c.trim().length > 0).map((cell, cIdx) => (
                                      <td key={cIdx} className="px-2.5 py-1.5 border-b border-neutral-200">
                                        {cell.trim()}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }
                      return <p key={pIdx} className="whitespace-pre-line">{paragraph}</p>;
                    })}
                  </div>

                  {/* Sources & Verification Section (Mandatory on Substantive Responses) */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-neutral-300 bg-neutral-50 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase font-bold text-black">
                        <BookOpen className="w-3.5 h-3.5 text-black" />
                        <span>Sources and Verification</span>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        {msg.sources.map((src, sIdx) => (
                          <div key={sIdx} className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-neutral-200 pb-1 last:border-0 last:pb-0">
                            <div>
                              <strong className="text-black">{src.authority}</strong> — <span>{src.documentTitle}</span>
                              <div className="text-[10px] text-neutral-600 italic">{src.relevance}</div>
                            </div>
                            {src.citationUrl && (
                              <a 
                                href={src.citationUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-black hover:underline inline-flex items-center gap-1 font-mono text-[10px] flex-shrink-0"
                              >
                                <span>Official Doc</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions & Feedback (Assistant Messages) */}
                  {msg.sender === 'assistant' && (
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyText(msg.id, msg.text)}
                          className="px-2 py-1 border border-neutral-300 hover:border-black text-[11px] text-black inline-flex items-center gap-1 transition-colors"
                          title="Copy answer text"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-black" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-black" />
                              <span>Copy Answer</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handlePrintMessage(msg.text)}
                          className="px-2 py-1 border border-neutral-300 hover:border-black text-[11px] text-black inline-flex items-center gap-1 transition-colors"
                          title="Print answer transcript"
                        >
                          <Printer className="w-3 h-3 text-black" />
                          <span>Print</span>
                        </button>
                      </div>

                      {/* Feedback buttons */}
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                        <span>Helpful?</span>
                        <button
                          onClick={() => handleFeedback(msg.id, 'positive')}
                          className={`p-1 border ${
                            msg.feedback === 'positive' 
                              ? 'bg-black text-white border-black' 
                              : 'border-neutral-300 hover:border-black text-black'
                          }`}
                          aria-label="Mark helpful"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg.id, 'negative')}
                          className={`p-1 border ${
                            msg.feedback === 'negative' 
                              ? 'bg-black text-white border-black' 
                              : 'border-neutral-300 hover:border-black text-black'
                          }`}
                          aria-label="Mark needs clarification"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Loading typing state */}
            {isLoading && (
              <div className="border border-black bg-white p-4 space-y-2 max-w-md">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-black">
                  <span className="inline-block w-2 h-2 bg-black animate-ping"></span>
                  <span>Reviewing U.S. Tax Publications & Authoritative Sources...</span>
                </div>
                <div className="h-1 bg-neutral-200 overflow-hidden">
                  <div className="h-full bg-black animate-pulse w-2/3"></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Area */}
          <div className="p-4 border-t border-black bg-white space-y-2">
            <div className="relative">
              <textarea
                ref={textareaRef}
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question concerning U.S. tax preparation, bookkeeping, S-Corp reporting, or IRS forms..."
                className="w-full p-3 pr-24 border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none text-xs text-black resize-none bg-white font-sans"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                className="absolute right-2.5 bottom-3 px-4 py-2 bg-black text-white text-xs font-medium hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[10px] text-neutral-500 font-mono gap-1">
              <span>Press Enter to send · Shift+Enter for new line</span>
              <span>Need custom advice? <button onClick={onOpenConsultation} className="text-black font-semibold underline hover:text-neutral-700">Schedule Practice Consultation</button></span>
            </div>
          </div>
        </div>

        {/* Verified Sources Sidebar (Desktop or Toggled) */}
        {showSourcesPanel && (
          <aside className="w-80 border border-black bg-neutral-50 p-5 space-y-5 overflow-y-auto hidden lg:block">
            <div className="flex items-center justify-between border-b border-black pb-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-black" />
                <span>Approved Authorities</span>
              </h3>
              <button
                onClick={() => setShowSourcesPanel(false)}
                className="text-neutral-500 hover:text-black text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Every substantive response generated by the A/R Accounting Guidance Assistant draws strictly from verified federal and state statutory authorities:
            </p>

            <div className="space-y-3 text-xs">
              <div className="border border-neutral-200 bg-white p-2.5 space-y-1">
                <div className="font-bold text-black">Internal Revenue Service (IRS.gov)</div>
                <div className="text-[10px] text-neutral-600">Internal Revenue Code, Treasury Regs, Publications 17, 334, 535, 583, 946, Instructions for Forms 1040, 1120-S, 1065.</div>
              </div>

              <div className="border border-neutral-200 bg-white p-2.5 space-y-1">
                <div className="font-bold text-black">U.S. Dept. of the Treasury</div>
                <div className="text-[10px] text-neutral-600">FinCEN beneficial ownership reporting, statutory tax accounting regulations.</div>
              </div>

              <div className="border border-neutral-200 bg-white p-2.5 space-y-1">
                <div className="font-bold text-black">Financial Accounting Standards Board</div>
                <div className="text-[10px] text-neutral-600">FASB Accounting Standards Codification (ASC), U.S. GAAP general reconciliation rules.</div>
              </div>

              <div className="border border-neutral-200 bg-white p-2.5 space-y-1">
                <div className="font-bold text-black">Social Security Administration</div>
                <div className="text-[10px] text-neutral-600">Statutory wage base caps, FICA payroll contribution thresholds.</div>
              </div>

              <div className="border border-neutral-200 bg-white p-2.5 space-y-1">
                <div className="font-bold text-black">U.S. Department of Labor (DOL)</div>
                <div className="text-[10px] text-neutral-600">Fair Labor Standards Act (FLSA), worker classification standards (W-2 vs. 1099).</div>
              </div>

              <div className="border border-neutral-200 bg-white p-2.5 space-y-1">
                <div className="font-bold text-black">State Revenue Agencies</div>
                <div className="text-[10px] text-neutral-600">California FTB, New York DTF, Texas Comptroller, Florida DOR.</div>
              </div>
            </div>

            <div className="border-t border-neutral-300 pt-3 text-[10px] text-neutral-500 font-mono leading-normal">
              Notice: The assistant strictly refrains from offering non-U.S. tax advice, Philippine BIR guidance, or any form of unlawful evasion assistance.
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
