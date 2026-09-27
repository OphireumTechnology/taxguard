/**
 * A/R Tax Services, LLC - Unified Accountant & Tax Preparation Center
 * Complete implementation of the 20-Item Navigation Architecture & Core Preparation Engine.
 */

import React, { useState, useEffect } from 'react';
import { accountantCenterService } from '../services/AccountantCenterService';
import { demoDataStore } from '../services/DemoDataService';
import { DemoEngagement, DemoTaxWorkpaper } from '../types';

// Subviews
import { AccountantCommandDashboard } from './accountant/AccountantCommandDashboard';
import { ConsolidatedDocumentCenter } from './accountant/ConsolidatedDocumentCenter';
import { WorkpaperCenter } from './accountant/WorkpaperCenter';
import { TaxPreparationWorkspace } from './accountant/TaxPreparationWorkspace';
import { AiExceptionCenter } from './accountant/AiExceptionCenter';
import { MissingDocumentCenter } from './accountant/MissingDocumentCenter';
import { PriorYearComparisonView } from './accountant/PriorYearComparisonView';
import { PreFilingQcView } from './accountant/PreFilingQcView';
import { FinalApprovalFilingView } from './accountant/FinalApprovalFilingView';
import { FilingOperationsView } from './accountant/FilingOperationsView';
import { ReportsExportCenter } from './accountant/ReportsExportCenter';
import { AccountantAuditLogView } from './accountant/AccountantAuditLogView';
import { AccountantAdminViews } from './accountant/AccountantAdminViews';

// Existing legacy TaxGuard components for backward compatibility
import { 
  SmartFormWorkspace,
  WorkpaperEditor,
  MissingItemsPanel,
  DiscrepancyPanel,
  AIResearchAssistant,
  DraftReturnPreparer,
  FixedAssetRegister,
  EntityRelationshipGraph
} from '../../taxguard';

import { 
  Users, 
  Calendar, 
  Sparkles, 
  FileSpreadsheet, 
  ShieldCheck, 
  Send,
  Building2,
  ChevronDown
} from 'lucide-react';

interface AccountantDashboardViewProps {
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
  onOpenAiAssistant: () => void;
  isDark?: boolean;
}

export const AccountantDashboardView: React.FC<AccountantDashboardViewProps> = ({
  activeNavId = 'dashboard',
  onSelectNav = () => {},
  onOpenAiAssistant,
  isDark = false
}) => {
  const [, setTick] = useState(0);

  // Subscribe to AccountantCenterService for real-time reactivity
  useEffect(() => {
    const unsub = accountantCenterService.subscribe(() => {
      setTick(t => t + 1);
    });
    return unsub;
  }, []);

  const selectedClient = accountantCenterService.getSelectedClient();
  const selectedTaxYear = accountantCenterService.getSelectedTaxYear();
  const allClients = accountantCenterService.getAllClients();
  const availableYears = [2026, 2025, 2024, 2023];

  const [filingSubView, setFilingSubView] = useState<'operations' | 'approval'>('operations');

  const currentTab = activeNavId === 'default' || !activeNavId ? 'dashboard' : activeNavId;

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  return (
    <div className="space-y-6">
      {/* Top Client & Tax Year Selection Bar (Section 6 Requirements) */}
      <div className={`p-4 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Client Selector */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 uppercase font-bold text-[10px]">Active Tax Client:</span>
            <select
              value={selectedClient.id}
              onChange={(e) => accountantCenterService.selectClient(e.target.value)}
              className="px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded font-bold text-neutral-900 dark:text-white focus:outline-none"
            >
              {allClients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.category})
                </option>
              ))}
            </select>
          </div>

          {/* Tax Year Selector */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 uppercase font-bold text-[10px]">Filing Year:</span>
            <select
              value={selectedTaxYear}
              onChange={(e) => accountantCenterService.selectTaxYear(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded font-bold text-neutral-900 dark:text-white focus:outline-none"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  Tax Year {yr} {yr === 2025 ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Practice Meta & AI shortcut */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-[11px]">
            ERO EFIN: <strong>574892</strong> &bull; Preparer: <strong>Marcus Vance, EA</strong>
          </span>
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 rounded font-bold uppercase hover:opacity-90 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Assist</span>
          </button>
        </div>
      </div>

      {/* 20-ITEM NAVIGATION ROUTING ENGINE */}
      {/* 1. Dashboard */}
      {(currentTab === 'dashboard' || currentTab === 'overview') && (
        <AccountantCommandDashboard
          onNavigate={onSelectNav}
          onOpenAiAssistant={onOpenAiAssistant}
          isDark={isDark}
        />
      )}

      {/* 2. Clients */}
      {currentTab === 'clients' && (
        <div className="space-y-4">
          <div className={`p-5 border rounded-lg shadow-sm ${cardBg}`}>
            <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary} mb-1`}>
              2. Client Master Directory &amp; Entity Profiles
            </h3>
            <p className={`text-xs ${textSecondary} mb-4`}>
              Select any client below to switch practice context and populate live workpaper calculations.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
              {allClients.map(c => (
                <div
                  key={c.id}
                  onClick={() => accountantCenterService.selectClient(c.id)}
                  className={`p-4 border rounded cursor-pointer transition-all ${
                    c.id === selectedClient.id
                      ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-800 font-bold'
                      : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-sm text-neutral-900 dark:text-white">{c.name}</div>
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded text-[9px]">{c.category}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1">{c.entityType} &bull; {c.filingStatus}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">SSN/EIN: {c.ssnEinMasked}</div>
                  <div className="mt-3 text-[10px] text-emerald-600 font-bold">
                    Status: {c.workflowStatus}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Tax Years */}
      {currentTab === 'tax_years' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary}`}>
              3. Tax Filing Cycle Registry &amp; Multi-Year History
            </h3>
            <p className={`text-xs ${textSecondary}`}>
              Active tax years supported for client {selectedClient.name}.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            {availableYears.map(yr => (
              <div 
                key={yr} 
                onClick={() => accountantCenterService.selectTaxYear(yr)}
                className={`p-4 border rounded cursor-pointer ${
                  yr === selectedTaxYear ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-800' : 'border-neutral-300 dark:border-neutral-700'
                }`}
              >
                <div className="font-bold text-base">TY{yr}</div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {yr === 2025 ? 'Active Preparation (MeF v2025.1)' : yr === 2024 ? 'Accepted Return (Archived)' : 'Historical Record'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Document Center */}
      {currentTab === 'document_center' && (
        <ConsolidatedDocumentCenter isDark={isDark} />
      )}

      {/* 5. Workpaper Center */}
      {(currentTab === 'workpapers' || currentTab === 'lead_dossier') && (
        <WorkpaperCenter 
          isDark={isDark} 
          onNavigateToDocs={() => onSelectNav('document_center')} 
        />
      )}

      {/* 6. Tax Preparation */}
      {(currentTab === 'tax_prep' || currentTab === 'prep' || currentTab === 'draft_prep') && (
        <TaxPreparationWorkspace 
          isDark={isDark} 
          onNavigateToDocs={() => onSelectNav('document_center')} 
        />
      )}

      {/* 7. Exceptions */}
      {(currentTab === 'exceptions' || currentTab === 'diagnostics') && (
        <AiExceptionCenter 
          isDark={isDark} 
          onNavigateToDocs={() => onSelectNav('document_center')} 
        />
      )}

      {/* 8. Missing Documents */}
      {(currentTab === 'missing_docs' || currentTab === 'missing_items') && (
        <MissingDocumentCenter isDark={isDark} />
      )}

      {/* 9. Prior-Year Comparison */}
      {currentTab === 'prior_year' && (
        <PriorYearComparisonView isDark={isDark} />
      )}

      {/* 10. Pre-Filing Review */}
      {currentTab === 'pre_filing_review' && (
        <PreFilingQcView 
          isDark={isDark} 
          onNavigateToFiling={() => onSelectNav('filing_readiness')} 
        />
      )}

      {/* 11. Filing Readiness & Operations */}
      {(currentTab === 'filing_readiness' || currentTab === 'filing_operations') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2 border-neutral-200 dark:border-neutral-800 text-xs font-mono">
            <button
              onClick={() => setFilingSubView('operations')}
              className={`px-3 py-1.5 rounded font-bold transition-all ${
                filingSubView === 'operations'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Filing Operations &amp; Transmission Queue
            </button>
            <button
              onClick={() => setFilingSubView('approval')}
              className={`px-3 py-1.5 rounded font-bold transition-all ${
                filingSubView === 'approval'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Final Return Approval &amp; Attestation
            </button>
          </div>

          {filingSubView === 'operations' ? (
            <FilingOperationsView 
              isDark={isDark} 
              onNavigateToQc={() => onSelectNav('pre_filing_review')}
              onNavigateToPrep={() => onSelectNav('tax_prep')}
              onNavigateToAudit={() => onSelectNav('audit_log')}
            />
          ) : (
            <FinalApprovalFilingView 
              isDark={isDark} 
              onNavigateToQc={() => onSelectNav('pre_filing_review')} 
            />
          )}
        </div>
      )}

      {/* 12. Reports */}
      {currentTab === 'reports' && (
        <ReportsExportCenter isDark={isDark} />
      )}

      {/* 13. Audit Log */}
      {currentTab === 'audit_log' && (
        <AccountantAuditLogView isDark={isDark} />
      )}

      {/* 14. Team */}
      {currentTab === 'team' && (
        <AccountantAdminViews viewId="team" isDark={isDark} />
      )}

      {/* 15. Roles & Permissions */}
      {(currentTab === 'permissions' || currentTab === 'roles') && (
        <AccountantAdminViews viewId="roles" isDark={isDark} />
      )}

      {/* 16. AI Configuration */}
      {currentTab === 'ai_config' && (
        <AccountantAdminViews viewId="ai_config" isDark={isDark} />
      )}

      {/* 17. Document Rules */}
      {currentTab === 'doc_rules' && (
        <AccountantAdminViews viewId="doc_rules" isDark={isDark} />
      )}

      {/* 18. Workflow Configuration */}
      {currentTab === 'workflow_config' && (
        <AccountantAdminViews viewId="workflow" isDark={isDark} />
      )}

      {/* 19. Demo Environment */}
      {currentTab === 'demo_env' && (
        <AccountantAdminViews viewId="demo_env" isDark={isDark} />
      )}

      {/* 20. System Settings */}
      {(currentTab === 'settings' || currentTab === 'system_settings') && (
        <AccountantAdminViews viewId="settings" isDark={isDark} />
      )}

      {/* Legacy subview support (Fixed Assets, Entity Graph, Smart Forms, Research) */}
      {currentTab === 'fixed_assets' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg}`}>
          <FixedAssetRegister userRole="accountant" />
        </div>
      )}
      {currentTab === 'entities' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg}`}>
          <EntityRelationshipGraph userRole="accountant" />
        </div>
      )}
      {currentTab === 'smart_forms' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg}`}>
          <SmartFormWorkspace userRole="accountant" />
        </div>
      )}
      {currentTab === 'research' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg}`}>
          <AIResearchAssistant userRole="accountant" />
        </div>
      )}
    </div>
  );
};
