/**
 * A/R Tax Services, LLC - Unified Master Demonstration Router
 * Intercepts protected role dashboard and login routes.
 * Enforces strict authentication tokens, isolation, and role boundaries.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { DemoRole, DEMO_ROLES, DemoRoleConfig } from './types';
import { DemoAuthService } from './services/DemoAuthService';
import { DashboardShell, NavItem } from './components/DashboardShell';
import { RoleLoginPage } from './components/RoleLoginPage';
import { ErrorPageView, ErrorPageType } from './components/ErrorPages';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { IntegrationRegistryModal } from './components/IntegrationRegistryModal';
import { CLIENT_NAV_GROUPS } from './config/clientNavGroups';
import { ACCOUNTANT_NAV_GROUPS } from './config/accountantNavGroups';

// Role Views
import { ClientDashboardView } from './views/ClientDashboardView';
import { ReviewerDashboardView } from './views/ReviewerDashboardView';
import { AccountantDashboardView } from './views/AccountantDashboardView';
import { BookkeeperDashboardView } from './views/BookkeeperDashboardView';
import { PayrollDashboardView } from './views/PayrollDashboardView';
import { AdvisoryDashboardView } from './views/AdvisoryDashboardView';
import { BillingDashboardView } from './views/BillingDashboardView';
import { ComplianceDashboardView } from './views/ComplianceDashboardView';
import { OperationsDashboardView } from './views/OperationsDashboardView';
import { IntakeDashboardView } from './views/IntakeDashboardView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { ExecutiveDashboardView } from './views/ExecutiveDashboardView';
import { LifecycleRoleDashboardView } from './views/LifecycleRoleDashboardView';
import { PortalDirectoryView } from './views/PortalDirectoryView';

// Icons
import {
  FileText,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  CreditCard,
  PenTool,
  Folder,
  Scale,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
  Calculator,
  Inbox,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Award,
  Clock,
  Key,
  Activity,
  UserPlus,
  Lock,
  RotateCcw,
  Phone,
  Send,
  Archive,
  FileCheck,
  RefreshCw,
  Coins,
  ShieldAlert,
  Sparkles,
  Building2,
  BookOpen,
  Share2,
  FileEdit,
  Settings,
  HelpCircle,
  MessageSquare
} from 'lucide-react';

// Route Info Interface
interface ParsedDemoRoute {
  isDemo: boolean;
  isPortals?: boolean;
  isLogin: boolean;
  isDashboard: boolean;
  isError: boolean;
  errorType?: ErrorPageType;
  role?: DemoRole;
}

export const DemoAppRouter: React.FC = () => {
  const [currentHash, setCurrentHash] = useState(() => 
    typeof window !== 'undefined' ? window.location.hash || window.location.pathname : ''
  );
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [integrationsModalOpen, setIntegrationsModalOpen] = useState(false);
  const [activeNavId, setActiveNavId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash || '';
      const params = new URLSearchParams(h.includes('?') ? h.split('?')[1] : window.location.search);
      const tab = params.get('tab');
      if (tab) return tab;
    }
    return 'overview';
  });

  // Listen for hash / popstate changes
  useEffect(() => {
    const handleUrlChange = () => {
      const h = window.location.hash || window.location.pathname;
      setCurrentHash(h);
      const params = new URLSearchParams(h.includes('?') ? h.split('?')[1] : window.location.search);
      const tab = params.get('tab');
      if (tab) {
        setActiveNavId(tab);
      }
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Parse current route
  const routeInfo = useMemo<ParsedDemoRoute>(() => {
    const rawWithQuery = (currentHash || '').replace(/^#\/?/, '').replace(/^\/+/, '');
    const raw = rawWithQuery.split('?')[0].toLowerCase();
    
    // Check for error pages
    if (raw.startsWith('error/')) {
      const errType = raw.replace('error/', '') as ErrorPageType;
      // If unauthorized (401), route directly to client login page
      if (errType === '401') {
        return { isDemo: true, isPortals: false, isLogin: true, isDashboard: false, isError: false, role: 'client' };
      }
      return { isDemo: true, isPortals: false, isLogin: false, isDashboard: false, isError: true, errorType: errType };
    }

    // Check for Staff & Client Portals Directory route
    if (raw === 'portals' || raw === 'portals/' || raw === 'portals/directory') {
      return { isDemo: true, isPortals: true, isLogin: false, isDashboard: false, isError: false };
    }

    // Role mapping check for all 29 roles
    const roles = Object.keys(DEMO_ROLES) as DemoRole[];
    for (const r of roles) {
      const cfg = DEMO_ROLES[r];
      const loginClean = cfg.loginPath.replace(/^#\/?/, '').replace(/^\/+/, '');
      const dashClean = cfg.dashboardPath.replace(/^#\/?/, '').replace(/^\/+/, '');

      if (raw === loginClean) {
        return { isDemo: true, isPortals: false, isLogin: true, isDashboard: false, isError: false, role: r };
      }
      if (raw === dashClean) {
        return { isDemo: true, isPortals: false, isLogin: false, isDashboard: true, isError: false, role: r };
      }
    }

    // Additional aliases and legacy redirects to canonical routes
    if (raw === 'client-portal' || raw === 'client_portal' || raw === 'client/portal' || raw === 'portal') {
      const isClientAuth = DemoAuthService.isAuthenticated('client');
      return { 
        isDemo: true, 
        isPortals: false, 
        isLogin: !isClientAuth, 
        isDashboard: isClientAuth, 
        isError: false, 
        role: 'client' 
      };
    }
    if (raw === 'client-login' || raw === 'client_login' || raw === 'portal/login') {
      return { isDemo: true, isPortals: false, isLogin: true, isDashboard: false, isError: false, role: 'client' };
    }
    if (raw === 'staff-portal' || raw === 'accountant-workspace') {
      return { isDemo: true, isPortals: false, isLogin: false, isDashboard: true, isError: false, role: 'accountant' };
    }
    if (raw === 'reviewer-portal' || raw === 'cpa-portal' || raw === 'reviewer-workspace' || raw === 'senior-reviewer-workspace') {
      return { isDemo: true, isPortals: false, isLogin: false, isDashboard: true, isError: false, role: 'reviewer' };
    }
    if (raw === 'admin-dashboard' || raw === 'admin-portal') {
      return { isDemo: true, isPortals: false, isLogin: false, isDashboard: true, isError: false, role: 'admin' };
    }
    if (raw === 'bookkeeper/login' || raw === 'bookkeeper-login') {
      return { isDemo: true, isPortals: false, isLogin: true, isDashboard: false, isError: false, role: 'bookkeeper' };
    }
    if (raw === 'bookkeeper/dashboard' || raw === 'bookkeeper-dashboard' || raw === 'bookkeeper-workspace') {
      return { isDemo: true, isPortals: false, isLogin: false, isDashboard: true, isError: false, role: 'bookkeeper' };
    }

    return { isDemo: false, isPortals: false, isLogin: false, isDashboard: false, isError: false };
  }, [currentHash]);

  const role = routeInfo.role;
  const roleConfig: DemoRoleConfig | undefined = role ? DEMO_ROLES[role] : undefined;
  const isAuthenticated = role ? DemoAuthService.isAuthenticated(role) : false;

  // Keep address bar in sync when route is redirected to login without firing synchronous hashchange during render
  useEffect(() => {
    if ((routeInfo.isLogin || !isAuthenticated) && roleConfig?.loginPath) {
      if (typeof window !== 'undefined') {
        const loginHash = roleConfig.loginPath.startsWith('#') ? roleConfig.loginPath : `#${roleConfig.loginPath}`;
        if (window.location.hash !== loginHash && !window.location.hash.endsWith('/login')) {
          window.history.replaceState(null, '', loginHash);
        }
      }
    }
  }, [routeInfo.isLogin, isAuthenticated, roleConfig?.loginPath]);

  // If not a demo route, let the public site render
  if (!routeInfo.isDemo) {
    return null;
  }

  // 1. Staff & Client Portals Directory Route
  if (routeInfo.isPortals) {
    return (
      <PortalDirectoryView
        onNavigate={(path) => {
          window.location.hash = path.startsWith('#') ? path : `#${path}`;
        }}
        onNavigateHome={() => {
          window.location.hash = '#/';
          window.history.pushState(null, '', '/');
        }}
      />
    );
  }

  // 2. Error page route
  if (routeInfo.isError && routeInfo.errorType) {
    return <ErrorPageView type={routeInfo.errorType} />;
  }

  if (!role || !roleConfig) {
    return <ErrorPageView type="404" />;
  }

  // 3. Login Route
  if (routeInfo.isLogin) {
    return (
      <RoleLoginPage
        role={role}
        onSuccess={() => {
          window.location.hash = roleConfig.dashboardPath;
        }}
        onNavigateHome={() => {
          window.location.hash = '#/';
          window.history.pushState(null, '', '/');
        }}
      />
    );
  }

  // 4. Protected Dashboard Route: Check Session Authentication
  if (!isAuthenticated) {
    // Direct access without an active session: Render role's login page directly
    return (
      <RoleLoginPage
        role={role}
        onSuccess={() => {
          window.location.hash = roleConfig.dashboardPath;
        }}
        onNavigateHome={() => {
          window.location.hash = '#/';
          window.history.pushState(null, '', '/');
        }}
      />
    );
  }

  // Navigation Items per Role
  const navItemsByRole: Record<DemoRole, NavItem[]> = {
    client: [
      { id: 'overview', label: 'Overview & Status', icon: FileText },
      { id: 'entities', label: 'Entity Profile & Org Chart', icon: Building2 },
      { id: 'vault', label: 'Document Vault', icon: UploadCloud },
      { id: 'questionnaire', label: 'Tax Organizer', icon: CheckCircle },
      { id: 'bookkeeping', label: 'Bookkeeping & Registers', icon: FileSpreadsheet },
      { id: 'journal', label: 'General Journal & TB', icon: BookOpen },
      { id: 'bank_feeds', label: 'Bank Feeds & Connections', icon: RefreshCw },
      { id: 'accounting_sync', label: 'Cloud Accounting Sync', icon: Layers },
      { id: 'reconciliation', label: 'Bank Reconciliation', icon: Scale },
      { id: 'financial_reports', label: 'Financial Statements', icon: DollarSign },
      { id: 'return_review', label: 'Return Review & 8879', icon: PenTool },
      { id: 'readiness', label: 'Tax Readiness Center', icon: ShieldCheck },
      { id: 'estimated_tax', label: 'Estimated Taxes & Safe Harbor', icon: Calculator },
      { id: 'advisory', label: 'Tax Strategy & Scenarios', icon: TrendingUp },
      { id: 'messages', label: 'Messages & Tasks', icon: MessageSquare },
      { id: 'lender_package', label: 'Credit & Lender Package', icon: Share2 },
      { id: 'amendments', label: 'Amendments & Closures', icon: FileEdit },
      { id: 'billing', label: 'Fee Invoices & Payments', icon: CreditCard },
      { id: 'notices', label: 'Tax Notices & Transcripts', icon: AlertCircle },
      { id: 'archive', label: 'Prior Year Archive', icon: Archive },
      { id: 'settings', label: 'Security & Consents', icon: Settings },
      { id: 'support', label: 'Help & Knowledge Base', icon: HelpCircle }
    ],
    reviewer: [
      { id: 'queue', label: 'Review Queue', icon: Scale },
      { id: 'workpapers', label: 'Source Workpapers', icon: FileSpreadsheet },
      { id: 'diagnostics', label: 'Variance Analysis', icon: Layers },
      { id: 'certification', label: 'CPA Release Gate', icon: ShieldCheck }
    ],
    accountant: [
      { id: 'prep', label: 'Active Returns', icon: FileSpreadsheet },
      { id: 'trial_balance', label: 'Trial Balance Mapping', icon: Layers },
      { id: 'm1', label: 'Schedule M-1', icon: DollarSign },
      { id: 'depreciation', label: 'Section 179 Schedules', icon: Calculator }
    ],
    bookkeeper: [
      { id: 'inbox', label: 'Bank Feed Inbox', icon: Inbox },
      { id: 'reconciliation', label: 'Bank Reconciliation', icon: CheckCircle },
      { id: 'accounts', label: 'Chart of Accounts', icon: Folder },
      { id: 'close', label: 'Month-End Close', icon: Calendar }
    ],
    payroll: [
      { id: 'registers', label: 'Payroll Registers', icon: Users },
      { id: 'form941', label: 'Form 941 Returns', icon: FileText },
      { id: 'liabilities', label: 'EFTPS Liabilities', icon: DollarSign },
      { id: 'yearend', label: 'W-2 & 1099 Filings', icon: Calendar }
    ],
    advisor: [
      { id: 'compensation', label: 'Reasonable Compensation', icon: Calculator },
      { id: 'entity', label: 'Entity Restructuring', icon: Layers },
      { id: 'rd_credit', label: 'Section 41 R&D Credit', icon: Award },
      { id: 'roadmap', label: 'Strategic Action Plan', icon: TrendingUp }
    ],
    billing: [
      { id: 'invoices', label: 'Invoices & A/R Aging', icon: DollarSign },
      { id: 'estimated_pmts', label: 'Estimated Tax Vouchers', icon: Calendar },
      { id: 'ai_credits', label: 'AI Credit Metering', icon: Coins }
    ],
    compliance: [
      { id: 'audit', label: 'Immutable Audit Trail', icon: ShieldCheck },
      { id: 'resolution', label: 'Tax Resolution & Defense', icon: ShieldAlert },
      { id: 'taxguard_audit', label: 'TaxGuard Audit Ledger', icon: Activity },
      { id: 'ai_governance', label: 'AI Governance & Safety', icon: Lock },
      { id: 'irc7216', label: 'IRC § 7216 Consents', icon: FileText },
      { id: 'credentials', label: 'PTIN / EFIN Registry', icon: Key },
      { id: 'retention', label: 'Retention Schedule', icon: Folder }
    ],
    operations: [
      { id: 'board', label: 'Workflow Board', icon: Activity },
      { id: 'capacity', label: 'Capacity Utilization', icon: Users },
      { id: 'deadlines', label: 'Statutory Deadlines', icon: Calendar }
    ],
    intake: [
      { id: 'pipeline', label: 'Prospective Inquiries', icon: UserPlus },
      { id: 'conflict', label: 'Conflict Clearance', icon: ShieldCheck },
      { id: 'proposals', label: 'Proposals & Retainers', icon: FileText }
    ],
    admin: [
      { id: 'tester', label: 'Role Access Matrix', icon: Lock },
      { id: 'actions', label: 'Practice Action Center', icon: Activity },
      { id: 'credits', label: 'AI Credit Metering', icon: Key },
      { id: 'voice', label: 'Voice Assistant Sandbox', icon: Sparkles }
    ],
    executive: [
      { id: 'kpis', label: 'Practice Realization', icon: TrendingUp },
      { id: 'capacity', label: 'Capacity Headroom', icon: Users },
      { id: 'roadmap', label: 'Practice Growth', icon: Award }
    ],
    reception: [
      { id: 'inquiries', label: 'Inquiries Intake', icon: Inbox },
      { id: 'calendar', label: 'Consultations', icon: Calendar },
      { id: 'calls', label: 'Switchboard Log', icon: Phone },
      { id: 'reminders', label: 'Notifications', icon: Clock }
    ],
    'engagement-manager': [
      { id: 'orders', label: 'Scope Change Orders', icon: FileText },
      { id: 'timeline', label: 'Workload Timelines', icon: Activity },
      { id: 'assignments', label: 'Staff Allocations', icon: Users },
      { id: 'sla', label: 'Stage SLA Track', icon: Clock }
    ],
    verification: [
      { id: 'queue', label: 'Identity Review', icon: ShieldCheck },
      { id: 'tin', label: 'SSN / TIN Matches', icon: CheckCircle },
      { id: 'authority', label: 'Signing Authorities', icon: Key },
      { id: 'discrepancies', label: 'Flags & Escalations', icon: AlertCircle }
    ],
    documents: [
      { id: 'intake', label: 'Intake Queue', icon: UploadCloud },
      { id: 'classification', label: 'OCR Classification', icon: Layers },
      { id: 'split', label: 'Dossier Splitting', icon: Folder },
      { id: 'custody', label: 'Chain of Custody', icon: ShieldCheck }
    ],
    'data-entry': [
      { id: 'batches', label: 'Data Batches', icon: Layers },
      { id: 'cash', label: 'Cash Expense Ledger', icon: DollarSign },
      { id: 'slips', label: 'Receipt Transcripts', icon: FileText },
      { id: 'submit', label: 'Submit to Books', icon: CheckCircle }
    ],
    'accounts-payable': [
      { id: 'bills', label: 'Vendor Payables', icon: CreditCard },
      { id: 'w9', label: 'W-9 Compliance', icon: FileText },
      { id: 'batches', label: 'ACH Batches', icon: Layers },
      { id: 'disburse', label: 'Simulated Payments', icon: DollarSign }
    ],
    'accounts-receivable': [
      { id: 'aging', label: 'Receivable Aging', icon: DollarSign },
      { id: 'plans', label: 'Payment Plans', icon: Calendar },
      { id: 'remind', label: 'Dunning Reminders', icon: Clock },
      { id: 'receipts', label: 'Record Payments', icon: CreditCard }
    ],
    'quality-control': [
      { id: 'inspections', label: 'QC Inspections', icon: ShieldCheck },
      { id: 'checklist', label: '7-Point Checklist', icon: CheckCircle },
      { id: 'findings', label: 'Remediation Log', icon: AlertCircle },
      { id: 'gate', label: 'Release Gate', icon: Lock }
    ],
    filing: [
      { id: 'gates', label: 'Release Gates', icon: Lock },
      { id: 'diagnostics', label: 'MeF Diagnostics', icon: Activity },
      { id: 'batches', label: 'Filing Batches', icon: Layers },
      { id: 'transmit', label: 'Simulated Transmit', icon: UploadCloud }
    ],
    acknowledgements: [
      { id: 'acks', label: 'MeF Receipts', icon: CheckCircle },
      { id: 'rejected', label: 'Rejection Alerts', icon: AlertCircle },
      { id: 'corrections', label: 'Correction Cases', icon: RotateCcw },
      { id: 'simulator', label: 'ACK Simulator', icon: Activity }
    ],
    correspondence: [
      { id: 'notices', label: 'Agency Notices', icon: AlertCircle },
      { id: 'deadlines', label: 'Statutory Clocks', icon: Clock },
      { id: 'draft', label: 'AI Defense Draft', icon: FileText },
      { id: 'submit', label: 'Simulated Filings', icon: Send }
    ],
    resolution: [
      { id: 'cases', label: 'Resolution Cases', icon: Scale },
      { id: 'oic', label: 'Form 433 Financials', icon: Calculator },
      { id: 'hearings', label: 'Appeals Conferences', icon: Calendar },
      { id: 'agreements', label: 'Payment Settlements', icon: DollarSign }
    ],
    audit: [
      { id: 'exams', label: 'Examination Defense', icon: Scale },
      { id: 'idr', label: 'IDR Workpapers', icon: FileSpreadsheet },
      { id: 'poa', label: 'Form 2848 POA', icon: Key },
      { id: 'closure', label: 'No-Change Closure', icon: ShieldCheck }
    ],
    amendments: [
      { id: 'amendments', label: 'Amended Returns', icon: FileSpreadsheet },
      { id: 'refunds', label: 'Refund Claims', icon: DollarSign },
      { id: 'explanations', label: 'Part III Statements', icon: FileText },
      { id: 'transmit', label: 'File Amendment', icon: Send }
    ],
    records: [
      { id: 'archives', label: 'Retention Archive', icon: Archive },
      { id: 'holds', label: 'Legal Holds', icon: Lock },
      { id: 'certs', label: 'Destruction Certs', icon: FileCheck },
      { id: 'rollforward', label: 'Annual Roll-Forward', icon: RefreshCw }
    ],
    'client-success': [
      { id: 'renewals', label: 'Annual Renewals', icon: RefreshCw },
      { id: 'health', label: 'Client Health Score', icon: Activity },
      { id: 'proposals', label: 'Next-Year Retainers', icon: FileText },
      { id: 'cycle', label: 'Roll Forward Cycle', icon: TrendingUp }
    ],
    support: [
      { id: 'tickets', label: 'Support Queue', icon: Inbox },
      { id: 'sessions', label: 'Role Sessions', icon: Lock },
      { id: 'sla', label: 'SLA Monitoring', icon: Clock },
      { id: 'helpdesk', label: 'System Access', icon: Key }
    ]
  };

  const navItems = navItemsByRole[role] || [];

  // Render role view component
  const renderDashboardContent = () => {
    switch (role) {
      case 'client':
        return (
          <ClientDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'reviewer':
        return (
          <ReviewerDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'accountant':
        return (
          <AccountantDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'bookkeeper':
        return (
          <BookkeeperDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'payroll':
        return (
          <PayrollDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'advisor':
        return (
          <AdvisoryDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'billing':
        return (
          <BillingDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'compliance':
        return (
          <ComplianceDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'operations':
        return (
          <OperationsDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'intake':
        return (
          <IntakeDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      case 'admin':
        return (
          <AdminDashboardView 
            activeNavId={activeNavId} 
            onSelectNav={setActiveNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
            onOpenIntegrations={() => setIntegrationsModalOpen(true)} 
          />
        );
      case 'executive':
        return <ExecutiveDashboardView onOpenAiAssistant={() => setAiAssistantOpen(true)} />;
      // Extended Lifecycle Roles
      case 'reception':
      case 'engagement-manager':
      case 'verification':
      case 'documents':
      case 'data-entry':
      case 'accounts-payable':
      case 'accounts-receivable':
      case 'quality-control':
      case 'filing':
      case 'acknowledgements':
      case 'correspondence':
      case 'resolution':
      case 'audit':
      case 'amendments':
      case 'records':
      case 'client-success':
      case 'support':
        return (
          <LifecycleRoleDashboardView 
            role={role} 
            activeNavId={activeNavId} 
            onOpenAiAssistant={() => setAiAssistantOpen(true)} 
          />
        );
      default:
        return <ErrorPageView type="404" />;
    }
  };

  return (
    <>
      <DashboardShell
        role={role}
        activeNavId={activeNavId}
        onSelectNav={(id) => {
          setActiveNavId(id);
          if (role === 'client' || role === 'accountant') {
            const cleanPath = roleConfig.dashboardPath.split('?')[0];
            window.location.hash = `${cleanPath}?tab=${id}`;
          }
        }}
        navItems={navItems}
        navGroups={role === 'client' ? CLIENT_NAV_GROUPS : (role === 'accountant' ? ACCOUNTANT_NAV_GROUPS : undefined)}
        title={roleConfig.title}
        breadcrumbs={['Demonstration Workspace', roleConfig.department, roleConfig.title]}
        onOpenAiAssistant={() => setAiAssistantOpen(true)}
        onOpenIntegrations={() => setIntegrationsModalOpen(true)}
        isRightDrawerOpen={aiAssistantOpen}
        onCloseRightDrawer={() => setAiAssistantOpen(false)}
        rightDrawerContent={<AiAssistantDrawer role={role} />}
      >
        {renderDashboardContent()}
      </DashboardShell>

      {/* Future Integrations Registry Modal */}
      {integrationsModalOpen && (
        <IntegrationRegistryModal onClose={() => setIntegrationsModalOpen(false)} />
      )}
    </>
  );
};
