/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Staff Practice Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React, { Suspense, useRef } from 'react';
import { useStaffPortalMotion } from './useStaffPortalMotion';
import { StaffPortalTechnologyHero } from './StaffPortalTechnologyHero';

const LazyStaffTechnologyBackground = React.lazy(() => import('./StaffTechnologyBackground'));

interface StaffPortalLoginLayoutProps {
  /** Right-column Staff Authentication glassmorphism card rendered by StaffLoginPage. */
  children: React.ReactNode;
}

const StaticBackdropFallback: React.FC = () => (
  <div
    aria-hidden="true"
    data-testid="staff-technology-background-fallback"
    className="pointer-events-none absolute inset-0"
    style={{
      background: 'linear-gradient(155deg, #061426 0%, #0B1F36 55%, #051120 100%)'
    }}
  />
);

/**
 * Ensures any failure in noncritical decorative animation never disrupts Staff Login availability.
 */
class DecorativeBackgroundBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <StaticBackdropFallback />;
    }
    return this.props.children;
  }
}

/**
 * Responsive enterprise two-column layout for the Staff Practice Portal (/staff/login).
 * - Desktop (lg+): Balanced two-column split with technology presentation (left) and auth card (right).
 * - Tablet (md): Balanced layout with reduced animation complexity and login card prioritized.
 * - Mobile (<md): Single-column layout with login card prioritized and simplified decorative backdrop.
 * Contains zero authentication logic, credential state, or authorization controls.
 */
export const StaffPortalLoginLayout: React.FC<StaffPortalLoginLayoutProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, complexity } = useStaffPortalMotion(containerRef);

  return (
    <div
      ref={containerRef}
      data-testid="staff-portal-login-layout"
      className="relative overflow-x-clip bg-[#061426] text-white"
    >
      <DecorativeBackgroundBoundary>
        <Suspense fallback={<StaticBackdropFallback />}>
          <LazyStaffTechnologyBackground animate={shouldAnimate} complexity={complexity} />
        </Suspense>
      </DecorativeBackgroundBoundary>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,54fr)_minmax(0,46fr)] lg:items-center lg:gap-12">
          {/* Left Column on Desktop — Technology Presentation (second on mobile/tablet so sign-in is immediate) */}
          <div className="order-2 lg:order-1">
            <StaffPortalTechnologyHero animate={shouldAnimate} complexity={complexity} />
          </div>

          {/* Right Column on Desktop — Staff Authentication Card (first on mobile/tablet) */}
          <div
            className={`order-1 flex w-full justify-center lg:order-2 lg:justify-end ${
              !shouldAnimate ? 'destria-motion-paused' : ''
            }`}
          >
            <div className="w-full max-w-[472px]">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
