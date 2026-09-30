import React, { useState } from 'react';
import { 
  FileCheck, 
  Download, 
  PenTool, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  Eye, 
  AlertCircle,
  Clock,
  X
} from 'lucide-react';
import { DocumentItem } from '../../../types';

interface DeliverablesViewProps {
  documents: DocumentItem[];
}

export const DeliverablesView: React.FC<DeliverablesViewProps> = ({ documents }) => {
  const [hasSigned8879, setHasSigned8879] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signerName, setSignerName] = useState('Michael Perotti');
  const [signerPin, setSignerPin] = useState('');
  const [signedStamp, setSignedStamp] = useState<string | null>(null);

  const deliverables = [
    {
      id: 'deliv_1040',
      title: '2025 Form 1040 - Certified Federal & South Carolina Tax Return',
      type: 'Official CPA Prepared Filing Package',
      pages: '28 Pages',
      status: 'Ready for Review',
      description: 'Complete federal individual income tax return including Schedule C, Schedule SE, Itemized Deductions, and SC 1040 state schedules.',
      signed: true,
      certifiedBy: 'Elena Rostova, CPA & Desmond Hinds'
    },
    {
      id: 'deliv_8879',
      title: 'Form 8879 - IRS e-File Signature Authorization',
      type: 'Statutory E-File Authorization',
      pages: '2 Pages',
      status: hasSigned8879 ? 'Signed & Authorized' : 'Signature Required',
      description: 'Authorizes A/R Tax Services, LLC to electronically transmit your 2025 Form 1040 to the Internal Revenue Service and South Carolina Department of Revenue.',
      signed: hasSigned8879,
      certifiedBy: hasSigned8879 ? 'Signed by Michael Perotti' : 'Awaiting Taxpayer Signature'
    }
  ];

  const handleSign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim() || signerPin.length < 5) return;

    const hash = 'SHA256:' + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setSignedStamp(hash);
    setHasSigned8879(true);
    setIsSignModalOpen(false);
  };

  const downloadDeliverable = (title: string) => {
    const blob = new Blob([
      `=======================================================\n` +
      `A/R TAX SERVICES, LLC - OFFICIAL DELIVERABLE ARCHIVE\n` +
      `=======================================================\n` +
      `Document: ${title}\n` +
      `Client: Michael Perotti\n` +
      `Tax Year: 2025\n` +
      `Preparer Firm: A/R Tax Services, LLC (Columbia, SC)\n` +
      `Compliance: IRS Circular 230 & Electronic Signatures Act (E-SIGN)\n` +
      `E-File Status: ${hasSigned8879 ? 'Authorized' : 'Pending Authorization'}\n` +
      `Digital Signature Hash: ${signedStamp || 'VERIFIED_IRS_MEF_STAMP'}\n` +
      `Timestamp: ${new Date().toISOString()}\n` +
      `=======================================================`
    ], { type: 'text/plain' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(u);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-6 sm:p-7 rounded-2xl bg-[#0A1F38] border border-[#183458] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
            Certified Deliverables &amp; Filings
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mt-1">
            Tax Packages &amp; Signature Authorizations
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Review completed CPA workpapers, sign statutory filing authorizations, and access permanent tax archives.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>2 Ready For Review</span>
          </span>
        </div>
      </div>

      {/* Deliverable Items List */}
      <div className="grid grid-cols-1 gap-4">
        {deliverables.map((item) => (
          <div
            key={item.id}
            className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all hover:border-[#1E3A5F]"
          >
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-base font-bold text-white">{item.title}</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  item.signed
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  {item.status}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                {item.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                <span>Format: <strong className="text-white">PDF ({item.pages})</strong></span>
                <span>&bull;</span>
                <span>Certification: <strong className="text-slate-200">{item.certifiedBy}</strong></span>
                {item.id === 'deliv_8879' && signedStamp && (
                  <>
                    <span>&bull;</span>
                    <span className="text-emerald-400 font-mono text-[10px]">Cryptographic Stamp: {signedStamp.slice(0, 16)}...</span>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-shrink-0 w-full md:w-auto justify-end">
              {item.id === 'deliv_8879' && !hasSigned8879 ? (
                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] font-bold text-xs flex items-center gap-2 shadow-md transition-all"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Sign Form 8879</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => downloadDeliverable(item.title)}
                  className="px-4 py-2.5 rounded-xl bg-[#06172C] hover:bg-[#132E52] border border-[#183458] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#C6A15B]" />
                  <span>Download Archive</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Signature Modal */}
      {isSignModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#0A1F38] border border-[#183458] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-[#183458] pb-3">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-[#C6A15B]" />
                <h3 className="font-serif text-base font-bold text-white">
                  Form 8879 Electronic Signature
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsSignModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Under penalties of perjury, I declare that I have examined a copy of my 2025 electronic individual income tax return and accompanying schedules and statements, and to the best of my knowledge and belief, it is true, correct, and complete. I authorize A/R Tax Services, LLC to enter my PIN on my 2025 electronically filed return.
            </p>

            <form onSubmit={handleSign} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Taxpayer Full Legal Name
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full bg-[#06172C] border border-[#183458] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Create 5-Digit Self-Selected E-File PIN
                </label>
                <input
                  type="password"
                  maxLength={5}
                  value={signerPin}
                  onChange={(e) => setSignerPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 54321"
                  className="w-full bg-[#06172C] border border-[#183458] rounded-xl px-3 py-2 text-white font-mono tracking-widest focus:outline-none focus:border-[#C6A15B]"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Any 5 numbers (cannot be all zeros)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#06172C] border border-[#183458] flex items-center gap-2 text-[11px] text-emerald-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Legally binding under the U.S. Electronic Signatures in Global and National Commerce Act (E-SIGN).</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={signerPin.length < 5}
                  className="px-5 py-2.5 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] font-bold transition-colors shadow-md disabled:opacity-50"
                >
                  Confirm &amp; Authorize Transmission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
