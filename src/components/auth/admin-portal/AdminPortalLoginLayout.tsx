/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Secure Super Administrator Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React, { Suspense, useRef } from 'react';
import { useStaffPortalMotion } from '../staff-portal/useStaffPortalMotion';
import { AdminPortalTechnologyHero } from './AdminPortalTechnologyHero';

const LazyTechnologyBackground = React.lazy(() => import('../staff-portal/StaffTechnologyBackground'));

interface AdminPortalLoginLayoutProps {
  /** Right-column Super Administrator authentication card rendered by AdminLoginPage. */
  children: React.ReactNode;
}

const StaticBackdropFallback: React.FC = () => (
  <div
    aria-hidden="true"
    data-testid="admin-technology-background-fallback"
    className="pointer-events-none absolute inset-0"
    style={{
      background: 'linear-gradient(155deg, #061426 0%, #0B1F36 55%, #051120 100%)'
    }}
  />
);

/**
 * Fault isolation boundary so any noncritical decorative animation failure never blocks
 * Super Administrator authentication availability.
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
 * Responsive enterprise two-column layout for the Secure Super Administrator Portal (/admin/login).
 * - Desktop (lg+): Balanced two-column split with executive governance narrative (left) and auth card (right).
 * - Mobile/Tablet (<lg): Sign-in card prioritized first with reduced/minimal decorative motion.
 * Contains zero authentication logic, credential state, or authorization controls.
 */
export const AdminPortalLoginLayout: React.FC<AdminPortalLoginLayoutProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldAnimate, complexity } = useStaffPortalMotion(containerRef);

  return (
    <div
      ref={containerRef}
      data-testid="admin-portal-login-layout"
      className="relative overflow-x-clip bg-[#061426] text-white"
    >
      <DecorativeBackgroundBoundary>
        <Suspense fallback={<StaticBackdropFallback />}>
          <LazyTechnologyBackground animate={shouldAnimate} complexity={complexity} />
        </Suspense>
      </DecorativeBackgroundBoundary>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:items-center lg:gap-12">
          {/* Left Column on Desktop — Governance Presentation (second on mobile/tablet) */}
          <div className="order-2 lg:order-1">
            <AdminPortalTechnologyHero animate={shouldAnimate} complexity={complexity} />
          </div>

          {/* Right Column on Desktop — Super Administrator Authentication Card (first on mobile/tablet) */}
          <div
            className={`order-1 flex w-full justify-center lg:order-2 lg:justify-end ${
              !shouldAnimate ? 'destria-motion-paused' : ''
            }`}
          >
            <div className="w-full max-w-[476px]">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
