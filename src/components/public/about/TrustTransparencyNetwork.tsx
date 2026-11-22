import React, { useState } from 'react';
import {
  Briefcase,
  Cpu,
  Eye,
  FileCheck2,
  Lock,
  Users,
} from 'lucide-react';

interface TrustNode {
  id: string;
  index: string;
  title: string;
  shortLabel: string;
  pillar: string;
  description: string;
  emphasis: string;
  icon: React.ComponentType<{ className?: string }>;
  side: 'left' | 'right';
}

const TRUST_NODES: TrustNode[] = [
  {
    id: 'tax_expertise',
    index: '01',
    title: 'Professional Tax Expertise',
    shortLabel: 'Tax Expertise',
    pillar: 'Advisory Foundation',
    description:
      'Seasoned tax and accounting specialists interpret federal, state, and business regulations with rigor tailored to each client engagement.',
    emphasis: 'Qualified professional judgment guides every filing and strategy.',
    icon: Briefcase,
    side: 'left',
  },
  {
    id: 'intelligent_tech',
    index: '02',
    title: 'Intelligent Financial Technology',
    shortLabel: 'Financial Technology',
    pillar: 'Modern Workflow Design',
    description:
      'Structured digital tools organize client records, streamline document preparation, and support clearer analytical review across tax seasons.',
    emphasis: 'Technology accelerates organization while preserving professional control.',
    icon: Cpu,
    side: 'left',
  },
  {
    id: 'secure_info',
    index: '03',
    title: 'Secure Information Management',
    shortLabel: 'Information Safeguards',
    pillar: 'Confidential Handling',
    description:
      'Sensitive tax documents, client records, and advisory communications are managed through disciplined digital intake and access controls.',
    emphasis: 'Designed for confidentiality across client and staff workspaces.',
    icon: Lock,
    side: 'left',
  },
  {
    id: 'transparent_processes',
    index: '04',
    title: 'Transparent Financial Processes',
    shortLabel: 'Transparent Processes',
    pillar: 'Traceable Clarity',
    description:
      'Every stage—from initial document intake through final review—is communicated clearly so clients understand how numbers and schedules connect.',
    emphasis: 'Clear upfront expectations without opaque calculations or hidden fees.',
    icon: Eye,
    side: 'right',
  },
  {
    id: 'human_accountability',
    index: '05',
    title: 'Human Review and Accountability',
    shortLabel: 'Human Oversight',
    pillar: 'Multi-Tiered Review',
    description:
      'Every tax return, financial statement, and advisory recommendation undergoes human review and direct professional accountability prior to delivery.',
    emphasis: 'Human advisors remain responsible for every conclusion and signature.',
    icon: FileCheck2,
    side: 'right',
  },
  {
    id: 'client_delivery',
    index: '06',
    title: 'Client-Focused Service Delivery',
    shortLabel: 'Client Delivery',
    pillar: 'Year-Round Partnership',
    description:
      'Advisory engagements are built around clear communication, responsive scheduling, and long-term guidance tailored to individuals and businesses.',
    emphasis: 'Accessible guidance designed for lasting financial confidence.',
    icon: Users,
    side: 'right',
  },
];

interface TrustTransparencyNetworkProps {
  shouldAnimate: boolean;
}

/**
 * Interactive conceptual Financial Intelligence & Transparency Network section
 * positioned between Executive Leadership and Core Values.
 */
export const TrustTransparencyNetwork: React.FC<TrustTransparencyNetworkProps> = ({
  shouldAnimate,
}) => {
  const [activeId, setActiveId] = useState<string>(TRUST_NODES[0].id);
  const activeNode = TRUST_NODES.find((n) => n.id === activeId) ?? TRUST_NODES[0];
  const leftNodes = TRUST_NODES.filter((n) => n.side === 'left');
  const rightNodes = TRUST_NODES.filter((n) => n.side === 'right');

  return (
    <section
      aria-labelledby="trust-transparency-heading"
      className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-3xl bg-[#07192E] border border-slate-700/55 p-6 sm:p-10 lg:p-12 shadow-2xl">
        {/* Subtle Architectural Background Grid & Calm Illumination */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 48%, rgba(212, 168, 67, 0.11), transparent 46%), radial-gradient(circle at 18% 20%, rgba(56, 189, 248, 0.06), transparent 36%), linear-gradient(to right, rgba(148, 163, 184, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.035) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
          }}
          aria-hidden="true"
        />

        {/* Section Header */}
        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-3 mb-10 lg:mb-12">
          <div className="text-xs font-bold tracking-[0.18em] uppercase text-[#E1BB60]">
            Transparent Service Architecture
          </div>
          <h2
            id="trust-transparency-heading"
            className="font-serif text-3xl sm:text-4xl lg:text-[2.5rem] font-bold text-white leading-tight"
            style={{ textWrap: 'balance' }}
          >
            Human Expertise. Intelligent Technology. Transparent Service.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Explore how Destria unites experienced tax professionals, structured digital workflows,
            and transparent client communication around a single standard of accountability.
          </p>
        </div>

        {/* Connected Network Architecture (Desktop 3-Column Hub + Mobile/Tablet Responsive Stack) */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-4 items-center">
          {/* Desktop Connecting Ledger Pathways SVG Behind Columns */}
          <svg
            viewBox="0 0 1200 420"
            preserveAspectRatio="none"
            className={`hidden lg:block pointer-events-none absolute inset-0 w-full h-full ${
              shouldAnimate ? '' : 'destria-motion-paused'
            }`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="trust-gold-stream" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D4A843" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#E5B552" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#D4A843" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="trust-cyan-stream" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.08" />
                <stop offset="50%" stopColor="#7DD3FC" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.08" />
              </linearGradient>
            </defs>

            {/* Left 3 nodes -> Center Core */}
            {[
              { id: 'tax_expertise', d: 'M 380 76 L 455 76 L 515 178 L 560 198', dur: '6.2s' },
              { id: 'intelligent_tech', d: 'M 380 210 L 555 210', dur: '5.4s' },
              { id: 'secure_info', d: 'M 380 344 L 455 344 L 515 242 L 560 222', dur: '6.8s' },
            ].map((p) => {
              const isSelected = activeId === p.id;
              return (
                <g key={p.id} fill="none">
                  <path
                    d={p.d}
                    stroke={isSelected ? 'rgba(229, 181, 82, 0.55)' : 'rgba(148, 163, 184, 0.2)'}
                    strokeWidth={isSelected ? '1.6' : '1'}
                  />
                  <path
                    d={p.d}
                    stroke={isSelected ? 'url(#trust-gold-stream)' : 'url(#trust-cyan-stream)'}
                    strokeWidth={isSelected ? '2' : '1.2'}
                    className="destria-ecosystem-stream"
                    style={{ animationDuration: p.dur }}
                  />
                </g>
              );
            })}

            {/* Center Core -> Right 3 nodes */}
            {[
              { id: 'transparent_processes', d: 'M 640 198 L 685 178 L 745 76 L 820 76', dur: '6.4s' },
              { id: 'human_accountability', d: 'M 645 210 L 820 210', dur: '5.6s' },
              { id: 'client_delivery', d: 'M 640 222 L 685 242 L 745 344 L 820 344', dur: '7.1s' },
            ].map((p) => {
              const isSelected = activeId === p.id;
              return (
                <g key={p.id} fill="none">
                  <path
                    d={p.d}
                    stroke={isSelected ? 'rgba(229, 181, 82, 0.55)' : 'rgba(148, 163, 184, 0.2)'}
                    strokeWidth={isSelected ? '1.6' : '1'}
                  />
                  <path
                    d={p.d}
                    stroke={isSelected ? 'url(#trust-gold-stream)' : 'url(#trust-cyan-stream)'}
                    strokeWidth={isSelected ? '2' : '1.2'}
                    className="destria-ecosystem-stream"
                    style={{ animationDuration: p.dur }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Left Capability Nodes */}
          <div className="lg:col-span-4 space-y-3.5 relative z-10">
            {leftNodes.map((node) => {
              const Icon = node.icon;
              const isSelected = node.id === activeId;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveId(node.id)}
                  aria-pressed={isSelected}
                  className={`w-full text-left rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0F2B4B] border-[#D4A843]/75 shadow-lg shadow-[#D4A843]/10'
                      : 'bg-[#0A203A]/85 border-slate-700/55 hover:border-[#D4A843]/40 hover:bg-[#0D2745]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? 'bg-[#D4A843]/15 border-[#D4A843]/60 text-[#E5B552]'
                          : 'bg-[#06182B] border-slate-700/60 text-[#D4A843]'
                      }`}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-[11px] font-semibold tracking-wider uppercase text-[#D4A843]/90">
                        {node.index} · {node.pillar}
                      </div>
                      <div className="font-serif text-base font-bold text-white leading-snug">
                        {node.title}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Central Abstract Financial Intelligence Core */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center py-4 lg:py-0 relative z-10">
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
              {/* Counter-rotating orbital verification rings */}
              <svg
                viewBox="0 0 260 260"
                className={`absolute inset-0 w-full h-full ${
                  shouldAnimate ? '' : 'destria-motion-paused'
                }`}
                aria-hidden="true"
              >
                <defs>
                  <radialGradient id="core-ambient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#D4A843" stopOpacity="0.22" />
                    <stop offset="60%" stopColor="#102D4F" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#06182B" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <circle cx="130" cy="130" r="122" fill="url(#core-ambient)" />

                {/* Outer slow gold orbital track */}
                <g className="destria-orbit-slow">
                  <circle
                    cx="130"
                    cy="130"
                    r="112"
                    fill="none"
                    stroke="#D4A843"
                    strokeOpacity="0.34"
                    strokeWidth="1"
                    strokeDasharray="6 10"
                  />
                  <circle cx="130" cy="18" r="3.5" fill="#E5B552" />
                  <circle cx="242" cy="130" r="2.5" fill="#7DD3FC" />
                  <circle cx="130" cy="242" r="3" fill="#D4A843" />
                </g>

                {/* Middle reverse sapphire ring */}
                <g className="destria-orbit-reverse">
                  <circle
                    cx="130"
                    cy="130"
                    r="88"
                    fill="none"
                    stroke="#7DD3FC"
                    strokeOpacity="0.28"
                    strokeWidth="1"
                    strokeDasharray="16 14"
                  />
                  <rect
                    x="126"
                    y="38"
                    width="8"
                    height="8"
                    rx="1.5"
                    fill="#071A2E"
                    stroke="#E5B552"
                    strokeWidth="1.2"
                  />
                </g>

                {/* Inner geometric ledger octagon */}
                <polygon
                  points="130,62 178,82 198,130 178,178 130,198 82,178 62,130 82,82"
                  fill="rgba(7, 25, 46, 0.88)"
                  stroke="#D4A843"
                  strokeOpacity="0.55"
                  strokeWidth="1.2"
                />
              </svg>

              {/* Center Core Label */}
              <div className="relative z-10 text-center px-6 space-y-1.5">
                <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#E1BB60]">
                  Destria Standard
                </div>
                <div className="font-serif text-lg sm:text-xl font-bold text-white leading-tight">
                  Financial Intelligence Core
                </div>
                <div className="text-[11px] text-slate-300">
                  Verified · Traceable · Guided
                </div>
              </div>
            </div>
          </div>

          {/* Right Capability Nodes */}
          <div className="lg:col-span-4 space-y-3.5 relative z-10">
            {rightNodes.map((node) => {
              const Icon = node.icon;
              const isSelected = node.id === activeId;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveId(node.id)}
                  aria-pressed={isSelected}
                  className={`w-full text-left rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0F2B4B] border-[#D4A843]/75 shadow-lg shadow-[#D4A843]/10'
                      : 'bg-[#0A203A]/85 border-slate-700/55 hover:border-[#D4A843]/40 hover:bg-[#0D2745]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? 'bg-[#D4A843]/15 border-[#D4A843]/60 text-[#E5B552]'
                          : 'bg-[#06182B] border-slate-700/60 text-[#D4A843]'
                      }`}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-[11px] font-semibold tracking-wider uppercase text-[#D4A843]/90">
                        {node.index} · {node.pillar}
                      </div>
                      <div className="font-serif text-base font-bold text-white leading-snug">
                        {node.title}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Node Architectural Detail Strip */}
        <div
          aria-live="polite"
          className="relative z-10 mt-8 rounded-2xl bg-[#051426]/90 border border-[#D4A843]/30 p-5 sm:p-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-4 space-y-1">
              <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#E1BB60]">
                Selected Pillar {activeNode.index} · {activeNode.pillar}
              </div>
              <h3 className="font-serif text-xl font-bold text-white">{activeNode.title}</h3>
            </div>
            <div className="lg:col-span-8 space-y-1.5">
              <p className="text-sm text-slate-200 leading-relaxed">{activeNode.description}</p>
              <p className="text-xs font-medium text-[#E1BB60]/90">{activeNode.emphasis}</p>
            </div>
          </div>
        </div>

        {/* Truthful Conceptual Visualization Disclosure */}
        <p className="relative z-10 mt-5 text-center text-[11px] text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Conceptual service visualization illustrating Destria Tax Services, LLC&apos;s commitment
          to structured documentation, transparent communication, and professional human review.
          This architectural diagram does not represent an operational blockchain network,
          uncommissioned automated agents, or third-party compliance certifications.
        </p>
      </div>
    </section>
  );
};
