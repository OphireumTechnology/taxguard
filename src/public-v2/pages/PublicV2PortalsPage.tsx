import React from 'react';
import { Lock, ArrowUpRight, Users, ShieldCheck, Briefcase, FileCheck } from 'lucide-react';
import { DEMO_ROLES } from '../../demo/types';

interface PublicV2PortalsPageProps {
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2PortalsPage: React.FC<PublicV2PortalsPageProps> = ({
  onNavigate,
  onOpenConsultation
}) => {
  const primaryPortals = [
    {
      title: 'Secure Client Portal',
      audience: 'Individual & Corporate Tax Clients',
      description: 'Encrypted document uploads, questionnaire completion, tax return draft review, digital Form 8879 signatures, and real-time status tracking.',
      route: '#/client/login',
      badge: 'Client Access'
    },
    {
      title: 'Staff & Accountant Workspace',
      audience: 'Staff Accountants, Bookkeepers & Preparers',
      description: 'Primary workpapers management, general ledger entry, trial balance reconciliations, and draft return assembly.',
      route: '#/accountant/login',
      badge: 'Staff Practice'
    },
    {
      title: 'Senior Reviewer Workspace',
      audience: 'Senior CPAs, Reviewers & Quality Managers',
      description: 'Second-tier technical audit, statutory tax code compliance checks, M-1 adjustments, and return approval for filing.',
      route: '#/reviewer/login',
      badge: 'Review Tier'
    },
    {
      title: 'Administrative Practice Console',
      audience: 'Practice Managers & Partners',
      description: 'Global engagement tracking, user lifecycle management, billing authorizations, and compliance telemetry.',
      route: '#/admin/login',
      badge: 'Executive Admin'
    }
  ];

  return (
    <div className="bg-white text-black space-y-16 py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="border-b border-black pb-8 space-y-3">
        <div className="inline-block border border-black bg-neutral-100 px-3 py-1 text-[11px] font-mono text-black">
          Practice Authentication & Portal Directory
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-black">
          Client & Staff Portals
        </h1>
        <p className="text-base sm:text-lg text-neutral-700 max-w-3xl leading-relaxed">
          Centralized directory for accessing client workspaces, staff accounting tools, technical review pipelines, and the complete 29-role demonstration ecosystem.
        </p>
      </div>

      {/* Primary Workspaces Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {primaryPortals.map((portal, idx) => (
          <div key={idx} className="border border-black p-6 sm:p-8 space-y-4 bg-white flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider bg-neutral-100 px-2 py-0.5 border border-neutral-300 font-semibold text-black">
                  {portal.badge}
                </span>
                <span className="text-xs font-mono text-neutral-500">Portal 0{idx + 1}</span>
              </div>

              <h2 className="text-xl font-bold text-black tracking-tight">{portal.title}</h2>
              <p className="text-xs font-mono text-neutral-600">{portal.audience}</p>
              <p className="text-xs text-neutral-700 leading-relaxed pt-1">
                {portal.description}
              </p>
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <a
                href={portal.route}
                className="w-full py-2.5 bg-black text-white hover:bg-neutral-800 text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>Launch {portal.title}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Complete 29 Roles Ecosystem Banner */}
      <section className="border border-black p-8 sm:p-10 bg-neutral-50 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-300 pb-4">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Practice Ecosystem</span>
            <h2 className="text-xl font-bold text-black tracking-tight mt-0.5">
              Full 29-Role Demonstration Ecosystem
            </h2>
          </div>
          <a
            href="#/portals"
            className="px-5 py-2 bg-white text-black border border-black text-xs font-semibold hover:bg-black hover:text-white transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>Open All 29 Role Directory</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <p className="text-xs text-neutral-700 leading-relaxed max-w-3xl">
          The firm operates an integrated 18-stage operating cycle spanning front-desk reception, multi-tier document intake, trial balance reconciliation, senior CPA review, e-file transmission, audit response, and archival storage. All 29 roles can be simulated directly.
        </p>

        {/* Roles chip grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2">
          {Object.values(DEMO_ROLES).slice(0, 18).map((r) => (
            <a
              key={r.role}
              href={`#${r.dashboardPath}`}
              className="p-2 border border-neutral-300 hover:border-black bg-white hover:bg-neutral-100 text-[11px] font-medium text-black transition-colors block text-center truncate"
              title={r.title}
            >
              {r.title}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
