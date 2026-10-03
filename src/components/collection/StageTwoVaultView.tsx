/**
 * A/R Tax Services, LLC - StageTwoVaultView
 * Section 16: Automatic Tax Year & Category Folder Organization
 *
 * Implements:
 * - Automatic organization by Tax Year (e.g. 2025, 2024, 2023)
 * - Category folders: Employment, Interest, Investments, Business, Rental, Property,
 *   Deductions/Credits, Payments, Other, Prior Returns, Historical Documents
 * - Sorting derived from persisted metadata, not filename alone
 * - Document details drawer with metadata, SHA-256 hash, matched requirement, and audit actions
 */

import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  ShieldCheck,
  Calendar,
  Tag,
  Hash,
  Download,
  Eye,
  ChevronRight,
  ChevronDown,
  Building2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { StageTwoUploadedDocument } from '../../services/stageTwoCollectionService';

interface StageTwoVaultViewProps {
  documents: StageTwoUploadedDocument[];
  currentTaxYear: number;
  onRefresh?: () => void;
}

export const StageTwoVaultView: React.FC<StageTwoVaultViewProps> = ({
  documents,
  currentTaxYear,
  onRefresh
}) => {
  const [selectedDoc, setSelectedDoc] = useState<StageTwoUploadedDocument | null>(null);
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({
    [currentTaxYear]: true,
    [currentTaxYear - 1]: true
  });
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleYear = (year: number) => {
    setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
  };

  const toggleFolder = (key: string) => {
    setExpandedFolders(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Group documents by tax year (using detectedTaxYear or document's taxYear)
  const tree = useMemo(() => {
    const yearsMap = new Map<number, Map<string, StageTwoUploadedDocument[]>>();

    documents.forEach(doc => {
      const yr = (doc as any).detectedTaxYear || doc.taxYear || currentTaxYear;
      if (!yearsMap.has(yr)) {
        yearsMap.set(yr, new Map());
      }
      const folders = yearsMap.get(yr)!;

      // Classify into folder category
      const type = ((doc as any).detectedType || doc.claimedCategory || '').toLowerCase();
      let folderName = 'Other';

      if (type.includes('w-2') || type.includes('wage') || type.includes('employment')) {
        folderName = 'Employment';
      } else if (type.includes('1099-int') || type.includes('interest')) {
        folderName = 'Interest';
      } else if (type.includes('1099-div') || type.includes('dividend')) {
        folderName = 'Dividends';
      } else if (type.includes('1099-b') || type.includes('invest') || type.includes('brokerage')) {
        folderName = 'Investments';
      } else if (type.includes('1099-nec') || type.includes('business') || type.includes('trial') || type.includes('ledger') || type.includes('bank')) {
        folderName = 'Business & Banking';
      } else if (type.includes('1098') || type.includes('mortgage') || type.includes('property')) {
        folderName = 'Property';
      } else if (type.includes('prior') || type.includes('1040') || type.includes('1120')) {
        folderName = 'Prior Returns';
      } else if (type.includes('payment') || type.includes('estimated')) {
        folderName = 'Payments';
      } else if (type.includes('deduction') || type.includes('charit') || type.includes('education') || type.includes('hsa')) {
        folderName = 'Deductions & Credits';
      }

      if (!folders.has(folderName)) {
        folders.set(folderName, []);
      }
      folders.get(folderName)!.push(doc);
    });

    return yearsMap;
  }, [documents, currentTaxYear]);

  const sortedYears = Array.from(tree.keys()).sort((a, b) => b - a);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Folder Tree */}
      <div className="lg:col-span-2 space-y-4">
        <div className="p-4 bg-[#0D2745] border border-slate-700/60 rounded-xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-[#D4A843]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              CLIENT DOCUMENTS VAULT (Section 16 Auto-Organized)
            </h3>
          </div>
          <span className="text-xs font-mono text-[#A9B7C8]">
            {documents.length} Total Persisted Files
          </span>
        </div>

        {sortedYears.length === 0 ? (
          <div className="p-8 bg-[#0D2745] border border-slate-700/60 rounded-xl text-center space-y-3">
            <Folder className="w-12 h-12 text-[#7F91A6] mx-auto opacity-50" />
            <p className="text-xs text-[#A9B7C8]">
              No documents currently stored in Client Vault. Uploaded tax documents are automatically organized by tax year and category here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedYears.map(year => {
              const foldersMap = tree.get(year)!;
              const isYearOpen = expandedYears[year] ?? true;
              const yearDocCount = Array.from(foldersMap.values()).reduce((sum, list) => sum + list.length, 0);

              return (
                <div key={year} className="bg-[#0D2745] border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
                  {/* Year Header */}
                  <button
                    type="button"
                    onClick={() => toggleYear(year)}
                    className="w-full p-3.5 bg-[#102D4F] hover:bg-[#143657] flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {isYearOpen ? (
                        <ChevronDown className="w-4 h-4 text-[#D4A843]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#7F91A6]" />
                      )}
                      <Calendar className="w-4 h-4 text-[#D4A843]" />
                      <span className="text-sm font-bold font-mono text-white">
                        TAX YEAR {year} {year === currentTaxYear ? '(Active)' : '(Historical)'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#06182B] text-slate-300">
                      {yearDocCount} Files
                    </span>
                  </button>

                  {/* Category Folders */}
                  {isYearOpen && (
                    <div className="p-3 space-y-2">
                      {Array.from(foldersMap.entries()).map(([folderName, docList]) => {
                        const folderKey = `${year}_${folderName}`;
                        const isFolderOpen = expandedFolders[folderKey] ?? true;

                        return (
                          <div key={folderKey} className="ml-4 pl-3 border-l-2 border-slate-700/60 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => toggleFolder(folderKey)}
                              className="flex items-center gap-2 text-xs font-bold text-slate-200 hover:text-white py-1 cursor-pointer"
                            >
                              {isFolderOpen ? (
                                <FolderOpen className="w-4 h-4 text-[#D4A843]" />
                              ) : (
                                <Folder className="w-4 h-4 text-[#A9B7C8]" />
                              )}
                              <span>{folderName}</span>
                              <span className="text-[10px] font-mono text-[#7F91A6]">({docList.length})</span>
                            </button>

                            {isFolderOpen && (
                              <div className="space-y-1.5 ml-4">
                                {docList.map(doc => {
                                  const isSelected = selectedDoc?.documentId === doc.documentId;
                                  return (
                                    <div
                                      key={doc.documentId}
                                      onClick={() => setSelectedDoc(doc)}
                                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                        isSelected
                                          ? 'bg-[#102D4F] border-[#D4A843] text-white shadow-xs'
                                          : 'bg-[#06182B] border-slate-800 text-[#A9B7C8] hover:border-slate-700 hover:text-white'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <FileText className="w-3.5 h-3.5 text-[#D4A843] shrink-0" />
                                        <span className="truncate font-medium">{doc.originalFileName}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#0D2745] text-emerald-400">
                                          {(doc as any).detectedType || 'Recognized'}
                                        </span>
                                        <span className="text-[10px] font-mono text-[#7F91A6]">
                                          {new Date(doc.uploadTimestamp).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Document Details Drawer (Section 41) */}
      <div className="space-y-4">
        <div className="p-4 bg-[#0D2745] border border-slate-700/60 rounded-xl shadow-md">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#D4A843]" />
            <span>Document Details (Section 41)</span>
          </h3>
          <p className="text-xs text-[#A9B7C8] mt-0.5">
            Cryptographic provenance & extraction inspection
          </p>
        </div>

        {selectedDoc ? (
          <div className="p-5 bg-[#0D2745] border border-slate-700/60 rounded-xl space-y-4 text-xs">
            <div>
              <div className="text-[10px] font-mono uppercase text-[#A9B7C8]">File Name</div>
              <div className="text-sm font-bold text-white break-all mt-0.5">{selectedDoc.originalFileName}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-[#06182B] border border-slate-700/80 rounded-lg">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#A9B7C8] block">Document ID</span>
                <span className="font-mono text-[#D4A843] font-bold">{selectedDoc.documentId}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-[#A9B7C8] block">Recognized Type</span>
                <span className="font-bold text-emerald-300">{(selectedDoc as any).detectedType || selectedDoc.claimedCategory}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-[#A9B7C8] block">Detected Year</span>
                <span className="font-mono text-white font-bold">TY {(selectedDoc as any).detectedTaxYear || selectedDoc.taxYear}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-[#A9B7C8] block">Processing State</span>
                <span className="font-bold text-blue-300">{selectedDoc.processingStatus}</span>
              </div>
            </div>

            {(selectedDoc as any).detectedEmployer && (
              <div className="p-3 bg-[#06182B] border border-slate-700/80 rounded-lg">
                <span className="text-[10px] font-mono uppercase text-[#A9B7C8] block">Employer / Payer Source</span>
                <span className="font-bold text-white text-sm">{(selectedDoc as any).detectedEmployer}</span>
              </div>
            )}

            <div>
              <div className="text-[10px] font-mono uppercase text-[#A9B7C8]">Matched Requirement</div>
              <div className="p-2.5 bg-[#06182B] border border-slate-700/80 rounded-lg text-slate-200 mt-1">
                {selectedDoc.associatedRequirementId ? (
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Matched: {selectedDoc.associatedRequirementId}</span>
                  </span>
                ) : (
                  <span className="text-[#A9B7C8] italic">General supporting document / Unmatched</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase text-[#A9B7C8]">SHA-256 Provenance Hash</div>
              <div className="p-2 bg-[#06182B] border border-slate-800 rounded font-mono text-[10px] text-slate-300 break-all select-all mt-1">
                {selectedDoc.sha256Hash}
              </div>
            </div>

            <div className="text-[11px] text-[#A9B7C8] space-y-1">
              <div>Uploaded By: <strong className="text-white">{selectedDoc.uploadedBy}</strong></div>
              <div>Timestamp: <strong className="text-white">{new Date(selectedDoc.uploadTimestamp).toLocaleString()}</strong></div>
              <div>Security: <strong className="text-emerald-400">{selectedDoc.securityCheckStatus}</strong></div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-[#0D2745] border border-slate-700/60 rounded-xl text-center space-y-2 text-[#7F91A6]">
            <FileText className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs">Select any file from the vault folders to inspect recognized metadata, OCR extraction, and requirement match status.</p>
          </div>
        )}
      </div>
    </div>
  );
};
