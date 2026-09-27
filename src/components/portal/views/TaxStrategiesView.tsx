import React from 'react';
import { Award, ShieldCheck, CheckCircle2, ChevronRight, DollarSign, Calendar } from 'lucide-react';
import { TaxStrategy } from '../../../types';

interface TaxStrategiesViewProps {
  onBookSession: () => void;
}

export const TaxStrategiesView: React.FC<TaxStrategiesViewProps> = ({ onBookSession }) => {
  const strategies: TaxStrategy[] = [
    {
      id: 'strat_1',
      title: 'Augusta Rule (14-Day Residence Rental)',
      ircCode: 'IRC §280A(g)',
      potentialSavings: '$4,200',
      status: 'active',
      description: 'Rent your personal residence to your operating business for up to 14 days per calendar year for corporate strategy and quarterly board meetings. Income is 100% tax-free at federal and South Carolina state levels.'
    },
    {
      id: 'strat_2',
      title: 'Section 179 & Bonus Depreciation on Equipment',
      ircCode: 'IRC §179 / §168(k)',
      potentialSavings: '$3,850',
      status: 'in_progress',
      description: 'Accelerated first-year write-off for qualifying computer hardware, networking gear, and business machinery placed in service during tax year 2025.'
    },
    {
      id: 'strat_3',
      title: 'S-Corporation Optimization & Reasonable Compensation',
      ircCode: 'IRC §1366 & Rev. Rul. 74-44',
      potentialSavings: '$6,500',
      status: 'recommended',
      description: 'Evaluating an S-Corp election for your consulting entity once net profit crosses $85,000, significantly reducing self-employment FICA taxes through split salary/distribution modeling.'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-6 sm:p-7 rounded-2xl bg-[#0A1F38] border border-[#183458] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
            Strategic Advisory &bull; Wealth Preservation
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mt-1">
            Personalized Tax Strategies &amp; IRC Substantiations
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Proactive tax planning structures tailored to your entity structure and revenue projections.
          </p>
        </div>

        <button
          type="button"
          onClick={onBookSession}
          className="px-5 py-2.5 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] font-bold text-xs flex items-center gap-2 shadow-md transition-all self-start sm:self-auto flex-shrink-0"
        >
          <Calendar className="w-4 h-4" />
          <span>Book Strategy Call</span>
        </button>
      </div>

      {/* Strategies List */}
      <div className="grid grid-cols-1 gap-4">
        {strategies.map((strat) => (
          <div
            key={strat.id}
            className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] space-y-3 transition-colors hover:border-[#1E3A5F]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#183458] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#C6A15B]/15 text-[#C6A15B] flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-white">{strat.title}</h3>
                  <span className="text-[11px] font-mono text-[#C6A15B] font-semibold">
                    {strat.ircCode}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Est. Tax Savings</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">{strat.potentialSavings}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  strat.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : strat.status === 'in_progress'
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  {strat.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {strat.description}
            </p>

            <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>IRS Audit-Proof Workpaper Substantiation Prepared</span>
              </div>

              <button
                type="button"
                onClick={onBookSession}
                className="text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] flex items-center gap-1"
              >
                <span>Discuss with Desmond Hinds</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
