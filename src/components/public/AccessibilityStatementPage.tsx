import React from 'react';
import { useApp } from '../../context/AppContext';
import { Eye, CheckCircle2, Phone, Mail } from 'lucide-react';

export const AccessibilityStatementPage: React.FC = () => {
  const { setCurrentPage } = useApp();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10 text-slate-100">
      <div className="border-b border-[#1E3A5F] pb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
          <Eye className="w-3.5 h-3.5" />
          <span>Inclusion & Usability</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white">
          Accessibility Statement
        </h1>
        <p className="text-xs text-slate-400">
          Conformance Target: WCAG 2.1 Level AA • A/R Tax Services, LLC
        </p>
      </div>

      <div className="space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">Our Commitment</h2>
          <p>
            A/R Tax Services, LLC is dedicated to providing an accessible, inclusive digital environment for all clients, including individuals with visual, auditory, cognitive, and motor disabilities. We continually optimize our website, client portals, and document upload interfaces to comply with the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">Implemented Measures</h2>
          <ul className="space-y-2 text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A15B] flex-shrink-0 mt-0.5" />
              <span><strong>Keyboard Navigation:</strong> All critical interactive elements, form controls, and portal buttons are navigable via standard keyboard focus order.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A15B] flex-shrink-0 mt-0.5" />
              <span><strong>Contrast Ratios:</strong> Text content and interactive boundaries strictly meet or exceed WCAG AA contrast standards (minimum 4.5:1 for body copy).</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A15B] flex-shrink-0 mt-0.5" />
              <span><strong>Screen Reader Compatibility:</strong> Form fields feature descriptive aria-labels, semantic HTML landmark tags, and non-visual status indicators.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C6A15B] flex-shrink-0 mt-0.5" />
              <span><strong>Alternate Uploads:</strong> Clients with difficulty using web uploaders can transmit tax documents via encrypted email, postal mail, or during an in-office consultation.</span>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">Feedback & Assistance</h2>
          <p>
            If you encounter any difficulty navigating our portal or need documents in an alternative format (large print, read-aloud assistance), please reach out directly:
          </p>
          <div className="p-4 rounded-xl bg-[#0D2340] border border-[#1E3A5F] space-y-2 text-xs">
            <div className="flex items-center gap-2 text-white">
              <Phone className="w-4 h-4 text-[#C6A15B]" />
              <span>Phone: 678-205-9486 (Mon-Fri 9am-6pm EST)</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Mail className="w-4 h-4 text-[#C6A15B]" />
              <span>Email: info@artaxservices.com</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
