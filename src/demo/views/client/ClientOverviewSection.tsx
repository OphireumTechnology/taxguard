import React, { useState } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  CreditCard,
  PenTool,
  Clock,
  ShieldCheck,
  Calendar,
  Users,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Info,
  DollarSign
} from 'lucide-react';
import { ClientDashboardOverview, ClientTeamMember } from '../../services/clientDashboardServices';
import { LifecycleDetailModal } from './LifecycleDetailModal';

interface ClientOverviewSectionProps {
  overview: ClientDashboardOverview;
  onNavigate: (sectionId: string) => void;
  onOpenAssistant: () => void;
}

export const ClientOverviewSection: React.FC<ClientOverviewSectionProps> = ({
  overview,
  onNavigate,
  onOpenAssistant
}) => {
  const [lifecycleModalOpen, setLifecycleModalOpen] = useState(false);

  return (
    <div className="space-y-6" id="client-overview-section">
      {/* 1. Entity & Engagement Header Card */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Active Entity
              </span>
              <span className="text-xs font-mono text-[#667085]">Client ID: {overview.clientId}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#061A2F] mt-1 tracking-tight">
              {overview.entityName}
            </h1>
            <div className="text-xs text-[#4B5563] mt-0.5">
              Primary Contact: <strong className="text-[#061A2F]">{overview.clientName}</strong> • {overview.engagementTitle}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#FAF9F5] border border-[#D8DCE2] px-3 py-2 rounded text-right">
              <div className="text-[10px] font-mono uppercase text-[#667085]">Next Statutory Deadline</div>
              <div className="text-xs font-bold text-[#061A2F] flex items-center gap-1.5 justify-end mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-[#C99A32]" />
                {overview.nextDeadline}
              </div>
            </div>

            <button
              onClick={onOpenAssistant}
              className="flex items-center gap-2 px-3 py-2 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#C99A32] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>TaxGuard Assistant</span>
            </button>
          </div>
        </div>

        {/* Essential Engagement Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <div className="text-[10px] font-mono uppercase text-[#667085]">Tax Year</div>
            <div className="text-base font-bold text-[#061A2F] mt-0.5">{overview.taxYear}</div>
            <div className="text-[10px] text-[#667085]">{overview.returnType}</div>
          </div>

          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <div className="text-[10px] font-mono uppercase text-[#667085]">Lifecycle Progress</div>
            <div className="text-base font-bold text-[#061A2F] mt-0.5">{overview.completionPercentage}%</div>
            <div className="text-[10px] text-[#1B5E20] font-semibold">Stage {overview.lifecycleStageIndex} of 18</div>
          </div>

          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <div className="text-[10px] font-mono uppercase text-[#667085]">Return Review</div>
            <div className="text-xs font-bold text-[#1B5E20] mt-1 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {overview.returnReviewStatus}
            </div>
            <div className="text-[10px] text-[#667085]">CPA Elena Rostova</div>
          </div>

          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <div className="text-[10px] font-mono uppercase text-[#667085]">Signature Status</div>
            <div className="text-xs font-bold text-[#C99A32] mt-1 flex items-center gap-1">
              <PenTool className="w-3.5 h-3.5" />
              {overview.signatureStatus}
            </div>
            <div className="text-[10px] text-[#667085]">Form 8879-S Ready</div>
          </div>

          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <div className="text-[10px] font-mono uppercase text-[#667085]">Invoice Status</div>
            <div className="text-xs font-bold text-[#061A2F] mt-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-[#C99A32]" />
              {overview.invoiceStatus}
            </div>
            <div className="text-[10px] text-[#C99A32] font-semibold">Balance: ${overview.unpaidBalanceAmount.toFixed(2)}</div>
          </div>

          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <div className="text-[10px] font-mono uppercase text-[#667085]">Filing Status</div>
            <div className="text-xs font-bold text-[#061A2F] mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#667085]" />
              {overview.filingStatus}
            </div>
            <div className="text-[10px] text-[#667085]">MeF Transmission Ready</div>
          </div>
        </div>
      </div>

      {/* 2. Immediate Required Action Banner */}
      <div className="bg-[#FAF9F5] border border-[#C99A32] rounded-lg p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#061A2F] text-[#E8C66A] flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#C99A32] font-bold">
              Immediate Required Client Action
            </div>
            <h2 className="text-sm sm:text-base font-bold text-[#061A2F] mt-0.5">
              {overview.immediateRequiredAction}
            </h2>
            <p className="text-xs text-[#4B5563] mt-1">
              Your 2025 Form 1120-S package has been certified by senior CPA Elena Rostova. Please inspect the line summaries and authorize Form 8879-S to initiate transmission.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onNavigate('return_review')}
            className="px-4 py-2 bg-[#061A2F] text-white hover:bg-[#031323] text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span>Review Return Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Compact Authoritative 18-Stage Lifecycle Component */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#667085] font-bold">
              Authoritative Operational Cycle
            </div>
            <h2 className="text-base font-bold text-[#061A2F]">
              Current Engagement Lifecycle: Stage {overview.lifecycleStageIndex} of 18 ({overview.currentLifecycleStage})
            </h2>
          </div>
          <button
            onClick={() => setLifecycleModalOpen(true)}
            className="text-xs text-[#061A2F] hover:text-[#C99A32] font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>View Full 18-Stage Map</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Stepper Line */}
        <div className="py-4">
          <div className="flex items-center justify-between text-xs text-[#667085] mb-2 font-mono">
            <span>Stage 1: Onboard</span>
            <span className="font-bold text-[#061A2F]">Active: Stage {overview.lifecycleStageIndex} ({overview.currentLifecycleStage})</span>
            <span>Stage 18: Repeat</span>
          </div>
          <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden">
            <div 
              className="bg-[#061A2F] h-full rounded-full transition-all duration-500"
              style={{ width: `${(overview.lifecycleStageIndex / 18) * 100}%` }}
            />
          </div>
        </div>

        {/* Key Stage Attributes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Responsible Role</span>
            <span className="font-bold text-[#061A2F] mt-0.5 block">{overview.responsibleRole}</span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Completed Stages</span>
            <span className="font-bold text-[#1B5E20] mt-0.5 block">9 of 18 Stages Finalized</span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Next Sequential Stage</span>
            <span className="font-bold text-[#061A2F] mt-0.5 block">Stage 11: Sign (Form 8879)</span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Cycle Health</span>
            <span className="font-bold text-[#1B5E20] mt-0.5 block flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> On Schedule (No Blockers)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Eight Direct Overview Quick Actions */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="pb-3 border-b border-[#D8DCE2] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#667085] font-bold">
              Client Portal Workflows
            </div>
            <h2 className="text-base font-bold text-[#061A2F]">
              Direct Section Quick Actions
            </h2>
          </div>
          <span className="text-xs text-[#667085]">8 Direct Routing Workflows</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          <button
            onClick={() => onNavigate('vault')}
            className="p-3.5 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] hover:border-[#C99A32] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <UploadCloud className="w-4 h-4 text-[#061A2F] group-hover:text-[#C99A32]" />
              <ChevronRight className="w-3.5 h-3.5 text-[#667085] group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-[#061A2F] mt-2">Upload Document</div>
            <div className="text-[11px] text-[#667085] mt-0.5">Add tax forms, K-1s, or receipts to Vault</div>
          </button>

          <button
            onClick={() => onNavigate('questionnaire')}
            className="p-3.5 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] hover:border-[#C99A32] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <CheckCircle className="w-4 h-4 text-[#061A2F] group-hover:text-[#C99A32]" />
              <ChevronRight className="w-3.5 h-3.5 text-[#667085] group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-[#061A2F] mt-2">Continue Organizer</div>
            <div className="text-[11px] text-[#667085] mt-0.5">21 comprehensive tax questionnaires (75% done)</div>
          </button>

          <button
            onClick={() => onNavigate('ledger')}
            className="p-3.5 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] hover:border-[#C99A32] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <DollarSign className="w-4 h-4 text-[#061A2F] group-hover:text-[#C99A32]" />
              <ChevronRight className="w-3.5 h-3.5 text-[#667085] group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-[#061A2F] mt-2">Add Income Record</div>
            <div className="text-[11px] text-[#667085] mt-0.5">Log revenues, dividends, or pass-through</div>
          </button>

          <button
            onClick={() => onNavigate('ledger')}
            className="p-3.5 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] hover:border-[#C99A32] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <DollarSign className="w-4 h-4 text-[#061A2F] group-hover:text-[#C99A32]" />
              <ChevronRight className="w-3.5 h-3.5 text-[#667085] group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-[#061A2F] mt-2">Add Expense Entry</div>
            <div className="text-[11px] text-[#667085] mt-0.5">Log deductible expenses with AI suggestions</div>
          </button>

          <button
            onClick={() => onNavigate('return_review')}
            className="p-3.5 bg-[#FAF9F5] hover:bg-[#F3EFE6] border border-[#C99A32] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <FileText className="w-4 h-4 text-[#C99A32]" />
              <ChevronRight className="w-3.5 h-3.5 text-[#667085] group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-[#061A2F] mt-2">Review Draft Return</div>
            <div className="text-[11px] text-[#667085] mt-0.5">Inspect Form 1120-S figures and notes</div>
          </button>

          <button
            onClick={() => onNavigate('return_review')}
            className="p-3.5 bg-[#FAF9F5] hover:bg-[#F3EFE6] border border-[#C99A32] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <PenTool className="w-4 h-4 text-[#C99A32]" />
              <ChevronRight className="w-3.5 h-3.5 text-[#667085] group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-[#061A2F] mt-2">Authorize Form 8879</div>
            <div className="text-[11px] text-[#667085] mt-0.5">E-sign corporate e-file authorization</div>
          </button>

          <button
            onClick={() => onNavigate('billing')}
            className="p-3.5 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] hover:border-[#C99A32] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <CreditCard className="w-4 h-4 text-[#061A2F] group-hover:text-[#C99A32]" />
              <ChevronRight className="w-3.5 h-3.5 text-[#667085] group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-[#061A2F] mt-2">View Fee Invoices</div>
            <div className="text-[11px] text-[#667085] mt-0.5">Inspect itemized invoices and simulate payment</div>
          </button>

          <button
            onClick={() => onNavigate('notices')}
            className="p-3.5 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] hover:border-[#C99A32] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <AlertCircle className="w-4 h-4 text-[#061A2F] group-hover:text-[#C99A32]" />
              <ChevronRight className="w-3.5 h-3.5 text-[#667085] group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-[#061A2F] mt-2">Upload Tax Notice</div>
            <div className="text-[11px] text-[#667085] mt-0.5">Upload IRS / SC DOR letter for CPA defense</div>
          </button>
        </div>
      </div>

      {/* 5. Assigned Practice Team & Missing Information Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Practice Team */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
          <div className="pb-3 border-b border-[#D8DCE2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#061A2F]" />
              <h2 className="text-sm font-bold text-[#061A2F]">Assigned A/R Tax Services Engagement Team</h2>
            </div>
            <span className="text-[10px] font-mono text-[#667085] uppercase">Dedicated Professionals</span>
          </div>

          <div className="divide-y divide-[#E5E7EB] pt-1">
            {overview.assignedTeam.map((member) => (
              <div key={member.name} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#061A2F]">{member.name}</div>
                  <div className="text-[11px] text-[#667085]">{member.role}</div>
                </div>
                <div className="text-right text-xs">
                  <span className="px-2 py-0.5 bg-[#FAF9F5] border border-[#D8DCE2] text-[#061A2F] font-mono text-[11px] rounded">
                    {member.email}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Items & Attention Count */}
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-[#D8DCE2] flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#061A2F]">Compliance Checklist</h2>
              <span className="px-2 py-0.5 bg-[#FAF9F5] border border-[#C99A32] text-[#061A2F] text-[10px] font-mono font-bold rounded">
                Active
              </span>
            </div>

            <div className="py-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
                <span className="text-[#4B5563]">Missing Source Documents</span>
                <span className="font-bold text-[#C99A32]">{overview.documentsRequiringAttention} items</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
                <span className="text-[#4B5563]">Organizer Questions Pending</span>
                <span className="font-bold text-[#061A2F]">{overview.missingInformationCount} items</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
                <span className="text-[#4B5563]">Prior Year Archival Records</span>
                <span className="font-bold text-[#1B5E20]">4 Years Verified</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('vault')}
            className="w-full py-2 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] text-[#061A2F] text-xs font-bold rounded transition-colors text-center cursor-pointer mt-3"
          >
            Resolve Pending Items in Vault
          </button>
        </div>
      </div>

      {/* 18-Stage Lifecycle Modal */}
      <LifecycleDetailModal
        isOpen={lifecycleModalOpen}
        currentStage={overview.currentLifecycleStage as any}
        onClose={() => setLifecycleModalOpen(false)}
      />
    </div>
  );
};
