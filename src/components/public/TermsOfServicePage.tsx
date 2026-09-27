import React from 'react';
import { useApp } from '../../context/AppContext';
import { FileText, ShieldAlert, Check } from 'lucide-react';

export const TermsOfServicePage: React.FC = () => {
  const { setCurrentPage } = useApp();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10 text-slate-100">
      <div className="border-b border-[#1E3A5F] pb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
          <FileText className="w-3.5 h-3.5" />
          <span>Client Engagement & Website Terms</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white">
          Terms of Service
        </h1>
        <p className="text-xs text-slate-400">
          Effective Date: January 2026 • A/R Tax Services, LLC (Columbia, SC)
        </p>
      </div>

      <div className="space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">1. Scope of Engagement</h2>
          <p>
            By accessing the website, scheduling consultations, utilizing the client portal, or engaging A/R Tax Services, LLC (“the Firm”), you agree to be bound by these Terms of Service. Individual tax return preparation, corporate entity filings, and bookkeeping engagements are further governed by your specific signed Engagement Letter.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">2. Client Responsibilities</h2>
          <p>
            Tax preparation accuracy is fundamentally dependent upon the truthfulness, completeness, and timeliness of documentation supplied by the client. Clients agree to:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-300">
            <li>Provide complete, un-altered records (W-2s, 1099s, bank ledgers, expense receipts).</li>
            <li>Maintain contemporaneous records and documentation verifying all claimed deductions.</li>
            <li>Review completed draft returns in detail prior to executing Form 8879 (IRS e-file Signature Authorization).</li>
            <li>Promptly notify the Firm of any notices or correspondence received from the IRS or state taxing bodies.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">3. Disclaimers Concerning Outcomes & Refund Guarantees</h2>
          <div className="p-4 rounded-xl bg-[#0D2340] border border-[#C6A15B]/40 text-slate-200 space-y-2">
            <strong>No Guarantee of Specific Tax Refund:</strong>
            <p className="text-xs text-slate-300 leading-relaxed">
              Federal and state tax outcomes are strictly dictated by applicable statutes, tax brackets, and client-provided facts. A/R Tax Services, LLC makes no representation or guarantee that a client will receive a refund, nor that liabilities will be eliminated.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">4. Payment Terms & Portal Use</h2>
          <p>
            Fees for tax preparation and advisory services must be paid according to the schedule outlined in your service plan or invoice. The Firm reserves the right to withhold electronic transmission of tax returns until invoices are settled in full, unless an alternative written arrangement has been ratified.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">5. Limitation of Liability & Governing Law</h2>
          <p>
            To the maximum extent permitted by applicable South Carolina law, the Firm’s aggregate liability for any claims arising from an engagement shall not exceed the total fees paid by the client for the specific return or service giving rise to liability. These terms are governed by the laws of the State of South Carolina.
          </p>
        </section>
      </div>
    </div>
  );
};
