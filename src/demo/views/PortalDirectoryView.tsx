/**
 * A/R Tax Services, LLC - Staff & Client Portals Directory
 * Canonical directory of all 29 practice roles grouped by 7 operational stages.
 * Strict black-and-white minimalist design with zero credential exposure.
 */

import React, { useState } from 'react';
import { DemoRole, DEMO_ROLES, DemoRoleConfig } from '../types';
import { DemoBanner } from '../components/DemoBanner';
import { DeveloperContactNotice } from '../components/DeveloperContactNotice';
import { 
  ArrowLeft, 
  Search, 
  Shield, 
  Lock, 
  ExternalLink, 
  Layers, 
  CheckCircle,
  FileText,
  UserCheck,
  Building2,
  Calendar,
  Briefcase
} from 'lucide-react';

interface StageGroup {
  stageName: string;
  stageDescription: string;
  roles: {
    key: DemoRole;
    name: string;
    shortResponsibility: string;
  }[];
}

const PORTAL_STAGE_GROUPS: StageGroup[] = [
  {
    stageName: 'Client and Onboarding',
    stageDescription: 'Initial taxpayer engagement, client intake, identity verification, and document collection.',
    roles: [
      {
        key: 'client',
        name: 'Client / Taxpayer',
        shortResponsibility: 'Secure client portal for document uploads, tax organizers, return reviews, e-signatures, and fee payments.'
      },
      {
        key: 'reception',
        name: 'Reception and Scheduling',
        shortResponsibility: 'Switchboard intake triage, prospective client initial inquiry logging, and consultation calendar scheduling.'
      },
      {
        key: 'intake',
        name: 'Intake and Client Services',
        shortResponsibility: 'Prospective client qualification, engagement scope selection, and guided onboarding organizer dispatch.'
      },
      {
        key: 'engagement-manager',
        name: 'Engagement Manager',
        shortResponsibility: 'Engagement letter administration, professional fee schedules, scope modification orders, and contract tracking.'
      },
      {
        key: 'verification',
        name: 'Identity and Client Verification',
        shortResponsibility: 'Taxpayer identity verification, FinCEN Beneficial Ownership Information (BOI) compliance, and fraud prevention.'
      },
      {
        key: 'documents',
        name: 'Document Intake and Records',
        shortResponsibility: 'W-2, 1099, and K-1 source document intake, OCR data classification, completeness audits, and document vaulting.'
      }
    ]
  },
  {
    stageName: 'Accounting Operations',
    stageDescription: 'General ledger data entry, client bookkeeping, payroll processing, and cash disbursements.',
    roles: [
      {
        key: 'data-entry',
        name: 'Accounting Data Entry',
        shortResponsibility: 'Transaction batch journalizing, receipt data capture, and double-entry source transaction entry.'
      },
      {
        key: 'bookkeeper',
        name: 'Bookkeeping and CAS',
        shortResponsibility: 'Bank feed automated rules, monthly balance sheet reconciliations, and period-end trial balance close.'
      },
      {
        key: 'accounts-payable',
        name: 'Accounts Payable',
        shortResponsibility: 'Vendor invoice processing, approval routing, cash disbursement batches, and Form 1099-NEC vendor tracking.'
      },
      {
        key: 'accounts-receivable',
        name: 'Accounts Receivable',
        shortResponsibility: 'Client billing accounts, retainer deposits, aged accounts receivable collections, and trust ledger management.'
      },
      {
        key: 'payroll',
        name: 'Payroll and Compliance',
        shortResponsibility: 'Payroll processing runs, federal Form 941 reconciliations, state unemployment, and EFTPS tax liability remittance.'
      }
    ]
  },
  {
    stageName: 'Review, Reporting, and Planning',
    stageDescription: 'Senior practitioner workpaper review, quality assurance gates, strategic tax planning, and engagement billing.',
    roles: [
      {
        key: 'reviewer',
        name: 'Senior Reviewer / CPA / EA',
        shortResponsibility: 'Technical return examination, Schedule M-1 verification, maker-checker signoff, and CPA release gating.'
      },
      {
        key: 'quality-control',
        name: 'Quality Control',
        shortResponsibility: 'Pre-transmission 7-point filing release inspection, statutory checklist audits, and quality control scoring.'
      },
      {
        key: 'advisor',
        name: 'Tax Strategy and Advisory',
        shortResponsibility: 'Entity tax restructuring, reasonable compensation studies, Section 199A QBI analysis, and multi-year modeling.'
      },
      {
        key: 'billing',
        name: 'Billing and Collections',
        shortResponsibility: 'Final engagement work-in-progress realization, billing invoice generation, retainer offsets, and collection tracking.'
      }
    ]
  },
  {
    stageName: 'Tax Preparation and Filing',
    stageDescription: 'Core tax preparation, electronic return formatting, transmission batching, and acknowledgement tracking.',
    roles: [
      {
        key: 'accountant',
        name: 'Tax Preparation and Accounting',
        shortResponsibility: 'Trial balance mapping, Schedule M-1 book-to-tax adjustments, Section 179 depreciation, and return prep.'
      },
      {
        key: 'filing',
        name: 'Electronic Return Originator / Filing Specialist',
        shortResponsibility: 'IRS Modernized e-File (MeF) schema validation, electronic transmission packaging, and submission dispatch.'
      },
      {
        key: 'acknowledgements',
        name: 'Government Acknowledgement Specialist',
        shortResponsibility: 'IRS and state MeF electronic ACK validation, rejection code diagnostic triage, and resubmission routing.'
      }
    ]
  },
  {
    stageName: 'Government Response and Resolution',
    stageDescription: 'Statutory government notices, examination representation, audit defense, and amended return processing.',
    roles: [
      {
        key: 'correspondence',
        name: 'Government Correspondence and Notice Specialist',
        shortResponsibility: 'IRS CP2000, CP504, and state DOR notice response drafting, statutory response deadline tracking, and notice defense.'
      },
      {
        key: 'resolution',
        name: 'Tax Resolution and Representation',
        shortResponsibility: 'Form 2848 Power of Attorney representation, Offers in Compromise, installment agreements, and penalty abatements.'
      },
      {
        key: 'audit',
        name: 'Audit and Examination Specialist',
        shortResponsibility: 'IRS field and office audit representation, Information Document Request (IDR) fulfillment, and defense workpapers.'
      },
      {
        key: 'amendments',
        name: 'Amendment and Correction Specialist',
        shortResponsibility: 'Forms 1040-X, 1120-X, and 1065 amended return preparation, prior-year tax discrepancy resolution, and net operating loss carrybacks.'
      }
    ]
  },
  {
    stageName: 'Completion and Continuing Service',
    stageDescription: 'Permanent record dossier archiving, retention compliance, and annual client re-engagement cycles.',
    roles: [
      {
        key: 'records',
        name: 'Records and Archive Manager',
        shortResponsibility: 'Permanent client tax dossier archival, statutory retention scheduling, and immutable record vaulting.'
      },
      {
        key: 'client-success',
        name: 'Client Success and Annual Renewal',
        shortResponsibility: 'Annual client engagement renewal surveys, client relationship management, and next-season cycle initiation.'
      }
    ]
  },
  {
    stageName: 'Firm Management and Technology',
    stageDescription: 'Firm security governance, practice operational metrics, executive leadership, system administration, and technical support.',
    roles: [
      {
        key: 'compliance',
        name: 'Compliance and Security',
        shortResponsibility: 'SOC 2 and GLBA security standards compliance, user access entitlement reviews, and firm security audit logs.'
      },
      {
        key: 'operations',
        name: 'Practice Operations',
        shortResponsibility: 'Firm-wide workload balancing, staff capacity planning, SLA monitoring, and operational bottleneck resolution.'
      },
      {
        key: 'admin',
        name: 'System Administrator',
        shortResponsibility: 'Role session tokens, security sandbox controls, Integration Registry, Role Access Tester, and demo resets.'
      },
      {
        key: 'executive',
        name: 'Firm Owner / Executive',
        shortResponsibility: 'Executive practice KPIs, revenue forecasting, practice realization analysis, and strategic firm growth.'
      },
      {
        key: 'support',
        name: 'IT and Application Support',
        shortResponsibility: 'Portal user support tickets, workstation diagnostics, access troubleshooting, and platform stability.'
      }
    ]
  }
];

interface PortalDirectoryViewProps {
  onNavigate: (path: string) => void;
  onNavigateHome: () => void;
}

export const PortalDirectoryView: React.FC<PortalDirectoryViewProps> = ({
  onNavigate,
  onNavigateHome
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter groups by query
  const filteredGroups = PORTAL_STAGE_GROUPS.map(group => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return group;
    const matchingRoles = group.roles.filter(r => 
      r.name.toLowerCase().includes(q) ||
      r.shortResponsibility.toLowerCase().includes(q) ||
      r.key.toLowerCase().includes(q) ||
      group.stageName.toLowerCase().includes(q)
    );
    return {
      ...group,
      roles: matchingRoles
    };
  }).filter(group => group.roles.length > 0);

  const totalRoles = PORTAL_STAGE_GROUPS.reduce((acc, g) => acc + g.roles.length, 0);

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-sans antialiased selection:bg-black selection:text-white">
      {/* Persistent Demo Banner */}
      <DemoBanner />

      {/* Top Navigation Bar */}
      <header className="border-b border-neutral-300 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome}
              className="p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 transition-colors"
              title="Return to Public Website"
            >
              <ArrowLeft className="w-4 h-4 text-black" />
            </button>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                A/R Tax Services, LLC • Practice Portals
              </div>
              <h1 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-black">
                Staff &amp; Client Portals Directory
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search roles or stages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-neutral-300 text-xs text-black placeholder-neutral-400 focus:outline-none focus:border-black"
              />
            </div>

            <button
              onClick={onNavigateHome}
              className="hidden sm:inline-flex px-3 py-1.5 border border-neutral-300 hover:border-black text-xs font-semibold text-black uppercase tracking-wider transition-colors"
            >
              Public Site
            </button>
          </div>
        </div>
      </header>

      {/* Notice & Context Bar */}
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-neutral-700">
            <Shield className="w-4 h-4 text-black flex-shrink-0" />
            <span>
              <strong>Authentication Required:</strong> All 29 practice portals require demonstration credentials. No credentials are listed in this directory.
            </span>
          </div>
          <div className="flex items-center gap-4 text-neutral-600 font-mono text-[11px]">
            <span>Total Roles: <strong>{totalRoles}</strong></span>
            <span>Stages: <strong>7 Operational Groups</strong></span>
            <span>Security: <strong>Role-Isolated Token</strong></span>
          </div>
        </div>
      </div>

      {/* Main Directory Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-10">
        {/* TaxGuard AI Integrated Architecture Banner */}
        <section className="bg-[#061A2F] text-white border border-[#1A365D] p-5 sm:p-6 rounded-xs shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1A365D] pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-[#0A2544] border border-[#C99A32] text-[#D7AC4A] text-[10px] font-bold uppercase rounded-xs font-mono">
                  TaxGuard AI Engine
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Shared Intelligence &amp; Automation Layer
                </span>
              </div>
              <h2 className="text-base font-bold uppercase tracking-wide text-[#F7F4ED]">
                TaxGuard AI – Natively Integrated Across Practice Role Dashboards
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl">
                TaxGuard AI functions as an embedded intelligence and verification layer within each role workspace—powering real-time OCR extraction, maker-checker dual sign-off gates, draft workpapers, and source-grounded IRC research.
              </p>
            </div>

            <div className="px-3 py-1.5 bg-[#0A2544] border border-[#C99A32]/40 rounded-xs text-[11px] text-[#D7AC4A] font-mono self-start sm:self-center">
              Role-Based Authorization Active
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <button
              onClick={() => onNavigate('#/operations/dashboard')}
              className="p-2 bg-[#0A2544] hover:bg-[#1A365D] border border-[#1A365D] rounded-xs text-left transition-colors"
            >
              <div className="font-bold text-[#E8C66A]">Operations</div>
              <div className="text-[10px] text-slate-400">Workflow &amp; Deadlines</div>
            </button>

            <button
              onClick={() => onNavigate('#/documents/dashboard')}
              className="p-2 bg-[#0A2544] hover:bg-[#1A365D] border border-[#1A365D] rounded-xs text-left transition-colors"
            >
              <div className="font-bold text-[#E8C66A]">Document Specialist</div>
              <div className="text-[10px] text-slate-400">Scanner &amp; Classification</div>
            </button>

            <button
              onClick={() => onNavigate('#/data-entry/dashboard')}
              className="p-2 bg-[#0A2544] hover:bg-[#1A365D] border border-[#1A365D] rounded-xs text-left transition-colors"
            >
              <div className="font-bold text-[#E8C66A]">Data Entry</div>
              <div className="text-[10px] text-slate-400">OCR Confidence Triage</div>
            </button>

            <button
              onClick={() => onNavigate('#/accountant/dashboard')}
              className="p-2 bg-[#0A2544] hover:bg-[#1A365D] border border-[#1A365D] rounded-xs text-left transition-colors"
            >
              <div className="font-bold text-[#E8C66A]">Tax Preparer</div>
              <div className="text-[10px] text-slate-400">Smart Forms &amp; Workpapers</div>
            </button>

            <button
              onClick={() => onNavigate('#/reviewer/dashboard')}
              className="p-2 bg-[#0A2544] hover:bg-[#1A365D] border border-[#1A365D] rounded-xs text-left transition-colors"
            >
              <div className="font-bold text-[#E8C66A]">Senior Reviewer</div>
              <div className="text-[10px] text-slate-400">Maker-Checker Sign-Off</div>
            </button>

            <button
              onClick={() => onNavigate('#/compliance/dashboard')}
              className="p-2 bg-[#0A2544] hover:bg-[#1A365D] border border-[#1A365D] rounded-xs text-left transition-colors"
            >
              <div className="font-bold text-[#E8C66A]">Compliance</div>
              <div className="text-[10px] text-slate-400">Audit Trail &amp; AI Safety</div>
            </button>
          </div>
        </section>

        {filteredGroups.length === 0 ? (
          <div className="border border-neutral-300 p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-neutral-800">
              No roles matched your search &ldquo;{searchQuery}&rdquo;.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-1.5 border border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          filteredGroups.map((group, groupIdx) => (
            <section key={group.stageName} className="space-y-4">
              {/* Stage Header */}
              <div className="border-b-2 border-black pb-2 flex flex-col sm:flex-row sm:items-end justify-between gap-1">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500">
                    Stage 0{groupIdx + 1}
                  </div>
                  <h2 className="text-base font-bold uppercase tracking-wider text-black">
                    {group.stageName}
                  </h2>
                </div>
                <p className="text-xs text-neutral-600 max-w-xl">
                  {group.stageDescription}
                </p>
              </div>

              {/* Roles Table / Cards Grid */}
              <div className="border border-neutral-300 divide-y divide-neutral-200 bg-white">
                {group.roles.map((r) => {
                  const config: DemoRoleConfig = DEMO_ROLES[r.key];
                  return (
                    <div 
                      key={r.key} 
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-neutral-50/70 transition-colors"
                    >
                      {/* Left: Role identity and responsibility */}
                      <div className="space-y-1.5 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-sm text-black">
                            {r.name}
                          </h3>
                          <span className="px-1.5 py-0.5 border border-neutral-300 text-[10px] font-mono uppercase text-neutral-600 bg-white">
                            Role ID: {r.key}
                          </span>
                          <span className="px-1.5 py-0.5 border border-black bg-black text-white text-[10px] font-mono uppercase font-bold">
                            Active / Registered
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                          {r.shortResponsibility}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-neutral-500">
                          <span>Login: <code className="text-black font-semibold">{config.loginPath}</code></span>
                          <span>•</span>
                          <span>Dashboard: <code className="text-black font-semibold">{config.dashboardPath}</code></span>
                        </div>
                      </div>

                      {/* Right: Actions and Status */}
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="hidden sm:flex flex-col items-end text-[10px] font-mono text-neutral-500 mr-2">
                          <span className="text-black font-semibold">Demo Available</span>
                          <span>Session Guarded</span>
                        </div>

                        <button
                          onClick={() => onNavigate(config.loginPath)}
                          className="px-4 py-2 border border-black bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Sign In to Role</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}

        {/* Developer Contact Footer Section */}
        <div className="pt-6">
          <DeveloperContactNotice reason="Authorized demonstration access directory. To report route anomalies or session inquiries, reach out to the development team." />
        </div>
      </main>
    </div>
  );
};
