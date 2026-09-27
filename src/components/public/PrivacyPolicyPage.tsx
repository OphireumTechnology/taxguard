import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Lock, FileText, CheckCircle2 } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  const { setCurrentPage } = useApp();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10 text-slate-100">
      <div className="border-b border-[#1E3A5F] pb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Financial Data Protection Standards</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-400">
          Last Updated & Reviewed: January 2026 • Governing Entity: A/R Tax Services, LLC (Columbia, SC)
        </p>
      </div>

      <div className="space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">1. Commitment to Client Confidentiality</h2>
          <p>
            A/R Tax Services, LLC (“we”, “our”, or “the Firm”) is deeply committed to safeguarding the nonpublic personal financial information (NPI) of our clients, prospective clients, and web portal visitors. In accordance with the Gramm-Leach-Bliley Act (GLBA), the Internal Revenue Code Section 7216, the California Consumer Privacy Act (CCPA), and applicable GDPR principles for international stakeholders, we maintain stringent physical, electronic, and procedural safeguards.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">2. Categories of Information We Collect</h2>
          <p>To provide tax preparation, bookkeeping, and advisory services, we collect:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-300">
            <li><strong>Identifying Information:</strong> Names, Social Security Numbers (SSN), Employer Identification Numbers (EIN), physical addresses, telephone numbers, and email addresses.</li>
            <li><strong>Financial Records:</strong> Forms W-2, 1099, 1098, profit & loss statements, balance sheets, bank records, and investment statements.</li>
            <li><strong>Technical Telemetry:</strong> Anonymized audit logs, secure session tokens, device IP addresses, and encrypted authentication timestamps to protect against unauthorized access.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">3. Zero-Sale Commitment & Non-Disclosure</h2>
          <div className="p-4 rounded-xl bg-[#0D2340] border border-[#C6A15B]/40 text-slate-200">
            <strong>Absolute Policy:</strong> We never sell, rent, monetize, or trade any personal, demographic, or financial records to data brokers, advertising networks, or third-party marketers.
          </div>
          <p>
            Information is disclosed strictly to authorized tax authorities (IRS and state departments of revenue) upon your explicit authorization (Form 8879 or Form 2848), or to trusted software processors under binding confidentiality agreements (e.g., approved IRS e-file transmitters, cloud infrastructure providers).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">4. Encryption & Technical Safeguards</h2>
          <p>
            All electronic documents submitted through the A/R Tax Services portal are encrypted using 256-bit Advanced Encryption Standard (AES) at rest and TLS 1.3 during transit. Multi-factor authentication (MFA) and granular role-based access control (RBAC) restrict document access solely to assigned accountants and client account owners.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">5. Document Retention & Deletion Requests</h2>
          <p>
            Federal statutes (IRC Section 6107) require tax return preparers to retain copies of prepared returns and related records for a minimum statutory period (typically 3 to 7 years). Following the expiration of statutory retention mandates, files are systematically purged from our servers. Clients may request an export or audit log of their personal data by contacting <a href="mailto:info@artaxservices.com" className="text-[#C6A15B] underline">info@artaxservices.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">6. Privacy Inquiries</h2>
          <p>
            If you have questions regarding this Privacy Policy or our security protocols, please contact:<br />
            <strong>A/R Tax Services, LLC</strong><br />
            Attention: Privacy & Compliance Officer<br />
            Columbia, South Carolina, USA<br />
            Phone: <a href="tel:678-205-9486" className="text-[#C6A15B]">678-205-9486</a><br />
            Email: <a href="mailto:info@artaxservices.com" className="text-[#C6A15B]">info@artaxservices.com</a>
          </p>
        </section>
      </div>
    </div>
  );
};
