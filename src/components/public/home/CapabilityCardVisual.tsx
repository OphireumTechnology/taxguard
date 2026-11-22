import React, { useState } from 'react';

import capAiTaxImg from '../../../assets/images/cap_ai_tax_1795326127753.jpg';
import capDocOcrImg from '../../../assets/images/cap_doc_ocr_1795326126014.jpg';
import capAutoReconcileImg from '../../../assets/images/cap_auto_reconcile_1795326128180.jpg';
import capTaxComplianceImg from '../../../assets/images/cap_tax_compliance_1795326127633.jpg';
import capAnomalyDetectImg from '../../../assets/images/cap_anomaly_detect_1795326128007.jpg';
import capSmartBookkeepingImg from '../../../assets/images/cap_smart_bookkeeping_1795326128552.jpg';
import capFinancialAnalyticsImg from '../../../assets/images/cap_financial_analytics_1795326128054.jpg';
import capSecureVaultImg from '../../../assets/images/cap_secure_vault_1795326147903.jpg';
import capProfOversightImg from '../../../assets/images/cap_prof_oversight_1795326127670.jpg';

export type CapabilityVisualId =
  | 'ai-tax-prep'
  | 'doc-recognition'
  | 'auto-reconciliation'
  | 'tax-compliance'
  | 'anomaly-detection'
  | 'intelligent-bookkeeping'
  | 'strategic-analytics'
  | 'secure-doc-mgmt'
  | 'professional-review';

interface CapabilityAssetMeta {
  src: string;
  alt: string;
}

const CAPABILITY_ASSETS: Record<CapabilityVisualId, CapabilityAssetMeta> = {
  'ai-tax-prep': {
    src: capAiTaxImg,
    alt: 'Conceptual illustration of AI-assisted tax preparation schedules connected to a central metallic gold processing core',
  },
  'doc-recognition': {
    src: capDocOcrImg,
    alt: 'Conceptual illustration of optical document recognition scanning structured financial form layers into organized fields',
  },
  'auto-reconciliation': {
    src: capAutoReconcileImg,
    alt: 'Conceptual illustration of interconnected digital ledgers converging through a balanced golden reconciliation prism',
  },
  'tax-compliance': {
    src: capTaxComplianceImg,
    alt: 'Conceptual illustration of a regulatory intelligence shield surrounded by illuminated federal and multi-state verification nodes',
  },
  'anomaly-detection': {
    src: capAnomalyDetectImg,
    alt: 'Conceptual illustration of financial signal waveforms with a subtle amber-gold analytical variance highlight',
  },
  'intelligent-bookkeeping': {
    src: capSmartBookkeepingImg,
    alt: 'Conceptual illustration of organized multi-tier digital accounting journals and ledger columns linked by gold conduits',
  },
  'strategic-analytics': {
    src: capFinancialAnalyticsImg,
    alt: 'Conceptual illustration of layered glass executive financial projection planes and golden trajectory curves',
  },
  'secure-doc-mgmt': {
    src: capSecureVaultImg,
    alt: 'Conceptual illustration of an enterprise digital document vault with concentric metallic gold locking rings',
  },
  'professional-review': {
    src: capProfOversightImg,
    alt: 'Conceptual illustration of sequential digital governance tiers leading to a professional approval seal',
  },
};

interface CapabilityCardVisualProps {
  id: CapabilityVisualId;
  number: string;
  icon: React.ComponentType<{ className?: string }>;
  isHighlighted: boolean;
  shouldAnimate: boolean;
}

/**
 * Renders the unique 16:9 architectural fintech image for each capability card
 * paired with a subtle, capability-specific SVG/CSS technological micro-overlay.
 */
export const CapabilityCardVisual: React.FC<CapabilityCardVisualProps> = ({
  id,
  number,
  icon: IconComp,
  isHighlighted,
  shouldAnimate,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const asset = CAPABILITY_ASSETS[id];

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#051426] border-b border-slate-700/50">
      {/* Generated architectural technology visual with zero-broken-image fallback */}
      {!imageFailed ? (
        <img
          src={asset.src}
          alt={asset.alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className={`h-full w-full object-cover object-center transition-transform duration-500 ease-out ${
            isHighlighted ? 'scale-[1.045]' : 'group-hover:scale-[1.045]'
          }`}
        />
      ) : (
        <div
          className="h-full w-full flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle at 50% 40%, rgba(212, 168, 67, 0.18), rgba(6, 24, 43, 0.96) 72%)',
          }}
        >
          <IconComp className="w-10 h-10 text-[#D4A843]/60" />
        </div>
      )}

      {/* Controlled atmospheric vignette so card surfaces stay quiet and legible */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#081C33] via-[#06182B]/25 to-[#06182B]/35"
        aria-hidden="true"
      />

      {/* Capability-specific subtle technological micro-overlay */}
      <CapabilitySpecificOverlay
        id={id}
        isHighlighted={isHighlighted}
        shouldAnimate={shouldAnimate}
      />

      {/* Top corner architectural lockups: Icon medallion (left) & Number identifier (right) */}
      <div className="pointer-events-none absolute inset-x-3.5 top-3.5 flex items-center justify-between">
        <div
          className={`w-9 h-9 rounded-lg bg-[#06182B]/85 backdrop-blur-md border flex items-center justify-center text-[#E5B552] transition-colors duration-200 ${
            isHighlighted
              ? 'border-[#E5B552]/75'
              : 'border-slate-600/65 group-hover:border-[#D4A843]/65'
          }`}
        >
          <IconComp className="w-4 h-4" />
        </div>

        <span
          className={`px-2 py-0.5 rounded bg-[#06182B]/80 backdrop-blur-md border font-mono text-[11px] font-medium tabular-nums transition-colors duration-200 ${
            isHighlighted
              ? 'border-[#D4A843]/65 text-[#E5B552]'
              : 'border-slate-700/70 text-slate-300 group-hover:border-[#D4A843]/50 group-hover:text-[#E5B552]'
          }`}
        >
          {number}
        </span>
      </div>
    </div>
  );
};

interface OverlayProps {
  id: CapabilityVisualId;
  isHighlighted: boolean;
  shouldAnimate: boolean;
}

const CapabilitySpecificOverlay: React.FC<OverlayProps> = ({
  id,
  isHighlighted,
  shouldAnimate,
}) => {
  const activeOpacity = isHighlighted ? 'opacity-95' : 'opacity-55 group-hover:opacity-95';

  switch (id) {
    case 'ai-tax-prep':
      return (
        <svg
          viewBox="0 0 320 180"
          className={`pointer-events-none absolute inset-0 w-full h-full transition-opacity duration-300 ${activeOpacity}`}
          aria-hidden="true"
        >
          <path
            d="M 24 148 Q 100 112 160 94 T 296 42"
            fill="none"
            stroke="#E5B552"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '4.4s' }}
          />
          <path
            d="M 24 44 Q 95 76 160 94 T 296 144"
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="1"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '5.2s' }}
          />
          <circle cx="160" cy="94" r="4" fill="#E5B552" opacity="0.85" />
        </svg>
      );

    case 'doc-recognition':
      return (
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${activeOpacity}`}
          aria-hidden="true"
        >
          {/* Animated horizontal OCR scan beam */}
          <div className="destria-card-scan-beam absolute inset-x-4 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#7DD3FC] to-transparent shadow-[0_0_12px_rgba(125,211,252,0.85)]" />
          {/* Clearly fictional, non-sensitive sample form extraction markers */}
          <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-200/85">
            <span className="px-1.5 py-0.5 rounded bg-[#06182B]/80 border border-[#7DD3FC]/35">
              Sample W-2
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#06182B]/80 border border-[#D4A843]/40 text-[#E5B552]">
              Sample 1099
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#06182B]/80 border border-[#7DD3FC]/35">
              Sample K-1
            </span>
          </div>
        </div>
      );

    case 'auto-reconciliation':
      return (
        <svg
          viewBox="0 0 320 180"
          className={`pointer-events-none absolute inset-0 w-full h-full transition-opacity duration-300 ${activeOpacity}`}
          aria-hidden="true"
        >
          <path
            d="M 28 54 L 160 92 L 28 134"
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '4.2s' }}
          />
          <path
            d="M 292 54 L 160 92 L 292 134"
            fill="none"
            stroke="#E5B552"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '4.2s' }}
          />
          <circle
            cx="160"
            cy="92"
            r="14"
            fill="none"
            stroke="#E5B552"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
          <circle cx="160" cy="92" r="3.2" fill="#E5B552" />
        </svg>
      );

    case 'tax-compliance':
      return (
        <svg
          viewBox="0 0 320 180"
          className={`pointer-events-none absolute inset-0 w-full h-full transition-opacity duration-300 ${activeOpacity}`}
          aria-hidden="true"
        >
          <ellipse
            cx="160"
            cy="92"
            rx="94"
            ry="54"
            fill="none"
            stroke="rgba(212, 168, 67, 0.42)"
            strokeWidth="1"
            strokeDasharray="4 6"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '6s' }}
          />
          {[
            { cx: 74, cy: 92, delay: '0s' },
            { cx: 118, cy: 48, delay: '0.7s' },
            { cx: 202, cy: 48, delay: '1.4s' },
            { cx: 246, cy: 92, delay: '2.1s' },
          ].map((pt, i) => (
            <circle
              key={i}
              cx={pt.cx}
              cy={pt.cy}
              r="3.2"
              fill={i % 2 === 0 ? '#E5B552' : '#7DD3FC'}
              className="destria-checkpoint-glow"
              style={{ animationDelay: pt.delay }}
            />
          ))}
        </svg>
      );

    case 'anomaly-detection':
      return (
        <svg
          viewBox="0 0 320 180"
          className={`pointer-events-none absolute inset-0 w-full h-full transition-opacity duration-300 ${activeOpacity}`}
          aria-hidden="true"
        >
          <path
            d="M 18 118 L 76 112 L 112 122 L 144 96 L 160 58 L 178 106 L 222 114 L 264 108 L 302 115"
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="1.3"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '5s' }}
          />
          <circle
            cx="160"
            cy="58"
            r="11"
            fill="rgba(245, 158, 11, 0.14)"
            stroke="#F59E0B"
            strokeWidth="1.1"
            className="destria-checkpoint-glow"
          />
          <circle cx="160" cy="58" r="3" fill="#FBBF24" />
        </svg>
      );

    case 'intelligent-bookkeeping':
      return (
        <svg
          viewBox="0 0 320 180"
          className={`pointer-events-none absolute inset-0 w-full h-full transition-opacity duration-300 ${activeOpacity}`}
          aria-hidden="true"
        >
          <path
            d="M 36 144 H 124 L 160 108 L 196 144 H 284"
            fill="none"
            stroke="#E5B552"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '4.6s' }}
          />
          <path
            d="M 160 108 V 36"
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="1.1"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '3.6s' }}
          />
          <circle cx="160" cy="108" r="3" fill="#E5B552" />
        </svg>
      );

    case 'strategic-analytics':
      return (
        <svg
          viewBox="0 0 320 180"
          className={`pointer-events-none absolute inset-0 w-full h-full transition-opacity duration-300 ${activeOpacity}`}
          aria-hidden="true"
        >
          <path
            d="M 28 142 C 90 132, 128 110, 174 84 C 216 60, 254 54, 294 38"
            fill="none"
            stroke="#E5B552"
            strokeWidth="1.5"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '4.8s' }}
          />
          {shouldAnimate && (
            <circle r="3" fill="#F3CE74">
              <animateMotion
                dur="4.8s"
                repeatCount="indefinite"
                path="M 28 142 C 90 132, 128 110, 174 84 C 216 60, 254 54, 294 38"
              />
            </circle>
          )}
        </svg>
      );

    case 'secure-doc-mgmt':
      return (
        <svg
          viewBox="0 0 320 180"
          className={`pointer-events-none absolute inset-0 w-full h-full transition-opacity duration-300 ${activeOpacity}`}
          aria-hidden="true"
        >
          <circle
            cx="168"
            cy="92"
            r="52"
            fill="none"
            stroke="rgba(125, 211, 252, 0.42)"
            strokeWidth="1"
            strokeDasharray="6 8"
            className="destria-orbit-slow"
          />
          <circle
            cx="168"
            cy="92"
            r="36"
            fill="none"
            stroke="rgba(212, 168, 67, 0.55)"
            strokeWidth="1.1"
            strokeDasharray="14 10"
            className="destria-orbit-reverse"
          />
        </svg>
      );

    case 'professional-review':
      return (
        <svg
          viewBox="0 0 320 180"
          className={`pointer-events-none absolute inset-0 w-full h-full transition-opacity duration-300 ${activeOpacity}`}
          aria-hidden="true"
        >
          <path
            d="M 52 132 C 110 132, 134 94, 198 76 L 246 66"
            fill="none"
            stroke="#E5B552"
            strokeWidth="1.4"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '4.5s' }}
          />
          {[
            { cx: 68, cy: 130, delay: '0s' },
            { cx: 142, cy: 102, delay: '0.9s' },
            { cx: 212, cy: 72, delay: '1.8s' },
          ].map((pt, i) => (
            <circle
              key={i}
              cx={pt.cx}
              cy={pt.cy}
              r="3.4"
              fill="#E5B552"
              className="destria-checkpoint-glow"
              style={{ animationDelay: pt.delay }}
            />
          ))}
        </svg>
      );
  }
};
