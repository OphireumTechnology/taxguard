/**
 * TaxGuard AI – Verified Reports, Cryptographic Hash & QR Verification
 * Public Safe Disclosure: Validates document integrity without exposing confidential client data.
 */

import React, { useState } from 'react';
import { 
  QrCode, 
  ShieldCheck, 
  Lock, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { PublicVerificationRecord } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardReportsView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [lookupId, setLookupId] = useState<string>('AR-TAX-2024-VRF-88219');
  const [verificationResult, setVerificationResult] = useState<PublicVerificationRecord | null>(() =>
    TaxGuardStorageService.verifyRecord('AR-TAX-2024-VRF-88219')
  );
  const [hasSearched, setHasSearched] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    const res = TaxGuardStorageService.verifyRecord(lookupId);
    setVerificationResult(res);
  };

  const verificationUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}#taxguard/verification?id=${lookupId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* Verification Lookup Tool */}
      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#C99A32]" />
            <span>Cryptographic Verification & Public Safe Registry</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Authenticate signed tax workpapers, client summaries, and filing seals via SHA-256 integrity checks.
          </p>
        </div>

        <form onSubmit={handleLookup} className="flex gap-2 max-w-xl">
          <input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Enter verification ID (e.g. AR-TAX-2024-VRF-88219)..."
            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xs font-mono focus:ring-1 focus:ring-[#C99A32]"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2544] text-[#F7F4ED] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-[#D7AC4A]" />
            <span>Verify Seal</span>
          </button>
        </form>

        {/* Safe Verification Result Box */}
        {hasSearched && (
          <div>
            {verificationResult ? (
              <div className="p-5 bg-[#FAF9F5] border border-[#C99A32]/60 rounded-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <div className="font-bold text-xs text-[#061A2F] uppercase">
                        Cryptographic Verification Status: VALID & CERTIFIED
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Verification ID: {verificationResult.verificationId}
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-xs font-mono self-start sm:self-center">
                    Status: {verificationResult.status}
                  </span>
                </div>

                {/* Safe Fields Grid (Notice NO Taxpayer Name, SSN, or Financial Figures) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xs border border-slate-200">
                  <div>
                    <span className="text-slate-500">Document Type:</span>
                    <div className="font-semibold text-slate-800">{verificationResult.documentType}</div>
                  </div>

                  <div>
                    <span className="text-slate-500">Issuing Organization:</span>
                    <div className="font-semibold text-slate-800">{verificationResult.issuingOrganization}</div>
                  </div>

                  <div>
                    <span className="text-slate-500">Jurisdiction:</span>
                    <div className="font-semibold text-slate-800">{verificationResult.jurisdiction}</div>
                  </div>

                  <div>
                    <span className="text-slate-500">Issue Date & Version:</span>
                    <div className="font-semibold text-slate-800">
                      {verificationResult.issueDate} (Version {verificationResult.version}.0)
                    </div>
                  </div>
                </div>

                {/* Cryptographic SHA-256 Fingerprint */}
                <div className="p-3 bg-slate-100 rounded-xs font-mono text-xs space-y-1">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">SHA-256 Cryptographic Digest:</div>
                  <div className="text-slate-800 text-[11px] break-all font-bold">
                    {verificationResult.cryptographicSha256}
                  </div>
                </div>

                {/* Privacy & Anti-Disclosure Notice */}
                <div className="text-[11px] text-slate-500 flex items-start gap-2 pt-1 border-t border-slate-200">
                  <ShieldCheck className="w-4 h-4 text-[#C99A32] flex-shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    <strong>Statutory Privacy Protection (IRC § 7216):</strong> In strict compliance with federal tax confidentiality regulations, this public verification interface confirms document validity and cryptographic authenticity without revealing confidential taxpayer identities, Social Security numbers, financial numbers, or preparer notes.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    onClick={copyLink}
                    className="px-3 py-1.5 border border-slate-300 hover:border-[#061A2F] text-slate-800 text-xs font-medium rounded-xs flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Verification Link Copied' : 'Copy Verification URL'}</span>
                  </button>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Authorized Signatory: {verificationResult.authorizedSignatoryTitle}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xs text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>No verification record matching ID "{lookupId}" was located in the authoritative registry.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
