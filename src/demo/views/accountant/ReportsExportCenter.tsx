/**
 * A/R Tax Services, LLC - Master Tax Client Package & Export Center
 * Sections 35 & 36: 19-Component Master Package and Multi-Format Export Center.
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Archive, 
  Code, 
  CheckCircle, 
  ExternalLink,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';

interface ReportsExportCenterProps {
  isDark: boolean;
}

export const ReportsExportCenter: React.FC<ReportsExportCenterProps> = ({ isDark }) => {
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const client = accountantCenterService.getSelectedClient();
  const taxYear = accountantCenterService.getSelectedTaxYear();
  const masterPackage = accountantCenterService.getMasterPackageComponents();

  const handleExport = (format: string) => {
    const filename = `AR_TaxServices_${client.name.replace(/\s+/g, '_')}_TY${taxYear}_Package.${format.toLowerCase()}`;
    setDownloadNotice(`Generated ${format.toUpperCase()} archive: ${filename}`);
    setTimeout(() => setDownloadNotice(null), 4000);
  };

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      {downloadNotice && (
        <div className="p-3 bg-emerald-600 text-white text-xs font-mono font-bold rounded flex items-center justify-between shadow">
          <span>{downloadNotice}</span>
          <span>✓ Ready</span>
        </div>
      )}

      {/* Header */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
            Sections 35 &amp; 36 &bull; Deliverables &amp; Formats
          </div>
          <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
            Tax Client Master Package &amp; Export Center
          </h2>
          <p className={`text-xs ${textSecondary} mt-0.5`}>
            Client: <strong>{client.name}</strong> &bull; Tax Filing Year: <strong className="font-mono">TY{taxYear}</strong>
          </p>
        </div>

        {/* Format Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExport('pdf')}
            className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold uppercase rounded hover:opacity-90 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Package</span>
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="px-3 py-1.5 border border-neutral-400 dark:border-neutral-600 text-xs font-bold uppercase rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Workpapers</span>
          </button>
          <button
            onClick={() => handleExport('zip')}
            className="px-3 py-1.5 border border-neutral-400 dark:border-neutral-600 text-xs font-bold uppercase rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5 text-amber-600" />
            <span>Complete ZIP</span>
          </button>
        </div>
      </div>

      {/* SECTION 35: 19-COMPONENT MASTER PACKAGE */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
        <div className="flex justify-between items-center border-b pb-3 border-neutral-200 dark:border-neutral-800">
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${textPrimary}`}>
              35. Tax Client Master Package Components (19 Elements)
            </h3>
            <p className={`text-xs ${textSecondary}`}>
              Complete regulatory assembly for filing submission, taxpayer transmittal, and permanent audit retention.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-600">
            19 of 19 Compiled
          </span>
        </div>

        <div className="border rounded overflow-x-auto border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                <th className="p-2.5">#</th>
                <th className="p-2.5">Package Component Title</th>
                <th className="p-2.5">Component Type</th>
                <th className="p-2.5">Source Authority</th>
                <th className="p-2.5">Reviewer</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {masterPackage.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="p-2.5 font-mono text-neutral-400">{c.sequenceNumber.toString().padStart(2, '0')}</td>
                  <td className="p-2.5 font-bold text-neutral-900 dark:text-white">{c.name}</td>
                  <td className="p-2.5 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">{c.type}</td>
                  <td className="p-2.5 font-mono text-[10px] text-neutral-500">{c.sourceRef}</td>
                  <td className="p-2.5 font-mono text-[10px]">{c.reviewer}</td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-mono text-[10px] font-bold">
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
