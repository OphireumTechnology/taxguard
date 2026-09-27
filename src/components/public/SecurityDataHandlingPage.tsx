import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Lock, Key, Server, Cpu, Database, UserCheck } from 'lucide-react';

export const SecurityDataHandlingPage: React.FC = () => {
  const { setCurrentPage } = useApp();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10 text-slate-100">
      <div className="border-b border-[#1E3A5F] pb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
          <Lock className="w-3.5 h-3.5" />
          <span>Information Security Architecture</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white">
          Security & Data Handling
        </h1>
        <p className="text-xs text-slate-400">
          SOC-Aligned Technical & Operational Measures • A/R Tax Services, LLC
        </p>
      </div>

      <div className="space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
        {/* Core Safeguards Notice */}
        <div className="p-4 rounded-xl bg-[#0D2340] border border-[#C6A15B]/40 text-slate-200 space-y-1.5">
          <strong className="text-white block font-semibold">Security Governance Statement:</strong>
          <p className="text-xs text-slate-300 leading-relaxed">
            A/R Tax Services, LLC uses administrative, technical, and organizational safeguards designed to protect client information. No system can eliminate every security risk. We continually assess and enhance our controls to protect taxpayer confidentiality.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">1. Strong Cryptographic Controls</h2>
          <p>
            Tax returns, Social Security numbers, bank routing information, and business accounting books represent high-sensitivity assets. A/R Tax Services, LLC protects client data through rigorous standards:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-[#0D2340] border border-[#1E3A5F] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Key className="w-4 h-4 text-[#C6A15B]" />
                <span>Encrypted Storage at Rest</span>
              </div>
              <p className="text-xs text-slate-400">
                All document storage volumes, client tax files, and database clusters are encrypted at rest using industry-standard cryptographic algorithms (AES-256).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0D2340] border border-[#1E3A5F] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#C6A15B]" />
                <span>TLS 1.3 Encryption in Transit</span>
              </div>
              <p className="text-xs text-slate-400">
                All client-to-server traffic is enforced over TLS 1.3 protocols with HSTS (HTTP Strict Transport Security), preventing unauthorized interception.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">2. Multi-Factor Authentication &amp; Access Controls</h2>
          <p>
            Client and staff authentication endpoints utilize multi-factor verification (TOTP authenticator apps or biometric credentials via WebAuthn). Passwords are never stored in plaintext and are hashed using salted cryptographic functions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">3. Role-Based Access Control (RBAC) &amp; Staff Segregation</h2>
          <p>
            Internal staff access is strictly restricted according to the principle of least privilege. Accountants only access documents belonging to engagements explicitly assigned to their caseload. Administrative actions (role changes, system deletions) require supervisory authorization and generate detailed audit trails with administrative safeguards.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">4. Continuous Audit Logging &amp; Access Monitoring</h2>
          <p>
            Every document upload, viewing session, status transition, and portal login is recorded in tamper-evident, cryptographically timestamped audit logging with administrative access safeguards. Automated anomaly monitors flag suspicious login attempts and immediately isolate sessions.
          </p>
        </section>
      </div>
    </div>
  );
};
