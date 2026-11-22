import React, { useRef } from 'react';
import { useInViewMotion } from '../../public/home/useInViewMotion';
import { ClientPortalTechnologyHero } from './ClientPortalTechnologyHero';

interface ClientPortalLoginLayoutProps {
  /** Right-column Client Authentication Panel rendered by ClientLoginPage. */
  children: React.ReactNode;
}

/**
 * Responsive 55:45 desktop split-screen container for the Client Portal Login gateway.
 * On mobile/tablet (< lg), the authentication panel renders first for immediate usability.
 * Contains zero auth logic or credential awareness.
 */
export const ClientPortalLoginLayout: React.FC<ClientPortalLoginLayoutProps> = ({
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate } = useInViewMotion(containerRef);

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-clip bg-[#06182B] text-slate-100"
    >
      {/* Subtle Ambient Architectural Midnight-Navy & Champagne-Gold Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,168,67,0.09),transparent_48%),radial-gradient(ellipse_at_bottom_right,rgba(37,99,235,0.08),transparent_52%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.35)] to-transparent"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:items-center lg:gap-12">
          {/* Left Section (~55% desktop): Technology & Client Confidence Showcase (ordered second on mobile so login is immediate) */}
          <div className="order-2 lg:order-1">
            <ClientPortalTechnologyHero animate={shouldAnimate} />
          </div>

          {/* Right Section (~45% desktop): Client Authentication Panel (ordered first on mobile) */}
          <div className="order-1 flex w-full justify-center lg:order-2 lg:justify-end">
            <div className="w-full max-w-[456px] space-y-5">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
