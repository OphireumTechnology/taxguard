import React, { useEffect, useRef, useState } from 'react';
import { Link2, Shield, FileCheck2, Lock, CheckCircle2, Pause, Play } from 'lucide-react';
import { useInViewMotion } from './useInViewMotion';

interface IntegrityBlock {
  index: number;
  code: string;
  title: string;
  concept: string;
  prevHashConcept: string;
  hashConcept: string;
  traceDetail: string;
}

const INTEGRITY_BLOCKS: IntegrityBlock[] = [
  {
    index: 1,
    code: 'BLK-01',
    title: 'Document Receipt',
    concept: 'Cryptographic fingerprint concept',
    prevHashConcept: '0000...genesis',
    hashConcept: 'sha256:9f4a...c821',
    traceDetail: 'Each uploaded source file receives a structured digest reference so subsequent workpapers trace back to the exact original submission.',
  },
  {
    index: 2,
    code: 'BLK-02',
    title: 'Classification Entry',
    concept: 'Structured document chain',
    prevHashConcept: 'sha256:9f4a...c821',
    hashConcept: 'sha256:4b1e...7d04',
    traceDetail: 'Category assignments and tax-year tags are logged sequentially rather than silently overwritten, preserving intake context.',
  },
  {
    index: 3,
    code: 'BLK-03',
    title: 'Reconciliation Record',
    concept: 'Financial transaction integrity',
    prevHashConcept: 'sha256:4b1e...7d04',
    hashConcept: 'sha256:e2c7...19ab',
    traceDetail: 'Book-to-tax groupings and ledger adjustments reference prior period states for clear variance traceability.',
  },
  {
    index: 4,
    code: 'BLK-04',
    title: 'Discrepancy Audit Log',
    concept: 'Tamper-evident audit trail concept',
    prevHashConcept: 'sha256:e2c7...19ab',
    hashConcept: 'sha256:71d9...5e63',
    traceDetail: 'Flagged discrepancies and practitioner resolutions are recorded in chronological order to support internal quality review.',
  },
  {
    index: 5,
    code: 'BLK-05',
    title: 'Practitioner Review',
    concept: 'Independent verification sign-off',
    prevHashConcept: 'sha256:71d9...5e63',
    hashConcept: 'sha256:3c8f...a410',
    traceDetail: 'Separate preparer and reviewer checkpoints document who examined each schedule and when review milestones were cleared.',
  },
  {
    index: 6,
    code: 'BLK-06',
    title: 'Client Authorization',
    concept: 'Compliance record traceability',
    prevHashConcept: 'sha256:3c8f...a410',
    hashConcept: 'sha256:b604...f29d',
    traceDetail: 'Client approval records link directly to the reviewed return version so historical filings remain organized and verifiable.',
  },
];

export const BlockchainIntegritySection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { shouldAnimate } = useInViewMotion(sectionRef);
  const [activeBlock, setActiveBlock] = useState(0);
  const [userPaused, setUserPaused] = useState(false);

  const isRunning = shouldAnimate && !userPaused;

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setActiveBlock((prev) => (prev + 1) % INTEGRITY_BLOCKS.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const current = INTEGRITY_BLOCKS[activeBlock];

  return (
    <section
      ref={sectionRef}
      id="data-integrity"
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-28 ${!isRunning ? 'destria-motion-paused' : ''}`}
      aria-labelledby="integrity-heading"
    >
      <div className="rounded-2xl bg-[#071A2E] border border-[#D4A843]/30 p-6 sm:p-8 lg:p-10 space-y-8 relative overflow-hidden">
        {/* Subtle Background Grid */}
        <div
          className="pointer-events-none absolute inset-0 destria-tech-grid-bg opacity-35"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#E5B552] uppercase">
              Blockchain-Inspired Data Integrity Concepts
            </p>
            <h2
              id="integrity-heading"
              className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
            >
              Traceable Financial Records Built on Cryptographic Integrity Principles
            </h2>
            <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
              Inspired by distributed-ledger verification concepts, our document custody and audit-trail design emphasizes chronological record continuity, cryptographic file hashing concepts, and clear compliance traceability from intake to archive.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-pressed={userPaused}
            className="h-10 px-4 rounded-lg bg-[#06182B] hover:bg-[#102D4F] border border-slate-700 text-xs font-semibold text-slate-100 inline-flex items-center gap-2 transition-colors self-start lg:self-end whitespace-nowrap shrink-0"
          >
            {userPaused ? <Play className="w-3.5 h-3.5 text-[#D4A843]" /> : <Pause className="w-3.5 h-3.5 text-[#D4A843]" />}
            <span>{userPaused ? 'Resume Chain' : 'Pause Chain'}</span>
          </button>
        </div>

        {/* Sequential Illuminated Ledger Chain Visualization */}
        <div className="relative z-10">
          {/* Desktop SVG Connector Track */}
          <svg
            viewBox="0 0 1200 24"
            className="hidden lg:block w-full h-6 mb-2 pointer-events-none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line x1="60" y1="12" x2="1140" y2="12" stroke="rgba(148,163,184,0.22)" strokeWidth="2" />
            <line
              x1="60"
              y1="12"
              x2={60 + (1080 * activeBlock) / (INTEGRITY_BLOCKS.length - 1)}
              y2="12"
              stroke="#E5B552"
              strokeWidth="2.5"
              className="transition-all duration-500"
            />
            {INTEGRITY_BLOCKS.map((blk, i) => {
              const cx = 60 + (1080 * i) / (INTEGRITY_BLOCKS.length - 1);
              const lit = i <= activeBlock;
              return (
                <circle
                  key={blk.code}
                  cx={cx}
                  cy="12"
                  r={i === activeBlock ? 6 : 4}
                  fill={lit ? '#E5B552' : '#1E3A5F'}
                  stroke={i === activeBlock ? '#FFFFFF' : '#D4A843'}
                  strokeWidth={i === activeBlock ? 1.5 : 0.75}
                />
              );
            })}
          </svg>

          {/* 6 Interactive Ledger Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {INTEGRITY_BLOCKS.map((blk, idx) => {
              const isActive = idx === activeBlock;
              const isPast = idx < activeBlock;
              return (
                <button
                  key={blk.code}
                  type="button"
                  onClick={() => {
                    setActiveBlock(idx);
                    setUserPaused(true);
                  }}
                  aria-pressed={isActive}
                  className={`text-left rounded-xl p-4 border transition-all duration-300 flex flex-col justify-between gap-3 ${
                    isActive
                      ? 'bg-[#102D4F] border-[#E5B552] shadow-[0_0_24px_rgba(212,168,67,0.24)] -translate-y-0.5'
                      : isPast
                      ? 'bg-[#0A213C] border-[#D4A843]/45 hover:border-[#D4A843]'
                      : 'bg-[#06182B]/90 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#E5B552] tabular-nums">
                      {blk.code}
                    </span>
                    {isPast ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Link2 className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#E5B552]' : 'text-slate-500'}`} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white leading-snug">{blk.title}</div>
                    <div className="font-mono text-[10px] text-sky-300/90 truncate tabular-nums">
                      {blk.hashConcept}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Block Inspector & Key Principles */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div
            className="lg:col-span-7 rounded-xl bg-[#06182B]/95 border border-slate-700/80 p-5 sm:p-6 space-y-3"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-xl font-bold text-white">
                {current.code}: {current.title}
              </h3>
              <span className="text-xs font-medium text-[#E5B552]">{current.concept}</span>
            </div>
            <p className="text-xs sm:text-sm text-[#A9B7C8] leading-relaxed">
              {current.traceDetail}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800 font-mono text-[11px] tabular-nums">
              <div>
                <span className="text-slate-400 block">Illustrative Prior Link</span>
                <span className="text-slate-200">{current.prevHashConcept}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Illustrative Record Digest</span>
                <span className="text-[#E5B552]">{current.hashConcept}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl bg-[#0A213C] border border-slate-700/80 p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <FileCheck2 className="w-4 h-4 text-[#D4A843] mt-0.5 shrink-0" />
                <div className="text-xs text-slate-200 leading-relaxed">
                  <strong className="text-white">Document Verification Chains:</strong> Clear linkage between source tax documents, workpapers, and reviewer sign-offs.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-[#D4A843] mt-0.5 shrink-0" />
                <div className="text-xs text-slate-200 leading-relaxed">
                  <strong className="text-white">Tamper-Evident Audit Concepts:</strong> Chronological event logging designed to make unauthorized alterations detectable.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#D4A843] mt-0.5 shrink-0" />
                <div className="text-xs text-slate-200 leading-relaxed">
                  <strong className="text-white">Controlled Information Transfer:</strong> Client records move strictly through authenticated portal sessions rather than unverified public channels.
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pt-3 border-t border-slate-800">
              Conceptual integrity illustration only. Destria Tax Services, LLC does not deploy a public blockchain network and does not offer cryptocurrency trading, token sales, or digital currency investment services.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
