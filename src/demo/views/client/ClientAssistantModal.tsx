import React, { useState } from 'react';
import { X, Sparkles, Send, ShieldCheck, HelpCircle } from 'lucide-react';

interface ClientAssistantModalProps {
  isOpen: boolean;
  activeSection?: string;
  currentSection?: string;
  clientId?: string;
  onClose: () => void;
  onNavigate?: (sectionId: string) => void;
}

const CONTEXTUAL_PROMPTS: Record<string, { title: string; suggestions: string[]; initialMessage: string }> = {
  overview: {
    title: 'Overview & Status Assistant',
    initialMessage: 'Welcome to your Tax Portal overview. I can explain your current 18-stage operating cycle, upcoming statutory deadlines, or help you prioritize your next action.',
    suggestions: [
      'What is my immediate required action?',
      'Why is my engagement at Stage 10 (Approve)?',
      'Who is on my assigned A/R Tax Services team?'
    ]
  },
  vault: {
    title: 'Document Vault Assistant',
    initialMessage: 'I can guide you on acceptable file types (PDF, XLSX, images), security scanning standards, or clarify what missing documents are still needed for your 2025 return.',
    suggestions: [
      'What file formats are accepted?',
      'How does the anti-malware verification work?',
      'Can I replace an uploaded document?'
    ]
  },
  questionnaire: {
    title: 'Tax Organizer Assistant',
    initialMessage: 'I am here to assist with your Tax Year 2025 Organizer. Ask me about specific sections, required business details, or why certain IRS information is requested.',
    suggestions: [
      'Why is digital asset reporting required by the IRS?',
      'Can I save my draft and finish later?',
      'What happens after I submit my organizer?'
    ]
  },
  ledger: {
    title: 'Income & Expenses Assistant',
    initialMessage: 'I can help explain business expense categories under IRC Section 162, review safe-harbor limits, or help you log commercial income sources.',
    suggestions: [
      'How does the AI categorization recommendation work?',
      'What is the de minimis safe harbor for equipment?',
      'Are business meals 100% deductible or 50%?'
    ]
  },
  return_review: {
    title: 'Return Review Assistant',
    initialMessage: 'Your draft Form 1120-S is certified by Elena Rostova, CPA. I can explain lines on Form 1120-S, pass-through Schedule K-1s, or help you request a correction.',
    suggestions: [
      'What is Form 8879-S and why do I need to sign it?',
      'How do I request a line correction on the draft?',
      'Does signing Form 8879-S immediately file the return?'
    ]
  },
  billing: {
    title: 'Fee Invoices Assistant',
    initialMessage: 'I can explain your professional fee invoice line items, explain retainer credits, or guide you through our simulated payment workflow.',
    suggestions: [
      'What does this corporate tax preparation fee cover?',
      'How does the simulated payment work in demo mode?',
      'Can I request an installment payment plan?'
    ]
  },
  notices: {
    title: 'Tax Notices Assistant',
    initialMessage: 'Received correspondence from the IRS or South Carolina DOR? I can explain notice types like CP2000, response windows, and how to request formal CPA representation.',
    suggestions: [
      'What does a CP2000 notice mean?',
      'What is Form 2848 Power of Attorney?',
      'How quickly should I respond to a state DOR notice?'
    ]
  },
  archive: {
    title: 'Prior Year Archive Assistant',
    initialMessage: 'Your prior filed corporate returns are stored in this immutable 7-year regulatory vault. I can explain verification hashes or help you request an amendment.',
    suggestions: [
      'How do I verify the SHA-256 authenticity hash?',
      'What is an IRS MeF Submission ID?',
      'How do I request a prior year return amendment?'
    ]
  }
};

export const ClientAssistantModal: React.FC<ClientAssistantModalProps> = ({
  isOpen,
  activeSection,
  currentSection,
  onClose,
  onNavigate
}) => {
  if (!isOpen) return null;

  const resolvedSection = currentSection || activeSection || 'overview';
  const context = CONTEXTUAL_PROMPTS[resolvedSection] || CONTEXTUAL_PROMPTS.overview;
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: context.initialMessage }
  ]);
  const [input, setInput] = useState('');

  const handleSend = (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q) return;

    const userMsg = { role: 'user' as const, text: q };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');

    // Formulate helpful, non-legal-advice responses
    setTimeout(() => {
      let reply = 'Thank you for your question. As a demonstration AI assistant, I can explain portal workflows and standard tax definitions, but professional tax positions are certified by Elena Rostova, CPA.';
      const lower = q.toLowerCase();

      if (lower.includes('8879') || lower.includes('sign')) {
        reply = 'Form 8879-S is the IRS e-file signature authorization for S-Corporations. Signing authorizes A/R Tax Services, LLC to electronically transmit Form 1120-S to the IRS. In this demo, signing records a simulated certified signature without submitting real data.';
      } else if (lower.includes('correction') || lower.includes('error')) {
        reply = 'You can request return corrections directly from the Return Review tab using the "Request Return Correction" form. This notifies your assigned CPA review team and logs an immutable audit event.';
      } else if (lower.includes('file') || lower.includes('format')) {
        reply = 'The Document Vault accepts PDF, JPG, PNG, TIFF, DOCX, XLSX, CSV, OFX, and QFX files up to 25 MB. Executable binaries and scripts are automatically rejected for firm security.';
      } else if (lower.includes('meal') || lower.includes('deductible')) {
        reply = 'Under IRC Section 274(n), ordinary and necessary business meals are generally 50% deductible. Your CPA team automatically applies the proper limitation on Schedule M-1.';
      } else if (lower.includes('notice') || lower.includes('cp2000')) {
        reply = 'A CP2000 is an automated IRS document matching notice. It proposes adjustments based on reported 1099s or W-2s. You can upload the notice in the Tax Notices tab to have your CPA prepare an official response.';
      } else if (lower.includes('payment') || lower.includes('invoice')) {
        reply = 'In this demonstration environment, invoice payments are strictly simulated. Clicking "Simulate Payment" updates your balance and issues a sample receipt, with zero real bank funds moving.';
      }

      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    }, 400);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-modal-title"
    >
      <div className="bg-white rounded-lg border border-[#D8DCE2] w-full max-w-lg h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#D8DCE2] bg-[#061A2F] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D7AC4A]" />
            <div>
              <h2 id="assistant-modal-title" className="text-sm font-bold">
                TaxGuard Contextual Assistant
              </h2>
              <div className="text-[10px] font-mono text-[#D7AC4A]">
                {context.title} • Client Guidance Layer
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Regulatory Disclaimer Banner */}
        <div className="bg-[#FAF9F5] border-b border-[#D8DCE2] px-4 py-2 flex items-center gap-2 text-[11px] text-[#667085]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C99A32] flex-shrink-0" />
          <span>Informational guidance only • Does not constitute formal legal or tax advice.</span>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#061A2F] text-white'
                    : 'bg-[#FBFAF7] border border-[#D8DCE2] text-[#1A2028]'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Contextual Quick Suggestions */}
        <div className="p-3 border-t border-[#D8DCE2] bg-[#FAF9F5] space-y-1.5">
          <div className="text-[10px] font-mono text-[#667085] uppercase tracking-wider font-semibold">
            Suggested Prompts for this Section:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {context.suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s)}
                className="text-[11px] text-left px-2.5 py-1 bg-white border border-[#D8DCE2] hover:border-[#C99A32] rounded text-[#061A2F] transition-colors cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-[#D8DCE2] bg-white flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask about this section or your return..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            className="flex-1 px-3 py-2 text-xs border border-[#D8DCE2] rounded focus:outline-none focus:border-[#C99A32] bg-[#FBFAF7]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="p-2 bg-[#061A2F] text-white rounded hover:bg-[#031323] transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
