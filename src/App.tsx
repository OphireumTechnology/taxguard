/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { PublicLayout } from './components/layout/PublicLayout';
import { PortalLayout } from './components/layout/PortalLayout';
import { PageLoadingFallback } from './components/common/PageLoadingFallback';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { HomePage } from './components/public/HomePage';
import { StageTwoCollectionWorkspace } from './components/collection/StageTwoCollectionWorkspace';

const AboutPage = lazy(() => import('./components/public/AboutPage').then(m => ({ default: m.AboutPage })));
const FounderPage = lazy(() => import('./components/public/FounderPage').then(m => ({ default: m.FounderPage })));
const ServicesPage = lazy(() => import('./components/public/ServicesPage').then(m => ({ default: m.ServicesPage })));
const PricingPage = lazy(() => import('./components/public/PricingPage').then(m => ({ default: m.PricingPage })));
const BookConsultationPage = lazy(() => import('./components/public/BookConsultationPage').then(m => ({ default: m.BookConsultationPage })));
const ResourcesPage = lazy(() => import('./components/public/ResourcesPage').then(m => ({ default: m.ResourcesPage })));
const CareersPage = lazy(() => import('./components/public/CareersPage').then(m => ({ default: m.CareersPage })));
const JobDetailPage = lazy(() => import('./components/public/JobDetailPage').then(m => ({ default: m.JobDetailPage })));
const ContactPage = lazy(() => import('./components/public/ContactPage').then(m => ({ default: m.ContactPage })));
const PrivacyPolicyPage = lazy(() => import('./components/public/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import('./components/public/TermsOfServicePage').then(m => ({ default: m.TermsOfServicePage })));
const AccessibilityStatementPage = lazy(() => import('./components/public/AccessibilityStatementPage').then(m => ({ default: m.AccessibilityStatementPage })));
const SecurityDataHandlingPage = lazy(() => import('./components/public/SecurityDataHandlingPage').then(m => ({ default: m.SecurityDataHandlingPage })));
const ProfessionalDisclaimersPage = lazy(() => import('./components/public/ProfessionalDisclaimersPage').then(m => ({ default: m.ProfessionalDisclaimersPage })));
const TaxStrategiesPage = lazy(() => import('./components/public/TaxStrategiesPage').then(m => ({ default: m.TaxStrategiesPage })));
const IndustriesPage = lazy(() => import('./components/public/IndustriesPage').then(m => ({ default: m.IndustriesPage })));
const NotFoundPage = lazy(() => import('./components/public/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const ClientLoginPage = lazy(() => import('./components/auth/AuthPages').then(m => ({ default: m.ClientLoginPage })));
const ClientRegisterPage = lazy(() => import('./components/auth/AuthPages').then(m => ({ default: m.ClientRegisterPage })));
const StaffLoginPage = lazy(() => import('./components/auth/AuthPages').then(m => ({ default: m.StaffLoginPage })));
const StaffOnboardingWizard = lazy(() => import('./components/workspace/StaffOnboardingWizard').then(m => ({ default: m.StaffOnboardingWizard })));
const LiveCalendarModule = lazy(() => import('./components/calendar/LiveCalendarModule').then(m => ({ default: m.LiveCalendarModule })));
const VirtualConsultationRoom = lazy(() => import('./components/consultation/VirtualConsultationRoom').then(m => ({ default: m.VirtualConsultationRoom })));

import { DemoAppRouter } from './demo/DemoAppRouter';
import { PublicV2Router } from './public-v2/PublicV2Router';
import { DemoAuthService } from './demo/services/DemoAuthService';
import { DEMO_ROLES, DemoRole } from './demo/types';
import { ErrorPageView } from './demo/components/ErrorPages';

import { LiveClientWorkflowRouter } from './components/workflow/LiveClientWorkflowRouter';
function getUrlTarget(): string {
  if (typeof window === 'undefined') return '';
  const hash = (window.location.hash || '').replace(/^#\/?/, '').replace(/^\/+/, '').toLowerCase();
  const path = (window.location.pathname || '').replace(/^\/+/, '').toLowerCase();
  return hash || path;
}

function isTaxGuardRouteUrl(): boolean {
  return getUrlTarget().startsWith('taxguard');
}

function isPublicV2RouteUrl(): boolean {
  return getUrlTarget().startsWith('public-v2');
}

function isCanonicalLiveAuthRouteUrl(): boolean {
  const target = getUrlTarget().replace(/\/+$/, '');
  return target === 'client/login' || target === 'client/register';
}

function isClientScopedRouteUrl(): boolean {
  const target = getUrlTarget();
  return target === 'client' || target.startsWith('client/');
}

function hasLiveClientWorkspace(user: { role?: string } | null | undefined): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
    user?.role === 'client' &&
    localStorage.getItem('taxguard_environment') === 'live' &&
    !DemoAuthService.isAuthenticated('client')
  );
}


function isDemoRouteUrl(): boolean {
  const target = getUrlTarget();
  if (target.startsWith('taxguard') || target.startsWith('public-v2')) return false;
  if (isCanonicalLiveAuthRouteUrl()) return false;
  if (target.startsWith('error/')) return true;
  if (target === 'portals' || target.startsWith('portals/')) return true;
  if (target.endsWith('/login') || target.endsWith('/dashboard')) return true;
  if (target.includes('/login') || target.includes('/dashboard')) return true;
  return ['client-portal', 'client_portal', 'reviewer-portal', 'staff-portal', 'cpa-portal', 'admin-dashboard', 'admin-portal', 'reviewer-workspace', 'accountant-workspace', 'portals'].includes(target);
}

const AppContent: React.FC = () => {
  const { currentPage, currentUser, setCurrentPage, pageParams } = useApp();
  const [liveTaxYear, setLiveTaxYear] = React.useState<number>(
    () => new Date().getFullYear() - 1
  );
  const [isDemoRoute, setIsDemoRoute] = React.useState(() => isDemoRouteUrl());
  const [isPublicV2Route, setIsPublicV2Route] = React.useState(() => isPublicV2RouteUrl());
  const [isTaxGuardRoute, setIsTaxGuardRoute] = React.useState(() => isTaxGuardRouteUrl());

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

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(`[DIAGNOSTIC] Router initialization: active page = "${currentPage}", isTaxGuardRoute = ${isTaxGuardRoute}, isDemoRoute = ${isDemoRoute}, isPublicV2Route = ${isPublicV2Route}, authenticatedRole = "${currentUser?.role || 'none'}"`);
    }
  }, [currentPage, isTaxGuardRoute, isDemoRoute, isPublicV2Route, currentUser?.role]);
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
      const hasLiveClientSession = hasLiveClientWorkspace(currentUser);
      const hasDemoClientSession = DemoAuthService.isAuthenticated('client');

      if (hasLiveClientSession) {
        targetHash = '#/client_portal';
      } else if (hasDemoClientSession) {
        targetHash = '#/client/dashboard';
      } else {
        targetHash = '#/client/login';
      }
    }

    if (targetHash && window.location.hash !== targetHash) {
      window.location.hash = targetHash;
      setIsDemoRoute(
        targetHash !== '#/client/login' &&
        targetHash !== '#/stage_one_onboard' &&
        !Boolean(currentUser && currentUser.role === 'client')
      );
    }
  }, [currentPage, currentUser]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  const isTaxGuard = isTaxGuardRoute || isTaxGuardRouteUrl() || (currentPage as string) === 'taxguard';
  if (isTaxGuard) {
    const activeRoles = DemoAuthService.getActiveRoles();
    if (activeRoles && activeRoles.length > 0) {
      const primaryRole = activeRoles[0] as DemoRole;
      const targetPath = DEMO_ROLES[primaryRole]?.dashboardPath || '#/client/dashboard';
      if (window.location.hash !== targetPath) window.location.hash = targetPath;
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

  const isPublicV2 = isPublicV2Route || isPublicV2RouteUrl() || currentPage === 'public_v2';
  if (isPublicV2) return <PublicV2Router />;

  const hasDemoClientSession = DemoAuthService.isAuthenticated('client');
  const hasLiveClientSession = hasLiveClientWorkspace(currentUser);
  const isLiveClientRoute = hasLiveClientSession && (
    isClientScopedRouteUrl() ||
    ['client_portal', 'stage_one_onboard', 'onboarding', 'client_onboarding'].includes(currentPage)
  );

  const isDemo = !isLiveClientRoute && (
    isDemoRoute ||
    isDemoRouteUrl() ||
    [
      'portals',
      'admin_dashboard',
      'admin_portal',
      'reviewer_workspace',
      'senior_reviewer_workspace',
      'reviewer_portal',
      'accountant_workspace',
      'staff_portal'
    ].includes(currentPage) ||
    (currentPage === 'client_portal' && hasDemoClientSession && !hasLiveClientSession)
  );

  if (isDemo) return <DemoAppRouter />;

  const renderPage = () => {
    if (currentPage === 'client_portal' && hasLiveClientSession) {
      const permanentClientId = currentUser?.clientId?.trim();

      if (!permanentClientId) {
        return (
          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-red-800">
              LIVE Workspace Locked
            </h2>

            <p className="mt-2 text-sm text-slate-700">
              A permanent TaxGuard Client ID is required before the LIVE workflow can open.
              TaxGuard will not substitute DEMO data or create a browser-side Client ID.
            </p>
          </div>
        );
      }

      return (
        <LiveClientWorkflowRouter
          clientId={permanentClientId}
          taxYear={liveTaxYear}
          onTaxYearChange={setLiveTaxYear}
        />
      );
    }

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

    if (
      currentPage === 'stage_one_onboard' ||
      currentPage === 'onboarding' ||
      currentPage === 'client_onboarding'
    ) {
      if (!hasLiveClientSession) {
        return <ClientLoginPage />;
      }

      const permanentClientId = currentUser?.clientId?.trim();

      if (!permanentClientId) {
        return <ClientLoginPage />;
      }

      return (
        <LiveClientWorkflowRouter
          clientId={permanentClientId}
          taxYear={liveTaxYear}
          onTaxYearChange={setLiveTaxYear}
        />
      );
    }

    if (currentPage === 'staff_onboarding') {
      if (!currentUser) return <StaffLoginPage />;
      return <StaffOnboardingWizard />;
    }

    switch (currentPage) {
      case 'home': return <HomePage />;
      case 'about': return <AboutPage />;
      case 'founder': return <FounderPage />;
      case 'services': return <ServicesPage />;
      case 'industries': return <IndustriesPage />;
      case 'tax_strategies': return <TaxStrategiesPage />;
      case 'pricing': return <PricingPage />;
      case 'book_consultation': return <BookConsultationPage />;
      case 'resources': return <ResourcesPage />;
      case 'careers': return <CareersPage />;
      case 'job_detail': return <JobDetailPage />;
      case 'contact': return <ContactPage />;
      case 'privacy': return <PrivacyPolicyPage />;
      case 'terms': return <TermsOfServicePage />;
      case 'accessibility': return <AccessibilityStatementPage />;
      case 'security': return <SecurityDataHandlingPage />;
      case 'disclaimers': return <ProfessionalDisclaimersPage />;
      case 'live_calendar': return <LiveCalendarModule />;
      case 'virtual_consultation_room':
        return (
          <VirtualConsultationRoom
            roomId={pageParams?.roomId}
            appointmentId={pageParams?.appointmentId}
            onExit={() => setCurrentPage('stage_one_onboard')}
          />
        );
      case 'client_login': return <ClientLoginPage />;
      case 'client_register': return <ClientRegisterPage />;
      case 'staff_login': return <StaffLoginPage />;
      case 'not_found':
      default:
        return <NotFoundPage />;
    }
  };

  const portalRoutes = new Set<string>([
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
    'virtual_consultation_room'
  ]);

  if (portalRoutes.has(currentPage)) {
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
