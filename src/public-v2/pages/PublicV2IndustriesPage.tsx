import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

interface PublicV2IndustriesPageProps {
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2IndustriesPage: React.FC<PublicV2IndustriesPageProps> = ({
  onNavigate,
  onOpenConsultation
}) => {
  const industries = [
    {
      name: 'Professional Services',
      subtitle: 'Law Practices, Engineering, Architecture, Consulting',
      challenges: 'Time-and-materials billing, trust account reconciliations (IOLTA), pass-through partner distributions, multi-jurisdiction nexus.',
      solutions: 'Customized chart of accounts, monthly WIP tracking, partner capital account reconciliation, and Section 199A Qualified Business Income (QBI) analysis.'
    },
    {
      name: 'Construction and Real Estate',
      subtitle: 'General Contractors, Specialty Trades, Property Developers',
      challenges: 'Job costing, percentage-of-completion vs. completed-contract accounting, progress billings, subcontractor 1099 compliance, passive activity rules.',
      solutions: 'Project job costing setups, retention tracking, 1031 like-kind exchange guidance coordination, and cost segregation study integration.'
    },
    {
      name: 'Retail and E-commerce',
      subtitle: 'Direct-to-Consumer, Amazon/Shopify Sellers, Multi-Channel Merchants',
      challenges: 'Multi-state sales tax economic nexus (Wayfair thresholds), inventory accounting (FIFO/Weighted Average), merchant processing fee reconciliations.',
      solutions: 'Integration with merchant settlement statements (Stripe, Shopify, Amazon), inventory cost-of-goods-sold analysis, and state sales tax filing coordination.'
    },
    {
      name: 'Healthcare Practices',
      subtitle: 'Medical Groups, Dental Clinics, Specialty Care, Wellness Practices',
      challenges: 'Insurance reimbursement delays, medical equipment depreciation (Section 179), practice overhead allocation, associate compensation structures.',
      solutions: 'Clean cash-flow forecasting, high-deduction equipment expensing schedules, healthcare payroll administration, and entity structuring.'
    },
    {
      name: 'Transportation & Logistics',
      subtitle: 'Freight Carriers, Fleet Operators, Owner-Operators, Couriers',
      challenges: 'Per-diem deductions, heavy highway vehicle use tax (Form 2290), fuel tax reconciliations, equipment leasing vs. purchasing decisions.',
      solutions: 'Standard mileage vs. actual expense optimization, commercial vehicle depreciation schedules, and multi-state driver payroll compliance.'
    },
    {
      name: 'Hospitality & Food Services',
      subtitle: 'Restaurants, Catering Operations, Specialty Cafes, Event Venues',
      challenges: 'Tip reporting compliance (Form 8027 / FICA Tip Credit under IRC § 45B), food and beverage inventory waste tracking, high labor turnover payroll.',
      solutions: 'FICA tip credit calculations, vendor payables automation, food cost ratio monitoring, and multi-location franchise reporting.'
    },
    {
      name: 'Technology & Software',
      subtitle: 'SaaS Startups, IT Contractors, Software Development Studios',
      challenges: 'Section 174 R&D expenditure amortization, equity compensation (RSUs, ISOs, 83(b) elections), international contractor withholding rules.',
      solutions: 'Section 174 capitalization tracking, R&D tax credit workpapers coordination, cap-table pass-through reporting, and federal/state compliance.'
    },
    {
      name: 'Nonprofit Organizations',
      subtitle: '501(c)(3) Charities, Educational Foundations, Community Associations',
      challenges: 'Form 990 annual information return filing, donor contribution substantiation, functional expense allocation, unrelated business income tax (UBIT).',
      solutions: 'Detailed Form 990 / 990-EZ compilation, statement of functional expenses preparation, donor acknowledgment documentation compliance.'
    }
  ];

  return (
    <div className="bg-white text-black space-y-16 py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="border-b border-black pb-8 space-y-3">
        <div className="inline-block border border-black bg-neutral-100 px-3 py-1 text-[11px] font-mono text-black">
          Targeted Industry Competence
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-black">
          Industry Practice Areas
        </h1>
        <p className="text-base sm:text-lg text-neutral-700 max-w-3xl leading-relaxed">
          Specialized accounting methodologies tailored to the distinct operational realities, inventory models, and regulatory frameworks of diverse business sectors.
        </p>
      </div>

      {/* Industry Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {industries.map((ind, idx) => (
          <div key={idx} className="border border-black p-6 sm:p-8 space-y-4 bg-white flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <span className="text-xs font-mono font-bold text-neutral-500">Industry 0{idx + 1}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-black font-semibold">U.S. Operations</span>
              </div>

              <h2 className="text-xl font-bold text-black tracking-tight">{ind.name}</h2>
              <p className="text-xs font-mono text-neutral-600">{ind.subtitle}</p>

              <div className="space-y-2 pt-2 text-xs">
                <div>
                  <strong className="text-black font-semibold">Operational Nuances:</strong>
                  <p className="text-neutral-600 leading-relaxed mt-0.5">{ind.challenges}</p>
                </div>
                <div>
                  <strong className="text-black font-semibold">A/R Accounting Focus:</strong>
                  <p className="text-neutral-600 leading-relaxed mt-0.5">{ind.solutions}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <button
                onClick={onOpenConsultation}
                className="w-full py-2 bg-neutral-100 hover:bg-black hover:text-white text-black border border-black text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Discuss {ind.name} Practice Requirements</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
