/**
 * TaxGuard AI – Navigation Header Bar
 * Brand aligned: Navy #061A2F, Gold #C99A32, Ivory #FBFAF7
 */

import React from 'react';
import { 
  ShieldCheck, 
  Layers, 
  FileText, 
  UploadCloud, 
  ListChecks, 
  AlertTriangle, 
  DollarSign, 
  BookOpen, 
  CheckCircle2, 
  Search, 
  QrCode, 
  History, 
  Cpu, 
  Settings,
  ArrowLeft,
  Home,
  FolderKanban,
  Camera,
  GitMerge,
  Sparkles,
  Database
} from 'lucide-react';

export type TaxGuardSubRoute = 
  | 'dashboard'
  | 'cases'
  | 'intake'
  | 'documents'
  | 'document-scanner'
  | 'classification'
  | 'extraction'
  | 'field-mapping'
  | 'summaries'
  | 'evidence'
  | 'missing-items'
  | 'discrepancies'
  | 'workpapers'
  | 'review'
  | 'research'
  | 'reports'
  | 'verification'
  | 'audit-log'
  | 'integrations'
  | 'settings';

interface TaxGuardNavProps {
  currentSubRoute: TaxGuardSubRoute;
  onNavigate: (subRoute: TaxGuardSubRoute) => void;
  userRole: string;
  onExitToPortal?: () => void;
}

export const TaxGuardNav: React.FC<TaxGuardNavProps> = ({
  currentSubRoute,
  onNavigate,
  userRole,
  onExitToPortal
}) => {
  const navItems: Array<{ id: TaxGuardSubRoute; label: string; icon: React.ComponentType<{ className?: string }>; minRole?: string }> = [
    { id: 'dashboard', label: 'Console', icon: Layers },
    { id: 'cases', label: 'Cases & Engagements', icon: FolderKanban },
    { id: 'intake', label: 'Intake', icon: FileText },
    { id: 'document-scanner', label: 'Scanner', icon: Camera },
    { id: 'documents', label: 'Vault', icon: UploadCloud },
    { id: 'classification', label: 'AI Classification', icon: Cpu },
    { id: 'extraction', label: 'OCR Extraction', icon: Cpu },
    { id: 'field-mapping', label: 'Smart Forms & Mapping', icon: GitMerge },
    { id: 'summaries', label: 'Doc Summaries', icon: Sparkles },
    { id: 'evidence', label: 'Evidence Library', icon: Database },
    { id: 'missing-items', label: 'Missing Items', icon: ListChecks },
    { id: 'discrepancies', label: 'Discrepancies', icon: AlertTriangle },
    { id: 'workpapers', label: 'Workpapers', icon: DollarSign },
    { id: 'review', label: 'Maker-Checker Review', icon: CheckCircle2 },
    { id: 'research', label: 'Tax Research', icon: Search },
    { id: 'reports', label: 'Reports & Hash', icon: QrCode },
    { id: 'audit-log', label: 'Audit Trail', icon: History },
    { id: 'integrations', label: 'Integrations', icon: Cpu },
    { id: 'settings', label: 'Governance', icon: Settings, minRole: 'cpa' }
  ];

  return (
    <header className="bg-[#061A2F] text-white border-b border-[#1A365D] sticky top-0 z-30 shadow-md">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between border-b border-[#1A365D]/60 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0A2544] border border-[#C99A32]/60 rounded-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D7AC4A]" />
            <span className="font-bold tracking-wide text-[#F7F4ED] uppercase text-[10px]">TaxGuard AI</span>
          </div>
          <span className="text-slate-300 font-medium hidden sm:inline text-[11px]">
            Verified Tax and Accounting Operations
          </span>
          <span className="text-[10px] text-[#D7AC4A] bg-[#020D18] px-2 py-0.5 border border-[#1A365D] rounded-xs font-mono">
            Powered by Ophireum AI Technology
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
            <span className="text-slate-400">Active Role:</span>
            <span className="font-bold text-[#E8C66A] uppercase px-1.5 py-0.5 bg-[#0A2544] rounded border border-[#1A365D]">
              {userRole}
            </span>
          </div>
          <button
            onClick={() => {
              if (onExitToPortal) {
                onExitToPortal();
              } else {
                window.location.hash = '#/';
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:text-white border border-[#1A365D] hover:bg-[#0A2544] transition-colors rounded-xs"
            title="Return to Main Portal"
          >
            <Home className="w-3 h-3 text-[#D7AC4A]" />
            <span>Firm Portal</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto scrollbar-thin">
        <nav className="flex space-x-1 py-1.5 min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSubRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xs transition-colors ${
                  isActive
                    ? 'bg-[#0A2544] text-[#E8C66A] border-b-2 border-b-[#C99A32] font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-[#0A2544]/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#D7AC4A]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
