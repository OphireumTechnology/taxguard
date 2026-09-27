import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FAQ_DATA } from '../../data/mockData';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  FileDown, 
  BookOpen, 
  Calendar, 
  CheckCircle2, 
  Lock 
} from 'lucide-react';

export const ResourcesPage: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const categories = ['All', 'Tax Preparation & Strategy', 'Business Services', 'Security & Privacy', 'Consultations & Engagement', 'Legal & Estate Coordination'];

  const filteredFaqs = FAQ_DATA.filter((faq) => {
    const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-16 pb-20 text-slate-100">
      
      {/* Header Banner */}
      <section className="relative pt-12 pb-14 border-b border-[#1E3A5F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Knowledge & Client Guidance</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-extrabold text-white">
            Resources & Frequently Asked Questions
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Essential guidance, filing deadlines, document checklists, and answers to common tax and accounting questions.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto pt-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tax questions, documents, deadlines..."
                className="w-full bg-[#0D2340] border border-[#1E3A5F] focus:border-[#C6A15B] rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-400 focus:outline-none shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Free Downloadable Tax Checklist */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 rounded-3xl bg-gradient-to-r from-[#0D2340] via-[#07172B] to-[#0D2340] border border-[#C6A15B]/40 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-left">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#C6A15B] uppercase tracking-wider">
              <FileDown className="w-4 h-4" /> Downloadable Client Checklist
            </div>
            <h2 className="font-serif text-2xl font-bold text-white">
              2025/2026 Individual & Business Tax Preparation Checklist
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Ensure you gather all W-2s, 1099s, expense logs, healthcare forms, and mortgage statements before your consultation.
            </p>
          </div>
          <button
            onClick={() => {
              const element = document.createElement("a");
              const file = new Blob([
                "A/R TAX SERVICES, LLC - 2025/2026 TAX PREPARATION CHECKLIST\n\n" +
                "1. Personal Information:\n- Social Security numbers and dates of birth for taxpayer, spouse & dependents\n- Driver's license or state ID\n- Bank routing and account number for direct deposit\n\n" +
                "2. Income Records:\n- Form W-2 (Wage Statements)\n- Form 1099-NEC / 1099-MISC (Self-employment / Contract)\n- Form 1099-INT / 1099-DIV (Interest & Dividends)\n- Form 1099-B (Brokerage / Capital Gains)\n- Form 1099-R (Retirement / Pensions)\n- Schedule K-1 (Partnership, S-Corp or Estate)\n\n" +
                "3. Deductions & Credits:\n- Form 1098 (Mortgage Interest & Property Taxes)\n- Charitable donation receipts\n- Form 1095-A (Health Insurance Marketplace)\n- Childcare provider name, address & Tax ID\n- Business mileage log and receipts\n\n" +
                "4. Business Filings:\n- Profit & Loss statement\n- Balance Sheet as of Dec 31\n- Form 941 quarterly payroll reports\n- Asset purchase/depreciation records\n\n" +
                "Upload directly to your encrypted portal: info@artaxservices.com | 678-205-9486"
              ], {type: 'text/plain'});
              element.href = URL.createObjectURL(file);
              element.download = "AR_Tax_Services_Document_Checklist.txt";
              document.body.appendChild(element);
              element.click();
            }}
            className="flex-shrink-0 px-6 py-3.5 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center gap-2 shadow-lg"
          >
            <FileDown className="w-4 h-4" />
            Download Tax Organizer (.TXT)
          </button>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Answers to common client inquiries regarding filing deadlines, documentation, and pricing
          </p>
        </div>
        
        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 justify-center pb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-[#C6A15B] text-[#07172B] shadow-sm font-bold'
                  : 'bg-[#0D2340] text-slate-300 hover:text-white border border-[#1E3A5F]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQs */}
        <div className="space-y-4">
          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No questions found matching your search. Please reach out to our Columbia, SC office directly.
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => (
              <div 
                key={idx}
                className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-[#132E52] transition-colors"
                >
                  <span className="font-serif text-base font-bold text-white">
                    {faq.question}
                  </span>
                  <div className="p-1 rounded bg-[#07172B] text-[#C6A15B] flex-shrink-0">
                    {openFaqIndex === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {openFaqIndex === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-[#1E3A5F]/60">
                    <p>{faq.answer}</p>
                    <div className="mt-3 text-[10px] text-[#C6A15B] font-semibold uppercase tracking-wider">
                      Category: {faq.category}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Still Have Questions CTA */}
        <div className="p-6 rounded-2xl bg-[#07172B] border border-[#1E3A5F] text-center space-y-3">
          <h3 className="font-serif text-lg font-bold text-white">Have a specific question not covered here?</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Our team is available to provide clarity on any personal or business tax inquiries.
          </p>
          <div className="pt-1">
            <button
              onClick={() => setCurrentPage('contact')}
              className="px-5 py-2.5 rounded-lg text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A]"
            >
              Contact Our Advisors
            </button>
          </div>
        </div>

      </section>

    </div>
  );
};
