import React from 'react';
import { ArrowRight, CheckCircle2, FileText, ArrowUpRight } from 'lucide-react';

interface PublicV2ServicesPageProps {
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2ServicesPage: React.FC<PublicV2ServicesPageProps> = ({
  onNavigate,
  onOpenConsultation
}) => {
  const detailedServices = [
    {
      id: 'individual-tax',
      title: 'Individual Tax Preparation',
      forms: 'Form 1040, Schedule A, B, C, D, E, SE',
      summary: 'Thorough, accurate federal and multi-state individual income tax preparation designed to capture every legitimate deduction and credit while ensuring full IRS compliance.',
      deliverables: [
        'Federal Form 1040 e-filed with IRS Modernized e-File',
        'State income tax returns across all required jurisdictions',
        'Itemized vs. Standard Deduction optimization analysis',
        'Capital gains and stock options (RSU / ISO / ESPP) reconciliation',
        'Encrypted digital client copy and multi-year record archiving'
      ]
    },
    {
      id: 'business-tax',
      title: 'Business Tax Preparation',
      forms: 'Form 1120-S, Form 1065, Form 1120',
      summary: 'Statutory compliance for corporate and partnership entities, ensuring accurate pass-through income distributions and Schedule M-1 book-to-tax reconciliations.',
      deliverables: [
        'Annual S-Corporation (1120-S) or Partnership (1065) preparation',
        'Timely Schedule K-1 generation for all partners and shareholders',
        'Book-to-tax reconciliations (Schedule M-1 / M-2)',
        'Depreciation schedules for Section 179 and MACRS assets',
        'State corporate franchise and income tax filings'
      ]
    },
    {
      id: 'bookkeeping',
      title: 'Bookkeeping and Monthly Close',
      forms: 'Balance Sheet, Profit & Loss, Trial Balance',
      summary: 'Ongoing general ledger maintenance, monthly bank reconciliations, and financial statement compilation following U.S. accounting conventions.',
      deliverables: [
        'Monthly general ledger classification and reconciliation',
        'Comprehensive bank, credit card, and merchant processing reconciliations',
        'Monthly Profit & Loss, Balance Sheet, and Cash Flow statements',
        'Accounts Payable & Accounts Receivable tracking',
        'Year-end clean books handover for seamless tax preparation'
      ]
    },
    {
      id: 'payroll',
      title: 'Payroll Accounting',
      forms: 'Form 941, Form 940, W-2, W-3, State SUI/SIT',
      summary: 'Statutory payroll processing, withholding calculations, tax remittance tracking, and quarterly employment tax return filing.',
      deliverables: [
        'Federal income tax, Social Security, and Medicare withholding computations',
        'Quarterly Form 941 preparation and tax reconciliation',
        'Annual Federal Unemployment Tax Act (Form 940) filing',
        'Year-end employee Form W-2 and employer Form W-3 generation',
        'State unemployment and disability insurance compliance'
      ]
    },
    {
      id: 'tax-planning',
      title: 'Tax Planning and Advisory',
      forms: 'Form 1040-ES, Form 1120-W, Projections',
      summary: 'Proactive year-round tax advisory designed to project tax liabilities, structure quarterly estimated payments, and compare entity configurations.',
      deliverables: [
        'Quarterly estimated tax computations and safe-harbor payment vouchers',
        'Entity structure suitability analysis (LLC vs. S-Corp vs. C-Corp)',
        'Reasonable compensation studies for S-Corporation shareholder-officers',
        'Year-end tax acceleration and deferral timing strategies',
        'Retirement plan contribution planning (SEP-IRA, Solo 401(k), SIMPLE)'
      ]
    },
    {
      id: 'notice-support',
      title: 'IRS and State Notice Support',
      forms: 'CP2000, CP14, Letter 525, Form 2848',
      summary: 'Professional analysis and written response preparation for IRS or state revenue notices, automated underreporter letters, and penalty assessments.',
      deliverables: [
        'Comprehensive notice audit against filed tax returns and transcripts',
        'Drafting of substantiated written responses and documentation packages',
        'Penalty abatement requests (First-Time Abatement / Reasonable Cause)',
        'Assistance with IRS payment agreements and installment requests',
        'Representation coordination under Form 2848 (Power of Attorney)'
      ]
    },
    {
      id: 'amendments',
      title: 'Amendments and Corrections',
      forms: 'Form 1040-X, Form 1120-X, Amended 1065',
      summary: 'Filing formal amended returns to correct omissions, adjust filing status, report late 1099/W-2 documents, or claim missed statutory credits.',
      deliverables: [
        'Review of original filed return to detect errors and omissions',
        'Computation of net tax adjustment and revised refund or balance due',
        'Preparation and submission of Form 1040-X or corporate amended returns',
        'Updated state amended returns across all affected jurisdictions',
        'Tracking of amended return processing status through government channels'
      ]
    },
    {
      id: 'formation-closure',
      title: 'Business Formation and Closure Support',
      forms: 'SS-4, Form 2553, Form 8832, Final Returns',
      summary: 'Administrative and tax setup for new ventures, including federal Employer Identification Numbers, S-Corp elections, and orderly corporate liquidations.',
      deliverables: [
        'Federal Employer Identification Number (EIN) procurement',
        'S-Corporation Election (Form 2553) preparation and timely filing',
        'Entity classification election (Form 8832) for multi-member LLCs',
        'Initial chart of accounts setup aligned with industry NAICS standards',
        'Final return preparation and tax closing dissolutions'
      ]
    }
  ];

  return (
    <div className="bg-white text-black space-y-16 py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="border-b border-black pb-8 space-y-3">
        <div className="inline-block border border-black bg-neutral-100 px-3 py-1 text-[11px] font-mono text-black">
          Comprehensive Services Menu
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-black">
          Accounting & Tax Services
        </h1>
        <p className="text-base sm:text-lg text-neutral-700 max-w-3xl leading-relaxed">
          Structured accounting, compliance, and tax preparation services tailored to individual taxpayers, expanding businesses, and complex corporate entities.
        </p>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {detailedServices.map((service, idx) => (
          <div 
            key={service.id} 
            className="border border-black p-6 sm:p-8 space-y-5 bg-white flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <span className="text-xs font-mono font-bold text-neutral-500">Service 0{idx + 1}</span>
                <span className="text-[10px] font-mono bg-neutral-100 px-2 py-0.5 border border-neutral-300 text-black">
                  {service.forms}
                </span>
              </div>

              <h2 className="text-xl font-bold text-black tracking-tight">
                {service.title}
              </h2>

              <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                {service.summary}
              </p>

              <div className="space-y-2 pt-2 border-t border-neutral-200">
                <span className="text-[11px] font-mono uppercase font-bold text-black tracking-wider block">
                  Core Deliverables:
                </span>
                <ul className="space-y-1.5 text-xs text-neutral-600">
                  {service.deliverables.map((d, dIdx) => (
                    <li key={dIdx} className="flex items-start gap-2">
                      <span className="text-black font-bold">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <button
                onClick={onOpenConsultation}
                className="w-full py-2.5 bg-black text-white hover:bg-neutral-800 text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>Request {service.title}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Educational Callout */}
      <section className="border border-black p-8 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-bold text-black">Need General Guidance on U.S. Tax Forms?</h2>
          <p className="text-xs text-neutral-600 mt-1">
            Explore our interactive A/R Accounting Guidance Assistant to review requirements for Schedule C, S-Corp returns, or W-2 vs 1099.
          </p>
        </div>
        <button
          onClick={() => onNavigate('/public-v2/accounting-assistant')}
          className="px-6 py-2.5 bg-white text-black border border-black text-xs font-semibold hover:bg-black hover:text-white transition-colors flex-shrink-0"
        >
          Ask Assistant
        </button>
      </section>
    </div>
  );
};
