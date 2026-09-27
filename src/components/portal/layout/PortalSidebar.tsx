import React, { useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  ShieldCheck,
  MessageSquare,
  CreditCard,
  UserCheck,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Headphones,
  CheckCircle2,
  Clock,
  Building,
  FolderOpen,
  FileSpreadsheet,
  Eye,
  Send,
  Archive,
  Calendar,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { ClientPortalTab, TaxWorkspaceTab } from '../../../types/clientPortal';

interface PortalSidebarProps {
  activeTab: ClientPortalTab;
  onSelectTab: (tab: ClientPortalTab, subTab?: string) => void;
  onOpenHelp: () => void;
  pendingApprovalsCount?: number;
  unreadMessagesCount?: number;
  pendingRfiCount?: number;
  unpaidInvoicesCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const PortalSidebar: React.FC<PortalSidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenHelp,
  pendingApprovalsCount = 1,
  unreadMessagesCount = 0,
  pendingRfiCount = 1,
  unpaidInvoicesCount = 0,
  isCollapsed,
  onToggleCollapse
}) => {
  const [workspaceOpen, setWorkspaceOpen] = useState(true);

  const isTabActive = (tab: ClientPortalTab) => {
    if (tab === 'workspace') {
      return (
        activeTab === 'workspace' ||
        activeTab === 'client_intake' ||
        activeTab === 'required_documents' ||
        activeTab === 'document_center' ||
        activeTab === 'documents' ||
        activeTab === 'accounting_connections' ||
        activeTab === 'integrations' ||
        activeTab === 'tax_strategies' ||
        activeTab === 'tax_return' ||
        activeTab === 'reports'
      );
    }
    if (tab === 'approvals') {
      return activeTab === 'approvals';
    }
    if (tab === 'messages') {
      return (
        activeTab === 'messages' ||
        activeTab === 'requests' ||
        activeTab === 'appointments' ||
        activeTab === 'calendar' ||
        activeTab === 'notifications'
      );
    }
    if (tab === 'billing') {
      return activeTab === 'billing';
    }
    if (tab === 'profile_security') {
      return activeTab === 'profile_security' || activeTab === 'onboarding';
    }
    return activeTab === tab;
  };

  const navItemClass = (isActive: boolean) => `
    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group text-left
    ${isActive 
      ? 'bg-[#0D2340] text-white border border-[#C99A3D]/40 shadow-sm' 
      : 'text-slate-300 hover:text-white hover:bg-[#0A1F38]'
    }
  `;

  return (
    <aside 
      className={`hidden md:flex flex-col bg-[#050E1A] border-r border-[#0B2748] transition-all duration-300 select-none flex-shrink-0 relative ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
      aria-label="Client Portal Navigation"
    >
      {/* Top Header Branding */}
      <div className="p-4 border-b border-[#0B2748] flex items-center justify-between min-h-[58px]">
        {!isCollapsed && (
          <div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#C99A3D]">
              A/R TAX SERVICES
            </div>
            <div className="text-xs font-serif font-bold text-white mt-0.5">
              Client Tax Center
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0B2748] transition-colors ml-auto"
          title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
          aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Six Consolidated Modules Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        
        {/* Module A: Overview */}
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('overview')}
            className={navItemClass(isTabActive('overview'))}
            title="Overview"
          >
            {isTabActive('overview') && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#C99A3D] rounded-r-full" />
            )}
            <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${isTabActive('overview') ? 'text-[#C99A3D]' : 'text-slate-400'}`} />
            {!isCollapsed && <span>Overview</span>}
          </button>
        </div>

        {/* Module B: Tax Workspace */}
        <div className="space-y-1">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onSelectTab('workspace')}
              className={navItemClass(isTabActive('workspace'))}
              title="Tax Workspace"
            >
              {isTabActive('workspace') && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#C99A3D] rounded-r-full" />
              )}
              <Briefcase className={`w-4 h-4 flex-shrink-0 ${isTabActive('workspace') ? 'text-[#C99A3D]' : 'text-slate-400'}`} />
              {!isCollapsed && <span>Tax Workspace</span>}
            </button>
            {!isCollapsed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setWorkspaceOpen(!workspaceOpen);
                }}
                className="p-1.5 text-slate-400 hover:text-white -ml-8 relative z-10"
                title="Toggle workspace sections"
              >
                {workspaceOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 text-[#C99A3D]" />}
              </button>
            )}
          </div>

          {/* Sub-Items within Tax Workspace */}
          {!isCollapsed && workspaceOpen && (
            <div className="pl-6 space-y-0.5 pt-0.5 border-l border-[#0B2748]/80 ml-4">
              <button
                type="button"
                onClick={() => onSelectTab('workspace', 'intake')}
                className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-[#07172B] transition-colors"
              >
                Intake Organizer
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('workspace', 'documents')}
                className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-[#07172B] transition-colors"
              >
                Document Vault
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('workspace', 'books_records')}
                className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-[#07172B] transition-colors"
              >
                Books &amp; Records
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('workspace', 'strategy')}
                className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-[#07172B] transition-colors"
              >
                Strategy Summary
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('workspace', 'return_review')}
                className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-[#07172B] transition-colors font-medium text-[#E2BD67]"
              >
                Return Review
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('workspace', 'filing_status')}
                className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-[#07172B] transition-colors"
              >
                Filing Status
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('workspace', 'post_filing')}
                className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-[#07172B] transition-colors"
              >
                Post-Filing Records
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('workspace', 'prior_years')}
                className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-[#07172B] transition-colors"
              >
                Prior Years
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('workspace', 'business_closure')}
                className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 transition-colors flex items-center gap-1 mt-1 border-t border-[#0B2748] pt-1.5"
              >
                <Building className="w-3 h-3 text-rose-400" />
                <span>Business Closure</span>
              </button>
            </div>
          )}
        </div>

        {/* Module C: Approvals */}
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('approvals')}
            className={navItemClass(isTabActive('approvals'))}
            title="Approvals"
          >
            {isTabActive('approvals') && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#C99A3D] rounded-r-full" />
            )}
            <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${isTabActive('approvals') ? 'text-[#C99A3D]' : 'text-slate-400'}`} />
            {!isCollapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>Approvals</span>
                {pendingApprovalsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#C99A3D] text-[#06172C] text-[10px] font-bold">
                    {pendingApprovalsCount}
                  </span>
                )}
              </div>
            )}
          </button>
        </div>

        {/* Module D: Messages */}
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('messages')}
            className={navItemClass(isTabActive('messages'))}
            title="Messages"
          >
            {isTabActive('messages') && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#C99A3D] rounded-r-full" />
            )}
            <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isTabActive('messages') ? 'text-[#C99A3D]' : 'text-slate-400'}`} />
            {!isCollapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>Messages</span>
                {(unreadMessagesCount > 0 || pendingRfiCount > 0) && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    {unreadMessagesCount + pendingRfiCount}
                  </span>
                )}
              </div>
            )}
          </button>
        </div>

        {/* Module E: Billing */}
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('billing')}
            className={navItemClass(isTabActive('billing'))}
            title="Billing"
          >
            {isTabActive('billing') && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#C99A3D] rounded-r-full" />
            )}
            <CreditCard className={`w-4 h-4 flex-shrink-0 ${isTabActive('billing') ? 'text-[#C99A3D]' : 'text-slate-400'}`} />
            {!isCollapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span>Billing</span>
                {unpaidInvoicesCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                    {unpaidInvoicesCount}
                  </span>
                )}
              </div>
            )}
          </button>
        </div>

        {/* Module F: Profile & Security */}
        <div>
          <button
            type="button"
            onClick={() => onSelectTab('profile_security')}
            className={navItemClass(isTabActive('profile_security'))}
            title="Profile & Security"
          >
            {isTabActive('profile_security') && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#C99A3D] rounded-r-full" />
            )}
            <UserCheck className={`w-4 h-4 flex-shrink-0 ${isTabActive('profile_security') ? 'text-[#C99A3D]' : 'text-slate-400'}`} />
            {!isCollapsed && <span>Profile &amp; Security</span>}
          </button>
        </div>

      </div>

      {/* Footer Support Assistance */}
      <div className="p-3 border-t border-[#0B2748] space-y-2">
        <button
          type="button"
          onClick={onOpenHelp}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#0B2748] transition-colors"
          title="Direct Support"
        >
          <Headphones className="w-4 h-4 text-[#C99A3D]" />
          {!isCollapsed && <span>Advisory Assistance</span>}
        </button>

        {!isCollapsed && (
          <div className="px-3 py-2 rounded-xl bg-[#040E1B] border border-[#0B2748] text-[10px] text-slate-400 space-y-0.5">
            <div className="font-bold text-slate-300">IRS Registered ERO</div>
            <div>A/R Tax Services, LLC</div>
            <div className="text-[#C99A3D] font-mono">Pub 4557 Compliant</div>
          </div>
        )}
      </div>
    </aside>
  );
};
