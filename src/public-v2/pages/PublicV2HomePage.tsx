import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  ArrowRight, 
  CheckCircle2, 
  MessageSquareCode, 
  FileText, 
  Layers, 
  Briefcase, 
  Building2, 
  ShieldCheck, 
  Calendar,
  Check
} from 'lucide-react';

interface PublicV2HomePageProps {
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2HomePage: React.FC<PublicV2HomePageProps> = ({
  onNavigate,
  onOpenConsultation
}) => {
  // Inline consultation form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    clientType: 'individual',
    service: 'Individual Tax Preparation',
    state: 'CA',
    consultationType: 'Virtual Video (Confidential)',
    message: '',
    consent: false
  });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [mockConfirmationCode, setMockConfirmationCode] = useState('');

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent) return;
    const code = `AR-DEMO-${Math.floor(100000 + Math.random() * 900000)}`;
    setMockConfirmationCode(code);
    setFormSubmitted(true);
  };

  const servicesList = [
    {
      title: 'Individual Tax Preparation',
      description: 'Comprehensive Form 1040 preparation with multi-state returns, itemized deduction optimization, and investment schedule reconciliations.',
      path: '/public-v2/services'
    },
    {
      title: 'Business Tax Preparation',
      description: 'Corporate and partnership compliance for S-Corps (Form 1120-S), Partnerships (Form 1065), and C-Corps with Schedule K-1 allocations.',
      path: '/public-v2/services'
    },
    {
      title: 'Bookkeeping and Monthly Close',
      description: 'Disciplined monthly general ledger accounting, accounts reconciliation, cash flow tracking, and financial statements under U.S. standards.',
      path: '/public-v2/services'
    },
    {
      title: 'Payroll Accounting',
      description: 'Statutory withholding computations, Form 941/940 reconciliations, state unemployment reporting, and year-end Form W-2/W-3 generation.',
      path: '/public-v2/services'
    },
    {
      title: 'Tax Planning and Advisory',
      description: 'Proactive quarterly estimated tax computations (Form 1040-ES), entity structure comparisons, and multi-year tax minimization strategies.',
      path: '/public-v2/services'
    },
    {
      title: 'IRS and State Notice Support',
      description: 'Systematic review of CP2000, CP14, and state department of revenue examination letters with substantiated written responses.',
      path: '/public-v2/services'
    },
    {
      title: 'Amendments and Corrections',
      description: 'Filing Form 1040-X, amended corporate returns, and missed prior-year filings to correct reporting discrepancies or claim missed credits.',
      path: '/public-v2/services'
    },
    {
      title: 'Business Formation and Closure Support',
      description: 'EIN procurement assistance, initial entity classification elections (Form 2553 / Form 8832), and final tax return closing dissolutions.',
      path: '/public-v2/services'
    }
  ];

  const operatingCycleStages = [
    'Onboard',
    'Collect',
    'Record',
    'Reconcile',
    'Review',
    'Report',
    'Plan',
    'Prepare',
    'Approve',
    'File',
    'Monitor',
    'Archive',
    'Repeat'
  ];

  const industriesList = [
    { name: 'Professional Services', focus: 'Law firms, engineering consultancies, creative agencies, and independent advisors.' },
    { name: 'Construction and Real Estate', focus: 'General contractors, trade subcontractors, property developers, and rental portfolio operators.' },
    { name: 'Retail and E-commerce', focus: 'Multi-channel digital merchants, inventory management, and multi-state economic nexus compliance.' },
    { name: 'Healthcare Practices', focus: 'Private medical, dental, therapy, and clinical wellness practices with distinct operational accounting.' },
    { name: 'Transportation', focus: 'Owner-operators, freight logistics, per-diem deduction rules, and commercial fleet operations.' },
    { name: 'Hospitality', focus: 'Restaurants, specialty food services, tip reporting compliance (Form 8027), and vendor reconciliations.' },
    { name: 'Technology', focus: 'SaaS companies, software contractors, hardware startups, and digital intellectual property accounting.' },
    { name: 'Nonprofit Organizations', focus: 'Tax-exempt 501(c)(3) entities, donor reporting integrity, and Form 990 informational filing support.' }
  ];

  const trustStatements = [
    'U.S.-Focused Accounting Services',
    'Structured Review and Approval',
    'Secure Client Workflow',
    'Federal and State Tax Support',
    'Clear Client Communication',
    'Year-Round Advisory'
  ];

  return (
    <div className="bg-white text-black space-y-16 sm:space-y-24 py-8 sm:py-12">
      {/* 1. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border border-black p-8 sm:p-12 lg:p-16 space-y-8 bg-white">
          {/* Demonstration Notice */}
          <div className="inline-block border border-black bg-neutral-100 px-3 py-1.5 text-[11px] font-mono text-black">
            Public Page 2 Preview — This alternative website and its interactive functions are currently for demonstration purposes only.
          </div>

          <div className="space-y-4 max-w-4xl">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-black leading-tight">
              Clear Accounting.<br />Confident Decisions.
            </h1>
            <p className="text-base sm:text-lg text-neutral-700 font-sans max-w-2xl leading-relaxed">
              U.S.-focused accounting, tax preparation, bookkeeping, payroll support, and advisory services for individuals and businesses.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
            <button
              onClick={onOpenConsultation}
              className="px-6 py-3 bg-black text-white text-xs sm:text-sm font-medium hover:bg-neutral-800 transition-colors inline-flex items-center gap-2 border border-black"
            >
              <span>Book a Consultation</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('/public-v2/services')}
              className="px-6 py-3 bg-white text-black border border-black text-xs sm:text-sm font-medium hover:bg-neutral-100 transition-colors inline-flex items-center gap-2"
            >
              <span>Explore Our Services</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('/public-v2/accounting-assistant')}
              className="px-6 py-3 bg-neutral-100 text-black border border-black text-xs sm:text-sm font-semibold hover:bg-black hover:text-white transition-colors inline-flex items-center gap-2"
            >
              <MessageSquareCode className="w-4 h-4" />
              <span>Ask the Accounting Assistant</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. TRUST SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-t border-b border-black py-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {trustStatements.map((stmt, idx) => (
              <div key={idx} className="space-y-1 text-center sm:text-left border-l border-neutral-200 pl-3 first:border-0 first:pl-0">
                <span className="text-[10px] font-mono text-neutral-500 font-bold">0{idx + 1}</span>
                <p className="text-xs sm:text-sm font-bold text-black tracking-tight leading-snug">
                  {stmt}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. SERVICES SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-black pb-4">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Practice Capabilities</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-black tracking-tight mt-1">
              Core Accounting & Tax Services
            </h2>
          </div>
          <button
            onClick={() => onNavigate('/public-v2/services')}
            className="text-xs font-semibold text-black hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View Detailed Scope</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {servicesList.map((service, idx) => (
            <div 
              key={idx} 
              className="border border-neutral-300 hover:border-black p-6 space-y-4 bg-white transition-all flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-neutral-400 font-bold group-hover:text-black">
                  [ 0{idx + 1} ]
                </span>
                <h3 className="text-base font-bold text-black tracking-tight leading-snug">
                  {service.title}
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {service.description}
                </p>
              </div>

              <button
                onClick={() => onNavigate('/public-v2/services')}
                className="pt-3 border-t border-neutral-200 text-xs font-semibold text-black hover:underline inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
              >
                <span>Learn More</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. HOW THE FIRM WORKS (OPERATING CYCLE) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border border-black p-6 sm:p-10 bg-neutral-50 space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Methodology & Rigor</span>
            <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight">
              The Firm Operating Cycle
            </h2>
            <p className="text-xs text-neutral-600 max-w-2xl">
              Every tax return, reconciliation, and financial report follows a structured 12-stage sequential lifecycle to prevent errors and ensure regulatory compliance.
            </p>
          </div>

          {/* Clean wrapping operating cycle */}
          <div className="border border-neutral-300 bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              {operatingCycleStages.map((stage, idx) => (
                <React.Fragment key={idx}>
                  <div className="px-3 py-1.5 border border-black bg-white font-mono text-xs flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-[9px] text-neutral-400 font-bold">{idx + 1}.</span>
                    <span className="font-bold text-black">{stage}</span>
                  </div>
                  {idx < operatingCycleStages.length - 1 && (
                    <span className="text-neutral-400 font-mono text-xs hidden sm:inline">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. INDUSTRY SUPPORT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="border-b border-black pb-4">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Market Sectors</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-black tracking-tight mt-1">
            Industry Practice Areas
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {industriesList.map((ind, idx) => (
            <div key={idx} className="border border-neutral-300 p-5 space-y-2 bg-white">
              <h3 className="text-sm font-bold text-black tracking-tight">{ind.name}</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">{ind.focus}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. ACCOUNTING ASSISTANT SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-2 border-black p-8 sm:p-12 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-black text-white text-[10px] font-mono uppercase tracking-wider">
              <MessageSquareCode className="w-3.5 h-3.5 text-white" />
              <span>Interactive Knowledge Feature</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-black tracking-tight">
              A/R Accounting Guidance Assistant
            </h2>
            <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
              Explore general U.S. accounting, tax preparation procedures, S-Corporation reporting, record retention guidelines, and IRS notice responses with citation-backed educational references.
            </p>
          </div>

          <button
            onClick={() => onNavigate('/public-v2/accounting-assistant')}
            className="px-6 py-3 bg-black text-white hover:bg-neutral-800 text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-2 border border-black flex-shrink-0"
          >
            <span>Launch Guidance Assistant</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 7. CONSULTATION SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8" id="consultation-section">
        <div className="border-b border-black pb-4">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Direct Engagement</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-black tracking-tight mt-1">
            Book a Professional Consultation
          </h2>
          <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
            Schedule an introductory review for individual tax filings, monthly business bookkeeping, or compliance advisory.
          </p>
        </div>

        <div className="border border-black bg-white p-6 sm:p-10 max-w-3xl mx-auto">
          {formSubmitted ? (
            <div className="space-y-4 py-6">
              <div className="p-4 border border-black bg-neutral-50 flex items-start gap-3">
                <div className="p-1 bg-black text-white flex-shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-black text-sm">
                    Demonstration Submission Registered
                  </h3>
                  <p className="text-xs text-neutral-700">
                    Confirmation Code: <span className="font-mono font-bold text-black">{mockConfirmationCode}</span>
                  </p>
                  <p className="text-xs text-neutral-600 pt-1 leading-relaxed">
                    Notice: This alternative Public Page 2 website is running in demonstration mode. A local mock record was registered for {formData.name} regarding {formData.service}. No actual email was transmitted.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setFormSubmitted(false)}
                  className="px-5 py-2 bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
                >
                  Submit Another Demonstration Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInlineSubmit} className="space-y-5 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="home-name">
                    Full Name *
                  </label>
                  <input
                    id="home-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Robert Vance"
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="home-email">
                    Email Address *
                  </label>
                  <input
                    id="home-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="r.vance@example.com"
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="home-phone">
                    Telephone *
                  </label>
                  <input
                    id="home-phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(925) 000-0000"
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="home-client-type">
                    Taxpayer Profile *
                  </label>
                  <select
                    id="home-client-type"
                    value={formData.clientType}
                    onChange={(e) => setFormData({ ...formData, clientType: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  >
                    <option value="individual">Individual Taxpayer</option>
                    <option value="business">Business / Entity</option>
                    <option value="both">Individual & Business</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="home-state">
                    U.S. State *
                  </label>
                  <select
                    id="home-state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  >
                    <option value="CA">California (CA)</option>
                    <option value="NY">New York (NY)</option>
                    <option value="TX">Texas (TX)</option>
                    <option value="FL">Florida (FL)</option>
                    <option value="WA">Washington (WA)</option>
                    <option value="IL">Illinois (IL)</option>
                    <option value="OTHER">Other U.S. State</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="home-service">
                    Primary Service Needed *
                  </label>
                  <select
                    id="home-service"
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  >
                    {servicesList.map((s, idx) => (
                      <option key={idx} value={s.title}>{s.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="home-consult-type">
                    Preferred Format *
                  </label>
                  <select
                    id="home-consult-type"
                    value={formData.consultationType}
                    onChange={(e) => setFormData({ ...formData, consultationType: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  >
                    <option value="Virtual Video (Confidential)">Virtual Video Consultation</option>
                    <option value="Telephone (Direct)">Telephone Direct Call</option>
                    <option value="Written Summary">Written Analysis / Email Assessment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1" htmlFor="home-message">
                  Brief Description of Scope or Objectives
                </label>
                <textarea
                  id="home-message"
                  rows={3}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Outline your timeline, tax year requirements, or bookkeeping status..."
                  className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none resize-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={formData.consent}
                    onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded-none border-neutral-400 text-black focus:ring-black"
                  />
                  <span className="text-xs text-neutral-600 leading-normal">
                    I understand this demonstration form creates a local mock confirmation and does not transmit confidential financial documents. No email or third-party transmission is initiated.
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-neutral-200 flex justify-end">
                <button
                  type="submit"
                  disabled={!formData.consent}
                  className="px-8 py-3 bg-black text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                >
                  Submit Consultation Request
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
