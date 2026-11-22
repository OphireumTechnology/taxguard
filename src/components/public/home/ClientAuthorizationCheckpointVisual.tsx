import React from 'react';
import {
  FileLock2,
  ClipboardCheck,
  FileSignature,
  Lock,
  ShieldCheck
} from 'lucide-react';

interface ClientAuthorizationCheckpointVisualProps {
  activeStageIndex: number;
  animate: boolean;
}

const CHECKPOINT_NODES = [
  {
    id: 'protected-doc',
    label: 'Protected Financial Document',
    sublabel: 'Structured Return Package',
    tone: 'cyan' as const,
    icon: FileLock2
  },
  {
    id: 'review-checkpoint',
    label: 'Verified Review Checkpoint',
    sublabel: 'Practitioner Quality Review',
    tone: 'gold' as const,
    icon: ClipboardCheck
  },
  {
    id: 'client-gate',
    label: 'Client Authorization Gate',
    sublabel: 'Required Client Decision',
    tone: 'gate' as const,
    icon: FileSignature
  },
  {
    id: 'final-processing',
    label: 'Final Professional Processing',
    sublabel: 'Locked Until Authorized',
    tone: 'locked' as const,
    icon: ShieldCheck
  }
] as const;

/**
 * Conceptual Client Authorization Gate visual illustrating that tax preparation
 * cannot advance to filing without explicit client authorization.
 * Non-interactive safeguard illustration — never simulates approval or filing.
 */
export const ClientAuthorizationCheckpointVisual: React.FC<
  ClientAuthorizationCheckpointVisualProps
> = ({ activeStageIndex, animate }) => {
  const isAuthStageHighlighted = activeStageIndex === 3;

  return (
    <div
      aria-label="Client authorization governance checkpoint illustration"
      className={`relative overflow-hidden rounded-2xl border bg-[#06182B]/90 p-5 sm:p-6 transition-colors duration-300 ${
        isAuthStageHighlighted
          ? 'border-[rgba(212,168,67,0.58)] shadow-[0_0_32px_rgba(56,189,248,0.1)]'
          : 'border-[rgba(148,163,184,0.2)]'
      } ${!animate ? 'destria-motion-paused' : ''}`}
    >
      {/* Top Gold-to-Cyan Accent Hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-400/50 via-[#E5B552] to-sky-400/35"
      />

      {/* Header Row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[rgba(148,163,184,0.16)]">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E5B552]">
            Stage 04 Authorization Control Gate
          </p>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-white">
            Explicit Client Decision Required Before Any Filing
          </h3>
        </div>
        <div className="inline-flex items-center gap-2 self-start sm:self-center rounded-lg border border-[rgba(212,168,67,0.35)] bg-[#0B223C] px-3 py-1.5 text-xs font-semibold text-[#E5B552]">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Controlled Release Gate</span>
        </div>
      </div>

      {/* Animated Conduit & Checkpoint Flow */}
      <div className="mt-5">
        {/* Desktop SVG Pathway: Active flow stops cleanly at the Client Authorization Gate */}
        <svg
          aria-hidden="true"
          viewBox="0 0 880 28"
          preserveAspectRatio="none"
          className="pointer-events-none mb-3 hidden h-7 w-full lg:block"
        >
          {/* Active pre-authorization flow (Protected Doc -> Review -> Authorization Gate) */}
          <line
            x1="80"
            y1="14"
            x2="585"
            y2="14"
            stroke="rgba(56, 189, 248, 0.28)"
            strokeWidth="1.5"
          />
          <line
            x1="80"
            y1="14"
            x2="585"
            y2="14"
            stroke="#38BDF8"
            strokeWidth="2"
            strokeLinecap="round"
            className="destria-neural-stream"
          />

          {/* Vertical checkpoint barrier line right at the Client Authorization Gate */}
          <line
            x1="585"
            y1="3"
            x2="585"
            y2="25"
            stroke="#E5B552"
            strokeWidth="2"
            className="destria-checkpoint-glow"
          />

          {/* Held / Gated downstream pathway until client authorization is granted */}
          <line
            x1="596"
            y1="14"
            x2="800"
            y2="14"
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />

          {/* Node points */}
          <circle cx="80" cy="14" r="3.5" fill="#38BDF8" />
          <circle cx="332" cy="14" r="3.5" fill="#E5B552" />
          <circle
            cx="585"
            cy="14"
            r="6"
            fill="#0D2745"
            stroke="#E5B552"
            strokeWidth="2"
            className="destria-checkpoint-glow"
          />
          <circle cx="800" cy="14" r="3.5" fill="#06182B" stroke="rgba(148,163,184,0.45)" strokeWidth="1.5" />
        </svg>

        {/* Four Checkpoint Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CHECKPOINT_NODES.map((node, index) => {
            const Icon = node.icon;
            const isGate = node.tone === 'gate';
            const isLocked = node.tone === 'locked';

            return (
              <div
                key={node.id}
                className={`rounded-xl border p-4 transition-colors ${
                  isGate
                    ? 'border-[rgba(212,168,67,0.65)] bg-gradient-to-b from-[#112F54] to-[#0B223C] shadow-[0_0_24px_rgba(212,168,67,0.14)]'
                    : isLocked
                      ? 'border-dashed border-[rgba(148,163,184,0.3)] bg-[#061628]/70'
                      : 'border-[rgba(148,163,184,0.2)] bg-[#091F38]/90'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                      isGate
                        ? 'border-[rgba(212,168,67,0.6)] bg-[#D4A843]/15 text-[#E5B552]'
                        : node.tone === 'cyan'
                          ? 'border-sky-400/35 bg-sky-400/10 text-sky-300'
                          : isLocked
                            ? 'border-slate-700 bg-[#06182B] text-slate-400'
                            : 'border-[rgba(212,168,67,0.35)] bg-[#D4A843]/10 text-[#E5B552]'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-xs text-slate-400">0{index + 1}</span>
                </div>
                <p className="mt-3 text-sm font-bold text-white leading-snug">{node.label}</p>
                <p
                  className={`mt-1 text-xs leading-relaxed ${
                    isGate ? 'font-medium text-[#E5B552]' : 'text-slate-400'
                  }`}
                >
                  {node.sublabel}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prominent Mandatory Governance Rule */}
      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[rgba(212,168,67,0.35)] bg-[#0A203A]/90 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-white">
          No return is finalized or transmitted without the required client authorization.
        </p>
        <span className="text-xs text-slate-400 shrink-0">
          Conceptual control illustration · Client approval occurs inside the authenticated portal
        </span>
      </div>
    </div>
  );
};
