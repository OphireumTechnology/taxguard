import React, { useRef, useState } from 'react';
import {
  KeyRound,
  UserCog,
  ShieldCheck,
  FolderLock,
  FileClock,
  Lock,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useInViewMotion } from './useInViewMotion';

interface SecurityLayer {
  id: string;
  title: string;
  summary: string;
  controlNote: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECURITY_LAYERS: SecurityLayer[] = [
  {
    id: 'auth',
    title: 'Secure Authentication',
    summary: 'Dedicated client and staff sign-in boundaries with session controls designed to verify user identity before granting access.',
    controlNote: 'Multi-factor authentication workflows for authorized personnel',
    icon: KeyRound,
  },
  {
    id: 'rbac',
    title: 'Role-Based Access Controls',
    summary: 'Strict separation between client accounts, preparers, independent reviewers, practice managers, and administrators.',
    controlNote: 'Server-enforced permissions per practice role',
    icon: UserCog,
  },
  {
    id: 'confidentiality',
    title: 'Confidential Financial Information',
    summary: 'Client tax records are isolated per taxpayer engagement so individuals and businesses view only their authorized information.',
    controlNote: 'Scoped client data boundaries across portal reads',
    icon: ShieldCheck,
  },
  {
    id: 'doc-access',
    title: 'Document Access Management',
    summary: 'Structured vault intake and controlled download authorization replace unsecured email attachments for sensitive tax forms.',
    controlNote: 'Authorized document handling & version tracking',
    icon: FolderLock,
  },
  {
    id: 'audit-trail',
    title: 'Audit Trail Integrity',
    summary: 'Key workflow actions, review milestones, and administrative access events are logged chronologically for internal accountability.',
    controlNote: 'Traceable operational & security event records',
    icon: FileClock,
  },
  {
    id: 'privacy',
    title: 'Financial Privacy',
    summary: 'Client nonpublic personal financial information is handled in accordance with Gramm-Leach-Bliley Act (GLBA) and IRC Section 7216 principles.',
    controlNote: 'Published privacy policy & formal consent workflows',
    icon: Lock,
  },
  {
    id: 'oversight',
    title: 'Human Oversight',
    summary: 'Administrative safeguards and dual-layer professional review ensure technology supports—never bypasses—qualified human judgment.',
    controlNote: 'Independent review & maker-checker discipline',
    icon: Eye,
  },
];

export const SecurityArchitectureSection: React.FC = () => {
  const { setCurrentPage } = useApp();
  const sectionRef = useRef<HTMLElement>(null);
  const { shouldAnimate } = useInViewMotion(sectionRef);
  const [selectedId, setSelectedId] = useState(SECURITY_LAYERS[0].id);

  const selectedLayer =
    SECURITY_LAYERS.find((layer) => layer.id === selectedId) ?? SECURITY_LAYERS[0];

  return (
    <section
      ref={sectionRef}
      id="security-privacy"
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-28 ${!shouldAnimate ? 'destria-motion-paused' : ''}`}
      aria-labelledby="security-heading"
    >
      <div className="rounded-2xl bg-[#0A213C] border border-slate-700/70 p-6 sm:p-8 lg:p-10 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left: Layered Shield Architecture SVG Visualization */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative rounded-2xl bg-[#06182B] border border-slate-800 p-6 flex flex-col items-center justify-center overflow-hidden">
              <svg
                viewBox="0 0 320 300"
                className="w-full max-w-[300px] h-auto"
                role="img"
                aria-label="Layered financial data protection visualization"
              >
                <defs>
                  <radialGradient id="shieldHalo" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#D4A843" stopOpacity="0.22" />
                    <stop offset="65%" stopColor="#3B82F6" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#06182B" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <circle cx="160" cy="150" r="132" fill="url(#shieldHalo)" />

                {/* Outer Defense Ring */}
                <g className="destria-orbit-slow">
                  <circle
                    cx="160"
                    cy="150"
                    r="118"
                    fill="none"
                    stroke="rgba(212,168,67,0.38)"
                    strokeWidth="1.25"
                    strokeDasharray="8 8"
                  />
                </g>

                {/* Middle Access Control Ring */}
                <g className="destria-orbit-reverse">
                  <circle
                    cx="160"
                    cy="150"
                    r="88"
                    fill="none"
                    stroke="rgba(96,165,250,0.42)"
                    strokeWidth="1.25"
                    strokeDasharray="24 14"
                  />
                </g>

                {/* Inner Custody Ring */}
                <circle
                  cx="160"
                  cy="150"
                  r="60"
                  fill="none"
                  stroke="rgba(212,168,67,0.28)"
                  strokeWidth="1"
                />

                {/* Animated Data Pathways into the Shield */}
                {[
                  'M 32 70 L 122 126',
                  'M 288 70 L 198 126',
                  'M 32 230 L 122 174',
                  'M 288 230 L 198 174',
                ].map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke="rgba(212,168,67,0.45)"
                    strokeWidth="1.25"
                    className="destria-dash-animate"
                  />
                ))}

                {/* Central Shield Crest */}
                <path
                  d="M160 96 L204 114 V154 C204 184 184 206 160 218 C136 206 116 184 116 154 V114 Z"
                  fill="#0D2745"
                  stroke="#E5B552"
                  strokeWidth="2"
                />
                <path
                  d="M160 110 L192 123 V152 C192 174 177 191 160 201 C143 191 128 174 128 152 V123 Z"
                  fill="none"
                  stroke="rgba(96,165,250,0.45)"
                  strokeWidth="1.25"
                />
                {/* Lock Glyph Inside Shield */}
                <rect x="148" y="150" width="24" height="19" rx="3" fill="#E5B552" />
                <path
                  d="M153 150 V142 C153 137 156 134 160 134 C164 134 167 137 167 142 V150"
                  fill="none"
                  stroke="#E5B552"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="160" cy="159" r="2.5" fill="#06182B" />

                {/* Perimeter Security Nodes */}
                {[
                  { cx: 32, cy: 70 },
                  { cx: 288, cy: 70 },
                  { cx: 32, cy: 230 },
                  { cx: 288, cy: 230 },
                ].map((pt, idx) => (
                  <circle key={idx} cx={pt.cx} cy={pt.cy} r="5" fill="#0D2745" stroke="#E5B552" strokeWidth="1.5" />
                ))}
              </svg>

              {/* Selected Layer Readout */}
              <div className="w-full pt-4 border-t border-slate-800 space-y-1.5 text-left" aria-live="polite">
                <div className="text-xs font-semibold text-[#E5B552]">{selectedLayer.title}</div>
                <p className="text-xs text-[#A9B7C8] leading-relaxed">{selectedLayer.summary}</p>
                <div className="text-[11px] text-slate-400">{selectedLayer.controlNote}</div>
              </div>
            </div>
          </div>

          {/* Right: 7 Layered Safeguard Controls */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.14em] text-[#E5B552] uppercase">
                Financial Security &amp; Privacy
              </p>
              <h2
                id="security-heading"
                className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
              >
                Layered Protection for Confidential Financial Records
              </h2>
              <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
                Our architecture emphasizes disciplined access controls, client isolation, auditable workflows, and regulatory financial privacy—never overstated with unverified external badges.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SECURITY_LAYERS.map((layer) => {
                const IconComp = layer.icon;
                const active = layer.id === selectedId;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setSelectedId(layer.id)}
                    aria-pressed={active}
                    className={`text-left rounded-xl p-3.5 border transition-all duration-200 flex items-start gap-3 ${
                      active
                        ? 'bg-[#102D4F] border-[#E5B552]'
                        : 'bg-[#06182B]/85 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        active
                          ? 'bg-[#06182B] border-[#E5B552]/60 text-[#E5B552]'
                          : 'bg-[#0A213C] border-slate-700 text-[#D4A843]'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-semibold text-white">{layer.title}</div>
                      <div className="text-[11px] text-[#A9B7C8] line-clamp-2 leading-relaxed">
                        {layer.controlNote}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Links to Full Security & Privacy Documentation */}
            <div className="flex flex-wrap items-center gap-5 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setCurrentPage('security')}
                className="inline-flex items-center gap-1.5 font-semibold text-[#E5B552] hover:text-white transition-colors"
              >
                <span>Review Security &amp; Data Handling</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('privacy')}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-300 hover:text-white transition-colors"
              >
                <span>Privacy Policy &amp; GLBA Notice</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
