import React from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { ShieldCheck, UserCheck, KeyRound, ExternalLink } from 'lucide-react';

export const RoleSwitcherBanner: React.FC = () => {
  const { currentRole, setCurrentRole, currentUser, currentPage, setCurrentPage } = useApp();

  const roleOptions: { role: UserRole | 'guest'; label: string; sub: string }[] = [
    { role: 'guest', label: 'Guest / Public', sub: 'Prospective Client View' },
    { role: 'client', label: 'Michael Perotti', sub: 'Individual Client Portal' },
    { role: 'client', label: 'Comfort Dondo', sub: 'Business Client (LLC)' },
    { role: 'accountant', label: 'Desmond Hinds', sub: 'Founder / Senior Tax Strategist' },
    { role: 'senior_reviewer', label: 'Elena Rostova, CPA', sub: 'Senior Compliance Reviewer' },
    { role: 'admin', label: 'Operations Admin', sub: 'Firm Administrator' },
    { role: 'super_admin', label: 'Super Admin', sub: 'Security & Compliance' },
  ];

  return (
    <div className="bg-[#050E1A] border-b border-[#0B2748] text-xs text-slate-300 py-1.5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Left Security & Location Status */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[#E2BD67] font-medium whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C99A3D] flex-shrink-0" />
            <span className="tracking-wide text-[11px] sm:text-xs">Secure Portal</span>
          </div>
          <span className="hidden sm:inline text-slate-600">|</span>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 whitespace-nowrap text-[11px] sm:text-xs">
            <span>Columbia, SC</span>
            <span className="text-[#C99A3D]">•</span>
            <a href="tel:678-205-9486" className="text-slate-300 hover:text-[#E2BD67] transition-colors">
              678-205-9486
            </a>
          </div>
          <span className="hidden md:inline text-slate-600">|</span>
          <div className="hidden md:flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] whitespace-nowrap">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Operational</span>
          </div>
        </div>

        {/* Center/Right Interactive Role Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 justify-end">
          <span className="hidden lg:inline text-slate-400 font-medium whitespace-nowrap text-[11px]">
            Active Persona:
          </span>

          <div className="relative min-w-0">
            <select
              value={
                currentRole === 'client' && currentUser?.id === 'user_client_2'
                  ? 'business_client'
                  : currentRole
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'business_client') {
                  setCurrentRole('client');
                } else {
                  setCurrentRole(val as UserRole | 'guest');
                }
              }}
              aria-label="Switch Active Persona and Role"
              className="bg-[#0B2748] border border-[#C99A3D]/50 hover:border-[#C99A3D] text-[#F8F6F1] rounded px-2 py-1 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-[#C99A3D] cursor-pointer max-w-[155px] xs:max-w-[200px] sm:max-w-[250px] md:max-w-[300px] truncate"
            >
              <option value="guest">Guest / Public Visitor View</option>
              <option value="client">Client: Michael Perotti (Individual 1040)</option>
              <option value="business_client">Client: Comfort Dondo (LLC)</option>
              <option value="accountant">Staff: Desmond Hinds (Founder)</option>
              <option value="senior_reviewer">Reviewer: Elena Rostova, CPA</option>
              <option value="admin">Admin: Executive Operations</option>
              <option value="super_admin">Security: Super Administrator</option>
            </select>
          </div>

          {/* Direct portal shortcuts */}
          {currentRole === 'client' && currentPage !== 'client_portal' && (
            <button
              onClick={() => setCurrentPage('client_portal')}
              className="hidden sm:inline-flex bg-[#C99A3D]/20 text-[#E2BD67] hover:bg-[#C99A3D]/30 px-2 py-1 rounded text-[11px] font-semibold transition-colors items-center gap-1 whitespace-nowrap"
            >
              <span>Portal</span> <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {currentRole === 'accountant' && currentPage !== 'accountant_workspace' && (
            <button
              onClick={() => setCurrentPage('accountant_workspace')}
              className="hidden sm:inline-flex bg-[#C99A3D]/20 text-[#E2BD67] hover:bg-[#C99A3D]/30 px-2 py-1 rounded text-[11px] font-semibold transition-colors items-center gap-1 whitespace-nowrap"
            >
              <span>Accountant Workspace</span> <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {currentRole === 'senior_reviewer' && currentPage !== 'reviewer_workspace' && (
            <button
              onClick={() => setCurrentPage('reviewer_workspace')}
              className="hidden sm:inline-flex bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 px-2 py-1 rounded text-[11px] font-semibold transition-colors items-center gap-1 whitespace-nowrap border border-purple-500/40"
            >
              <span>Reviewer Workspace</span> <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {(currentRole === 'admin' || currentRole === 'super_admin') && currentPage !== 'admin_dashboard' && (
            <button
              onClick={() => setCurrentPage('admin_dashboard')}
              className="hidden sm:inline-flex bg-[#C99A3D] text-[#06172C] hover:bg-[#E2BD67] px-2 py-1 rounded text-[11px] font-bold transition-colors items-center gap-1 whitespace-nowrap"
            >
              <span>Admin Dashboard</span> <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
