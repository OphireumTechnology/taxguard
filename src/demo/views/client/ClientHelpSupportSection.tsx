import React, { useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Clock,
  Info
} from 'lucide-react';

interface ClientHelpSupportSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
}

export const ClientHelpSupportSection: React.FC<ClientHelpSupportSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq_01');

  const faqs = [
    {
      id: 'faq_01',
      question: 'What is an S-Corporation "Reasonable Officer Compensation" requirement?',
      answer: 'Under Internal Revenue Code § 1366 and Revenue Ruling 74-44, shareholder-employees who provide substantial services to an S-Corporation must be paid reasonable W-2 compensation before taking tax-free distributions. A/R Tax Services, LLC utilizes RCReports third-party wage benchmarking to establish an audit-defensible salary level.',
      statutoryRef: 'IRC § 1366 / Rev. Rul. 74-44'
    },
    {
      id: 'faq_02',
      question: 'How does the South Carolina Pass-Through Entity (PTE) Tax Election save money?',
      answer: 'Enacted under SC Act 61, the PTE election allows S-Corporations and Partnerships to pay state income tax at the entity level (3%). This payment is fully deductible as an ordinary business expense on federal Form 1120-S Line 12, thereby legally bypassing the federal $10,000 individual State and Local Tax (SALT) deduction cap on Schedule A.',
      statutoryRef: 'SC Code § 12-6-545(G) / IRS Notice 2020-75'
    },
    {
      id: 'faq_03',
      question: 'Why are client business meals only 50% deductible?',
      answer: 'Internal Revenue Code § 274(n) limits the tax deduction for business food and beverage expenses to 50% of the cost. The meal must be directly related to or associated with the active conduct of trade or business, and the taxpayer must substantiate date, amount, location, business purpose, and attendee names.',
      statutoryRef: 'IRC § 274(n) / Treas. Reg. § 1.274-5'
    },
    {
      id: 'faq_04',
      question: 'What is the De Minimis Safe Harbor for business equipment and supplies?',
      answer: 'Treasury Regulation § 1.263(a)-1(f) allows businesses with an applicable accounting procedure to immediately expense tangible property costing $2,500 or less per invoice (or up to $5,000 with an Applicable Financial Statement), rather than capitalizing and depreciating it over multiple years.',
      statutoryRef: 'Treas. Reg. § 1.263(a)-1(f)'
    },
    {
      id: 'faq_05',
      question: 'What are the statutory safe harbor thresholds for quarterly estimated tax payments?',
      answer: 'To avoid the IRC § 6654 underpayment penalty, individual taxpayers must pay either 90% of their current-year tax liability or 100% of their prior-year tax liability (increased to 110% if prior-year Adjusted Gross Income exceeded $150,000).',
      statutoryRef: 'IRC § 6654(d)(1)(C)'
    }
  ];

  const filteredFaqs = faqs.filter(f =>
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.statutoryRef.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="client-help-support-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Practice Knowledge Base
              </span>
              <span className="text-xs text-[#667085]">Statutory Guidance &bull; CPA Support Desk</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Client Support, Tax Knowledge Base &amp; Contacts
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Access plain-English explanations of IRC codes, safe harbor guidelines, and direct contact with your dedicated CPA team.
            </p>
          </div>

          {onOpenAssistant && (
            <button
              onClick={onOpenAssistant}
              className="px-3.5 py-2 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Ask TaxGuard AI Assistant</span>
            </button>
          )}
        </div>

        {/* Practice Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
          <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded-lg space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#061A2F]">
              <MapPin className="w-4 h-4 text-[#C99A32]" />
              <span>Headquarters Office</span>
            </div>
            <div className="text-[#4B5563] space-y-0.5">
              <div>A/R Tax Services, LLC</div>
              <div>1201 Main Street, Suite 1940</div>
              <div>Columbia, SC 29201</div>
              <div className="pt-1 text-[#667085]">Hours: Mon–Fri, 8:30 AM – 5:30 PM EST</div>
            </div>
          </div>

          <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded-lg space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#061A2F]">
              <Phone className="w-4 h-4 text-[#C99A32]" />
              <span>Direct Telephony &amp; Fax</span>
            </div>
            <div className="text-[#4B5563] space-y-0.5 font-mono text-[11px]">
              <div>Direct: +1 (803) 555-0190</div>
              <div>Secure Fax: +1 (803) 555-0191</div>
              <div className="pt-1 text-[#1B5E20] font-sans font-medium">IRS Rapid Audit Response Line</div>
            </div>
          </div>

          <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded-lg space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#061A2F]">
              <Mail className="w-4 h-4 text-[#C99A32]" />
              <span>Assigned Engagement Team</span>
            </div>
            <div className="text-[#4B5563] space-y-2">
              <div><strong>Lead CPA:</strong> Elena Rostova, CPA</div>
              <div className="text-[11px] font-mono text-[#667085]">elena.rostova@artaxservices.com</div>
              <div className="flex items-center gap-2.5 pt-1">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-[#C99A32] flex-shrink-0 bg-[#061A2F]">
                  <img
                    src="/ceo/123456789-desmond.png"
                    alt="Desmond Hinds, Founder and Chief Executive Officer of A/R Tax Services, LLC"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div>
                  <div><strong>Managing Partner:</strong> Desmond Hinds, CEO</div>
                  <div className="text-[11px] font-mono text-[#667085]">desmond.hinds@artaxservices.com</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Searchable Knowledge Base & FAQs */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8DCE2] pb-4">
          <div>
            <h3 className="text-base font-bold text-[#061A2F]">Frequently Asked Tax &amp; Accounting Questions</h3>
            <p className="text-xs text-[#667085]">Grounded in official Internal Revenue Code and South Carolina tax statutes.</p>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-[#667085] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tax rules or statutes..."
              className="w-full pl-9 pr-3 py-1.5 border border-[#D8DCE2] rounded text-xs focus:outline-none focus:border-[#061A2F]"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredFaqs.map(faq => {
            const isExpanded = expandedFaqId === faq.id;
            return (
              <div
                key={faq.id}
                className="border border-[#D8DCE2] rounded-lg overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                  className="w-full p-4 text-left bg-[#FBFAF7] hover:bg-[#FAF9F5] flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="font-bold text-xs text-[#061A2F]">{faq.question}</span>
                  <ChevronDown className={`w-4 h-4 text-[#667085] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="p-4 bg-white border-t border-[#D8DCE2] space-y-2 text-xs text-[#4B5563]">
                    <p className="leading-relaxed">{faq.answer}</p>
                    <div className="pt-2 border-t border-[#E5E7EB] text-[11px] text-[#667085] flex items-center justify-between">
                      <span>Statutory Citation: <strong className="font-mono text-[#061A2F]">{faq.statutoryRef}</strong></span>
                      <span className="text-[#1B5E20] font-semibold">Verified by Firm CPAs</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
