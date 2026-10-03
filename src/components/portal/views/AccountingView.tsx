import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  UploadCloud, 
  RefreshCw, 
  ExternalLink, 
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Send,
  Lock,
  FileText
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface TransactionInquiry {
  id: string;
  date: string;
  description: string;
  amount: number;
  question: string;
  status: 'PENDING_CLIENT_RESPONSE' | 'SUBMITTED';
  clientResponse?: string;
  uploadedReceiptName?: string;
}

export const AccountingView: React.FC = () => {
  const { currentUser } = useApp();
  const [qboConnected, setQboConnected] = useState(false);
  const [xeroConnected, setXeroConnected] = useState(false);
  const [isConnectingQBO, setIsConnectingQBO] = useState(false);
  const [isConnectingXero, setIsConnectingXero] = useState(false);
  const [csvUploaded, setCsvUploaded] = useState(false);
  const [clientWriteAuthorized, setClientWriteAuthorized] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // Client Transaction Clarifications / Bookkeeping questions
  const [inquiries, setInquiries] = useState<TransactionInquiry[]>([
    {
      id: 'inq_01',
      date: '2025-09-15',
      description: 'AMAZON.COM* COMMERCIAL ORDER #4819',
      amount: 489.99,
      question: 'Please confirm whether this hardware purchase was for firm computer equipment or office consumable supplies (required for De Minimis Safe Harbor election).',
      status: 'PENDING_CLIENT_RESPONSE'
    }
  ]);
  const [activeResponseText, setActiveResponseText] = useState<{ [id: string]: string }>({});

  const handleConnectQBO = () => {
    setIsConnectingQBO(true);
    setTimeout(() => {
      setQboConnected(true);
      setIsConnectingQBO(false);
      setNotice({ type: 'success', message: 'QuickBooks Online linked in secure Read-Only mode.' });
      setTimeout(() => setNotice(null), 4000);
    }, 1200);
  };

  const handleConnectXero = () => {
    setIsConnectingXero(true);
    setTimeout(() => {
      setXeroConnected(true);
      setIsConnectingXero(false);
      setNotice({ type: 'success', message: 'Xero Organization linked in secure Read-Only mode.' });
      setTimeout(() => setNotice(null), 4000);
    }, 1200);
  };

  const handleToggleWriteAuth = async () => {
    const nextState = !clientWriteAuthorized;
    setClientWriteAuthorized(nextState);
    if (nextState) {
      try {
        const token = localStorage.getItem('artax_session_token') || localStorage.getItem('supabase_auth_token');
        await fetch('/api/bookkeeping/sync/write-authorize/client', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {})
          },
          body: JSON.stringify({ provider: 'QUICKBOOKS' })
        });
      } catch {
        // graceful client fallback
      }
      setNotice({
        type: 'info',
        message: 'Provisional write authorization granted to A/R Tax Services CPAs. All modifications require independent maker-checker review before posting.'
      });
    } else {
      setNotice({
        type: 'info',
        message: 'Write authorization revoked. Ledgers are strictly read-only.'
      });
    }
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSubmitClarification = (inquiryId: string) => {
    const text = activeResponseText[inquiryId];
    if (!text || !text.trim()) return;

    setInquiries(prev => prev.map(inq => {
      if (inq.id !== inquiryId) return inq;
      return {
        ...inq,
        status: 'SUBMITTED',
        clientResponse: text.trim(),
        uploadedReceiptName: 'Receipt_Amazon_Invoice_4819.pdf'
      };
    }));

    setNotice({
      type: 'success',
      message: 'Business purpose description and receipt transmitted to your assigned accountant.'
    });
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-6 sm:p-7 rounded-2xl bg-[#0A1F38] border border-[#183458] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
            General Ledger &amp; Bookkeeping Feeds
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mt-1">
            Accounting &amp; Banking Connections
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Direct read-only API feeds and trial balance imports for automated Schedule C, Form 1120-S, and partnership reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4" />
          <span>Read-Only Financial Data Sync</span>
        </div>
      </div>

      {notice && (
        <div className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
          notice.type === 'success' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-blue-950/60 border-blue-500/40 text-blue-300'
        }`}>
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Intuit QuickBooks Online */}
        <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 font-bold flex items-center justify-center text-sm font-mono">
                QB
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                qboConnected
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {qboConnected ? 'Connected (Live)' : 'Not Connected'}
              </span>
            </div>

            <div>
              <h3 className="font-serif text-base font-bold text-white">Intuit QuickBooks Online</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Connect your QuickBooks ledger using OAuth 2.0 to import Profit &amp; Loss statements, balance sheets, and journal entries directly to your CPA workpapers.
              </p>
            </div>

            {qboConnected && (
              <div className="p-3 rounded-xl bg-[#06172C] border border-[#183458] text-xs text-slate-300 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>Last Reconciled:</span>
                  <strong className="text-emerald-400 font-mono">Today, 11:20 AM EST</strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Synced Accounts:</span>
                  <span className="text-white font-mono">1 Operating, 1 Credit Card</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#183458]">
            <button
              type="button"
              onClick={handleConnectQBO}
              disabled={isConnectingQBO || qboConnected}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                qboConnected
                  ? 'bg-[#06172C] text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C]'
              }`}
            >
              {isConnectingQBO ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting to Intuit OAuth...</span>
                </>
              ) : qboConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>QuickBooks Online Connected</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  <span>Connect QuickBooks Online</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Xero Cloud Accounting */}
        <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 font-bold flex items-center justify-center text-sm font-mono">
                XR
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                xeroConnected
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {xeroConnected ? 'Connected (Live)' : 'Not Connected'}
              </span>
            </div>

            <div>
              <h3 className="font-serif text-base font-bold text-white">Xero Accounting</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Seamless multi-currency ledger integration with Xero organization feeds, automatic invoice batches, and general ledger synchronization.
              </p>
            </div>

            {xeroConnected && (
              <div className="p-3 rounded-xl bg-[#06172C] border border-[#183458] text-xs text-slate-300 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>Status:</span>
                  <strong className="text-blue-400 font-mono">Active (Read-Only)</strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Last Sync:</span>
                  <span className="text-white font-mono">Today, 09:45 AM EST</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#183458]">
            <button
              type="button"
              onClick={handleConnectXero}
              disabled={isConnectingXero || xeroConnected}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                xeroConnected
                  ? 'bg-[#06172C] text-blue-400 border border-blue-500/30'
                  : 'bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C]'
              }`}
            >
              {isConnectingXero ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting to Xero...</span>
                </>
              ) : xeroConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xero Connected</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  <span>Connect Xero Organization</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Manual Trial Balance / CSV Export */}
        <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-[#C6A15B]/15 text-[#C6A15B] font-bold flex items-center justify-center text-sm">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                csvUploaded
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {csvUploaded ? 'Trial Balance Imported' : 'CSV Import'}
              </span>
            </div>

            <div>
              <h3 className="font-serif text-base font-bold text-white">Manual Trial Balance CSV</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                If you use Wave, FreshBooks, Sage, or an offline bookkeeping ledger, upload your year-end trial balance or general ledger export.
              </p>
            </div>

            {csvUploaded ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>2025_YearEnd_TrialBalance.csv parsed successfully.</span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#06172C] border border-[#183458] text-[11px] text-slate-400">
                Supports Standard 4-Column and Multi-Currency General Ledger exports.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#183458]">
            <button
              type="button"
              onClick={() => setCsvUploaded(true)}
              className="w-full py-2.5 rounded-xl bg-[#06172C] hover:bg-[#132E52] border border-[#183458] text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-[#C6A15B]" />
              <span>{csvUploaded ? 'Re-upload Trial Balance' : 'Upload General Ledger CSV'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Stage 1 Client Write Authorization Control */}
      <div className="p-5 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Lock className="w-4 h-4 text-[#C6A15B]" />
            <span>Accounting Ledger Modification Permissions (Stage 1 Authorization)</span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            By default, all accounting feeds are strictly read-only. Granting permission allows certified A/R Tax Services CPAs to draft adjusting entries for your approval.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleWriteAuth}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
            clientWriteAuthorized
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-[#06172C] hover:bg-[#0E2C52] border border-slate-700 text-slate-300'
          }`}
        >
          {clientWriteAuthorized ? 'Write Authorized (Click to Revoke)' : 'Authorize CPA Adjustments'}
        </button>
      </div>

      {/* Bookkeeping Clarifications & Inquiries */}
      <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#C6A15B]" />
              <span>Transaction Clarifications &amp; Receipt Requests</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Your CPA has flagged the following items requiring your confirmation of business purpose or supporting receipt.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#06172C] border border-[#183458] text-slate-300">
            {inquiries.filter(i => i.status === 'PENDING_CLIENT_RESPONSE').length} Pending
          </span>
        </div>

        <div className="space-y-3">
          {inquiries.map((inq) => (
            <div key={inq.id} className="p-4 rounded-xl bg-[#06172C] border border-[#183458] space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800 pb-2">
                <div className="font-mono text-white font-bold">{inq.description}</div>
                <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                  <span>Date: {inq.date}</span>
                  <span className="text-[#C6A15B] font-bold">${inq.amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-slate-300 bg-[#0A1F38] p-3 rounded-lg border border-[#183458]">
                <strong className="text-[#C6A15B] block mb-1">CPA Inquiry:</strong>
                {inq.question}
              </div>

              {inq.status === 'SUBMITTED' ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Response Transmitted to CPA</span>
                  </div>
                  <div className="text-[11px] text-slate-300 italic">&ldquo;{inq.clientResponse}&rdquo;</div>
                  {inq.uploadedReceiptName && (
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-1">
                      <FileText className="w-3 h-3 text-[#C6A15B]" />
                      <span>Attached: {inq.uploadedReceiptName}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={activeResponseText[inq.id] || ''}
                    onChange={(e) => setActiveResponseText({ ...activeResponseText, [inq.id]: e.target.value })}
                    placeholder="Describe business purpose (e.g. 'Laptop upgrade for client financial modeling')..."
                    className="w-full bg-[#0D2745] border border-slate-700 rounded-lg p-2 text-xs text-white h-16 outline-none"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => alert('Simulated document picker: Selected Amazon_Receipt.pdf')}
                      className="px-3 py-1.5 bg-[#0D2745] hover:bg-[#14375F] text-slate-300 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-[#C6A15B]" />
                      <span>Attach Receipt PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmitClarification(inq.id)}
                      className="px-4 py-1.5 bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Clarification</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
