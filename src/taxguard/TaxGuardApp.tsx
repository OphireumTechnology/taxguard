/**
 * TaxGuard AI – Verified Tax and Accounting Operations
 * Powered by Ophireum AI Technology
 * Master Module Router & Application Shell
 */

import React, { useState, useEffect } from 'react';
import { TaxGuardNav, TaxGuardSubRoute } from './components/TaxGuardNav';
import { TaxGuardDashboardView } from './views/TaxGuardDashboardView';
import { TaxGuardIntakeView } from './views/TaxGuardIntakeView';
import { TaxGuardDocumentsView } from './views/TaxGuardDocumentsView';
import { TaxGuardExtractionView } from './views/TaxGuardExtractionView';
import { TaxGuardMissingItemsView } from './views/TaxGuardMissingItemsView';
import { TaxGuardDiscrepanciesView } from './views/TaxGuardDiscrepanciesView';
import { TaxGuardWorkpapersView } from './views/TaxGuardWorkpapersView';
import { TaxGuardReviewApprovalView } from './views/TaxGuardReviewApprovalView';
import { TaxGuardResearchView } from './views/TaxGuardResearchView';
import { TaxGuardReportsView } from './views/TaxGuardReportsView';
import { TaxGuardAuditLogView } from './views/TaxGuardAuditLogView';
import { TaxGuardIntegrationsView } from './views/TaxGuardIntegrationsView';
import { TaxGuardAdminSettingsView } from './views/TaxGuardAdminSettingsView';
import { TaxGuardCasesView } from './views/TaxGuardCasesView';
import { TaxGuardScannerView } from './views/TaxGuardScannerView';
import { TaxGuardClassificationView } from './views/TaxGuardClassificationView';
import { TaxGuardFieldMappingView } from './views/TaxGuardFieldMappingView';
import { TaxGuardSummariesView } from './views/TaxGuardSummariesView';
import { TaxGuardEvidenceView } from './views/TaxGuardEvidenceView';

interface TaxGuardAppProps {
  initialRole?: string;
  initialSubRoute?: TaxGuardSubRoute;
  onExit?: () => void;
}

export const TaxGuardApp: React.FC<TaxGuardAppProps> = ({
  initialRole = 'cpa',
  initialSubRoute = 'dashboard',
  onExit
}) => {
  const [currentSubRoute, setCurrentSubRoute] = useState<TaxGuardSubRoute>(initialSubRoute);
  const [activeRole, setActiveRole] = useState<string>(initialRole);

  // Sync subroute from window hash if present, e.g. #taxguard/documents
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.startsWith('taxguard/')) {
        const sub = hash.replace('taxguard/', '').split('?')[0] as TaxGuardSubRoute;
        if (sub) {
          setCurrentSubRoute(sub);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleNavigate = (sub: TaxGuardSubRoute) => {
    setCurrentSubRoute(sub);
    window.location.hash = `#taxguard/${sub}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FBFAF7] text-[#1A2028] flex flex-col font-sans selection:bg-[#C99A32]/20 selection:text-[#061A2F]">
      {/* Navigation Header */}
      <TaxGuardNav
        currentSubRoute={currentSubRoute}
        onNavigate={handleNavigate}
        userRole={activeRole}
        onExitToPortal={onExit}
      />

      {/* Role Switching Utility Strip for Demonstration / Testing */}
      <div className="bg-[#031323] text-slate-300 border-b border-[#1A365D] py-1.5 px-4 sm:px-6 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px]">Role Perspective:</span>
            <div className="inline-flex rounded-xs border border-slate-700 bg-[#061A2F] p-0.5 text-[10px] font-semibold">
              {(['client', 'preparer', 'reviewer', 'cpa', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={`px-2 py-0.5 rounded-xs uppercase tracking-wider transition-colors ${
                    activeRole === role
                      ? 'bg-[#C99A32] text-[#061A2F] font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono hidden md:block">
            NIST AI RMF 1.0 Aligned • Circular 230 Compliant • Multi-Tenant Isolated
          </div>
        </div>
      </div>

      {/* Main Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentSubRoute === 'dashboard' && (
          <TaxGuardDashboardView userRole={activeRole} onNavigateSubRoute={handleNavigate} />
        )}
        {currentSubRoute === 'cases' && (
          <TaxGuardCasesView userRole={activeRole} />
        )}
        {currentSubRoute === 'intake' && (
          <TaxGuardIntakeView userRole={activeRole} />
        )}
        {currentSubRoute === 'document-scanner' && (
          <TaxGuardScannerView userRole={activeRole} onFinished={() => handleNavigate('documents')} />
        )}
        {currentSubRoute === 'documents' && (
          <TaxGuardDocumentsView userRole={activeRole} />
        )}
        {currentSubRoute === 'classification' && (
          <TaxGuardClassificationView userRole={activeRole} />
        )}
        {currentSubRoute === 'extraction' && (
          <TaxGuardExtractionView userRole={activeRole} />
        )}
        {currentSubRoute === 'field-mapping' && (
          <TaxGuardFieldMappingView userRole={activeRole} />
        )}
        {currentSubRoute === 'summaries' && (
          <TaxGuardSummariesView userRole={activeRole} />
        )}
        {currentSubRoute === 'evidence' && (
          <TaxGuardEvidenceView userRole={activeRole} />
        )}
        {currentSubRoute === 'missing-items' && (
          <TaxGuardMissingItemsView userRole={activeRole} />
        )}
        {currentSubRoute === 'discrepancies' && (
          <TaxGuardDiscrepanciesView userRole={activeRole} />
        )}
        {currentSubRoute === 'workpapers' && (
          <TaxGuardWorkpapersView userRole={activeRole} />
        )}
        {currentSubRoute === 'review' && (
          <TaxGuardReviewApprovalView userRole={activeRole} />
        )}
        {currentSubRoute === 'research' && (
          <TaxGuardResearchView userRole={activeRole} />
        )}
        {currentSubRoute === 'reports' && (
          <TaxGuardReportsView userRole={activeRole} />
        )}
        {currentSubRoute === 'verification' && (
          <TaxGuardReportsView userRole={activeRole} />
        )}
        {currentSubRoute === 'audit-log' && (
          <TaxGuardAuditLogView userRole={activeRole} />
        )}
        {currentSubRoute === 'integrations' && (
          <TaxGuardIntegrationsView userRole={activeRole} />
        )}
        {currentSubRoute === 'settings' && (
          <TaxGuardAdminSettingsView userRole={activeRole} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D8DCE2] bg-white py-4 px-4 sm:px-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <span className="font-bold text-[#061A2F]">A/R Tax Services, LLC</span> • TaxGuard AI Operations Engine
          </div>
          <div className="text-[11px] font-mono">
            Powered by Ophireum AI Technology • All rights reserved
          </div>
        </div>
      </footer>
    </div>
  );
};
export default TaxGuardApp;
