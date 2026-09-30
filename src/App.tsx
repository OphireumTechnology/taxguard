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

import { PublicV2Router } from './public-v2/PublicV2Router';

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

function hasLiveClientWorkspace(
  user: { role?: string; clientId?: string } | null | undefined
): boolean {
  return Boolean(
    user?.role === 'client' &&
    user?.clientId &&
    user.clientId.trim().length > 0
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
  const {
    currentPage,
    currentUser,
    setCurrentPage,
    pageParams,
    authLifecycleState,
    isInitialized,
    provisionedOnboarding
  } = useApp();
  const [liveTaxYear, setLiveTaxYear] = React.useState<number>(
    () => provisionedOnboarding?.taxYear || 2025
  );
  const [isPublicV2Route, setIsPublicV2Route] = React.useState(() => isPublicV2RouteUrl());
  const [isTaxGuardRoute, setIsTaxGuardRoute] = React.useState(() => isTaxGuardRouteUrl());

  const isInitializingAuth = !isInitialized || authLifecycleState === 'INITIALIZING';
  const hasLiveClientSession = Boolean(
    authLifecycleState === 'AUTHENTICATED' && hasLiveClientWorkspace(currentUser)
  );

  useEffect(() => {
    if (provisionedOnboarding?.taxYear && provisionedOnboarding.taxYear !== liveTaxYear) {
      setLiveTaxYear(provisionedOnboarding.taxYear);
    }
  }, [provisionedOnboarding?.taxYear, liveTaxYear]);

  useEffect(() => {
    const handleUrlChange = () => {
      setIsPublicV2Route(isPublicV2RouteUrl());
      setIsTaxGuardRoute(isTaxGuardRouteUrl());
    };
    handleUrlChange();
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [currentPage]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(
        `[DIAGNOSTIC] Router initialization: active page = "${currentPage}", authLifecycleState = "${authLifecycleState}", isTaxGuardRoute = ${isTaxGuardRoute}, isPublicV2Route = ${isPublicV2Route}, authenticatedRole = "${currentUser?.role || 'none'}"`
      );
    }
  }, [currentPage, authLifecycleState, isTaxGuardRoute, isPublicV2Route, currentUser?.role]);

  useEffect(() => {
    // Do not redirect while session initialization is still in progress
    if (isInitializingAuth) return;

    const isProtectedClientRoute = [
      'stage_one_onboard',
      'onboarding',
      'client_onboarding',
      'client_portal'
    ].includes(currentPage);

    const isPublicClientAuthRoute = [
      'client_login',
      'client_register',
      'login',
      'register'
    ].includes(currentPage);

    if (isProtectedClientRoute && !hasLiveClientSession) {
      setCurrentPage('client_login');
      return;
    }

    if (isPublicClientAuthRoute && hasLiveClientSession) {
      setCurrentPage('stage_one_onboard');
      return;
    }

    let targetHash = '';

    if (currentPage === 'portals') {
      targetHash = '#/public-v2/portals';
    } else if (
      currentPage === 'admin_dashboard' ||
      currentPage === 'admin_portal'
    ) {
      targetHash = currentUser ? '#/admin/dashboard' : '#/staff/login';
    } else if (
      currentPage === 'reviewer_workspace' ||
      currentPage === 'senior_reviewer_workspace' ||
      currentPage === 'reviewer_portal'
    ) {
      targetHash = currentUser ? '#/reviewer/dashboard' : '#/staff/login';
    } else if (
      currentPage === 'accountant_workspace' ||
      currentPage === 'staff_portal'
    ) {
      targetHash = currentUser ? '#/accountant/dashboard' : '#/staff/login';
    }

    if (targetHash && window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, [currentPage, currentUser, hasLiveClientSession, isInitializingAuth, setCurrentPage]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  const isTaxGuard = isTaxGuardRoute || isTaxGuardRouteUrl() || (currentPage as string) === 'taxguard';
  if (isTaxGuard) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold">
            <span>403 Forbidden</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Access Restricted</h1>
          <p className="text-sm text-slate-600">
            Access to standalone TaxGuard console has been removed. TaxGuard AI operates as an integrated service layer within authorized role dashboards. Please log in to your designated role dashboard.
          </p>
          <div className="pt-2 flex gap-3">
            <button
              onClick={() => { window.location.hash = '#/'; }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition"
            >
              Return Home
            </button>
            <button
              onClick={() => { window.location.hash = '#/portals'; }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition"
            >
              Go to Portals
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPublicV2 = isPublicV2Route || isPublicV2RouteUrl() || currentPage === 'public_v2';
  if (isPublicV2) return <PublicV2Router />;

  const renderAuthInitializingState = () => (
    <div
      className="max-w-md mx-auto px-4 py-24 text-center space-y-4"
      aria-live="polite"
      data-testid="auth-initializing-screen"
    >
      <div className="w-10 h-10 border-2 border-[#C6A15B] border-t-transparent rounded-full animate-spin mx-auto" />
      <h2 className="font-serif text-xl font-bold text-white">
        Verifying Secure TaxGuard Session
      </h2>
      <p className="text-xs text-slate-300">
        Restoring your encrypted Client Tax Center credentials and Stage 01 onboarding state...
      </p>
    </div>
  );

  const renderPage = () => {
    if (
      currentPage === 'stage_one_onboard' ||
      currentPage === 'onboarding' ||
      currentPage === 'client_onboarding' ||
      currentPage === 'client_portal'
    ) {
      if (isInitializingAuth) {
        return renderAuthInitializingState();
      }

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

    if (
      currentPage === 'admin_dashboard' ||
      currentPage === 'admin_portal' ||
      currentPage === 'reviewer_workspace' ||
      currentPage === 'senior_reviewer_workspace' ||
      currentPage === 'reviewer_portal' ||
      currentPage === 'accountant_workspace' ||
      currentPage === 'staff_portal' ||
      currentPage === 'portals'
    ) {
      return null;
    }

    if (currentPage === 'staff_onboarding') {
      if (isInitializingAuth) return renderAuthInitializingState();
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
      case 'login':
      case 'client_login':
        return <ClientLoginPage />;
      case 'register':
      case 'client_register':
        return <ClientRegisterPage />;
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

  const isAuthenticatedPortalSession = Boolean(
    !isInitializingAuth &&
    authLifecycleState === 'AUTHENTICATED' &&
    currentUser &&
    (currentUser.role !== 'client' || hasLiveClientSession)
  );

  if (portalRoutes.has(currentPage) && isAuthenticatedPortalSession) {
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
