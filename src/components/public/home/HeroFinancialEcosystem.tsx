import React, { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  FileSearch,
  ShieldCheck,
  Calculator,
  Scale,
  Link2,
  UserCheck,
  HardDrive,
  Pause,
  Play,
} from 'lucide-react';
import { BRAND_ASSETS } from '../../../utils/assets';
import { COMPANY_BRANDING } from '../../../config/companyBranding';
import { useInViewMotion } from './useInViewMotion';

interface EcosystemNode {
  id: string;
  label: string;
  shortLabel: string;
  angleDeg: number;
  icon: React.ComponentType<{ className?: string }>;
  role: string;
  oversight: string;
}

const ECOSYSTEM_NODES: EcosystemNode[] = [
  {
    id: 'ai-intelligence',
    label: 'AI Financial Intelligence',
    shortLabel: 'AI Intelligence',
    angleDeg: -90,
    icon: BrainCircuit,
    role: 'Structures multi-document financial intake and highlights relevant tax items for practitioner review.',
    oversight: 'AI-assisted organization · Practitioner supervised',
  },
  {
    id: 'doc-processing',
    label: 'Tax Document Processing',
    shortLabel: 'Document Intake',
    angleDeg: -45,
    icon: FileSearch,
    role: 'Organizes W-2s, 1099s, K-1s, and financial statements into a structured client workpaper index.',
    oversight: 'Structured intake · Human verification',
  },
  {
    id: 'data-validation',
    label: 'Financial Data Validation',
    shortLabel: 'Data Validation',
    angleDeg: 0,
    icon: ShieldCheck,
    role: 'Checks mathematical consistency and flags missing statements or cross-form variances early.',
    oversight: 'Automated cross-checks · Preparer sign-off',
  },
  {
    id: 'intelligent-accounting',
    label: 'Intelligent Accounting',
    shortLabel: 'Accounting',
    angleDeg: 45,
    icon: Calculator,
    role: 'Aligns general ledger activity, trial balances, and book-to-tax schedules across reporting periods.',
    oversight: 'Structured ledger workflows · Dual review',
  },
  {
    id: 'tax-compliance',
    label: 'Tax Compliance',
    shortLabel: 'Tax Compliance',
    angleDeg: 90,
    icon: Scale,
    role: 'Maps validated financial data against federal and state reporting rules for individual and entity returns.',
    oversight: 'Statutory review · Credentialed oversight',
  },
  {
    id: 'integrity-verification',
    label: 'Integrity Verification',
    shortLabel: 'Audit Trace',
    angleDeg: 135,
    icon: Link2,
    role: 'Applies cryptographic hashing and sequential audit-trail concepts to document custody and workpapers.',
    oversight: 'Tamper-evident record concepts · Traceable logs',
  },
  {
    id: 'human-review',
    label: 'Human Professional Review',
    shortLabel: 'Human Review',
    angleDeg: 180,
    icon: UserCheck,
    role: 'Every return, advisory recommendation, and filing decision requires review by qualified tax professionals.',
    oversight: 'Independent reviewer · Client authorization',
  },
  {
    id: 'secure-storage',
    label: 'Secure Digital Storage',
    shortLabel: 'Digital Vault',
    angleDeg: 225,
    icon: HardDrive,
    role: 'Maintains role-based access controls and organized document custody for sensitive client records.',
    oversight: 'Access-controlled vault · Client isolation',
  },
];

// Coordinates on a 520x520 SVG stage centered at (260, 260)
const CENTER = 260;
const ORBIT_RADIUS = 196;

function polarToCartesian(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

export const HeroFinancialEcosystem: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useInViewMotion(containerRef);
  const [activeIndex, setActiveIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);

  const isRunning = shouldAnimate && !userPaused;

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ECOSYSTEM_NODES.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const activeNode = ECOSYSTEM_NODES[activeIndex];

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl bg-[#091F38]/90 border border-[#D4A843]/30 p-4 sm:p-6 shadow-2xl overflow-hidden ${
        !isRunning ? 'destria-motion-paused' : ''
      }`}
      aria-label="Interactive Financial Intelligence Ecosystem"
    >
      {/* Subtle architectural corner glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#3B82F6]/12 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[#D4A843]/12 blur-3xl"
        aria-hidden="true"
      />

      {/* Top Caption Bar */}
      <div className="relative z-10 flex items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white tracking-wide truncate">
            Financial Intelligence Ecosystem
          </div>
          <div className="text-[11px] text-[#A9B7C8] truncate">
            {COMPANY_BRANDING.displayName} · Columbia, SC
          </div>
        </div>
        <button
          type="button"
          onClick={() => setUserPaused((p) => !p)}
          aria-pressed={userPaused}
          aria-label={userPaused ? 'Resume ecosystem animation' : 'Pause ecosystem animation'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-200 bg-[#06182B] hover:bg-[#102D4F] border border-slate-700/80 transition-colors whitespace-nowrap shrink-0"
        >
          {userPaused ? <Play className="w-3.5 h-3.5 text-[#D4A843]" /> : <Pause className="w-3.5 h-3.5 text-[#D4A843]" />}
          <span>{userPaused ? 'Resume' : 'Pause'}</span>
        </button>
      </div>

      {/* Main Orbital Visualization Stage */}
      <div className="relative my-3 mx-auto w-full max-w-[460px] aspect-square select-none">
        {/* Background SVG Rings, Pathways & Flowing Data Particles */}
        <svg
          viewBox="0 0 520 520"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="destriaCoreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D4A843" stopOpacity="0.22" />
              <stop offset="52%" stopColor="#3B82F6" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#06182B" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="destriaGoldArc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E5B552" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#D4A843" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="destriaBlueArc" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.7" />
              <stop offset="60%" stopColor="#3B82F6" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#D4A843" stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {/* Soft ambient halo */}
          <circle cx={CENTER} cy={CENTER} r={220} fill="url(#destriaCoreGlow)" />

          {/* Outer slowly rotating gold & blue technical ring */}
          <g className="destria-orbit-slow">
            <circle
              cx={CENTER}
              cy={CENTER}
              r={ORBIT_RADIUS}
              fill="none"
              stroke="url(#destriaGoldArc)"
              strokeWidth="1.25"
              strokeDasharray="10 8"
            />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={ORBIT_RADIUS + 18}
              fill="none"
              stroke="rgba(148,163,184,0.16)"
              strokeWidth="1"
              strokeDasharray="2 10"
            />
          </g>

          {/* Mid counter-rotating architectural blue ring */}
          <g className="destria-orbit-reverse">
            <circle
              cx={CENTER}
              cy={CENTER}
              r={148}
              fill="none"
              stroke="url(#destriaBlueArc)"
              strokeWidth="1.5"
              strokeDasharray="42 22 14 22"
            />
          </g>

          {/* Inner rotating precision scanning arc */}
          <g className="destria-orbit-inner">
            <circle
              cx={CENTER}
              cy={CENTER}
              r={116}
              fill="none"
              stroke="#D4A843"
              strokeOpacity="0.48"
              strokeWidth="1.25"
              strokeDasharray="28 60"
            />
          </g>

          {/* Connection lines & animated particles from each node to central emblem */}
          {ECOSYSTEM_NODES.map((node, idx) => {
            const pos = polarToCartesian(node.angleDeg, ORBIT_RADIUS);
            const inner = polarToCartesian(node.angleDeg, 108);
            const isActive = idx === activeIndex;
            const pathD = `M ${pos.x} ${pos.y} L ${inner.x} ${inner.y}`;

            return (
              <g key={node.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isActive ? '#E5B552' : 'rgba(148, 163, 184, 0.24)'}
                  strokeWidth={isActive ? '2' : '1'}
                  className={isActive ? 'destria-dash-animate' : undefined}
                />
                {/* Subtle orbital chord to next node */}
                {(() => {
                  const next = ECOSYSTEM_NODES[(idx + 1) % ECOSYSTEM_NODES.length];
                  const nextPos = polarToCartesian(next.angleDeg, ORBIT_RADIUS);
                  return (
                    <line
                      x1={pos.x}
                      y1={pos.y}
                      x2={nextPos.x}
                      y2={nextPos.y}
                      stroke="rgba(96, 165, 250, 0.14)"
                      strokeWidth="1"
                    />
                  );
                })()}
                {/* Traveling particle on active & opposite node when animating */}
                {isRunning && (isActive || idx === (activeIndex + 4) % ECOSYSTEM_NODES.length) && (
                  <circle r={isActive ? '4' : '2.8'} fill={isActive ? '#E5B552' : '#60A5FA'}>
                    <animateMotion
                      dur={isActive ? '2.2s' : '3.2s'}
                      repeatCount="indefinite"
                      path={pathD}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Preserved Official Circular Destria Emblem at Exact Center */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="false"
        >
          <div className="relative flex items-center justify-center w-[42%] aspect-square rounded-full">
            <img
              id="home-hero-destria-logo"
              src={BRAND_ASSETS.destriaLogoHero}
              alt="Destria Tax Services, LLC — Official Circular Corporate Emblem"
              width={216}
              height={216}
              className="destria-brand-emblem w-full h-full aspect-square object-contain block"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>

        {/* 8 Interactive Technological Nodes Around the Orbital Ring */}
        {ECOSYSTEM_NODES.map((node, idx) => {
          const pos = polarToCartesian(node.angleDeg, ORBIT_RADIUS);
          const leftPct = (pos.x / 520) * 100;
          const topPct = (pos.y / 520) * 100;
          const isActive = idx === activeIndex;
          const IconComp = node.icon;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              onMouseEnter={() => setActiveIndex(idx)}
              aria-label={`${node.label}: ${node.role}`}
              aria-pressed={isActive}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group focus:outline-none z-10`}
            >
              <span
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border transition-all duration-200 ${
                  isActive
                    ? 'bg-[#102D4F] border-[#E5B552] text-[#E5B552] shadow-[0_0_20px_rgba(212,168,67,0.32)] scale-110'
                    : 'bg-[#06182B]/95 border-slate-700/90 text-slate-300 hover:border-[#D4A843]/70 hover:text-white'
                }`}
              >
                <IconComp className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </span>
              <span
                className={`hidden sm:block text-[10px] font-semibold tracking-tight px-1.5 py-0.5 rounded bg-[#06182B]/90 whitespace-nowrap transition-colors ${
                  isActive ? 'text-[#E5B552]' : 'text-slate-300 group-hover:text-white'
                }`}
              >
                {node.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Node Inspector Strip */}
      <div
        className="relative z-10 rounded-xl bg-[#06182B]/95 border border-slate-700/75 p-3.5 sm:p-4 space-y-1.5 transition-colors"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-semibold text-white">
            {activeNode.label}
          </div>
          <div className="text-[11px] font-medium text-[#E5B552]">
            {activeNode.oversight}
          </div>
        </div>
        <p className="text-xs text-[#A9B7C8] leading-relaxed">
          {activeNode.role}
        </p>
      </div>
    </div>
  );
};
