import React from 'react';
import { ExternalLink, Calendar, FileText, Clock, BookOpen, ShieldCheck } from 'lucide-react';

interface PublicV2ResourcesPageProps {
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2ResourcesPage: React.FC<PublicV2ResourcesPageProps> = ({
  onNavigate,
  onOpenConsultation
}) => {
  const deadlines = [
    { date: 'January 15', description: 'Q4 Estimated Tax Payment Due (Form 1040-ES for prior calendar year).' },
    { date: 'January 31', description: 'Form W-2 and Form 1099-NEC distribution deadline to recipients and IRS/SSA.' },
    { date: 'March 15', description: 'S-Corporation (Form 1120-S) and Partnership (Form 1065) tax returns due (or 6-month extension Form 7004).' },
    { date: 'April 15', description: 'Individual Income Tax (Form 1040) & C-Corporation (Form 1120) returns due; Q1 Estimated Tax due.' },
    { date: 'June 15', description: 'Q2 Estimated Tax Payment Due (Form 1040-ES / Form 1120-W).' },
    { date: 'September 15', description: 'Q3 Estimated Tax Payment Due; Extended S-Corporation and Partnership returns due.' },
    { date: 'October 15', description: 'Extended Individual Income Tax Returns (Form 1040) due.' }
  ];

  const retentionRules = [
    { timeframe: '3 Years', items: 'Bank statements, canceled checks, invoices, mileage logs, expense receipts supporting filed Form 1040 / Form 1120 items under IRC § 6501(a).' },
    { timeframe: '4 Years', items: 'Employment tax records: Form 941, Form 940, state unemployment reports, wage logs, employee withholding certificates (Form W-4).' },
    { timeframe: '6 Years', items: 'Records supporting returns where gross income omitted exceeds 25% of total gross income reported under IRC § 6501(e).' },
    { timeframe: 'Indefinite', items: 'Articles of Incorporation, Operating Agreements, Filed Tax Returns, Form 4562 depreciation schedules, real estate purchase deeds until asset is sold.' }
  ];

  const commonForms = [
    { code: 'Form 1040', title: 'U.S. Individual Income Tax Return', authority: 'IRS' },
    { code: 'Form 1120-S', title: 'U.S. Income Tax Return for an S Corporation', authority: 'IRS' },
    { code: 'Form 1065', title: 'U.S. Return of Partnership Income', authority: 'IRS' },
    { code: 'Schedule C', title: 'Profit or Loss From Business (Sole Proprietorship)', authority: 'IRS' },
    { code: 'Schedule E', title: 'Supplemental Income and Loss (Rentals, S-Corps, Partnerships)', authority: 'IRS' },
    { code: 'Form 941', title: 'Employer’s Quarterly Federal Tax Return', authority: 'IRS' },
    { code: 'Form 1099-NEC', title: 'Nonemployee Compensation (Contractors)', authority: 'IRS' },
    { code: 'Form W-2', title: 'Wage and Tax Statement', authority: 'SSA / IRS' }
  ];

  const officialSources = [
    { name: 'IRS.gov Official Portal', url: 'https://www.irs.gov', desc: 'Authoritative source for federal tax forms, instructions, and Internal Revenue Bulletins.' },
    { name: 'U.S. Department of the Treasury', url: 'https://home.treasury.gov', desc: 'Treasury decisions, international tax treaties, and FinCEN compliance.' },
    { name: 'GovInfo (U.S. Government Publishing Office)', url: 'https://www.govinfo.gov', desc: 'Official, authenticated repository for U.S. Code, Code of Federal Regulations, and Congressional hearings.' },
    { name: 'Social Security Administration', url: 'https://www.ssa.gov', desc: 'Annual maximum wage base thresholds, BSO employer W-2 filing portal.' },
    { name: 'California Franchise Tax Board', url: 'https://www.ftb.ca.gov', desc: 'California state individual and corporate income tax forms and notices.' }
  ];

  return (
    <div className="bg-white text-black space-y-16 py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="border-b border-black pb-8 space-y-3">
        <div className="inline-block border border-black bg-neutral-100 px-3 py-1 text-[11px] font-mono text-black">
          Practice Knowledge & Compliance Reference
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-black">
          Tax Calendar & Resources
        </h1>
        <p className="text-base sm:text-lg text-neutral-700 max-w-3xl leading-relaxed">
          Statutory filing deadlines, recordkeeping retention frameworks, commonly filed tax forms, and authenticated federal portals.
        </p>
      </div>

      {/* Tax Calendar */}
      <section className="border border-black p-6 sm:p-8 bg-white space-y-6">
        <div className="border-b border-neutral-200 pb-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Deadlines</span>
            <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight mt-0.5">
              Annual U.S. Tax Calendar (Calendar-Year Filers)
            </h2>
          </div>
          <Calendar className="w-5 h-5 text-black" />
        </div>

        <div className="divide-y divide-neutral-200">
          {deadlines.map((item, idx) => (
            <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6 text-xs">
              <span className="font-mono font-bold text-black w-32 flex-shrink-0">{item.date}</span>
              <span className="text-neutral-700 leading-relaxed">{item.description}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Record Retention Framework */}
      <section className="border border-black p-6 sm:p-8 bg-neutral-50 space-y-6">
        <div className="border-b border-neutral-300 pb-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Recordkeeping Rules</span>
            <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight mt-0.5">
              Document Retention Guidelines (IRC § 6501)
            </h2>
          </div>
          <Clock className="w-5 h-5 text-black" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {retentionRules.map((rule, idx) => (
            <div key={idx} className="border border-neutral-300 bg-white p-5 space-y-2">
              <div className="font-mono font-bold text-sm text-black border-b border-neutral-200 pb-1">
                {rule.timeframe} Retention Rule
              </div>
              <p className="text-neutral-700 leading-relaxed">{rule.items}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Common Tax Forms Table */}
      <section className="border border-black p-6 sm:p-8 bg-white space-y-6">
        <div className="border-b border-neutral-200 pb-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Statutory Returns</span>
            <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight mt-0.5">
              Common Federal Forms Reference
            </h2>
          </div>
          <FileText className="w-5 h-5 text-black" />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-300 text-xs text-left">
            <thead>
              <tr className="bg-neutral-100 font-mono font-bold text-black">
                <th className="py-2.5 px-4">Form / Schedule</th>
                <th className="py-2.5 px-4">Official Designation</th>
                <th className="py-2.5 px-4">Governing Authority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {commonForms.map((f, idx) => (
                <tr key={idx} className="hover:bg-neutral-50">
                  <td className="py-2.5 px-4 font-mono font-bold text-black">{f.code}</td>
                  <td className="py-2.5 px-4 text-neutral-800">{f.title}</td>
                  <td className="py-2.5 px-4 text-neutral-600 font-mono">{f.authority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Official Government Portals */}
      <section className="border border-black p-6 sm:p-8 bg-white space-y-6">
        <div className="border-b border-neutral-200 pb-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">External Authorities</span>
            <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight mt-0.5">
              Approved U.S. Government Portals
            </h2>
          </div>
          <BookOpen className="w-5 h-5 text-black" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {officialSources.map((src, idx) => (
            <a
              key={idx}
              href={src.url}
              target="_blank"
              rel="noreferrer"
              className="border border-neutral-300 hover:border-black p-4 bg-neutral-50 hover:bg-white transition-all group flex flex-col justify-between space-y-2"
            >
              <div>
                <div className="font-bold text-black flex items-center justify-between">
                  <span>{src.name}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black" />
                </div>
                <p className="text-neutral-600 text-[11px] mt-1 leading-relaxed">{src.desc}</p>
              </div>
              <span className="font-mono text-[10px] text-neutral-500 group-hover:underline">{src.url}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
