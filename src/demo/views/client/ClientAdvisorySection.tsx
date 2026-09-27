import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Calendar,
  Download,
  CheckCircle,
  Sliders,
  DollarSign,
  ArrowRight,
  Info,
  Sparkles,
  HelpCircle,
  Award
} from 'lucide-react';
import { ClientAdvisoryPlan, IAdvisoryService } from '../../services/clientDashboardServices';

interface ClientAdvisorySectionProps {
  advisoryService: IAdvisoryService;
  clientId: string;
  onOpenAssistant: () => void;
}

export const ClientAdvisorySection: React.FC<ClientAdvisorySectionProps> = ({
  advisoryService,
  clientId,
  onOpenAssistant
}) => {
  const [advisoryPlan, setAdvisoryPlan] = useState<ClientAdvisoryPlan>(() =>
    advisoryService.getAdvisoryPlan(clientId)
  );

  // Interactive strategy modeling parameters
  const [projectedProfit, setProjectedProfit] = useState<number>(350000);
  const [officerSalary, setOfficerSalary] = useState<number>(120000);
  const [retirementContribution, setRetirementContribution] = useState<number>(45000);
  const [scheduleMeetingNotice, setScheduleMeetingNotice] = useState<string | null>(null);

  // Calculations
  const calculatedSavings = useMemo(() => {
    // FICA savings: Medicare 2.9% + SS cap on portion distributed rather than salary
    const distributionAmount = Math.max(0, projectedProfit - officerSalary - retirementContribution);
    const ficaSavings = distributionAmount * 0.029 + 8200; // estimated Medicare & base payroll savings
    const qbiDeduction = Math.min(projectedProfit * 0.2, officerSalary * 0.5); // IRC § 199A limitation
    const pteSavings = projectedProfit * 0.035; // South Carolina Act 61 elective PTE benefit
    const retirementTaxShield = retirementContribution * 0.37; // top marginal bracket shelter
    const totalPotentialSavings = ficaSavings + pteSavings + retirementTaxShield;

    return {
      distributionAmount,
      ficaSavings,
      qbiDeduction,
      pteSavings,
      retirementTaxShield,
      totalPotentialSavings
    };
  }, [projectedProfit, officerSalary, retirementContribution]);

  const handleScheduleConsult = () => {
    setScheduleMeetingNotice('Advisory planning consultation request sent to Elena Rostova, CPA.');
    setTimeout(() => setScheduleMeetingNotice(null), 4000);
  };

  return (
    <div className="space-y-6" id="client-advisory-section">
      {/* 1. Mandatory Demo Disclaimer Banner */}
      <div className="bg-[#FAF9F5] border-2 border-[#C99A32] rounded-lg p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#061A2F] text-[#E8C66A] flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#C99A32] font-black">
                Advisory Projection Disclaimer
              </div>
              <h2 className="text-sm sm:text-base font-black text-[#061A2F]">
                Demo strategy estimation only — consult assigned CPA.
              </h2>
            </div>
          </div>
          <span className="text-xs font-mono text-[#667085]">
            Planning models for informational purposes • Non-binding estimate
          </span>
        </div>
      </div>

      {scheduleMeetingNotice && (
        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] text-[#1B5E20] rounded text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{scheduleMeetingNotice}</span>
        </div>
      )}

      {/* 2. Header Card */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#D7AC4A] uppercase tracking-wider font-bold bg-[#061A2F] px-2 py-0.5 rounded">
                Section 8 of 8
              </span>
              <span className="text-xs font-mono text-[#667085]">Year-Round Strategic Tax Blueprint</span>
            </div>
            <h1 className="text-xl font-black text-[#061A2F] mt-1">
              Tax Planning & Advisory
            </h1>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Multi-scenario financial modeling for <strong className="text-[#061A2F]">{advisoryPlan.entityName}</strong> • Designed by Elena Rostova, CPA.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleScheduleConsult}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#061A2F] hover:bg-[#031323] text-white rounded text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Schedule Strategy Call</span>
            </button>
            <button
              onClick={() => alert('Simulated download of Strategic Tax Advisory Memorandum PDF')}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>Download Memo (PDF)</span>
            </button>
          </div>
        </div>

        {/* Advisory Overview Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Current Entity Form</span>
            <span className="font-bold text-[#061A2F] block mt-0.5">S-Corporation (Pass-Through)</span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Reasonable Comp Study</span>
            <span className="font-bold text-[#1B5E20] block mt-0.5 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> RCReports Certified ($120k Benchmark)
            </span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Lead Strategic Advisor</span>
            <span className="font-bold text-[#061A2F] block mt-0.5">Elena Rostova, CPA</span>
          </div>
        </div>
      </div>

      {/* 3. Three Strategic Scenarios Comparison */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="pb-3 border-b border-[#D8DCE2]">
          <h2 className="text-sm font-bold text-[#061A2F]">Three Strategic Scenario Comparison</h2>
          <p className="text-xs text-[#667085]">Evaluated by A/R Tax Services, LLC for 2025/2026</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
          {advisoryPlan.scenarios.map((sc, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border flex flex-col justify-between ${
                idx === 1
                  ? 'bg-[#FAF9F5] border-[#C99A32] shadow-xs'
                  : 'bg-white border-[#D8DCE2]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[#D8DCE2]">
                  <span className="font-mono text-[10px] font-bold text-[#667085] uppercase">
                    Scenario {idx === 0 ? 'A' : idx === 1 ? 'B (Recommended)' : 'C'}
                  </span>
                  {idx === 1 && (
                    <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] font-mono text-[9px] font-bold rounded">
                      Optimal
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-[#061A2F] mt-2">{sc.title}</h3>
                <p className="text-[11px] text-[#4B5563] mt-1 leading-relaxed">
                  {sc.description}
                </p>

                <div className="mt-4 p-3 bg-white/70 rounded border border-[#E5E7EB] space-y-1 font-mono">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#667085]">Est. Tax Liability:</span>
                    <span className="font-bold text-[#061A2F]">${sc.estimatedTaxLiability.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#1B5E20]">
                    <span className="font-bold">Projected Net Savings:</span>
                    <span className="font-bold">+${sc.projectedSavings.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#D8DCE2] mt-4 flex items-center gap-1.5 text-[10px] text-[#667085]">
                <Sparkles className="w-3 h-3 text-[#C99A32]" />
                <span>Implemented in quarterly estimated payment schedules</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Interactive Advisory Simulator */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs space-y-4">
        <div className="pb-3 border-b border-[#D8DCE2] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#061A2F]">Interactive Tax Strategy Modeling Engine</h2>
            <p className="text-xs text-[#667085]">Adjust operational variables to observe estimated tax shield impacts</p>
          </div>
          <span className="px-2.5 py-1 bg-[#FAF9F5] border border-[#C99A32] text-[#061A2F] text-xs font-bold font-mono rounded">
            Real-Time Model
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-5 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-[#061A2F] mb-1">
                <span>Projected Net Operating Profit:</span>
                <span className="font-mono font-bold">${projectedProfit.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={200000}
                max={800000}
                step={25000}
                value={projectedProfit}
                onChange={(e) => setProjectedProfit(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#061A2F]"
              />
              <div className="flex justify-between text-[10px] text-[#667085] mt-0.5">
                <span>$200,000</span>
                <span>$500,000</span>
                <span>$800,000</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#061A2F] mb-1">
                <span>W-2 Officer Salary (RCReports Defensible Benchmark):</span>
                <span className="font-mono font-bold">${officerSalary.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={80000}
                max={200000}
                step={5000}
                value={officerSalary}
                onChange={(e) => setOfficerSalary(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#061A2F]"
              />
              <div className="flex justify-between text-[10px] text-[#667085] mt-0.5">
                <span>$80,000 (Min defensible)</span>
                <span>$140,000</span>
                <span>$200,000</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#061A2F] mb-1">
                <span>Solo 401(k) / Cash Balance Plan Contribution:</span>
                <span className="font-mono font-bold">${retirementContribution.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={0}
                max={69000}
                step={3000}
                value={retirementContribution}
                onChange={(e) => setRetirementContribution(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#061A2F]"
              />
              <div className="flex justify-between text-[10px] text-[#667085] mt-0.5">
                <span>$0</span>
                <span>$35,000</span>
                <span>$69,000 (2025 IRS Limit)</span>
              </div>
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="bg-[#FAF9F5] border border-[#C99A32] rounded-lg p-4 flex flex-col justify-between text-xs space-y-3">
            <div>
              <span className="font-mono text-[10px] uppercase font-bold text-[#C99A32] block">
                Simulated Strategy Impact
              </span>
              <div className="text-xl font-black text-[#1B5E20] font-mono mt-1">
                +${Math.round(calculatedSavings.totalPotentialSavings).toLocaleString()}
              </div>
              <span className="text-[11px] text-[#4B5563] block">
                Estimated annual tax savings vs. C-Corp or Sole Proprietorship
              </span>

              <div className="mt-4 space-y-2 border-t border-[#D8DCE2] pt-3 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Shareholder Distribution:</span>
                  <span className="font-bold">${calculatedSavings.distributionAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">FICA Tax Protected:</span>
                  <span className="font-bold text-[#1B5E20]">${Math.round(calculatedSavings.ficaSavings).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">SC Act 61 PTE Shield:</span>
                  <span className="font-bold text-[#1B5E20]">${Math.round(calculatedSavings.pteSavings).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Pension Tax Shield:</span>
                  <span className="font-bold text-[#1B5E20]">${Math.round(calculatedSavings.retirementTaxShield).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D8DCE2] text-[10px] text-[#667085]">
              IRC § 162 & § 199A compliance evaluated by A/R Tax Services, LLC.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
