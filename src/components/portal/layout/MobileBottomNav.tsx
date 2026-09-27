import React from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  ShieldCheck, 
  MessageSquare, 
  Menu 
} from 'lucide-react';
import { ClientPortalTab } from '../../../types/clientPortal';

interface MobileBottomNavProps {
  activeTab: ClientPortalTab;
  onSelectTab: (tab: ClientPortalTab) => void;
  onOpenDrawer: () => void;
  unreadMessagesCount?: number;
  pendingApprovalsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenDrawer,
  unreadMessagesCount = 0,
  pendingApprovalsCount = 1
}) => {
  const isOverview = activeTab === 'overview';
  const isWorkspace = activeTab === 'workspace';
  const isApprovals = activeTab === 'approvals';
  const isMessages = activeTab === 'messages';

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#050E1A]/95 backdrop-blur-md border-t border-[#0B2748] px-2 py-2 flex items-center justify-around select-none"
      aria-label="Mobile Navigation"
    >
      <button
        type="button"
        onClick={() => onSelectTab('overview')}
        className={`flex flex-col items-center gap-1 min-w-[56px] py-1 transition-colors ${
          isOverview ? 'text-[#C99A3D]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px] font-medium">Overview</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab('workspace')}
        className={`flex flex-col items-center gap-1 min-w-[56px] py-1 transition-colors ${
          isWorkspace ? 'text-[#C99A3D]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Briefcase className="w-5 h-5" />
        <span className="text-[10px] font-medium">Workspace</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab('approvals')}
        className={`flex flex-col items-center gap-1 min-w-[56px] py-1 relative transition-colors ${
          isApprovals ? 'text-[#C99A3D]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <ShieldCheck className="w-5 h-5" />
          {pendingApprovalsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#C99A3D]" />
          )}
        </div>
        <span className="text-[10px] font-medium">Approvals</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab('messages')}
        className={`flex flex-col items-center gap-1 min-w-[56px] py-1 relative transition-colors ${
          isMessages ? 'text-[#C99A3D]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5" />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
          )}
        </div>
        <span className="text-[10px] font-medium">Messages</span>
      </button>

      <button
        type="button"
        onClick={onOpenDrawer}
        className="flex flex-col items-center gap-1 min-w-[56px] py-1 text-slate-400 hover:text-slate-200 transition-colors"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] font-medium">Menu</span>
      </button>
    </nav>
  );
};
