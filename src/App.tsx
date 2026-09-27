/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, Suspense, lazy } from 'react';
import { AppProvider, useApp, PageRoute } from './context/AppContext';
import { PublicLayout } from './components/layout/PublicLayout';
import { PortalLayout } from './components/layout/PortalLayout';
import { PageLoadingFallback } from './components/common/PageLoadingFallback';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Immediate primary landing
import { HomePage } from './components/public/HomePage';

// Lazy-loaded Public Pages
const AboutPage = lazy(() => import('./components/public/AboutPage').then(m => ({ default: m.AboutPage })));
const FounderPage = lazy(() => import('./components/public/FounderPage').then(m => ({ default: m.FounderPage })));
const ServicesPage = lazy(() => import('./components/public/ServicesPage').then(m => ({ default: m.ServicesPage })));
const PricingPage = lazy(() => import('./components/public/PricingPage').then(m => ({ default: m.PricingPage })));
const BookConsultationPage = lazy(() => import('./components/public/BookConsultationPage').then(m => ({ default: m.BookConsultationPage })));
const ResourcesPage = lazy(() => import('./components/public/ResourcesPage').then(m => ({ default: m.ResourcesPage })));
const CareersPage = lazy(() => import('./components/public/CareersPage').then(m => ({ default: m.CareersPage })));
const JobDetailPage = lazy(() => import('./components/public/JobDetailPage').then(m => ({ default: m.JobDetailPage })));
const ContactPage = lazy(() => import('./components/public/ContactPage').then(m => ({ default: m.ContactPage })));

// Lazy-loaded Legal & Trust Pages
const PrivacyPolicyPage = lazy(() => import('./components/public/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import('./components/public/TermsOfServicePage').then(m => ({ default: m.TermsOfServicePage })));
const AccessibilityStatementPage = lazy(() => import('./components/public/AccessibilityStatementPage').then(m => ({ default: m.AccessibilityStatementPage })));
const SecurityDataHandlingPage = lazy(() => import('./components/public/SecurityDataHandlingPage').then(m => ({ default: m.SecurityDataHandlingPage })));
const ProfessionalDisclaimersPage = lazy(() => import('./components/public/ProfessionalDisclaimersPage').then(m => ({ default: m.ProfessionalDisclaimersPage })));
const TaxStrategiesPage = lazy(() => import('./components/public/TaxStrategiesPage').then(m => ({ default: m.TaxStrategiesPage })));
const IndustriesPage = lazy(() => import('./components/public/IndustriesPage').then(m => ({ default: m.IndustriesPage })));
const NotFoundPage = lazy(() => import('./components/public/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

// Lazy-loaded Auth Pages
const ClientLoginPage = lazy(() => import('./components/auth/AuthPages').then(m => ({ default: m.ClientLoginPage })));
const ClientRegisterPage = lazy(() => import('./components/auth/AuthPages').then(m => ({ default: m.ClientRegisterPage })));
const StaffLoginPage = lazy(() => import('./components/auth/AuthPages').then(m => ({ default: m.StaffLoginPage })));

// Lazy-loaded Portals & Workspaces
const StageOneIdentityWizard = lazy(() => import('./components/portal/StageOneIdentityWizard').then(m => ({ default: m.StageOneIdentityWizard })));
const ClientOnboardingWizard = lazy(() => import('./components/portal/ClientOnboardingWizard').then(m => ({ default: m.ClientOnboardingWizard })));
const StaffOnboardingWizard = lazy(() => import('./components/workspace/StaffOnboardingWizard').then(m => ({ default: m.StaffOnboardingWizard })));
const LiveCalendarModule = lazy(() => import('./components/calendar/LiveCalendarModule').then(m => ({ default: m.LiveCalendarModule })));
const VirtualConsultationRoom = lazy(() => import('./components/consultation/VirtualConsultationRoom').then(m => ({ default: m.VirtualConsultationRoom })));
import { ShieldAlert } from 'lucide-react';
import { DemoAppRouter } from './demo/DemoAppRouter';
import { PublicV2Router } from './public-v2/PublicV2Router';
import { DemoAuthService } from './demo/services/DemoAuthService';
import { DEMO_ROLES, DemoRole } from './demo/types';
import { ErrorPageView } from './demo/components/ErrorPages';

function isTaxGuardRouteUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = (window.location.hash || '').replace(/^#\/?/, '').replace(/^\/+/, '').toLowerCase();
  const path = (window.location.pathname || '').replace(/^\/+/, '').toLowerCase();
  const target = hash || path;
  return target.startsWith('taxguard');
}

function isPublicV2RouteUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = (window.location.hash || '').replace(/^#\/?/, '').replace(/^\/+/, '').toLowerCase();
  const path = (window.location.pathname || '').replace(/^\/+/, '').toLowerCase();
  const target = hash || path;
  return target.startsWith('public-v2');
}

function isDemoRouteUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = (window.location.hash || '').replace(/^#\/?/, '').replace(/^\/+/, '').toLowerCase();
  const path = (window.location.pathname || '').replace(/^\/+/, '').toLowerCase();
  const target = hash || path;

  if (target.startsWith('taxguard')) return false;
  if (target.startsWith('public-v2')) return false;
  if (target.startsWith('error/')) return true;
  if (target === 'portals' || target.startsWith('portals/')) return true;
  if (target.endsWith('/login') || target.endsWith('/dashboard')) return true;
  if (target.includes('/login') || target.includes('/dashboard')) return true;
  if (['client-portal', 'client_portal', 'reviewer-portal', 'staff-portal', 'cpa-portal', 'admin-dashboard', 'admin-portal', 'reviewer-workspace', 'accountant-workspace', 'portals'].includes(target)) return true;
  return false;
}

const AppContent: React.FC = () => {
  const { currentPage, currentUser, setCurrentPage, pageParams } = useApp();
  const [isDemoRoute, setIsDemoRoute] = React.useState<boolean>(() => isDemoRouteUrl());
  const [isPublicV2Route, setIsPublicV2Route] = React.useState<boolean>(() => isPublicV2RouteUrl());
  const [isTaxGuardRoute, setIsTaxGuardRoute] = React.useState<boolean>(() => isTaxGuardRouteUrl());

  useEffect(() => {
    const handleUrlChange = () => {
      setIsDemoRoute(isDemoRouteUrl());
      setIsPublicV2Route(isPublicV2RouteUrl());
      setIsTaxGuardRoute(isTaxGuardRouteUrl());
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Router initialization diagnostic log
  useEffect(() => {
    console.log(`[DIAGNOSTIC] Router initialization: active page = "${currentPage}", isTaxGuardRoute = ${isTaxGuardRoute}, isDemoRoute = ${isDemoRoute}, isPublicV2Route = ${isPublicV2Route}, user = "${currentUser?.name || 'Guest'}"`);
  }, [currentPage, isTaxGuardRoute, isDemoRoute, isPublicV2Route, currentUser?.name]);

  // Synchronize navigation to demo portals - route unauthenticated sessions directly to login
  useEffect(() => {
    let targetHash = '';
    if (currentPage === 'portals') {
      targetHash = '#/portals';
    } else if (currentPage === 'admin_dashboard' || currentPage === 'admin_portal') {
      targetHash = DemoAuthService.isAuthenticated('admin') ? '#/admin/dashboard' : '#/admin/login';
    } else if (currentPage === 'reviewer_workspace' || currentPage === 'senior_reviewer_workspace' || currentPage === 'reviewer_portal') {
      targetHash = DemoAuthService.isAuthenticated('reviewer') ? '#/reviewer/dashboard' : '#/reviewer/login';
    } else if (currentPage === 'accountant_workspace' || currentPage === 'staff_portal') {
      targetHash = DemoAuthService.isAuthenticated('accountant') ? '#/accountant/dashboard' : '#/accountant/login';
    } else if (currentPage === 'client_portal') {
      targetHash = DemoAuthService.isAuthenticated('client') ? '#/client/dashboard' : '#/client/login';
    }

    if (targetHash && window.location.hash !== targetHash) {
      window.location.hash = targetHash;
      setIsDemoRoute(true);
    }
  }, [currentPage]);

  // Scroll to top on page navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  // TaxGuard AI is an integrated service layer, not a standalone console.
  // Redirect authenticated users to their own authorized role dashboard; show 403 if unauthenticated.
  const isTaxGuard = isTaxGuardRoute || isTaxGuardRouteUrl() || (currentPage as string) === 'taxguard';
  if (isTaxGuard) {
    const activeRoles = DemoAuthService.getActiveRoles();
    if (activeRoles && activeRoles.length > 0) {
      const primaryRole = activeRoles[0] as DemoRole;
      const targetPath = DEMO_ROLES[primaryRole]?.dashboardPath || '#/client/dashboard';
      if (window.location.hash !== targetPath) {
        window.location.hash = targetPath;
      }
      return <DemoAppRouter />;
    }
    return (
      <ErrorPageView
        type="403"
        customMessage="Access to standalone TaxGuard console has been removed. TaxGuard AI operates as an integrated service layer within authorized role dashboards. Please log in to your designated role dashboard."
        onNavigateHome={() => { window.location.hash = '#/'; }}
        onNavigateLogin={() => { window.location.hash = '#/portals'; }}
      />
    );
  }

  // Check if Public Page 2 is active
  const isPublicV2 = isPublicV2Route || isPublicV2RouteUrl() || currentPage === 'public_v2';
  if (isPublicV2) {
    return <PublicV2Router />;
  }

  const isDemo = isDemoRoute || isDemoRouteUrl() || [
    'portals',
    'admin_dashboard',
    'admin_portal',
    'reviewer_workspace',
    'senior_reviewer_workspace',
    'reviewer_portal',
    'accountant_workspace',
    'staff_portal',
    'client_portal'
  ].includes(currentPage);

  // If URL matches demonstration environment, isolate and render DemoAppRouter
  if (isDemo) {
    return <DemoAppRouter />;
  }

  const renderPage = () => {
    // Legacy portal routes are delegated directly to DemoAppRouter
    if (
      currentPage === 'admin_dashboard' || 
      currentPage === 'admin_portal' ||
      currentPage === 'reviewer_workspace' || 
      currentPage === 'senior_reviewer_workspace' || 
      currentPage === 'reviewer_portal' ||
      currentPage === 'accountant_workspace' || 
      currentPage === 'staff_portal' ||
      currentPage === 'client_portal' ||
      currentPage === 'portals'
    ) {
      return null;
    }

    // Client Stage One Identity Verification & Onboarding (Unified 18-Stage Cycle)
    if (currentPage === 'stage_one_onboard' || currentPage === 'onboarding' || currentPage === 'client_onboarding') {
      return (
        <StageOneIdentityWizard
          onExitGatePassed={() => {
            setCurrentPage('client_portal');
          }}
          onNavigateToDashboard={() => {
            setCurrentPage('client_portal');
          }}
        />
      );
    }

    // Staff Onboarding protection
    if (currentPage === 'staff_onboarding') {
      if (!currentUser) {
        return <StaffLoginPage />;
      }
      return <StaffOnboardingWizard />;
    }

    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'about':
        return <AboutPage />;
      case 'founder':
        return <FounderPage />;
      case 'services':
        return <ServicesPage />;
      case 'industries':
        return <IndustriesPage />;
      case 'tax_strategies':
        return <TaxStrategiesPage />;
      case 'pricing':
        return <PricingPage />;
      case 'book_consultation':
        return <BookConsultationPage />;
      case 'resources':
        return <ResourcesPage />;
      case 'careers':
        return <CareersPage />;
      case 'job_detail':
        return <JobDetailPage />;
      case 'contact':
        return <ContactPage />;
      case 'privacy':
        return <PrivacyPolicyPage />;
      case 'terms':
        return <TermsOfServicePage />;
      case 'accessibility':
        return <AccessibilityStatementPage />;
      case 'security':
        return <SecurityDataHandlingPage />;
      case 'disclaimers':
        return <ProfessionalDisclaimersPage />;
      case 'live_calendar':
        return <LiveCalendarModule />;
      case 'virtual_consultation_room':
        return (
          <VirtualConsultationRoom
            roomId={pageParams?.roomId}
            appointmentId={pageParams?.appointmentId}
            onExit={() => setCurrentPage('client_portal')}
          />
        );
      case 'client_login':
        return <ClientLoginPage />;
      case 'client_register':
        return <ClientRegisterPage />;
      case 'staff_login':
        return <StaffLoginPage />;
      case 'not_found':
      default:
        return <NotFoundPage />;
    }
  };

  const PORTAL_ROUTES = new Set<string>([
    'stage_one_onboard',
    'client_portal',
    'client_onboarding',
    'onboarding',
    'staff_onboarding',
    'accountant_workspace',
    'staff_portal',
    'reviewer_workspace',
    'senior_reviewer_workspace',
    'reviewer_portal',
    'admin_dashboard',
    'admin_portal',
    'live_calendar',
    'virtual_consultation_room',
  ]);

  const isPortalRoute = PORTAL_ROUTES.has(currentPage);

  if (isPortalRoute) {
    return (
      <PortalLayout>
        <Suspense fallback={<PageLoadingFallback />}>
          {renderPage()}
        </Suspense>
      </PortalLayout>
    );
  }

  return (
    <PublicLayout>
      <Suspense fallback={<PageLoadingFallback />}>
        {renderPage()}
      </Suspense>
    </PublicLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
