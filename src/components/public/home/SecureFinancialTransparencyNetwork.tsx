import React, { useState } from 'react';
import {
  FolderLock,
  BrainCircuit,
  ClipboardCheck,
  UserCheck,
  FileSignature,
  ShieldCheck
} from 'lucide-react';

interface TransparencyNetworkNode {
  readonly id: string;
  readonly step: string;
  readonly label: string;
  readonly detailTitle: string;
  readonly detailBody: string;
  readonly governanceNote: string;
  readonly accent: 'cyan' | 'gold' | 'client';
  readonly icon: React.ComponentType<{ className?: string }>;
}

const NETWORK_NODES: readonly TransparencyNetworkNode[] = [
  {
    id: 'secure-intake',
    step: '01',
    label: 'Secure Intake',
    detailTitle: 'Secure Intake — Organized Client Document Submission',
    detailBody:
      'Tax statements, ledgers, and supporting documentation enter through your private Client Portal workspace for structured engagement intake.',
    governanceNote: 'Client files remain scoped to your individual engagement record.',
    accent: 'cyan',
    icon: FolderLock
  },
  {
    id: 'ai-assistance',
    step: '02',
    label: 'AI Assistance',
    detailTitle: 'AI Assistance — Structured Organization & Extraction',
    detailBody:
      'Technology assists by indexing uploaded forms, organizing line items, and preparing clean starting schedules for your tax team.',
    governanceNote: 'AI outputs are draft assistance only and never replace professional judgment.',
    accent: 'cyan',
    icon: BrainCircuit
  },
  {
    id: 'financial-validation',
    step: '03',
    label: 'Financial Validation',
    detailTitle: 'Financial Validation — Cross-Checking & Variance Detection',
    detailBody:
      'Figures across source forms, trial balances, and prior-year schedules are cross-checked to surface missing documents or variances early.',
    governanceNote: 'Every flagged discrepancy routes to a qualified human preparer for review.',
    accent: 'cyan',
    icon: ClipboardCheck
  },
  {
    id: 'professional-review',
    step: '04',
    label: 'Professional Review',
    detailTitle: 'Professional Review — Independent Practitioner Accountability',
    detailBody:
      'Experienced Destria tax professionals interpret applicable federal and state tax rules, verify calculations, and complete mandatory quality review.',
    governanceNote: 'Qualified professionals hold exclusive authority over all tax conclusions.',
    accent: 'gold',
    icon: UserCheck
  },
  {
    id: 'client-authorization',
    step: '05',
    label: 'Client Authorization',
    detailTitle: 'Client Authorization — Your Decision, Your Control',
    detailBody:
      'Review the prepared tax return summary, discuss the findings with your tax professional, and provide explicit authorization before filing.',
    governanceNote: 'No return is finalized or transmitted without the required client authorization.',
    accent: 'client',
    icon: FileSignature
  },
  {
    id: 'authorized-services',
    step: '06',
    label: 'Authorized Services',
    detailTitle: 'Authorized Services — Documented Delivery & Continuity',
    detailBody:
      'Following explicit client authorization, finalized filings and advisory deliverables are completed and preserved in your engagement archive.',
    governanceNote: 'Preparation, review, and client approval milestones remain clearly documented.',
    accent: 'gold',
    icon: ShieldCheck
  }
];

interface SecureFinancialTransparencyNetworkProps {
  animate: boolean;
}

/**
 * Interactive 6-node Secure Financial Transparency Network.
 * Defaults to Client Authorization so visitors immediately see the client-control narrative.
 * Clearly distinguishes conceptual visual metaphors from live blockchain infrastructure.
 */
export const SecureFinancialTransparencyNetwork: React.FC<
  SecureFinancialTransparencyNetworkProps
> = ({ animate }) => {
  // Default to index 4: Client Authorization
  const [selectedIndex, setSelectedIndex] = useState<number>(4);
  const selectedNode = NETWORK_NODES[selectedIndex] ?? NETWORK_NODES[4];

  return (
    <div
      aria-label="Secure Financial Transparency Network"
      className={`relative overflow-hidden rounded-2xl border border-[rgba(56,189,248,0.22)] bg-gradient-to-b from-[#081D34] to-[#051426] p-6 sm:p-8 shadow-[0_18px_48px_rgba(2,10,20,0.48)] ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/55 to-transparent"
      />

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between pb-5 border-b border-[rgba(148,163,184,0.16)]">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            Blockchain-Inspired Traceability Model
          </p>
          <h3 className="font-serif text-2xl sm:text-[1.65rem] font-bold text-white tracking-tight">
            Secure Financial Transparency Network
          </h3>
          <p className="text-sm sm:text-[15px] leading-relaxed text-slate-300">
            Follow the controlled journey of financial information from secure intake through
            professional review and explicit client authorization.
          </p>
        </div>
        <span className="font-mono text-xs font-medium text-slate-300 whitespace-nowrap">
          Node {selectedNode.step} of 06
        </span>
      </div>

      {/* Animated Connecting Pathway (Desktop) */}
      <div className="mt-6">
        <svg
          aria-hidden="true"
          viewBox="0 0 960 22"
          preserveAspectRatio="none"
          className="pointer-events-none mb-3 hidden h-5 w-full lg:block"
        >
          <defs>
            <linearGradient id="destriaTransparencyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="65%" stopColor="#E5B552" />
              <stop offset="100%" stopColor="#D4A843" />
            </linearGradient>
          </defs>
          <line
            x1="48"
            y1="11"
            x2="912"
            y2="11"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth="1.25"
          />
          <line
            x1="48"
            y1="11"
            x2="912"
            y2="11"
            stroke="url(#destriaTransparencyGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            className="destria-ecosystem-stream"
          />
          {[48, 220, 393, 566, 739, 912].map((cx, idx) => {
            const isActive = idx === selectedIndex;
            const isClientNode = idx === 4;
            return (
              <g key={cx}>
                <circle
                  cx={cx}
                  cy="11"
                  r={isActive ? '7' : '4.5'}
                  fill="none"
                  stroke={
                    isClientNode
                      ? 'rgba(229, 181, 82, 0.65)'
                      : isActive
                        ? 'rgba(56, 189, 248, 0.6)'
                        : 'rgba(148, 163, 184, 0.25)'
                  }
                  strokeWidth="1.2"
                  className={isActive ? 'destria-checkpoint-glow' : undefined}
                />
                <circle
                  cx={cx}
                  cy="11"
                  r={isActive ? '3.5' : '2.5'}
                  fill={isActive ? (isClientNode ? '#E5B552' : '#38BDF8') : '#0B223C'}
                  stroke={isClientNode ? '#E5B552' : '#38BDF8'}
                  strokeWidth="1.2"
                />
              </g>
            );
          })}
        </svg>

        {/* 6 Interactive Network Nodes */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {NETWORK_NODES.map((node, idx) => {
            const Icon = node.icon;
            const isSelected = idx === selectedIndex;
            const isClient = node.accent === 'client';
            const isGold = node.accent === 'gold';

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                aria-pressed={isSelected}
                className={`group flex min-h-[88px] flex-col justify-between rounded-xl border p-3.5 text-left transition-all focus-visible:outline-none ${
                  isSelected
                    ? isClient
                      ? 'border-[#E5B552] bg-[#112F54] shadow-[0_0_24px_rgba(212,168,67,0.2)]'
                      : isGold
                        ? 'border-[rgba(212,168,67,0.68)] bg-[#102C4D]'
                        : 'border-sky-400/70 bg-[#0D2B4C] shadow-[0_0_20px_rgba(56,189,248,0.14)]'
                    : 'border-[rgba(148,163,184,0.18)] bg-[#06182B]/80 hover:border-[rgba(56,189,248,0.45)] hover:bg-[#0B2340]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isClient || isGold
                        ? 'text-[#E5B552]'
                        : 'text-sky-300'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-xs text-slate-400">{node.step}</span>
                </div>
                <span className="mt-3 text-[13px] font-semibold leading-snug text-white">
                  {node.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Node Detail Card */}
      <div className="mt-5 rounded-xl border border-[rgba(148,163,184,0.2)] bg-[#06182B]/90 p-5 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5 max-w-3xl">
            <h4 className="font-serif text-lg sm:text-xl font-bold text-white">
              {selectedNode.detailTitle}
            </h4>
            <p className="text-sm sm:text-[15px] leading-relaxed text-slate-200">
              {selectedNode.detailBody}
            </p>
          </div>
          <div className="rounded-lg border border-[rgba(212,168,67,0.38)] bg-[#0B2340] px-4 py-3 lg:max-w-sm shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E5B552]">
              Governance Principle
            </p>
            <p className="mt-1 text-xs sm:text-[13px] font-medium leading-relaxed text-slate-100">
              {selectedNode.governanceNote}
            </p>
          </div>
        </div>

        {/* Conceptual Illustration Distinction */}
        <p className="border-t border-[rgba(148,163,184,0.14)] pt-3 text-xs leading-relaxed text-slate-400">
          Visual transparency model illustrating Destria&apos;s controlled workflow stages and auditability principles. Client tax records are managed in secure enterprise systems and are not stored on a public blockchain.
        </p>
      </div>
    </div>
  );
};
