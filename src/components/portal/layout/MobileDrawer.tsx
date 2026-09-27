import React from 'react';
import { 
  X, 
  LayoutDashboard, 
  Briefcase, 
  ShieldCheck, 
  MessageSquare, 
  CreditCard, 
  UserCheck, 
  LogOut, 
  Headphones,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { ClientPortalTab } from '../../../types/clientPortal';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ClientPortalTab;
  onSelectTab: (tab: ClientPortalTab, subTab?: string) => void;
  onOpenHelp: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onOpenHelp
}) => {
  const { currentUser, logout, setCurrentPage } = useApp();

  if (!isOpen) return null;

  const handleNav = (tab: ClientPortalTab, subTab?: string) => {
    onSelectTab(tab, subTab);
    onClose();
  };

  return (
    <div 
      className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-4/5 max-w-xs bg-[#050E1A] h-full border-l border-[#0B2748] flex flex-col p-5 overflow-y-auto text-slate-100 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#0B2748] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C99A3D]/20 text-[#C99A3D] font-bold flex items-center justify-center text-xs">
              {currentUser?.name ? currentUser.name.charAt(0) : 'C'}
            </div>
            <div>
              <div className="font-serif font-bold text-white text-sm truncate max-w-[150px]">
                {currentUser?.name || 'Client Tax Center'}
              </div>
              <div className="text-[10px] text-slate-400">
                A/R Tax Services Portal
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6 Consolidated Navigation Modules */}
        <div className="flex-1 space-y-2 text-xs">
          
          <button
            onClick={() => handleNav('overview')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-left ${
              activeTab === 'overview' ? 'bg-[#0D2340] text-white font-semibold border border-[#C99A3D]/40' : 'text-slate-300 hover:bg-[#07172B]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-[#C99A3D]" />
            <span>Overview</span>
          </button>

          <div className="space-y-1">
            <button
              onClick={() => handleNav('workspace')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-left ${
                activeTab === 'workspace' ? 'bg-[#0D2340] text-white font-semibold border border-[#C99A3D]/40' : 'text-slate-300 hover:bg-[#07172B]'
              }`}
            >
              <Briefcase className="w-4 h-4 text-[#C99A3D]" />
              <span>Tax Workspace</span>
            </button>
            <div className="pl-6 space-y-1 text-[11px] text-slate-400">
              <button onClick={() => handleNav('workspace', 'intake')} className="block w-full text-left py-1 hover:text-white">Intake Organizer</button>
              <button onClick={() => handleNav('workspace', 'documents')} className="block w-full text-left py-1 hover:text-white">Document Vault</button>
              <button onClick={() => handleNav('workspace', 'books_records')} className="block w-full text-left py-1 hover:text-white">Books &amp; Records</button>
              <button onClick={() => handleNav('workspace', 'return_review')} className="block w-full text-left py-1 hover:text-white text-[#E2BD67]">Return Review</button>
              <button onClick={() => handleNav('workspace', 'filing_status')} className="block w-full text-left py-1 hover:text-white">Filing Status</button>
              <button onClick={() => handleNav('workspace', 'business_closure')} className="block w-full text-left py-1 text-rose-400 hover:text-rose-300">Business Closure</button>
            </div>
          </div>

          <button
            onClick={() => handleNav('approvals')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-left ${
              activeTab === 'approvals' ? 'bg-[#0D2340] text-white font-semibold border border-[#C99A3D]/40' : 'text-slate-300 hover:bg-[#07172B]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#C99A3D]" />
              <span>Approvals</span>
            </div>
            <span className="px-1.5 py-0.5 rounded-full bg-[#C99A3D] text-[#06172C] text-[10px] font-bold">1 Action</span>
          </button>

          <button
            onClick={() => handleNav('messages')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-left ${
              activeTab === 'messages' ? 'bg-[#0D2340] text-white font-semibold border border-[#C99A3D]/40' : 'text-slate-300 hover:bg-[#07172B]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#C99A3D]" />
            <span>Messages &amp; Inquiries</span>
          </button>

          <button
            onClick={() => handleNav('billing')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-left ${
              activeTab === 'billing' ? 'bg-[#0D2340] text-white font-semibold border border-[#C99A3D]/40' : 'text-slate-300 hover:bg-[#07172B]'
            }`}
          >
            <CreditCard className="w-4 h-4 text-[#C99A3D]" />
            <span>Billing</span>
          </button>

          <button
            onClick={() => handleNav('profile_security')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-left ${
              activeTab === 'profile_security' ? 'bg-[#0D2340] text-white font-semibold border border-[#C99A3D]/40' : 'text-slate-300 hover:bg-[#07172B]'
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#C99A3D]" />
            <span>Profile &amp; Security</span>
          </button>
        </div>

        {/* Support & Logout */}
        <div className="border-t border-[#0B2748] pt-4 space-y-2">
          <button
            onClick={() => {
              onClose();
              onOpenHelp();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-[#07172B]"
          >
            <Headphones className="w-4 h-4 text-[#C99A3D]" />
            <span>Advisory Assistance</span>
          </button>

          <button
            onClick={() => {
              logout();
              setCurrentPage('home');
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-950/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
