/**
 * A/R Tax Services, LLC — Production Portal Directory
 * Authoritative role-based entry point for Clients, Staff, Reviewers, and Practice Administrators.
 */

import React from 'react';
import { 
  Users, 
  FileText, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  Building2, 
  Briefcase, 
  Scale, 
  Layers, 
  CheckCircle2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { useApp, PageRoute } from '../../context/AppContext';

interface PortalDirectoryPageProps {
  onNavigate?: (page: PageRoute) => void;
}

export const PortalDirectoryPage: React.FC<PortalDirectoryPageProps> = ({ onNavigate }) => {
  const { currentUser, setCurrentPage } = useApp();

  const handleGo = (page: PageRoute) => {
    if (onNavigate) {
      onNavigate(page);
    } else {
      setCurrentPage(page);
    }
  };

  const portalCards = [
    {
      id: 'client',
      title: 'Client Tax Center',
      role: 'Taxpayers, Businesses & Families',
      badge: 'Client Portal',
      badgeColor: 'border-[#D4A843]/40 bg-[#D4A843]/10 text-[#D4A843]',
      icon: Users,
      iconColor: 'text-[#D4A843]',
      description: 'Upload tax documents, complete the guided questionnaire, review draft returns, sign Form 8879, and track e-filing status.',
      primaryActionLabel: currentUser?.role === 'client' ? 'Enter Client Tax Center' : 'Sign In as Client',
      primaryTarget: (currentUser?.role === 'client' ? 'portal' : 'client_login') as PageRoute,
      secondaryActionLabel: !currentUser ? 'New Client Registration' : undefined,
      secondaryTarget: 'client_register' as PageRoute,
      features: ['Secure document vault', 'Action-oriented dashboard', 'E-signature authorization', 'Real-time filing tracker']
    },
    {
      id: 'accountant',
      title: 'Staff & Accountant Workspace',
      role: 'Preparers, Bookkeepers & Staff',
      badge: 'Preparation & Review',
      badgeColor: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
      icon: Briefcase,
      iconColor: 'text-blue-400',
      description: 'Manage assigned client tax dossiers, conduct document side-by-side validation, reconcile accounts, and prepare returns.',
      primaryActionLabel: ['accountant', 'preparer'].includes(currentUser?.role || '') ? 'Open Accountant Workspace' : 'Staff Sign In',
      primaryTarget: (['accountant', 'preparer'].includes(currentUser?.role || '') ? 'staff' : 'staff_login') as PageRoute,
      features: ['Assigned dossier queue', 'Side-by-side document review', 'Categorization & recording', 'Discrepancy resolution']
    },
    {
      id: 'reviewer',
      title: 'Senior Reviewer & CPA Workspace',
      role: 'Quality Reviewers, CPAs & EAs',
      badge: 'Maker-Checker QC',
      badgeColor: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
      icon: Scale,
      iconColor: 'text-purple-400',
      description: 'Independent quality control, maker-checker return certification, workpaper review, variance diagnostics, and approval gating.',
      primaryActionLabel: ['reviewer', 'senior_reviewer'].includes(currentUser?.role || '') ? 'Open Reviewer Workspace' : 'Reviewer Sign In',
      primaryTarget: (['reviewer', 'senior_reviewer'].includes(currentUser?.role || '') ? 'staff' : 'staff_login') as PageRoute,
      features: ['Independent sign-off', 'Maker-checker validation', 'Immutable version seal', 'Regulatory compliance checks']
    },
    {
      id: 'admin',
      title: 'Practice Administration Console',
      role: 'Managing Partners & Administrators',
      badge: 'Practice Governance',
      badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400',
      description: 'Practice oversight, tenant and user authorization, external provider readiness monitoring, and compliance audit trail inspection.',
      primaryActionLabel: ['admin', 'super_admin'].includes(currentUser?.role || '') ? 'Open Admin Console' : 'Administrator Sign In',
      primaryTarget: (['admin', 'super_admin'].includes(currentUser?.role || '') ? 'staff' : 'staff_login') as PageRoute,
      features: ['Provider readiness status', 'Role & user governance', 'Case & engagement tracking', 'Tamper-evident audit logs']
    }
  ];

  return (
    <div className="min-h-screen bg-[#06182B] text-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
      <div className="max-w-6xl mx-auto w-full space-y-10">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#0D2745] border border-slate-700/60 text-[#D4A843]">
            <Building2 className="w-3.5 h-3.5" />
            <span>A/R Tax Services, LLC &bull; TaxGuard Secure Operating System</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-tight">
            Professional Practice &amp; Client Portals
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Select your authorized portal to access client dossiers, tax preparation workflows, independent quality reviews, or practice administration.
          </p>
        </div>

        {/* Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {portalCards.map((card) => {
            const Icon = card.icon;
            return (
              <div 
                key={card.id}
                className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-[#D4A843]/50 transition-all duration-200 shadow-xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-[#06182B] border border-slate-700/60 flex items-center justify-center">
                      <Icon className={`w-6 h-6 ${card.iconColor}`} />
                    </div>
                    <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{card.title}</h2>
                    <p className="text-xs text-[#D4A843] font-medium mt-0.5">{card.role}</p>
                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{card.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-2 font-bold">
                      Key Capabilities
                    </span>
                    <ul className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      {card.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleGo(card.primaryTarget as PageRoute)}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <span>{card.primaryActionLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {card.secondaryActionLabel && (
                    <button
                      type="button"
                      onClick={() => handleGo(card.secondaryTarget as PageRoute)}
                      className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#06182B] hover:bg-[#102D4F] border border-slate-700/60 transition-colors cursor-pointer"
                    >
                      {card.secondaryActionLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Security & Architecture Guarantees */}
        <div className="bg-[#071A2E] border border-slate-700/60 rounded-xl p-5 text-xs text-slate-300 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Lock className="w-4 h-4 text-[#D4A843]" />
            <span>Authoritative Security &amp; Statutory Governance</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[11px] text-slate-400">
            <div className="p-3 bg-[#06182B] rounded-lg border border-slate-800">
              <span className="font-bold text-white block mb-0.5">IRC § 7216 Privacy</span>
              Statutory taxpayer disclosure protections with immutable consent logs.
            </div>
            <div className="p-3 bg-[#06182B] rounded-lg border border-slate-800">
              <span className="font-bold text-white block mb-0.5">Server Authoritative</span>
              No client-side state forgery. All stage gates evaluated server-side.
            </div>
            <div className="p-3 bg-[#06182B] rounded-lg border border-slate-800">
              <span className="font-bold text-white block mb-0.5">Maker-Checker Controls</span>
              Preparers cannot self-approve returns requiring independent CPA review.
            </div>
            <div className="p-3 bg-[#06182B] rounded-lg border border-slate-800">
              <span className="font-bold text-white block mb-0.5">Fail-Closed Pipeline</span>
              External integrations fail closed as NOT_CONFIGURED when uncommissioned.
            </div>
          </div>
        </div>

      </div>

      <footer className="mt-12 text-center text-xs text-slate-500 font-mono">
        &copy; {new Date().getFullYear()} A/R Tax Services, LLC &bull; Columbia, SC &bull; Confidential &amp; Proprietary
      </footer>
    </div>
  );
};
