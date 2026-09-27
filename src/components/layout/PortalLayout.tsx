import React from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { NotificationBell } from '../common/NotificationBell';
import { 
  Lock, 
  ShieldCheck, 
  LogOut, 
  Globe, 
  User, 
  ExternalLink,
  ChevronRight,
  Phone,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  const { currentUser, currentRole, logout, setCurrentPage, currentPage } = useApp();

  const getWorkspaceTitle = () => {
    switch (currentPage) {
      case 'admin_dashboard':
      case 'admin_portal':
        return 'Firm Administration & Governance';
      case 'reviewer_workspace':
      case 'senior_reviewer_workspace':
      case 'reviewer_portal':
        return 'Senior Reviewer & CPA Workspace';
      case 'accountant_workspace':
      case 'staff_portal':
        return 'Staff Accountant Practice Workspace';
      case 'live_calendar':
        return 'Client Consultation Calendar';
      case 'virtual_consultation_room':
        return 'Confidential Video Room';
      case 'client_onboarding':
      case 'onboarding':
        return 'Client Onboarding';
      case 'staff_onboarding':
        return 'Staff Onboarding';
      case 'client_portal':
      default:
        return 'Client Tax Center';
    }
  };

  const getRoleBadge = () => {
    switch (currentRole) {
      case 'super_admin':
      case 'admin':
        return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Admin</span>;
      case 'senior_reviewer':
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Senior CPA</span>;
      case 'accountant':
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Staff</span>;
      case 'client':
      default:
        return <span className="bg-[#C99A3D]/20 text-[#E2BD67] border border-[#C99A3D]/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Client</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#06172C] text-[#F8F6F1] font-sans selection:bg-[#C99A3D] selection:text-[#06172C]">
      {/* High-Security Portal Dedicated Header */}
      <header 
        className="sticky top-0 z-40 w-full bg-[#050E1A] border-b border-[#0B2748] shadow-lg select-none"
        role="banner"
        aria-label="Secure Portal Navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* Left Zone: Firm Portal Identity */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setCurrentPage('home')}
                className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C99A3D] rounded-lg p-1"
                aria-label="A/R Tax Services Portal Home"
              >
                <BrandLogo size="sm" variant="compact" />
              </button>

              <div className="h-6 w-px bg-[#1E3A5F] hidden sm:block" aria-hidden="true" />

              {/* Workspace Badge & Security Tag */}
              <div className="hidden sm:flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                    {getWorkspaceTitle()}
                  </span>
                  {getRoleBadge()}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span>256-Bit TLS &bull; IRS Circular 230 Compliant</span>
                </div>
              </div>
            </div>

            {/* Right Zone: Controls & Account */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              
              {/* Return to Public Site Button */}
              <button
                type="button"
                onClick={() => setCurrentPage('home')}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-[#0B2748] border border-transparent hover:border-[#1E3A5F] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C99A3D]"
                aria-label="View Public Website"
              >
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Public Website</span>
              </button>

              {/* Dedicated 44x44 Notification Bell */}
              <NotificationBell />

              {/* User Identity Pill */}
              {currentUser && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0B2748]/60 border border-[#1E3A5F] text-xs">
                  <div className="w-7 h-7 rounded-lg bg-[#C99A3D]/20 text-[#E2BD67] border border-[#C99A3D]/40 font-bold flex items-center justify-center text-xs">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-slate-200 text-xs truncate max-w-[120px]">
                      {currentUser.name || currentUser.email}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ID: #{currentUser.id?.slice(-5) || 'USER'}
                    </span>
                  </div>
                </div>
              )}

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={() => {
                  logout();
                  setCurrentPage('home');
                }}
                className="min-h-[44px] px-3 sm:px-3.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-rose-200 bg-[#0B2748]/80 hover:bg-rose-950/40 border border-[#1E3A5F] hover:border-rose-800/60 transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                aria-label="Sign out of confidential session"
                title="End secure session"
              >
                <LogOut className="w-4 h-4 text-slate-400 hover:text-rose-400" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>

            </div>

          </div>
        </div>
      </header>

      {/* Main Workspace Canvas */}
      <main className="flex-1 min-w-0 bg-[#06172C]">
        {children}
      </main>

      {/* Restrained, Dedicated Portal Footer */}
      <footer 
        className="bg-[#050E1A] border-t border-[#0B2748] py-4 text-xs text-slate-400 select-none"
        role="contentinfo"
        aria-label="Secure Portal Footer"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-[#C99A3D]" />
            <span>
              &copy; {new Date().getFullYear()} A/R Tax Services, LLC &bull; Confidential Client & Practice Portal
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-[11px] text-slate-400">
            <span className="text-slate-500 hidden sm:inline">&bull;</span>
            <a 
              href="tel:678-205-9486"
              className="text-slate-300 hover:text-[#E2BD67] transition-colors flex items-center gap-1"
            >
              <Phone className="w-3 h-3 text-[#C99A3D]" />
              <span>Support: 678-205-9486</span>
            </a>
            <span className="text-slate-600">&bull;</span>
            <button
              onClick={() => setCurrentPage('security')}
              className="hover:text-slate-200 transition-colors underline"
            >
              Security Policy
            </button>
            <span className="text-slate-600">&bull;</span>
            <button
              onClick={() => setCurrentPage('privacy')}
              className="hover:text-slate-200 transition-colors underline"
            >
              Privacy Notice
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
