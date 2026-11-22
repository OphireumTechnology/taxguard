import React, { useState } from 'react';
import { FileCheck2, Shield } from 'lucide-react';
import { CLIENT_PORTAL_VAULT_ASSET } from './clientPortalVisualAssets';

interface SecureFinancialVaultVisualProps {
  /** Controls whether ambient SVG motion layers run (paused when off-screen or reduced-motion). */
  animate: boolean;
}

/**
 * Purely presentational enterprise digital financial vault visual.
 * Receives no credentials, tokens, or taxpayer data.
 */
export const SecureFinancialVaultVisual: React.FC<SecureFinancialVaultVisualProps> = ({ animate }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[rgba(212,168,67,0.28)] bg-[#041120] shadow-[0_24px_64px_rgba(2,10,20,0.65)] ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      {/* 16:9 Architectural Vault Media Frame */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {!imageError ? (
          <picture>
            <source srcSet={CLIENT_PORTAL_VAULT_ASSET.webp} type="image/webp" />
            <img
              src={CLIENT_PORTAL_VAULT_ASSET.jpg}
              alt={CLIENT_PORTAL_VAULT_ASSET.alt}
              width={1408}
              height={768}
              loading="eager"
              decoding="async"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover object-center scale-[1.01] brightness-[0.88] contrast-[1.06]"
            />
          </picture>
        ) : (
          <div
            aria-hidden="true"
            className="h-full w-full bg-[radial-gradient(circle_at_55%_45%,rgba(212,168,67,0.22),rgba(13,39,69,0.92)_48%,#041120_100%)]"
          />
        )}

        {/* Atmospheric Navy Depth Vignette for Clean Legibility */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#051425] via-[#051425]/30 to-[#051425]/45"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#051425]/55 via-transparent to-[#051425]/35"
        />

        {/* Subtle Rotating Geometric Verification Rings (GPU-Composited SVG) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 640 400"
          fill="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-80"
        >
          <defs>
            <linearGradient id="destriaPortalGoldRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E1BB60" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#D4A843" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="destriaPortalSapphireLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="0" />
              <stop offset="50%" stopColor="#E1BB60" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Outer slow verification orbit */}
          <g className="destria-orbit-slow" style={{ transformOrigin: '368px 204px' }}>
            <circle
              cx="368"
              cy="204"
              r="142"
              stroke="url(#destriaPortalGoldRing)"
              strokeWidth="1"
              strokeDasharray="10 14"
            />
            <circle cx="368" cy="62" r="2.5" fill="#E1BB60" fillOpacity="0.85" />
            <circle cx="510" cy="204" r="2" fill="#93C5FD" fillOpacity="0.7" />
          </g>

          {/* Mid counter-rotating architectural ring */}
          <g className="destria-orbit-reverse" style={{ transformOrigin: '368px 204px' }}>
            <circle
              cx="368"
              cy="204"
              r="108"
              stroke="rgba(147, 197, 253, 0.28)"
              strokeWidth="1"
              strokeDasharray="4 10"
            />
            <circle cx="260" cy="204" r="2" fill="#E1BB60" fillOpacity="0.75" />
          </g>

          {/* Inner precision calibration ring */}
          <g className="destria-orbit-inner" style={{ transformOrigin: '368px 204px' }}>
            <circle
              cx="368"
              cy="204"
              r="72"
              stroke="rgba(212, 168, 67, 0.34)"
              strokeWidth="0.9"
              strokeDasharray="18 22"
            />
          </g>

          {/* Subtle horizontal architectural axis lines */}
          <line x1="24" y1="204" x2="210" y2="204" stroke="url(#destriaPortalSapphireLine)" strokeWidth="0.9" />
          <line x1="526" y1="204" x2="616" y2="204" stroke="url(#destriaPortalSapphireLine)" strokeWidth="0.9" />

          {/* Ambient floating light particles */}
          <circle cx="114" cy="96" r="1.8" fill="#E1BB60" className="destria-particle-float" />
          <circle
            cx="176"
            cy="282"
            r="1.5"
            fill="#93C5FD"
            className="destria-particle-float"
            style={{ animationDelay: '1.6s' }}
          />
          <circle
            cx="548"
            cy="118"
            r="1.8"
            fill="#E1BB60"
            className="destria-particle-float"
            style={{ animationDelay: '2.9s' }}
          />
          <circle
            cx="492"
            cy="314"
            r="1.5"
            fill="#93C5FD"
            className="destria-particle-float"
            style={{ animationDelay: '0.8s' }}
          />
        </svg>

        {/* Whisper-Quiet Verification Scan Beam */}
        <div
          aria-hidden="true"
          className="destria-card-scan-beam pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[rgba(212,168,67,0.14)] to-transparent"
        />

        {/* Precision Architectural Corner Frames */}
        <div aria-hidden="true" className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l border-t border-[rgba(212,168,67,0.45)]" />
        <div aria-hidden="true" className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r border-t border-[rgba(212,168,67,0.45)]" />

        {/* Subtle Bottom Glass Layering — Conceptual Protected Document & Oversight Framing */}
        <div className="absolute inset-x-4 bottom-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-[rgba(148,163,184,0.22)] bg-[#06182B]/80 px-3.5 py-2.5 backdrop-blur-md">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-white">
                Structured Document Vault
              </p>
              <p className="text-[11px] leading-snug text-slate-300">
                Organized tax returns, intake forms, and advisory records.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-[rgba(148,163,184,0.22)] bg-[#06182B]/80 px-3.5 py-2.5 backdrop-blur-md">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-white">
                Account-Scoped Portal Entry
              </p>
              <p className="text-[11px] leading-snug text-slate-300">
                Private gateway connecting clients directly with Destria professionals.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
