/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Security & Reliability Trust Indicators Panel
 *
 * Implements Section 24 of Client Dashboard Architecture:
 * - Bank-Level Security (AES-256 encryption at rest, TLS 1.3 in transit)
 * - Available for All 50 States (Full state jurisdiction engine)
 * - AI-Powered Document Detection (OCR & classification proposal assistance)
 * - Data Retention / Records (7-year statutory archive under IRC § 6107)
 * - Mobile Friendly (Responsive client portal)
 * - Circular 230 & IRC § 7216 compliant
 */

import React from 'react';
import {
  ShieldCheck,
  Building2,
  Sparkles,
  Archive,
  Smartphone,
  Lock,
  FileCheck
} from 'lucide-react';

export const SecurityReliabilityPanel: React.FC = () => {
  const trustIndicators = [
    {
      id: 'sec_1',
      title: 'Bank-Level Security',
      subtitle: 'AES-256 & TLS 1.3 Encryption',
      description: 'Documents are encrypted at rest with AES-256 and transmitted using TLS 1.3 with SHA-256 tamper verification.',
      icon: ShieldCheck,
      iconColor: 'text-[#D4A843]',
      tag: 'ENCRYPTED'
    },
    {
      id: 'sec_2',
      title: 'Available for All 50 States',
      subtitle: 'Multi-State Jurisdiction Engine',
      description: 'Comprehensive 50-state tax rules engine supporting resident, nonresident, part-year, and local returns.',
      icon: Building2,
      iconColor: 'text-blue-400',
      tag: '50 STATES'
    },
    {
      id: 'sec_3',
      title: 'AI Document Intelligence',
      subtitle: 'Verified Proposal Assistance',
      description: 'AI assists with OCR data extraction while Circular 230 tax professionals maintain deterministic review authority.',
      icon: Sparkles,
      iconColor: 'text-[#E1BB60]',
      tag: 'GOVERNED AI'
    },
    {
      id: 'sec_4',
      title: '7-Year Data Retention',
      subtitle: 'IRC § 6107 Statutory Archive',
      description: 'All workpapers, return packages, and e-signatures are preserved in immutable audit storage for statutory retention.',
      icon: Archive,
      iconColor: 'text-emerald-400',
      tag: 'STATUTORY'
    },
    {
      id: 'sec_5',
      title: 'Mobile Friendly & Accessible',
      subtitle: 'Any Device & Screen Size',
      description: 'Secure biometric-compatible portal accessible from smartphones, tablets, and desktop workstations.',
      icon: Smartphone,
      iconColor: 'text-indigo-400',
      tag: 'RESPONSIVE'
    }
  ];

  return (
    <section
      aria-label="Security and Reliability Trust Indicators"
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 shadow-xl space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#D4A843]" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            SECURITY &amp; RELIABILITY
          </h2>
          <span className="text-slate-500">&bull;</span>
          <span className="text-xs text-slate-300">
            Enterprise-grade taxpayer protection standards
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>IRC § 7216 Protected &bull; IRS Authorized e-File</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        {trustIndicators.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-[#06182B] border border-slate-800 flex flex-col justify-between space-y-2.5 transition-colors hover:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <div className={`p-1.5 rounded-lg bg-[#102D4F] ${item.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#102D4F] text-slate-300 border border-slate-700">
                  {item.tag}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-white text-xs">{item.title}</h3>
                <div className="text-[10px] text-[#D4A843] font-mono">{item.subtitle}</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {item.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                <FileCheck className="w-3 h-3" />
                <span>Verified Standard</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
