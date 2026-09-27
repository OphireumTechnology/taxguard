import React from 'react';
import { ArrowUpRight, CheckCircle2, Shield, Users, Award, BookOpen } from 'lucide-react';

interface PublicV2AboutPageProps {
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2AboutPage: React.FC<PublicV2AboutPageProps> = ({
  onNavigate,
  onOpenConsultation
}) => {
  return (
    <div className="bg-white text-black space-y-16 py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="border-b border-black pb-8 space-y-3">
        <div className="inline-block border border-black bg-neutral-100 px-3 py-1 text-[11px] font-mono text-black">
          Practice Overview · San Ramon, California
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-black">
          About A/R Tax Services, LLC
        </h1>
        <p className="text-base sm:text-lg text-neutral-700 max-w-3xl leading-relaxed">
          A dedicated U.S. accounting, tax preparation, bookkeeping, and advisory practice committed to meticulous accuracy, transparent workflows, and structured professional review.
        </p>
      </div>

      {/* Core Mission & Philosophy */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <div className="border border-black p-8 space-y-4 bg-white">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Practice Mission</span>
          <h2 className="text-2xl font-bold text-black tracking-tight">
            Clarity in Every Calculation
          </h2>
          <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
            The modern regulatory landscape demands precision. At A/R Tax Services, LLC, our objective is to eliminate guesswork from individual and corporate tax compliance. We treat tax returns not as annual administrative burdens, but as comprehensive financial records that reflect your hard-earned progress.
          </p>
          <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
            From sole proprietors navigating self-employment taxes to complex multi-state corporate entities managing multi-tiered partner allocations, we enforce rigorous internal controls and dual-tier reviews across every client engagement.
          </p>
        </div>

        <div className="border border-black p-8 space-y-4 bg-neutral-50">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Quality Framework</span>
          <h2 className="text-2xl font-bold text-black tracking-tight">
            Structured Review Standard
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-neutral-700">
            <div className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-black mt-0.5">01.</span>
              <p><strong>Primary Preparation:</strong> Complete document intake, trial balance reconciliation, and source verification.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-black mt-0.5">02.</span>
              <p><strong>Senior Technical Review:</strong> Rigorous technical verification of statutory deductions, credits, and schedule elections.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-black mt-0.5">03.</span>
              <p><strong>Client Approval & Filing:</strong> Final client walkthrough, digital authorization, and encrypted e-file transmission.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership Overview */}
      <section className="border border-black p-8 sm:p-12 bg-white space-y-6">
        <div className="border-b border-neutral-200 pb-4">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Leadership</span>
          <h2 className="text-2xl font-bold text-black tracking-tight mt-1">
            Principal Leadership & Technical Standards
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4 text-xs sm:text-sm text-neutral-700 leading-relaxed">
            <p>
              Under executive leadership, A/R Tax Services, LLC has cultivated an operating ethos grounded in verifiable tax law, ethical compliance, and long-term client stewardship.
            </p>
            <p>
              We operate exclusively within approved federal (IRS) and state departmental guidelines, maintaining active continuing education across emerging tax changes, depreciation limits, clean energy credits, and corporate reporting mandates.
            </p>
            <div className="pt-2 border-t border-neutral-200 grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-neutral-500">HQ Office:</span>
                <div className="font-bold text-black">San Ramon, CA</div>
              </div>
              <div>
                <span className="text-neutral-500">Jurisdiction:</span>
                <div className="font-bold text-black">U.S. Federal & 50 States</div>
              </div>
            </div>
          </div>

          <div className="border border-neutral-300 p-6 bg-neutral-50 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-black tracking-tight">Practice Values</h3>
              <ul className="space-y-2 text-xs text-neutral-600">
                <li>• No aggressive, speculative tax schemes</li>
                <li>• Transparent flat and scope-based fee structures</li>
                <li>• Encrypted document storage and handling</li>
                <li>• Timely responses within 1 business day</li>
              </ul>
            </div>

            <button
              onClick={onOpenConsultation}
              className="w-full py-2.5 bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-colors text-center"
            >
              Consult with Our Team
            </button>
          </div>
        </div>
      </section>

      {/* CTA Strip */}
      <section className="border border-black p-8 bg-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-black">Ready to Discuss Your Accounting Requirements?</h2>
          <p className="text-xs text-neutral-600 mt-1">Schedule a confidential consultation or test our educational assistant.</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => onNavigate('/public-v2/accounting-assistant')}
            className="px-5 py-2.5 bg-white text-black border border-black text-xs font-medium hover:bg-neutral-50 transition-colors"
          >
            Ask Assistant
          </button>
          <button
            onClick={onOpenConsultation}
            className="px-5 py-2.5 bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
          >
            Book Consultation
          </button>
        </div>
      </section>
    </div>
  );
};
