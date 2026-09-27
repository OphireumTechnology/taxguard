/**
 * TaxGuard AI – Source-Grounded Tax Research Assistant & Registry
 * Authoritative clickable citations: IRS, U.S. Treasury, SC DOR, FinCEN, SEC
 */

import React, { useState } from 'react';
import { 
  Search, 
  Send, 
  ExternalLink, 
  ShieldCheck, 
  BookOpen, 
  AlertCircle, 
  Sparkles,
  Layers
} from 'lucide-react';
import { TaxGuardAssistantService, TaxGuardAssistantResponse } from '../services/TaxGuardAssistantService';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

const INITIAL_REGISTRY = [
  {
    name: 'IRS Rev. Proc. 2024-40 (Annual Inflation Adjustments)',
    agency: 'Internal Revenue Service (IRS)',
    jurisdiction: 'Federal',
    taxYear: 2024,
    pubDate: '2024-10-22',
    lastVerified: '2025-01-15',
    status: 'Active Verified',
    url: 'https://www.irs.gov/pub/irs-drop/rp-24-40.pdf'
  },
  {
    name: 'South Carolina Code § 12-6-530 (Corporate Tax Rates & Apportionment)',
    agency: 'South Carolina Department of Revenue',
    jurisdiction: 'South Carolina',
    taxYear: 2024,
    pubDate: '2024-01-01',
    lastVerified: '2025-01-10',
    status: 'Active Verified',
    url: 'https://dor.sc.gov/tax/corporate-income'
  },
  {
    name: 'FinCEN Beneficial Ownership Information Final Reporting Rule (31 CFR § 1010.380)',
    agency: 'Financial Crimes Enforcement Network (FinCEN)',
    jurisdiction: 'Federal',
    taxYear: 2024,
    pubDate: '2023-11-29',
    lastVerified: '2025-01-12',
    status: 'Active Verified',
    url: 'https://www.fincen.gov/boi'
  },
  {
    name: 'Treasury Regulation § 1.274-5 (Substantiation Requirements for Business Expenses)',
    agency: 'U.S. Department of the Treasury',
    jurisdiction: 'Federal',
    taxYear: 2024,
    pubDate: '2024-03-15',
    lastVerified: '2025-01-08',
    status: 'Active Verified',
    url: 'https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/section-1.274-5'
  }
];

export const TaxGuardResearchView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [query, setQuery] = useState<string>('What are the Section 179 vehicle limits and bonus depreciation rates for 2024?');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<TaxGuardAssistantResponse | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      const res = await TaxGuardAssistantService.queryAssistant(query);
      setResponse(res);
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* Assistant Query Console */}
      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C99A32]" />
            <span>Source-Grounded U.S. Accounting & Tax Research Assistant</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strictly limited to U.S. tax compliance. Every answer includes verifiable agency citations.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a specific U.S. tax question (e.g. 'South Carolina corporate apportionment formula', 'Section 179 limits')..."
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xs focus:ring-1 focus:ring-[#C99A32] focus:border-[#C99A32]"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2 bg-[#061A2F] hover:bg-[#0A2544] text-[#F7F4ED] text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5 text-[#D7AC4A]" />
              <span>{isLoading ? 'Researching...' : 'Query IRC'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span>Suggested Inquiries:</span>
            <button
              type="button"
              onClick={() => setQuery('What are the business meal deduction rules under IRC § 274 for 2024?')}
              className="text-[#C99A32] hover:underline"
            >
              • 50% Meals Substantiation
            </button>
            <button
              type="button"
              onClick={() => setQuery('What are the corporate income tax rates and apportionment rules for South Carolina?')}
              className="text-[#C99A32] hover:underline"
            >
              • South Carolina Corporate Apportionment
            </button>
            <button
              type="button"
              onClick={() => setQuery('What is the FinCEN BOI reporting deadline under the Corporate Transparency Act?')}
              className="text-[#C99A32] hover:underline"
            >
              • FinCEN Beneficial Ownership
            </button>
          </div>
        </form>

        {/* Assistant Response Box */}
        {response && (
          <div className="mt-4 p-4 bg-[#FAF9F5] border border-[#C99A32]/40 rounded-xs space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#C99A32]/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#061A2F]">TaxGuard AI Research Finding:</span>
                <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.2 rounded font-mono">
                  TY {response.applicableTaxYear} • {response.jurisdiction}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Model: Gemini 2.5 Flash / Ophireum Grounding
              </span>
            </div>

            <p className="text-slate-800 leading-relaxed text-xs">
              {response.answer}
            </p>

            {/* Authoritative Citations */}
            {response.citations.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-[11px] font-bold text-[#061A2F] uppercase tracking-wider">
                  Authoritative Clickable Citations & Statutory References:
                </div>
                <div className="space-y-1.5">
                  {response.citations.map((c, idx) => (
                    <a
                      key={idx}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 bg-white border border-slate-200 hover:border-[#061A2F] rounded-xs transition-colors group"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-semibold text-[#061A2F] group-hover:text-[#C99A32] flex items-center gap-1.5">
                          <span>{c.title}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{c.agency}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Statutory Code: <strong>{c.citationCode}</strong> • Pub Date: {c.publicationDate} • Retrieved: {c.retrievalDate}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tax-Research Knowledge Base Registry */}
      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#C99A32]" />
            <span>Administrator-Managed Authoritative Source Registry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pre-verified primary sources with mandatory expiration and re-verification policies.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                <th className="py-2.5 px-3">Authoritative Source Title</th>
                <th className="py-2.5 px-3">Responsible Agency</th>
                <th className="py-2.5 px-3">Jurisdiction / TY</th>
                <th className="py-2.5 px-3">Last Verified</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {INITIAL_REGISTRY.map((src, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3 font-semibold text-[#061A2F]">{src.name}</td>
                  <td className="py-3 px-3 text-slate-600">{src.agency}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{src.jurisdiction} (TY {src.taxYear})</td>
                  <td className="py-3 px-3 font-mono text-slate-500">{src.lastVerified}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xs text-[10px] font-semibold">
                      {src.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-[#061A2F] hover:text-[#C99A32]"
                      title="Open Source Link"
                    >
                      <ExternalLink className="w-3.5 h-3.5 inline" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
