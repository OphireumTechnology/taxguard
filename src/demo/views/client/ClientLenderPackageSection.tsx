import React, { useState } from 'react';
import {
  Share2,
  Lock,
  FileText,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Calendar,
  Send,
  Sparkles,
  Info
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientLenderPackageSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
}

export const ClientLenderPackageSection: React.FC<ClientLenderPackageSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant
}) => {
  const [recipientName, setRecipientName] = useState('First Citizens Bank - Commercial Underwriting');
  const [recipientEmail, setRecipientEmail] = useState('commercial.lending@firstcitizens.bank');
  const [loanPurpose, setLoanPurpose] = useState('Commercial Real Estate Facility Expansion');
  const [include2025Tax, setInclude2025Tax] = useState(true);
  const [include2024Tax, setInclude2024Tax] = useState(true);
  const [includeFinancials, setIncludeFinancials] = useState(true);
  const [includeDebtSchedule, setIncludeDebtSchedule] = useState(true);
  const [includeBasisWorkpapers, setIncludeBasisWorkpapers] = useState(true);
  const [irc7216ConsentChecked, setIrc7216ConsentChecked] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Existing lender packages
  const [packages, setPackages] = useState([
    {
      id: 'pkg_01',
      recipient: 'First Citizens Bank - Commercial Credit',
      recipientEmail: 'underwriting@firstcitizens.bank',
      createdDate: '2026-01-20',
      expirationDate: '2026-03-20',
      documentsCount: 6,
      status: 'Active & Encrypted',
      downloadsCount: 3,
      lastDownloaded: 'Feb 12, 2026 at 09:14 AM EST',
      irc7216Signed: true,
      watermark: 'CONFIDENTIAL - FIRST CITIZENS UNDERWRITING'
    }
  ]);

  const handleGeneratePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!irc7216ConsentChecked) {
      alert('IRC § 7216 statutory disclosure consent is required before sharing tax documents.');
      return;
    }

    const newPkg = {
      id: `pkg_${Date.now()}`,
      recipient: recipientName,
      recipientEmail: recipientEmail,
      createdDate: new Date().toISOString().split('T')[0],
      expirationDate: '30 Days from Creation',
      documentsCount: [include2025Tax, include2024Tax, includeFinancials, includeDebtSchedule, includeBasisWorkpapers].filter(Boolean).length,
      status: 'Active & Encrypted',
      downloadsCount: 0,
      lastDownloaded: 'Never',
      irc7216Signed: true,
      watermark: `CONFIDENTIAL - ${recipientName.toUpperCase()}`
    };

    setPackages(prev => [newPkg, ...prev]);

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Generated Lender Sharing Package (IRC § 7216 Authorized)',
      record: `${recipientName} (${recipientEmail})`,
      result: 'Success (Simulated)',
      reason: `Client authorized disclosure under IRC § 7216 for ${loanPurpose}`
    });

    setActionNotice(`Encrypted package generated for ${recipientName}. Secure link with 30-day expiry created.`);
    setIrc7216ConsentChecked(false);
    setTimeout(() => setActionNotice(null), 6000);
  };

  return (
    <div className="space-y-6" id="client-lender-package-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Third-Party Disclosure
              </span>
              <span className="text-xs text-[#667085]">IRC § 7216 Compliant Lender Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Credit, Lender &amp; Underwriting Package Portal
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Assemble certified tax returns, compiled balance sheets, debt schedules, and K-1s into an encrypted lender bundle.
            </p>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{actionNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">IRC § 7216 Consent Logged</span>
          </div>
        )}
      </div>

      {/* Package Generator Form */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-6 shadow-xs">
        <div className="border-b border-[#D8DCE2] pb-3">
          <h3 className="text-sm font-bold text-[#061A2F]">Generate New Secured Underwriting Package</h3>
          <p className="text-xs text-[#667085]">Specify loan officer credentials and select audited deliverables to include.</p>
        </div>

        <form onSubmit={handleGeneratePackage} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#061A2F] mb-1">Financial Institution / Lender Name</label>
              <input
                type="text"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                className="w-full p-2.5 border border-[#D8DCE2] rounded bg-white"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-[#061A2F] mb-1">Underwriter / Loan Officer Email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                className="w-full p-2.5 border border-[#D8DCE2] rounded bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#061A2F] mb-1">Credit Application Purpose</label>
            <input
              type="text"
              value={loanPurpose}
              onChange={e => setLoanPurpose(e.target.value)}
              className="w-full p-2.5 border border-[#D8DCE2] rounded bg-white"
              required
            />
          </div>

          {/* Document Inclusions */}
          <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded space-y-2">
            <span className="font-bold text-[#061A2F] block">Select Verified Workpapers to Include:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={include2025Tax}
                  onChange={e => setInclude2025Tax(e.target.checked)}
                  className="rounded text-[#061A2F]"
                />
                <span>2025 Form 1120-S &amp; Form 7203 (Certified Draft)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={include2024Tax}
                  onChange={e => setInclude2024Tax(e.target.checked)}
                  className="rounded text-[#061A2F]"
                />
                <span>2024 Form 1120-S (Filed Return &amp; Transcripts)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFinancials}
                  onChange={e => setIncludeFinancials(e.target.checked)}
                  className="rounded text-[#061A2F]"
                />
                <span>Compiled Financials (Balance Sheet &amp; P&amp;L with SSARS Disclaimer)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDebtSchedule}
                  onChange={e => setIncludeDebtSchedule(e.target.checked)}
                  className="rounded text-[#061A2F]"
                />
                <span>Commercial Notes &amp; Debt Amortization Schedule</span>
              </label>
            </div>
          </div>

          {/* IRC § 7216 MANDATORY STATUTORY CONSENT */}
          <div className="p-4 bg-[#FAF9F5] border border-[#C99A32] rounded space-y-2">
            <div className="flex items-center gap-2 text-[#061A2F] font-bold">
              <ShieldCheck className="w-4 h-4 text-[#C99A32]" />
              <span>Mandatory IRC § 7216 Disclosure Consent</span>
            </div>
            <p className="text-[11px] text-[#4B5563] leading-relaxed">
              Federal law requires that we obtain your consent before disclosing your tax return information to a third party. Pursuant to Internal Revenue Code § 7216 and Treasury Regulation § 301.7216-3, I hereby authorize A/R Tax Services, LLC to disclose my company&apos;s tax return information to <strong>{recipientName}</strong> solely for the purpose of evaluating credit, loan underwriting, or banking relationships.
            </p>
            <label className="flex items-start gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={irc7216ConsentChecked}
                onChange={e => setIrc7216ConsentChecked(e.target.checked)}
                className="mt-0.5 rounded text-[#061A2F]"
                required
              />
              <span className="text-[11px] text-[#061A2F] font-bold">
                I am an authorized officer/owner and electronically execute this IRC § 7216 disclosure consent.
              </span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!irc7216ConsentChecked}
              className="px-5 py-2.5 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Generate Encrypted Lender Bundle</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Lender Packages */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
        <div className="border-b border-[#D8DCE2] pb-3">
          <h3 className="text-sm font-bold text-[#061A2F]">Active Third-Party Lender Packages</h3>
          <p className="text-xs text-[#667085]">Audit log of authorized recipients, access expirations, and underwriter downloads.</p>
        </div>

        <div className="space-y-3">
          {packages.map(pkg => (
            <div
              key={pkg.id}
              className="border border-[#D8DCE2] rounded-lg p-4 bg-[#FBFAF7] flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#061A2F]">{pkg.recipient}</span>
                  <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-bold">
                    {pkg.status}
                  </span>
                </div>
                <div className="text-xs text-[#667085] flex flex-wrap items-center gap-3">
                  <span>Recipient: <strong className="text-[#061A2F]">{pkg.recipientEmail}</strong></span>
                  <span>&bull;</span>
                  <span>Files: <strong>{pkg.documentsCount} Workpapers</strong></span>
                  <span>&bull;</span>
                  <span>Downloads: <strong className="font-mono text-[#061A2F]">{pkg.downloadsCount} times</strong></span>
                </div>
                <div className="text-[11px] text-[#667085] font-mono">
                  Watermark: {pkg.watermark} &bull; Expires: {pkg.expirationDate}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => alert(`Simulated link copied for ${pkg.recipient}: https://portal.artaxservices.com/share/${pkg.id}`)}
                  className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F] flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copy Secure Link</span>
                </button>
                <button
                  onClick={() => alert(`Simulated download of ${pkg.recipient} bundle.`)}
                  className="px-3 py-1.5 bg-[#061A2F] text-white rounded text-xs font-bold"
                >
                  Download Bundle
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
