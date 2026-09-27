import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  UploadCloud, 
  RefreshCw, 
  ExternalLink, 
  ShieldCheck,
  AlertCircle 
} from 'lucide-react';

export const AccountingView: React.FC = () => {
  const [qboConnected, setQboConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [csvUploaded, setCsvUploaded] = useState(false);

  const handleConnectQBO = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setQboConnected(true);
      setIsConnecting(false);
    }, 1200);
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
            Direct read-only API feeds and trial balance imports for automated Schedule C and corporate reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4" />
          <span>Read-Only Financial Data Sync</span>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Intuit QuickBooks Online */}
        <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 font-bold flex items-center justify-center text-sm">
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
              disabled={isConnecting || qboConnected}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                qboConnected
                  ? 'bg-[#06172C] text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C]'
              }`}
            >
              {isConnecting ? (
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
                If you use Xero, Wave, FreshBooks, or an external bookkeeping ledger, upload your year-end trial balance or general ledger export.
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
              className="w-full py-2.5 rounded-xl bg-[#06172C] hover:bg-[#132E52] border border-[#183458] text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <UploadCloud className="w-4 h-4 text-[#C6A15B]" />
              <span>{csvUploaded ? 'Re-upload Trial Balance' : 'Upload General Ledger CSV'}</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
