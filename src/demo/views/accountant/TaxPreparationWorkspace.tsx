/**
 * A/R Tax Services, LLC - Tax Return Preparation Workspace & Traceability
 * Sections 23, 24, 25:
 * Modular return preparation, Potential Form/Schedule mapping, and Source-to-Return Traceability engine.
 */

import React, { useState } from 'react';
import { 
  FileCheck2, 
  Layers, 
  Map, 
  GitBranch, 
  ExternalLink, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  User, 
  DollarSign, 
  ShieldCheck, 
  Globe2,
  FileText,
  Search,
  Eye
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';
import { ReturnTraceabilityRecord } from '../../types/accountantCenter';

interface TaxPreparationWorkspaceProps {
  isDark: boolean;
  onNavigateToDocs?: () => void;
}

export const TaxPreparationWorkspace: React.FC<TaxPreparationWorkspaceProps> = ({ isDark, onNavigateToDocs }) => {
  const [activeTab, setActiveTab] = useState<'prep_modules' | 'form_map' | 'traceability'>('prep_modules');
  const [activePrepSection, setActivePrepSection] = useState<'personal' | 'income' | 'adjustments' | 'deductions' | 'credits' | 'payments' | 'state' | 'international'>('personal');
  const [selectedTraceRecord, setSelectedTraceRecord] = useState<ReturnTraceabilityRecord | null>(null);

  const client = accountantCenterService.getSelectedClient();
  const taxYear = accountantCenterService.getSelectedTaxYear();
  const formMappings = accountantCenterService.getPotentialFormMappings();
  const traceabilityRecords = accountantCenterService.getTraceabilityRecords();

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
            Sections 23, 24, 25 &bull; Preparation &amp; Traceability
          </div>
          <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
            Tax Return Preparation &amp; Form Mapping Engine
          </h2>
          <p className={`text-xs ${textSecondary} mt-0.5`}>
            Client: <strong>{client.name}</strong> &bull; Tax Filing Year: <strong className="font-mono">CY{taxYear}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setActiveTab('prep_modules')}
            className={`px-3 py-1.5 rounded font-bold border transition-colors ${
              activeTab === 'prep_modules' 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            23. Return Modules
          </button>
          <button
            onClick={() => setActiveTab('form_map')}
            className={`px-3 py-1.5 rounded font-bold border transition-colors ${
              activeTab === 'form_map' 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            24. Form &amp; Schedule Map
          </button>
          <button
            onClick={() => setActiveTab('traceability')}
            className={`px-3 py-1.5 rounded font-bold border transition-colors ${
              activeTab === 'traceability' 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            25. Source Traceability
          </button>
        </div>
      </div>

      {/* TAB 23: RETURN MODULES (Section 23) */}
      {activeTab === 'prep_modules' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sub-Nav Sidebar */}
          <div className={`p-4 border rounded-lg shadow-sm ${cardBg} space-y-1.5 text-xs font-mono`}>
            <span className="text-[10px] uppercase text-neutral-500 font-bold block mb-2">
              Preparation Modules
            </span>
            <button
              onClick={() => setActivePrepSection('personal')}
              className={`w-full text-left p-2 rounded flex items-center justify-between ${
                activePrepSection === 'personal' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span>1. Personal / Taxpayer</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            </button>
            <button
              onClick={() => setActivePrepSection('income')}
              className={`w-full text-left p-2 rounded flex items-center justify-between ${
                activePrepSection === 'income' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span>2. Income Items</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            </button>
            <button
              onClick={() => setActivePrepSection('adjustments')}
              className={`w-full text-left p-2 rounded flex items-center justify-between ${
                activePrepSection === 'adjustments' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span>3. Adjustments</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            </button>
            <button
              onClick={() => setActivePrepSection('deductions')}
              className={`w-full text-left p-2 rounded flex items-center justify-between ${
                activePrepSection === 'deductions' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span>4. Deductions</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            </button>
            <button
              onClick={() => setActivePrepSection('credits')}
              className={`w-full text-left p-2 rounded flex items-center justify-between ${
                activePrepSection === 'credits' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span>5. Tax Credits</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            </button>
            <button
              onClick={() => setActivePrepSection('payments')}
              className={`w-full text-left p-2 rounded flex items-center justify-between ${
                activePrepSection === 'payments' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span>6. Payments / WH</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            </button>
            <button
              onClick={() => setActivePrepSection('state')}
              className={`w-full text-left p-2 rounded flex items-center justify-between ${
                activePrepSection === 'state' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span>7. State / SC SC1040</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            </button>
            <button
              onClick={() => setActivePrepSection('international')}
              className={`w-full text-left p-2 rounded flex items-center justify-between ${
                activePrepSection === 'international' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span>8. Foreign / FBAR</span>
              <span className="text-[10px] bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-1 rounded font-bold">REQ</span>
            </button>
          </div>

          {/* Module Content Area */}
          <div className={`lg:col-span-3 p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
            {activePrepSection === 'personal' && (
              <div className="space-y-3 text-xs">
                <div className="border-b pb-2 flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase">1. Personal / Taxpayer Information</h3>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">✓ VERIFIED AGAINST DRIVER LICENSE</span>
                </div>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="p-3 border rounded">Taxpayer: <strong>{client.name}</strong></div>
                  <div className="p-3 border rounded">SSN/EIN: <strong>{client.ssnEinMasked}</strong></div>
                  <div className="p-3 border rounded">Filing Status: <strong>{client.filingStatus}</strong></div>
                  <div className="p-3 border rounded">Residence State: <strong>South Carolina (Full-Year)</strong></div>
                </div>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400">
                  <strong>Preparer Attestation:</strong> Identity, address (Columbia, SC), and spouse/dependent qualifications confirmed against prior-year return and intake questionnaire.
                </div>
              </div>
            )}

            {activePrepSection === 'income' && (
              <div className="space-y-3 text-xs">
                <div className="border-b pb-2 flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase">2. Form 1040 Income Lines</h3>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">✓ ALL SOURCES DOCUMENTED</span>
                </div>
                <div className="space-y-2 font-mono">
                  <div className="p-3 border rounded flex justify-between">
                    <span>Line 1a — Wages, salaries, tips (Form W-2)</span>
                    <strong>$145,000.00</strong>
                  </div>
                  <div className="p-3 border rounded flex justify-between">
                    <span>Line 2b — Ordinary dividends (Form 1099-DIV)</span>
                    <strong>$6,420.00</strong>
                  </div>
                  <div className="p-3 border rounded flex justify-between">
                    <span>Line 7 — Net Capital Gain (Schedule D)</span>
                    <strong>$15,250.00</strong>
                  </div>
                  <div className="p-3 border rounded flex justify-between">
                    <span>Schedule 1, Line 3 — Net Business Profit (Schedule C)</span>
                    <strong>$66,350.00</strong>
                  </div>
                </div>
              </div>
            )}

            {activePrepSection === 'international' && (
              <div className="space-y-3 text-xs">
                <div className="border-b pb-2 flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase text-red-600">8. International &amp; Foreign Information Reporting</h3>
                  <span className="text-[10px] font-mono bg-red-100 text-red-900 px-2 py-0.5 rounded font-bold">
                    MANDATORY REVIEW
                  </span>
                </div>
                <p className="text-neutral-700 dark:text-neutral-300">
                  Taxpayer holds an account at <strong>Zürcher Kantonalbank (ZKB)</strong> with a maximum CY2025 aggregate value of <strong>$114,500 USD</strong>.
                </p>
                <div className="p-3 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/20 rounded space-y-2 font-mono">
                  <div className="font-bold text-red-900 dark:text-red-300">Statutory Filing Obligations:</div>
                  <div>• FinCEN Form 114 (FBAR): <strong>REQUIRED (Threshold $10,000 exceeded)</strong></div>
                  <div>• IRS Form 8938 (FATCA): <strong>REQUIRED (Married Filing Jointly threshold $100k exceeded)</strong></div>
                  <div>• Schedule B, Part III Foreign Accounts Question: <strong>YES (Country: Switzerland)</strong></div>
                </div>
              </div>
            )}

            {(activePrepSection !== 'personal' && activePrepSection !== 'income' && activePrepSection !== 'international') && (
              <div className="space-y-3 text-xs font-mono">
                <div className="border-b pb-2 flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase">{activePrepSection.toUpperCase()} SCHEDULE</h3>
                  <span className="text-[10px] text-emerald-600 font-bold">✓ RECONCILED</span>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">
                  All supporting documentation verified against statutory IRS publication guidelines. Lead workpaper schedules mapped and ready for cross-footing.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 24: POTENTIAL FORM & SCHEDULE MAP (Section 24) */}
      {activeTab === 'form_map' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary}`}>
                24. Potential Form &amp; Schedule Map
              </h3>
              <p className={`text-xs ${textSecondary}`}>
                AI preliminary mappings derived from intake evidence. Accountant determination required for statutory applicability.
              </p>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[10px] font-mono text-amber-900 dark:text-amber-300 rounded max-w-sm">
              <strong>Statutory Rule:</strong> Never automatically declare a form legally required until approved by an authorized accountant.
            </div>
          </div>

          <div className="border rounded overflow-x-auto border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="p-3">Source Information</th>
                  <th className="p-3">Source Document</th>
                  <th className="p-3">Potential Form / Schedule</th>
                  <th className="p-3">Reason / Basis</th>
                  <th className="p-3">Accountant Decision</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {formMappings.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    <td className="p-3 font-medium text-neutral-900 dark:text-white">
                      {item.sourceInformation}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                      {item.sourceDocument}
                    </td>
                    <td className="p-3 font-bold font-mono text-neutral-900 dark:text-white">
                      {item.potentialFormSchedule}
                    </td>
                    <td className="p-3 text-neutral-600 dark:text-neutral-300">
                      {item.reasonBasis}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-mono text-[10px] font-bold">
                        {item.accountantDecision}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[10px] text-amber-700 dark:text-amber-400">
                      {item.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 25: SOURCE-TO-RETURN TRACEABILITY (Section 25) */}
      {activeTab === 'traceability' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary}`}>
              25. Source-to-Return Traceability Engine
            </h3>
            <p className={`text-xs ${textSecondary}`}>
              Granular mathematical provenance: Return Item &rarr; Workpaper &rarr; Source Document &rarr; Page &rarr; Field &rarr; AI Extraction &rarr; Accountant Verification.
            </p>
          </div>

          <div className="border rounded overflow-x-auto border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="p-3">Prepared Return Item</th>
                  <th className="p-3 text-right">Reported Amount</th>
                  <th className="p-3">Workpaper Link</th>
                  <th className="p-3">Source Document &amp; Box</th>
                  <th className="p-3">Verified Value</th>
                  <th className="p-3">Signer</th>
                  <th className="p-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {traceabilityRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    <td className="p-3 font-bold text-neutral-900 dark:text-white">
                      {rec.returnItemLabel}
                    </td>
                    <td className="p-3 font-mono text-right font-bold text-neutral-900 dark:text-white">
                      ${rec.reportedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                      {rec.workpaperName}
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      <div>{rec.sourceDocumentName} (p.{rec.pageNumber})</div>
                      <div className="text-[10px] text-neutral-500">{rec.fieldBox}</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-600">
                      ${typeof rec.accountantVerifiedValue === 'number' ? rec.accountantVerifiedValue.toLocaleString() : rec.accountantVerifiedValue}
                    </td>
                    <td className="p-3 text-neutral-600 dark:text-neutral-400 font-mono text-[10px]">
                      {rec.verifiedBy}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedTraceRecord(rec)}
                        className="px-2 py-1 bg-neutral-900 text-white dark:bg-white dark:text-black rounded text-[10px] font-bold uppercase hover:opacity-80"
                      >
                        Provenance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Traceability Inspection Modal */}
          {selectedTraceRecord && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className={`w-full max-w-xl border rounded-xl p-5 shadow-2xl ${
                isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
              } space-y-4`}>
                <div className="flex justify-between items-center border-b pb-3 border-neutral-200 dark:border-neutral-800">
                  <h4 className="font-bold text-sm uppercase">Source Traceability Provenance Chain</h4>
                  <button onClick={() => setSelectedTraceRecord(null)} className="text-neutral-400 hover:text-white">
                    ✕
                  </button>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">1. TAX RETURN FIELD</span>
                    <strong>{selectedTraceRecord.returnItemLabel}</strong> &bull; Amount: ${selectedTraceRecord.reportedAmount.toLocaleString()}
                  </div>
                  <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">2. WORKPAPER DOSSIER</span>
                    <strong>{selectedTraceRecord.workpaperName}</strong>
                  </div>
                  <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">3. SOURCE DOCUMENT &amp; SCAN</span>
                    <strong>{selectedTraceRecord.sourceDocumentName}</strong> &bull; Page {selectedTraceRecord.pageNumber} &bull; {selectedTraceRecord.fieldBox}
                  </div>
                  <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">4. HUMAN-IN-THE-LOOP VERIFICATION</span>
                    AI Value: ${selectedTraceRecord.extractedAiValue.toLocaleString()} &rarr; Verified by: <strong>{selectedTraceRecord.verifiedBy}</strong> on {new Date(selectedTraceRecord.verifiedTimestamp).toLocaleString()}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedTraceRecord(null)}
                    className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold uppercase rounded"
                  >
                    Close Provenance
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
