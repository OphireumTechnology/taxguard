import React from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, ShieldCheck, Scale, FileText } from 'lucide-react';

export const ProfessionalDisclaimersPage: React.FC = () => {
  const { setCurrentPage } = useApp();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10 text-slate-100">
      <div className="border-b border-[#1E3A5F] pb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
          <Scale className="w-3.5 h-3.5" />
          <span>Statutory Compliance Notices</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white">
          Professional Disclaimers
        </h1>
        <p className="text-xs text-slate-400">
          Statutory Regulatory Disclosures • A/R Tax Services, LLC (Columbia, SC)
        </p>
      </div>

      <div className="space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
        {/* Core Notice */}
        <section className="p-6 rounded-2xl bg-[#0D2340] border border-[#C6A15B]/50 space-y-3">
          <div className="flex items-center gap-2 text-[#C6A15B] font-bold text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>Primary Professional Practice Disclosure</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            <strong>A/R Tax Services, LLC</strong> provides professional tax return preparation, business bookkeeping, and strategic tax planning advisory services. The Firm, its owners, and staff do not provide legal counsel, formal judicial representation, registered investment advisory services, or independent CPA attestation/audit opinions.
          </p>
        </section>

        {/* Section 1: Informational Purpose & No Client Relationship */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">1. Informational Purpose &amp; No Professional Relationship</h2>
          <p>
            The content, tools, calculators, checklists, and guides on this website are provided solely for general educational and informational purposes. Accessing this website, submitting an inquiry form, or scheduling a preliminary consultation does not create an accountant-client, fiduciary, or confidential advisory relationship.
          </p>
          <p>
            A formal professional-client relationship is created only when you and A/R Tax Services, LLC mutually execute a written Engagement Letter detailing the specific scope of services, fee arrangements, and mutual obligations.
          </p>
        </section>

        {/* Section 2: No Guaranteed Outcomes */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">2. No Guaranteed Refund or Savings Amount</h2>
          <p>
            No statement, communication, or marketing material from A/R Tax Services, LLC shall be construed as a guarantee of a specific tax refund, tax credit eligibility, or elimination of tax liability. Federal and state tax obligations are determined strictly by the statutory provisions of the Internal Revenue Code, applicable state and local tax codes, and the factual, verifiable financial records supplied by the taxpayer.
          </p>
        </section>

        {/* Section 3: Legal Services & Financial Products Disclaimer */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">3. Estate Planning, Legal &amp; Investment Coordination</h2>
          <p>
            Any discussions, worksheets, or guidance concerning estate planning, business entity formations, wills, trusts, and powers of attorney provided by A/R Tax Services, LLC are strictly educational, organizational, and tax-evaluative in nature.
          </p>
          <p>
            We do not draft formal legal instruments, execute wills or trusts, or practice law. All legal documents and formal entity covenants should be drafted and reviewed by independent, properly licensed legal counsel. Similarly, we do not sell securities or act as registered investment advisors; financial planning coordination is conducted in partnership with client-designated licensed financial professionals.
          </p>
        </section>

        {/* Section 4: Technology & AI Disclosure */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">4. Computational Tools &amp; Technology Notice</h2>
          <p>
            A/R Tax Services, LLC employs modern practice management software, encrypted transmission protocols, and analytical computational tools to assist with data organization, receipt scanning, and arithmetic consistency.
          </p>
          <p>
            Automated tools and algorithms never make final filing determinations. All tax classifications, deduction evaluations, statutory elections, and return filings are directly reviewed, substantiated, and finalized by qualified professional tax preparers.
          </p>
        </section>

        {/* Section 5: IRS Circular 230 Disclosure */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">5. IRS Circular 230 Notice</h2>
          <p>
            In accordance with IRS regulations, any tax advice contained on this website, in emails, or promotional resources is not intended or written to be used, and cannot be used, for the purpose of (i) avoiding tax-related penalties under the Internal Revenue Code, or (ii) promoting, marketing, or recommending to another party any tax-related transaction or matter.
          </p>
        </section>

        {/* Section 6: Third-Party Links & Software */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">6. Third-Party Tools &amp; Banking Integrations</h2>
          <p>
            Links, integrations, or references to third-party platforms (e.g., Intuit QuickBooks, Xero, Stripe, banking APIs) are provided for operational convenience and do not constitute endorsements. The Firm is not responsible for the independent terms, uptime, security practices, or privacy policies of outside software vendors.
          </p>
        </section>

        {/* Section 7: IRS Non-Affiliation & Professional Credentials */}
        <section className="space-y-3 border-t border-[#1E3A5F] pt-6">
          <h2 className="font-serif text-xl font-bold text-white">7. IRS Non-Affiliation &amp; Regulatory Credentials</h2>
          <p>
            A/R Tax Services, LLC is an independent commercial firm and is not affiliated with, endorsed by, or sponsored by the Internal Revenue Service or any state department of revenue.
          </p>
          <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F] space-y-1.5 text-xs text-slate-300">
            <p>
              <strong className="text-white">Professional Credential Standards:</strong> A/R Tax Services, LLC is a professional tax preparation, bookkeeping, and advisory practice. Tax preparation services are provided by authorized professionals holding active IRS Preparer Tax Identification Numbers (PTIN). Formal CPA attestations and Enrolled Agent representation services are coordinated in compliance with applicable federal and state regulatory standards.
            </p>
            <p>
              <strong className="text-white">Firm Location:</strong> Columbia, South Carolina, USA • <a href="tel:678-205-9486" className="text-[#C6A15B]">678-205-9486</a>
            </p>
            <p>
              <strong className="text-white">Client Financial Privacy:</strong> Review our{' '}
              <button onClick={() => setCurrentPage('privacy')} className="text-[#C6A15B] underline hover:text-white">
                GLBA-Compliant Privacy Policy
              </button>{' '}
              and{' '}
              <button onClick={() => setCurrentPage('terms')} className="text-[#C6A15B] underline hover:text-white">
                Terms of Service
              </button>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
