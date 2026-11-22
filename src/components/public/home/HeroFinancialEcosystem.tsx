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
    role: 'Structures multi-document financial intake and surfaces relevant tax positions for practitioner review.',
    oversight: 'AI-Assisted · Practitioner Supervised',
  },
  {
    id: 'doc-processing',
    label: 'Tax Document Processing',
    shortLabel: 'Document Intake',
    angleDeg: -45,
    icon: FileSearch,
    role: 'Organizes W-2s, 1099s, K-1s, and financial statements into a structured client workpaper index.',
    oversight: 'Structured Intake · Human Verification',
  },
  {
    id: 'data-validation',
    label: 'Financial Data Validation',
    shortLabel: 'Data Validation',
    angleDeg: 0,
    icon: ShieldCheck,
    role: 'Verifies mathematical consistency and identifies missing statements or cross-form variances early.',
    oversight: 'Automated Cross-Checks · Preparer Sign-Off',
  },
  {
    id: 'intelligent-accounting',
    label: 'Intelligent Accounting',
    shortLabel: 'Accounting',
    angleDeg: 45,
    icon: Calculator,
    role: 'Aligns general ledger activity, trial balances, and book-to-tax schedules across reporting periods.',
    oversight: 'Structured Ledger · Dual Review',
  },
  {
    id: 'tax-compliance',
    label: 'Tax Compliance',
    shortLabel: 'Tax Compliance',
    angleDeg: 90,
    icon: Scale,
    role: 'Maps validated financial figures against federal and state reporting rules for individual and entity filings.',
    oversight: 'Statutory Review · Credentialed Oversight',
  },
  {
    id: 'integrity-verification',
    label: 'Integrity Verification',
    shortLabel: 'Ledger Integrity',
    angleDeg: 135,
    icon: Link2,
    role: 'Applies cryptographic hashing and sequential audit-trail architecture to document custody and workpapers.',
    oversight: 'Cryptographic Trace · Audit Continuity',
  },
  {
    id: 'human-review',
    label: 'Human Professional Review',
    shortLabel: 'Human Review',
    angleDeg: 180,
    icon: UserCheck,
    role: 'Every return, advisory recommendation, and filing authorization requires qualified professional sign-off.',
    oversight: 'Independent Reviewer · Client Authorization',
  },
  {
    id: 'secure-storage',
    label: 'Secure Digital Vault',
    shortLabel: 'Digital Vault',
    angleDeg: 225,
    icon: HardDrive,
    role: 'Maintains role-based access controls and isolated digital custody for confidential client records.',
    oversight: 'Access-Controlled Vault · Client Isolation',
  },
];

// Coordinates on a 560x560 stage centered at (280, 280) for generous label clearance
const STAGE_SIZE = 560;
const CENTER = 280;
const ORBIT_RADIUS = 204;
const INNER_RING_RADIUS = 110;

function polarToCartesian(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

// Secondary neural cross-chords (connect nodes across the network for subtle AI & blockchain depth)
const NEURAL_CHORDS: Array<[number, number]> = [
  [0, 2],
  [2, 4],
  [4, 6],
  [6, 0],
  [1, 3],
  [3, 5],
  [5, 7],
  [7, 1],
];

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
    }, 3800);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const activeNode = ECOSYSTEM_NODES[activeIndex];
  const ActiveIcon = activeNode.icon;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center select-none ${
        !isRunning ? 'destria-motion-paused' : ''
      }`}
      aria-label="Interactive Financial Intelligence Ecosystem"
    >
      {/* Seamless Atmospheric Depth Halo (No Heavy Rectangular Box) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-visible"
        aria-hidden="true"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] h-[82%] rounded-full bg-[radial-gradient(circle,rgba(212,168,67,0.13)_0%,rgba(59,130,246,0.09)_46%,rgba(6,24,43,0)_74%)] blur-2xl" />
      </div>

      {/* Subtle Top Utility Strip: Ecosystem Title + Accessible Motion Pause Control */}
      <div className="w-full max-w-[500px] flex items-center justify-between gap-3 px-1 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-px w-5 bg-gradient-to-r from-[#D4A843] to-transparent flex-shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-medium tracking-[0.14em] uppercase text-[#A9B7C8] truncate">
            Financial Intelligence Ecosystem
          </span>
        </div>
        <button
          type="button"
          onClick={() => setUserPaused((p) => !p)}
          aria-pressed={userPaused}
          aria-label={userPaused ? 'Resume ecosystem animation' : 'Pause ecosystem animation'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white bg-[#0A203B]/70 hover:bg-[#102D4F]/90 border border-slate-700/60 hover:border-[#D4A843]/50 transition-colors duration-150 whitespace-nowrap shrink-0"
        >
          {userPaused ? (
            <Play className="w-3 h-3 text-[#E5B552]" />
          ) : (
            <Pause className="w-3 h-3 text-[#E5B552]" />
          )}
          <span>{userPaused ? 'Resume' : 'Pause'}</span>
        </button>
      </div>

      {/* Seamless Orbital Network Stage */}
      <div className="relative mx-auto w-full max-w-[490px] xl:max-w-[520px] aspect-square">
        <svg
          viewBox={`0 0 ${STAGE_SIZE} ${STAGE_SIZE}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="destriaEcosystemCoreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E5B552" stopOpacity="0.22" />
              <stop offset="44%" stopColor="#3B82F6" stopOpacity="0.11" />
              <stop offset="76%" stopColor="#1D4ED8" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#06182B" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="destriaGoldOrbit" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E5B552" stopOpacity="0.82" />
              <stop offset="50%" stopColor="#D4A843" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="destriaBlueOrbit" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#3B82F6" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#E5B552" stopOpacity="0.52" />
            </linearGradient>
            <filter id="destriaNodeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Soft core depth glow */}
          <circle cx={CENTER} cy={CENTER} r={242} fill="url(#destriaEcosystemCoreGlow)" />

          {/* Outer precision calibration ring (slow clockwise) */}
          <g className="destria-orbit-slow">
            <circle
              cx={CENTER}
              cy={CENTER}
              r={ORBIT_RADIUS + 26}
              fill="none"
              stroke="rgba(148, 163, 184, 0.14)"
              strokeWidth="0.9"
              strokeDasharray="2 11"
            />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={ORBIT_RADIUS}
              fill="none"
              stroke="url(#destriaGoldOrbit)"
              strokeWidth="1.25"
              strokeDasharray="12 8"
            />
          </g>

          {/* Intermediate counter-rotating neural/blockchain ring */}
          <g className="destria-orbit-reverse">
            <circle
              cx={CENTER}
              cy={CENTER}
              r={154}
              fill="none"
              stroke="url(#destriaBlueOrbit)"
              strokeWidth="1.35"
              strokeDasharray="36 20 10 20"
            />
          </g>

          {/* Inner scanning precision halo around central Destria logo */}
          <g className="destria-orbit-inner">
            <circle
              cx={CENTER}
              cy={CENTER}
              r={INNER_RING_RADIUS + 8}
              fill="none"
              stroke="#E5B552"
              strokeOpacity="0.45"
              strokeWidth="1.2"
              strokeDasharray="24 54"
            />
          </g>

          {/* Subtle neural-network cross-chords connecting technology capabilities */}
          {NEURAL_CHORDS.map(([fromIdx, toIdx]) => {
            const p1 = polarToCartesian(ECOSYSTEM_NODES[fromIdx].angleDeg, ORBIT_RADIUS);
            const p2 = polarToCartesian(ECOSYSTEM_NODES[toIdx].angleDeg, ORBIT_RADIUS);
            const chordActive = fromIdx === activeIndex || toIdx === activeIndex;
            const chordPath = `M ${p1.x} ${p1.y} Q ${CENTER} ${CENTER} ${p2.x} ${p2.y}`;
            return (
              <g key={`${fromIdx}-${toIdx}`}>
                <path
                  d={chordPath}
                  fill="none"
                  stroke={chordActive ? 'rgba(96, 165, 250, 0.32)' : 'rgba(96, 165, 250, 0.08)'}
                  strokeWidth={chordActive ? '1.1' : '0.75'}
                  className={chordActive ? 'destria-neural-stream' : undefined}
                />
              </g>
            );
          })}

          {/* Blockchain-inspired outer perimeter pathways & spoke data streams */}
          {ECOSYSTEM_NODES.map((node, idx) => {
            const pos = polarToCartesian(node.angleDeg, ORBIT_RADIUS);
            const inner = polarToCartesian(node.angleDeg, INNER_RING_RADIUS);
            const next = ECOSYSTEM_NODES[(idx + 1) % ECOSYSTEM_NODES.length];
            const nextPos = polarToCartesian(next.angleDeg, ORBIT_RADIUS);

            const isActive = idx === activeIndex;
            const isOpposite = idx === (activeIndex + 4) % ECOSYSTEM_NODES.length;
            const spokePath = `M ${pos.x} ${pos.y} L ${inner.x} ${inner.y}`;
            const perimeterPath = `M ${pos.x} ${pos.y} L ${nextPos.x} ${nextPos.y}`;

            return (
              <g key={node.id}>
                {/* Perimeter blockchain transaction link */}
                <path
                  d={perimeterPath}
                  fill="none"
                  stroke={isActive ? 'rgba(229, 181, 82, 0.42)' : 'rgba(96, 165, 250, 0.14)'}
                  strokeWidth={isActive ? '1.25' : '0.85'}
                />

                {/* Radial financial intelligence spoke to central Destria emblem */}
                <path
                  d={spokePath}
                  fill="none"
                  stroke={isActive ? '#E5B552' : 'rgba(148, 163, 184, 0.22)'}
                  strokeWidth={isActive ? '1.85' : '0.9'}
                  className={isActive ? 'destria-dash-animate' : undefined}
                />

                {/* Flowing gold data packet along active spoke */}
                {isRunning && isActive && (
                  <>
                    <circle r="3.6" fill="#E5B552" filter="url(#destriaNodeGlow)">
                      <animateMotion dur="2.1s" repeatCount="indefinite" path={spokePath} />
                    </circle>
                    <circle r="2.4" fill="#93C5FD" filter="url(#destriaNodeGlow)">
                      <animateMotion dur="2.8s" repeatCount="indefinite" path={perimeterPath} />
                    </circle>
                  </>
                )}

                {/* Secondary sapphire blue packet on opposite node for balanced continuous flow */}
                {isRunning && isOpposite && (
                  <circle r="2.6" fill="#60A5FA" filter="url(#destriaNodeGlow)">
                    <animateMotion dur="3.1s" repeatCount="indefinite" path={spokePath} />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Central Official Destria Circular Corporate Logo — Preserved Intact, Uncropped */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="false"
        >
          <div className="relative flex items-center justify-center w-[39%] aspect-square rounded-full">
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

        {/* 8 Interactive Financial Technology Nodes */}
        {ECOSYSTEM_NODES.map((node, idx) => {
          const pos = polarToCartesian(node.angleDeg, ORBIT_RADIUS);
          const leftPct = (pos.x / STAGE_SIZE) * 100;
          const topPct = (pos.y / STAGE_SIZE) * 100;
          const isActive = idx === activeIndex;
          const IconComp = node.icon;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              onMouseEnter={() => setActiveIndex(idx)}
              onFocus={() => setActiveIndex(idx)}
              aria-label={`${node.label}: ${node.role}`}
              aria-pressed={isActive}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 group focus:outline-none z-10 cursor-pointer"
            >
              <span
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border backdrop-blur-md transition-all duration-200 ${
                  isActive
                    ? 'bg-[#102D4F]/95 border-[#E5B552] text-[#E5B552] shadow-[0_0_24px_rgba(212,168,67,0.34)] scale-110'
                    : 'bg-[#071A2E]/90 border-slate-700/80 text-slate-300 group-hover:border-[#D4A843]/75 group-hover:text-white group-hover:scale-105'
                }`}
              >
                <IconComp className="w-4 h-4 sm:w-[17px] sm:h-[17px]" />
              </span>
              <span
                className={`hidden sm:block text-[10.5px] font-medium tracking-tight px-2 py-0.5 rounded bg-[#06182B]/85 backdrop-blur-sm whitespace-nowrap transition-colors duration-150 ${
                  isActive
                    ? 'text-[#E5B552]'
                    : 'text-slate-300/90 group-hover:text-white'
                }`}
              >
                {node.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Integrated Hairline Active Capability Caption (Clean, Unboxed Depth) */}
      <div
        className="w-full max-w-[500px] mt-1 pt-3.5 border-t border-slate-700/50 transition-opacity duration-200"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="inline-flex items-center gap-2 text-xs sm:text-[13px] font-semibold text-white">
            <ActiveIcon className="w-3.5 h-3.5 text-[#E5B552] flex-shrink-0" />
            <span>{activeNode.label}</span>
          </div>
          <span className="text-[11px] font-medium text-[#E5B552]/90">
            {activeNode.oversight}
          </span>
        </div>
        <p className="text-xs text-[#A9B7C8] leading-relaxed">
          {activeNode.role}
        </p>
      </div>
    </div>
  );
};
