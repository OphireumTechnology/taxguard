/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Master Tax Workflow Progress (7-Stage Workflow Stepper)
 *
 * Implements Section 6 of Client Dashboard Architecture:
 * 1 Getting Started
 * 2 Documents
 * 3 Review
 * 4 Tax Preparation
 * 5 Approval & Signature
 * 6 Filing
 * 7 Completed
 *
 * Each stage supports:
 * - NOT_STARTED
 * - IN_PROGRESS
 * - WAITING_ON_CLIENT
 * - WAITING_ON_STAFF
 * - UNDER_REVIEW
 * - BLOCKED
 * - COMPLETED
 *
 * Bound to authoritative workflow state. Hard gates prevent unauthorized skipping.
 */

import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Sparkles
} from 'lucide-react';

export type WorkflowStageStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_ON_CLIENT'
  | 'WAITING_ON_STAFF'
  | 'UNDER_REVIEW'
  | 'BLOCKED'
  | 'COMPLETED';

export interface WorkflowStepDefinition {
  stepNumber: number;
  id: string;
  label: string;
  description: string;
  stageNumbers: number[];
  defaultNavId: string;
}

export const MASTER_WORKFLOW_STEPS: WorkflowStepDefinition[] = [
  {
    stepNumber: 1,
    id: 'step_1',
    label: 'Getting Started',
    description: 'Onboarding & Consent',
    stageNumbers: [1],
    defaultNavId: 'stage_01'
  },
  {
    stepNumber: 2,
    id: 'step_2',
    label: 'Documents',
    description: 'Intake & Checklist',
    stageNumbers: [2, 3],
    defaultNavId: 'stage_02'
  },
  {
    stepNumber: 3,
    id: 'step_3',
    label: 'Review',
    description: 'Validation & Reconcile',
    stageNumbers: [4, 5, 6, 7, 8],
    defaultNavId: 'stage_04'
  },
  {
    stepNumber: 4,
    id: 'step_4',
    label: 'Tax Preparation',
    description: 'Form 1040 Calculations',
    stageNumbers: [9],
    defaultNavId: 'stage_09'
  },
  {
    stepNumber: 5,
    id: 'step_5',
    label: 'Approval & Signature',
    description: 'Draft Review & Form 8879',
    stageNumbers: [10, 11],
    defaultNavId: 'stage_10'
  },
  {
    stepNumber: 6,
    id: 'step_6',
    label: 'Filing',
    description: 'Electronic Filing Gateway',
    stageNumbers: [12, 13, 14],
    defaultNavId: 'stage_12'
  },
  {
    stepNumber: 7,
    id: 'step_7',
    label: 'Completed',
    description: 'Archive & Multi-Year Vault',
    stageNumbers: [15, 16, 17, 18],
    defaultNavId: 'stage_15'
  }
];

export interface TaxWorkflowProgressProps {
  authoritativeStage: number;
  authoritativeStageName?: string;
  missingCount: number;
  pendingRequestsCount: number;
  hasRejectedDocument?: boolean;
  onSelectStep?: (step: WorkflowStepDefinition) => void;
  onViewDetailedWorkflow?: () => void;
}

export const TaxWorkflowProgress: React.FC<TaxWorkflowProgressProps> = ({
  authoritativeStage,
  authoritativeStageName,
  missingCount,
  pendingRequestsCount,
  hasRejectedDocument = false,
  onSelectStep,
  onViewDetailedWorkflow
}) => {
  const getStepStatus = (step: WorkflowStepDefinition): WorkflowStageStatus => {
    // 1. Past stages are completed
    if (step.stageNumbers.every((n) => n < authoritativeStage)) {
      return 'COMPLETED';
    }

    // 2. Future stages are not started
    if (step.stageNumbers.every((n) => n > authoritativeStage)) {
      return 'NOT_STARTED';
    }

    // 3. Current active step
    if (hasRejectedDocument) {
      return 'BLOCKED';
    }
    if (pendingRequestsCount > 0) {
      return 'WAITING_ON_CLIENT';
    }
    if (step.stepNumber === 2) {
      if (missingCount > 0) return 'WAITING_ON_CLIENT';
      return 'UNDER_REVIEW';
    }
    if (step.stepNumber === 5) {
      if (authoritativeStage === 10) return 'WAITING_ON_CLIENT'; // Needs client approval
      if (authoritativeStage === 11) return 'WAITING_ON_CLIENT'; // Needs Form 8879 signature
    }
    if (step.stepNumber >= 3 && step.stepNumber <= 4) {
      return 'WAITING_ON_STAFF';
    }
    return 'IN_PROGRESS';
  };

  const getStatusBadge = (status: WorkflowStageStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
            COMPLETED
          </span>
        );
      case 'WAITING_ON_CLIENT':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40 animate-pulse">
            ACTION NEEDED
          </span>
        );
      case 'WAITING_ON_STAFF':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
            IN PREP
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
            UNDER REVIEW
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-red-950 text-red-300 border border-red-500/40">
            ATTENTION
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#D4A843]/20 text-[#E2BD67] border border-[#D4A843]/40">
            ACTIVE
          </span>
        );
      case 'NOT_STARTED':
      default:
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium text-slate-500 border border-slate-800">
            LOCKED
          </span>
        );
    }
  };

  return (
    <section
      aria-label="Master Tax Workflow Progress"
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-5 shadow-xl space-y-3.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
            MASTER TAX WORKFLOW PROGRESS
          </span>
          <span className="text-slate-500">&bull;</span>
          <span className="text-xs font-mono text-slate-300">
            Stage <strong className="text-white">{String(authoritativeStage).padStart(2, '0')} of 18</strong>
            {authoritativeStageName ? ` (${authoritativeStageName})` : ''}
          </span>
        </div>

        {onViewDetailedWorkflow && (
          <button
            type="button"
            onClick={onViewDetailedWorkflow}
            className="text-[11px] text-[#D4A843] hover:underline font-mono flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Authoritative 18 Stages &rarr;</span>
          </button>
        )}
      </div>

      {/* 7-Step Horizontal Stepper Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
        {MASTER_WORKFLOW_STEPS.map((step) => {
          const status = getStepStatus(step);
          const isCurrent = step.stageNumbers.includes(authoritativeStage);
          const isCompleted = status === 'COMPLETED';
          const isLocked = status === 'NOT_STARTED';

          return (
            <div
              key={step.id}
              onClick={() => {
                if (!isLocked && onSelectStep) {
                  onSelectStep(step);
                }
              }}
              className={`p-3 rounded-xl border flex flex-col justify-between transition-all select-none min-h-[92px] ${
                isCurrent
                  ? 'bg-[#102D4F] border-[#D4A843] ring-1 ring-[#D4A843]/40 shadow-lg'
                  : isCompleted
                  ? 'bg-[#071A2E] border-emerald-900/50 hover:border-emerald-600/60 cursor-pointer'
                  : 'bg-[#071A2E]/60 border-slate-800 text-slate-500 cursor-not-allowed opacity-75'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-mono font-bold ${
                    isCurrent
                      ? 'text-[#D4A843]'
                      : isCompleted
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                  }`}
                >
                  0{step.stepNumber}
                </span>

                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D4A843] animate-pulse ring-2 ring-[#D4A843]/40" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                )}
              </div>

              <div className="mt-2 space-y-1">
                <div
                  className={`font-semibold text-xs leading-snug line-clamp-1 ${
                    isCurrent ? 'text-white' : isCompleted ? 'text-slate-200' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </div>
                <div>{getStatusBadge(status)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
