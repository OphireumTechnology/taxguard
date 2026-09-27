import React, { useState } from 'react';
import {
  Archive,
  Download,
  FileText,
  Search,
  CheckCircle2,
  Calendar,
  Lock,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Eye,
  Info
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientPriorArchiveSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
}

export const ClientPriorArchiveSection: React.FC<ClientPriorArchiveSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant
}) => {
  const [selectedYear, setSelectedYear] = useState('2024');
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-Year Tax Comparison Metrics
  const yearComparisons = [
    { year: '2025 (Draft)', revenue: '$709,500', expenses: '$400,070', ordinaryIncome: '$309,430', federalTax: 'Pass-Through', effectiveRate: 'Pass-Through (K-1)', status: 'In Review' },
    { year: '2024', revenue: '$577,000', expenses: '$362,500', ordinaryIncome: '$214,500', federalTax: 'Pass-Through', effectiveRate: 'Pass-Through (K-1)', status: 'Filed & Accepted' },
    { year: '2023', revenue: '$485,000', expenses: '$318,000', ordinaryIncome: '$167,000', federalTax: 'Pass-Through', effectiveRate: 'Pass-Through (K-1)', status: 'Filed & Accepted' },
    { year: '2022', revenue: '$410,000', expenses: '$285,000', ordinaryIncome: '$125,000', federalTax: 'Pass-Through', effectiveRate: 'Pass-Through (K-1)', status: 'Filed & Accepted' }
  ];

  // Archived Deliverables by Year
  const archives = [
    {
      year: '2024',
      documents: [
        { name: '2024 Form 1120-S Federal Income Tax Return (Final Filed)', category: 'Tax Return', sidNumber: '10408220250749102849', dateFiled: 'March 11, 2025', size: '3.4 MB' },
        { name: '2024 IRS Official E-File Acceptance Acknowledgment', category: 'IRS Confirmation', sidNumber: '10408220250749102849', dateFiled: 'March 11, 2025', size: '420 KB' },
        { name: '2024 South Carolina SC 1120-S & PTE Tax Filing', category: 'State Return', sidNumber: 'SC-2025-9182048', dateFiled: 'March 11, 2025', size: '2.1 MB' },
        { name: '2024 Schedule K-1 (Michael Perotti - 85%)', category: 'K-1 Package', sidNumber: 'N/A', dateFiled: 'March 11, 2025', size: '1.2 MB' },
        { name: '2024 Schedule K-1 (Sarah Perotti - 15%)', category: 'K-1 Package', sidNumber: 'N/A', dateFiled: 'March 11, 2025', size: '1.2 MB' },
        { name: '2024 Compiled Financial Statements (Balance Sheet & P&L)', category: 'Financials', sidNumber: 'N/A', dateFiled: 'Feb 28, 2025', size: '2.8 MB' }
      ]
    },
    {
      year: '2023',
      documents: [
        { name: '2023 Form 1120-S Federal Income Tax Return (Final Filed)', category: 'Tax Return', sidNumber: '10408220240741192801', dateFiled: 'March 12, 2024', size: '3.1 MB' },
        { name: '2023 IRS Official E-File Acceptance Acknowledgment', category: 'IRS Confirmation', sidNumber: '10408220240741192801', dateFiled: 'March 12, 2024', size: '380 KB' },
        { name: '2023 Compiled Financial Statements', category: 'Financials', sidNumber: 'N/A', dateFiled: 'Feb 20, 2024', size: '2.5 MB' }
      ]
    },
    {
      year: '2022',
      documents: [
        { name: '2022 Form 1120-S Federal Income Tax Return (Final Filed)', category: 'Tax Return', sidNumber: '10408220230718293012', dateFiled: 'March 10, 2023', size: '2.9 MB' },
        { name: '2022 IRS Official E-File Acceptance Acknowledgment', category: 'IRS Confirmation', sidNumber: '10408220230718293012', dateFiled: 'March 10, 2023', size: '350 KB' }
      ]
    }
  ];

  const currentArchive = archives.find(a => a.year === selectedYear) || archives[0];

  const filteredDocs = currentArchive.documents.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="client-prior-archive-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Permanent Tax Vault
              </span>
              <span className="text-xs text-[#667085]">Statutory 7-Year Historical Retention</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Prior Year Returns, Transcripts &amp; Multi-Year History
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Access permanently archived Form 1120-S returns, IRS Submission ID (SID) acknowledgments, and Schedule K-1 packages.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert(`Simulated download of complete ${selectedYear} Tax & Accounting Bundle (ZIP)`)}
              className="px-3.5 py-2 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Download {selectedYear} Archive (ZIP)</span>
            </button>
          </div>
        </div>

        {/* Year Pills */}
        <div className="flex items-center gap-2 pt-4">
          <span className="text-xs font-bold text-[#061A2F] mr-2">Select Archive Tax Year:</span>
          {archives.map(a => (
            <button
              key={a.year}
              onClick={() => setSelectedYear(a.year)}
              className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer ${
                selectedYear === a.year
                  ? 'bg-[#061A2F] text-white border-[#061A2F]'
                  : 'bg-white text-[#061A2F] border-[#D8DCE2] hover:border-[#061A2F]'
              }`}
            >
              Tax Year {a.year}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-Year Financial Comparison Table */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
        <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#061A2F]">Multi-Year Financial &amp; Tax Comparison</h3>
            <p className="text-xs text-[#667085]">Year-over-year revenue, expenses, and pass-through ordinary income trends.</p>
          </div>
          <span className="text-xs text-[#1B5E20] font-bold flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>+23.0% YoY Revenue Growth</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-[#D8DCE2]">
            <thead className="bg-[#FBFAF7] border-b border-[#D8DCE2] text-[#667085] uppercase text-[10px] font-mono">
              <tr>
                <th className="p-3">Tax Year</th>
                <th className="p-3 text-right">Gross Revenue</th>
                <th className="p-3 text-right">Total Deductions</th>
                <th className="p-3 text-right">Ordinary Net Income</th>
                <th className="p-3">Federal Tax Treatment</th>
                <th className="p-3">IRS Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8DCE2]">
              {yearComparisons.map((yc, idx) => (
                <tr key={idx} className="hover:bg-[#FAF9F5]">
                  <td className="p-3 font-mono font-bold text-[#061A2F]">{yc.year}</td>
                  <td className="p-3 text-right font-mono text-[#061A2F] font-semibold">{yc.revenue}</td>
                  <td className="p-3 text-right font-mono text-[#667085]">{yc.expenses}</td>
                  <td className="p-3 text-right font-mono text-[#1B5E20] font-bold">{yc.ordinaryIncome}</td>
                  <td className="p-3 text-[#4B5563]">{yc.effectiveRate}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-bold">
                      {yc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Year Deliverables List */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8DCE2] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#061A2F]">Permanently Retained Files for {selectedYear}</h3>
            <p className="text-xs text-[#667085]">Certified documents with official IRS transmission timestamps.</p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#667085] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="pl-8 pr-3 py-1.5 border border-[#D8DCE2] rounded text-xs"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredDocs.map((doc, idx) => (
            <div
              key={idx}
              className="border border-[#D8DCE2] rounded-lg p-4 bg-[#FBFAF7] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#061A2F]" />
                  <span className="font-bold text-sm text-[#061A2F]">{doc.name}</span>
                  <span className="px-2 py-0.5 text-[10px] bg-white border border-[#D8DCE2] text-[#667085] rounded">
                    {doc.category}
                  </span>
                </div>
                <div className="text-xs text-[#667085] flex flex-wrap items-center gap-3">
                  <span>Filed: <strong>{doc.dateFiled}</strong></span>
                  <span>&bull;</span>
                  <span>File Size: <strong>{doc.size}</strong></span>
                  {doc.sidNumber !== 'N/A' && (
                    <>
                      <span>&bull;</span>
                      <span>IRS SID: <strong className="font-mono text-[#061A2F]">{doc.sidNumber}</strong></span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => alert(`Simulated preview for ${doc.name}`)}
                  className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F]"
                >
                  Preview
                </button>
                <button
                  onClick={() => alert(`Simulated download for ${doc.name}`)}
                  className="px-3 py-1.5 bg-[#061A2F] text-white rounded text-xs font-bold"
                >
                  Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
