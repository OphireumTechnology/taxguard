/**
 * TaxGuard AI – Case and Engagement Management Workspace
 * Full lifecycle tracking: Intake, In Progress, Review, CPA Sign-Off, Ready for Filing
 */

import React, { useState } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Calendar, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldCheck, 
  ChevronRight, 
  Filter, 
  Lock,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { TaxGuardEngagementCase, TaxReturnFormType } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardCasesView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [cases, setCases] = useState<TaxGuardEngagementCase[]>(() =>
    TaxGuardStorageService.getCases(userRole, userRole === 'client' ? 'client_henze_001' : undefined)
  );
  const [selectedCase, setSelectedCase] = useState<TaxGuardEngagementCase | null>(cases[0] || null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState<string | null>(null);
  const [workflowNote, setWorkflowNote] = useState<string>('');

  // New Case Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newEntityType, setNewEntityType] = useState<'Individual' | 'Single-Member LLC' | 'S-Corporation' | 'C-Corporation' | 'Partnership'>('Single-Member LLC');
  const [newReturnType, setNewReturnType] = useState<TaxReturnFormType>('1040');
  const [newTaxYear, setNewTaxYear] = useState(2024);
  const [newJurisdiction, setNewJurisdiction] = useState('Federal, South Carolina');
  const [newPriority, setNewPriority] = useState<'normal' | 'expedited' | 'urgent_statute'>('normal');

  const filteredCases = cases.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;

    const created = TaxGuardStorageService.createCase({
      tenantId: 'tenant_ar_tax_prod',
      clientId: `client_${Date.now()}`,
      clientName: newClientName,
      clientEmail: newClientEmail || 'client@artaxservices.com',
      entityType: newEntityType,
      taxYear: newTaxYear,
      returnType: newReturnType,
      jurisdictions: newJurisdiction.split(',').map(s => s.trim()),
      assignedPreparer: 'Marcus Vance, EA',
      assignedReviewer: 'Sarah Jenkins, CPA',
      assignedCpa: 'Desmond Hinds, Principal',
      status: 'intake',
      priority: newPriority,
      internalDeadline: '2025-03-31',
      filingDeadline: '2025-04-15',
      clientProgressPercent: 15,
      missingItemsCount: 3,
      discrepanciesCount: 0
    });

    setCases(TaxGuardStorageService.getCases(userRole, userRole === 'client' ? 'client_henze_001' : undefined));
    setSelectedCase(created);
    setShowCreateModal(false);
    setNewClientName('');
    setNewClientEmail('');
  };

  const handleStatusChange = (caseId: string, newStatus: TaxGuardEngagementCase['status']) => {
    TaxGuardStorageService.updateCaseStatus(caseId, newStatus, userRole);
    setCases(TaxGuardStorageService.getCases(userRole, userRole === 'client' ? 'client_henze_001' : undefined));
    if (selectedCase && selectedCase.id === caseId) {
      setSelectedCase({ ...selectedCase, status: newStatus });
    }
  };

  const handleWorkflowActionSubmit = (actionType: 'amendment' | 'audit_support' | 'notice_response' | 'business_closure') => {
    if (!selectedCase) return;
    TaxGuardStorageService.addCaseWorkflowAction(selectedCase.id, actionType, workflowNote, userRole);
    setShowWorkflowModal(null);
    setWorkflowNote('');
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* Header bar */}
      <div className="bg-white border border-[#D8DCE2] p-5 rounded-xs shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-[#C99A32]" />
            <span>Case & Engagement Management Workspace</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time engagement lifecycle, milestone tracking, filing deadlines, and maker-checker audit locks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-medium text-[#061A2F] outline-hidden cursor-pointer"
            >
              <option value="all">All Statuses ({cases.length})</option>
              <option value="intake">Intake</option>
              <option value="document_collection">Document Collection</option>
              <option value="extraction_review">Extraction Review</option>
              <option value="workpaper_prep">Workpaper Prep</option>
              <option value="cpa_review">CPA Technical Review</option>
              <option value="client_signing">Client Signing</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {userRole !== 'client' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#061A2F] text-white text-xs font-semibold rounded-xs hover:bg-[#0A2544] border border-[#1A365D] shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>New Engagement</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Cases List & Active Case Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cases List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Active Engagements ({filteredCases.length})
          </div>

          {filteredCases.map((c) => {
            const isSelected = selectedCase?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedCase(c)}
                className={`p-4 rounded-xs border cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-white border-[#C99A32] shadow-sm ring-1 ring-[#C99A32]/40' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-xs uppercase">
                      TY{c.taxYear} • Form {c.returnType}
                    </span>
                    <h2 className="text-sm font-bold text-[#061A2F] mt-1">{c.clientName}</h2>
                    <div className="text-xs text-slate-500">{c.entityType}</div>
                  </div>

                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs border ${
                    c.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : c.status === 'cpa_review'
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-blue-50 text-blue-900 border-blue-200'
                  }`}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Client Completion</span>
                    <span className="font-semibold text-slate-700">{c.clientProgressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#C99A32] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${c.clientProgressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Statutory: {c.filingDeadline}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.missingItemsCount > 0 && (
                      <span className="text-amber-700 font-medium">
                        {c.missingItemsCount} missing
                      </span>
                    )}
                    {c.discrepanciesCount > 0 && (
                      <span className="text-rose-700 font-medium">
                        {c.discrepanciesCount} alert
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Case Detail Inspector */}
        <div className="lg:col-span-7">
          {selectedCase ? (
            <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-6 space-y-6">
              {/* Top Banner */}
              <div className="border-b border-slate-200 pb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#C99A32] bg-[#061A2F] px-2 py-0.5 rounded-xs">
                      {selectedCase.id}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      TY{selectedCase.taxYear} Return ({selectedCase.returnType})
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#061A2F] mt-1.5">{selectedCase.clientName}</h2>
                  <p className="text-xs text-slate-500">
                    {selectedCase.clientEmail} • Jurisdictions: {selectedCase.jurisdictions.join(', ')}
                  </p>
                </div>

                {userRole !== 'client' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Advance Status:</span>
                    <select
                      value={selectedCase.status}
                      onChange={(e) => handleStatusChange(selectedCase.id, e.target.value as any)}
                      className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xs px-2 py-1 text-[#061A2F] cursor-pointer"
                    >
                      <option value="intake">Intake</option>
                      <option value="document_collection">Document Collection</option>
                      <option value="extraction_review">Extraction Review</option>
                      <option value="workpaper_prep">Workpaper Prep</option>
                      <option value="cpa_review">CPA Review</option>
                      <option value="client_signing">Client Signing</option>
                      <option value="ready_for_filing">Ready for Filing</option>
                      <option value="completed">Completed & Locked</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Staff Assignments */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xs text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Preparer</span>
                  <span className="font-semibold text-slate-800">{selectedCase.assignedPreparer}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Reviewer</span>
                  <span className="font-semibold text-slate-800">{selectedCase.assignedReviewer}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">CPA Sign-Off</span>
                  <span className="font-semibold text-[#061A2F]">{selectedCase.assignedCpa}</span>
                </div>
              </div>

              {/* Maker-Checker Workflow Steps */}
              <div>
                <h3 className="text-xs font-bold text-[#061A2F] uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Maker-Checker Approval Gates</span>
                  <span className="text-[11px] text-slate-500 font-normal">Dual Authorization Required for Material Gates</span>
                </h3>
                <div className="space-y-2">
                  {selectedCase.makerCheckerSteps.map((step) => (
                    <div
                      key={step.stepNumber}
                      className={`flex items-center justify-between p-2.5 rounded-xs border text-xs ${
                        step.completed
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          step.completed
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {step.completed ? '✓' : step.stepNumber}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-2">
                            <span>{step.stepName}</span>
                            <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded-xs font-bold ${
                              step.riskTier === 'filing_critical'
                                ? 'bg-rose-100 text-rose-800'
                                : step.riskTier === 'high_risk'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {step.riskTier.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">{step.description}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        {step.completed ? (
                          <div className="text-[11px] text-emerald-800">
                            <span className="font-semibold">{step.completedBy}</span>
                            <span className="text-slate-400 block text-[10px]">{step.completedAt}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Requires {step.requiredRole.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Workflow Action Triggers */}
              {userRole !== 'client' && (
                <div className="pt-4 border-t border-slate-200">
                  <h3 className="text-xs font-bold text-[#061A2F] uppercase tracking-wider mb-2">
                    Specialized Engagement Operations
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => setShowWorkflowModal('amendment')}
                      className="p-2.5 text-center border border-slate-200 rounded-xs hover:border-[#C99A32] hover:bg-slate-50 transition-colors text-xs"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                      <span className="font-medium text-slate-700 block">Amended Return</span>
                      <span className="text-[10px] text-slate-400">Form 1040-X / 1120X</span>
                    </button>
                    <button
                      onClick={() => setShowWorkflowModal('audit_support')}
                      className="p-2.5 text-center border border-slate-200 rounded-xs hover:border-[#C99A32] hover:bg-slate-50 transition-colors text-xs"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                      <span className="font-medium text-slate-700 block">Audit Defense</span>
                      <span className="text-[10px] text-slate-400">IRS / DOR Exam</span>
                    </button>
                    <button
                      onClick={() => setShowWorkflowModal('notice_response')}
                      className="p-2.5 text-center border border-slate-200 rounded-xs hover:border-[#C99A32] hover:bg-slate-50 transition-colors text-xs"
                    >
                      <AlertCircle className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                      <span className="font-medium text-slate-700 block">Notice Response</span>
                      <span className="text-[10px] text-slate-400">CP2000 / CP504</span>
                    </button>
                    <button
                      onClick={() => setShowWorkflowModal('business_closure')}
                      className="p-2.5 text-center border border-slate-200 rounded-xs hover:border-[#C99A32] hover:bg-slate-50 transition-colors text-xs"
                    >
                      <Lock className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                      <span className="font-medium text-slate-700 block">Final Dissolution</span>
                      <span className="text-[10px] text-slate-400">Final Return Box</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xs p-12 text-center text-slate-400 text-xs">
              Select an engagement case to view complete lifecycle details.
            </div>
          )}
        </div>
      </div>

      {/* New Engagement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-sm font-bold text-[#061A2F] uppercase">Create New Tax & Accounting Engagement</h2>
              <p className="text-xs text-slate-500 mt-0.5">Initializes case container, statutory audit log, and maker-checker gates.</p>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Taxpayer / Business Entity Name *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Carolina Timber Products, LLC"
                  className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 focus:border-[#C99A32] outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 focus:border-[#C99A32] outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Entity Classification</label>
                  <select
                    value={newEntityType}
                    onChange={(e) => setNewEntityType(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden"
                  >
                    <option value="Single-Member LLC">Single-Member LLC</option>
                    <option value="Individual">Individual (1040)</option>
                    <option value="S-Corporation">S-Corporation (1120-S)</option>
                    <option value="Partnership">Partnership (1065)</option>
                    <option value="C-Corporation">C-Corporation (1120)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tax Year</label>
                  <input
                    type="number"
                    value={newTaxYear}
                    onChange={(e) => setNewTaxYear(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Return Family</label>
                  <select
                    value={newReturnType}
                    onChange={(e) => setNewReturnType(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden"
                  >
                    <option value="1040">Form 1040 (Individual / Sch C)</option>
                    <option value="1120-S">Form 1120-S (S-Corp)</option>
                    <option value="1065">Form 1065 (Partnership)</option>
                    <option value="1120">Form 1120 (C-Corp)</option>
                    <option value="990">Form 990 (Non-Profit)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden"
                  >
                    <option value="normal">Standard Deadline</option>
                    <option value="expedited">Expedited Review</option>
                    <option value="urgent_statute">Urgent Statute of Limitations</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jurisdictions</label>
                <input
                  type="text"
                  value={newJurisdiction}
                  onChange={(e) => setNewJurisdiction(e.target.value)}
                  placeholder="Federal, South Carolina"
                  className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#061A2F] text-white font-semibold rounded-xs hover:bg-[#0A2544] border border-[#1A365D]"
                >
                  Initialize Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Specialized Workflow Modal */}
      {showWorkflowModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-sm font-bold text-[#061A2F] uppercase">
                Initiate {showWorkflowModal.replace('_', ' ').toUpperCase()} Workflow
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Appends a formal workflow action to the engagement case history with full audit logging.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-semibold text-slate-700">Specific Notes or Statutory Reason</label>
              <textarea
                rows={3}
                value={workflowNote}
                onChange={(e) => setWorkflowNote(e.target.value)}
                placeholder="Document the technical justification, IRS notice number, or amended return year..."
                className="w-full border border-slate-300 rounded-xs p-2 outline-hidden focus:border-[#C99A32]"
              />

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowWorkflowModal(null)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleWorkflowActionSubmit(showWorkflowModal as any)}
                  className="px-4 py-1.5 bg-[#061A2F] text-white font-semibold rounded-xs hover:bg-[#0A2544]"
                >
                  Commit Action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
