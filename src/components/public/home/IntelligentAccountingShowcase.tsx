import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  FileSpreadsheet,
  Scale,
  UploadCloud
} from 'lucide-react';
import { AccountingCapabilityCard } from './AccountingCapabilityCard';
import {
  ACCOUNTING_CAPABILITY_PANELS,
  INTELLIGENT_ACCOUNTING_VISUAL
} from './coreServiceVisualAssets';

interface IntelligentAccountingShowcaseProps {
  animate: boolean;
  onOpenClientPortal: () => void;
  onExploreTaxStrategies: () => void;
}

const CAPABILITY_ICONS = {
  quickbooks: FileSpreadsheet,
  xero: BookOpenCheck,
  reconciliation: Scale
} as const;

const RECONCILIATION_STEPS = [
  'Trial Balance Intake',
  'Ledger Mapping',
  'Book-to-Tax Review'
] as const;

/**
 * Spacious two-column showcase for Intelligent Accounting & Financial Transparency.
 * Preserves existing Client Portal and Tax Strategies navigation without implying
 * unverified live external API syncs or simulated financial balances.
 */
export const IntelligentAccountingShowcase: React.FC<IntelligentAccountingShowcaseProps> = ({
  animate,
  onOpenClientPortal,
  onExploreTaxStrategies
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-[rgba(212,168,67,0.28)] bg-gradient-to-br from-[#0D2542] via-[#091D35] to-[#061629] p-6 sm:p-10 lg:p-12 shadow-[0_24px_64px_rgba(2,10,20,0.52)] ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      {/* Top Metallic-Gold Hairline Border Accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4A843] to-transparent opacity-75"
      />

      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Left Column: Narrative, Three Modernized Capability Panels, and Actions */}
        <div className="space-y-7 lg:col-span-7">
          <div className="space-y-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E5B552]">
              Intelligent Accounting &amp; Reporting
            </p>
            <h3 className="font-serif text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-white [text-wrap:balance]">
              Intelligent Accounting &amp; Financial Transparency
            </h3>
            <p className="text-base sm:text-[17px] leading-[1.65] text-slate-300 max-w-2xl">
              Organized bookkeeping, reliable financial reconciliation, and coordinated client
              communication designed to support informed business decisions. Share trial balances,
              charts of accounts, and monthly statements year-round so book-to-tax adjustments stay
              clear ahead of filing season.
            </p>
          </div>

          {/* Three Modernized Accounting Capability Panels */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ACCOUNTING_CAPABILITY_PANELS.map((panel) => {
              const Icon = CAPABILITY_ICONS[panel.id];
              return (
                <AccountingCapabilityCard
                  key={panel.id}
                  title={panel.title}
                  description={panel.description}
                  supportingDetail={panel.supportingDetail}
                  icon={<Icon className="h-5 w-5 text-[#E5B552]" aria-hidden="true" />}
                />
              );
            })}
          </div>

          {/* Preserved Navigation Actions */}
          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <a
              href="/portal"
              onClick={(e) => {
                e.preventDefault();
                onOpenClientPortal();
              }}
              id="portal-upload-btn"
              role="link"
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#C99A3D] via-[#D4A843] to-[#E1BB60] px-6 py-3 text-sm font-bold text-[#06182B] shadow-[0_8px_24px_rgba(212,168,67,0.28)] transition-all hover:brightness-105 whitespace-nowrap"
            >
              <span>Access Secure Client Portal</span>
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={onExploreTaxStrategies}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[rgba(148,163,184,0.28)] bg-[#06182B]/90 px-6 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-[rgba(212,168,67,0.55)] hover:bg-[#102D4F] whitespace-nowrap"
            >
              <span>Explore Tax Strategies</span>
              <ArrowRight className="h-4 w-4 text-[#E5B552]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Right Column: Photorealistic Accounting Hub + Conceptual Ledger Reconciliation Overlay */}
        <div className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-2xl border border-[rgba(212,168,67,0.28)] bg-[#051424] shadow-[0_20px_50px_rgba(2,10,20,0.6)]">
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              {!imageError ? (
                <picture>
                  <source srcSet={INTELLIGENT_ACCOUNTING_VISUAL.webp} type="image/webp" />
                  <img
                    src={INTELLIGENT_ACCOUNTING_VISUAL.jpg}
                    alt={INTELLIGENT_ACCOUNTING_VISUAL.alt}
                    width={1200}
                    height={896}
                    loading="lazy"
                    decoding="async"
                    onError={() => setImageError(true)}
                    className="h-full w-full object-cover object-center brightness-[0.88] contrast-[1.06]"
                  />
                </picture>
              ) : (
                <div
                  aria-hidden="true"
                  className="h-full w-full bg-[radial-gradient(circle_at_50%_40%,rgba(212,168,67,0.22),rgba(13,39,69,0.92)_54%,#051424_100%)]"
                />
              )}

              {/* Atmospheric Navy Depth Vignette */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#051424] via-[#051424]/30 to-[#051424]/35"
              />

              {/* Subtle Animated Verification Scan Beam */}
              <div
                aria-hidden="true"
                className="destria-card-scan-beam pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[rgba(212,168,67,0.14)] to-transparent"
              />

              {/* Subtle Geometric Ledger Pathway Overlay */}
              <svg
                aria-hidden="true"
                viewBox="0 0 420 96"
                fill="none"
                className="pointer-events-none absolute inset-x-0 top-3 h-20 w-full opacity-80"
              >
                <path
                  d="M 24 44 L 146 44 L 182 24 L 272 24 L 308 44 L 396 44"
                  stroke="rgba(148, 163, 184, 0.25)"
                  strokeWidth="1"
                />
                <path
                  d="M 24 44 L 146 44 L 182 24 L 272 24 L 308 44 L 396 44"
                  stroke="#E1BB60"
                  strokeWidth="1.5"
                  className="destria-ecosystem-stream"
                />
                <circle cx="146" cy="44" r="2.8" fill="#E1BB60" />
                <circle cx="272" cy="24" r="2.8" fill="#93C5FD" className="destria-checkpoint-glow" />
                <circle cx="308" cy="44" r="2.8" fill="#E1BB60" />
              </svg>

              {/* Corner Calibration Frames */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 border-l border-t border-[rgba(212,168,67,0.5)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 border-r border-t border-[rgba(212,168,67,0.5)]"
              />

              {/* Conceptual Layered Ledger Verification Plate */}
              <div className="absolute inset-x-4 bottom-4 rounded-xl border border-[rgba(148,163,184,0.22)] bg-[#06182B]/88 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[rgba(148,163,184,0.16)]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E5B552]">
                    Accounting Oversight
                  </span>
                  <span className="text-[11px] text-slate-300">
                    Book-to-Tax Traceability
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {RECONCILIATION_STEPS.map((step, idx) => (
                    <div
                      key={step}
                      className="rounded-lg border border-[rgba(148,163,184,0.16)] bg-[#0A203A]/85 px-2.5 py-2"
                    >
                      <span className="block font-mono text-[10px] text-[#D4A843]">
                        0{idx + 1}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-semibold leading-tight text-white">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
