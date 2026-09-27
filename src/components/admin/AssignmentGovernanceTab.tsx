import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ClientAccountantBinding, AccountantProfile, ReassignmentRequest, User } from '../../types';
import { 
  Users, 
  UserCheck, 
  UserX, 
  UserPlus, 
  ShieldCheck, 
  ArrowRightLeft, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  PauseCircle, 
  PlayCircle,
  Briefcase,
  Layers,
  Award,
  Calendar,
  FileText
} from 'lucide-react';

interface AssignmentGovernanceTabProps {
  users: User[];
  onRefreshNeeded?: () => void;
}

export const AssignmentGovernanceTab: React.FC<AssignmentGovernanceTabProps> = ({ users, onRefreshNeeded }) => {
  const [bindings, setBindings] = useState<ClientAccountantBinding[]>([]);
  const [accountantWorkloads, setAccountantWorkloads] = useState<AccountantProfile[]>([]);
  const [reassignmentRequests, setReassignmentRequests] = useState<ReassignmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'unbound'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal / Form States
  const [isBindModalOpen, setIsBindModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isUnbindModalOpen, setIsUnbindModalOpen] = useState(false);
  const [selectedBinding, setSelectedBinding] = useState<ClientAccountantBinding | null>(null);

  // Bind Form Data
  const [newClientId, setNewClientId] = useState('');
  const [newAccountantId, setNewAccountantId] = useState('');
  const [newAssignmentType, setNewAssignmentType] = useState<string>('primary');
  const [newReason, setNewReason] = useState('Standard engagement onboarding and workload distribution');
  const [newInternalNotes, setNewInternalNotes] = useState('');
  const [newScopes, setNewScopes] = useState<string[]>([
    'view_accounting_records',
    'upload_workpapers',
    'prepare_tax_work',
    'communicate_with_client'
  ]);

  // Reassign Form Data
  const [reassignTargetAccountantId, setReassignTargetAccountantId] = useState('');
  const [reassignReason, setReassignReason] = useState('Caseload rebalancing per firm policy');

  // Unbind Form Data
  const [unbindReason, setUnbindReason] = useState('Engagement concluded or client requested preparer change');
  const [unbindReplacementId, setUnbindReplacementId] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [bindingsRes, workloadRes, reqsRes] = await Promise.all([
        api.assignments.list().catch(() => ({ bindings: [] })),
        api.assignments.getWorkload().catch(() => ({ profiles: [] })),
        api.assignments.listReassignmentRequests().catch(() => ({ requests: [] }))
      ]);

      setBindings(bindingsRes.bindings || []);
      setAccountantWorkloads(workloadRes.profiles || []);
      setReassignmentRequests(reqsRes.requests || []);
    } catch (err: any) {
      console.error('Error loading assignment governance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 6000);
  };

  const handleCreateBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId || !newAccountantId) {
      showNotification('error', 'Please select both a client and an accountant.');
      return;
    }

    try {
      const res = await api.assignments.bind({
        clientId: newClientId,
        accountantId: newAccountantId,
        assignmentType: newAssignmentType,
        accessScope: newScopes,
        reason: newReason,
        internalNotes: newInternalNotes
      });

      showNotification('success', res.message || 'Client successfully bound to accountant.');
      setIsBindModalOpen(false);
      await loadData();
      if (onRefreshNeeded) onRefreshNeeded();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to create assignment binding.');
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBinding || !reassignTargetAccountantId) {
      showNotification('error', 'Please select a replacement accountant.');
      return;
    }

    try {
      const res = await api.assignments.reassign(
        selectedBinding.id,
        reassignTargetAccountantId,
        reassignReason
      );

      showNotification('success', res.message || 'Client successfully reassigned.');
      setIsReassignModalOpen(false);
      setSelectedBinding(null);
      await loadData();
      if (onRefreshNeeded) onRefreshNeeded();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to reassign client.');
    }
  };

  const handleUnbind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBinding) return;
    if (!unbindReason.trim()) {
      showNotification('error', 'A mandatory reason is required to unbind an accountant for audit governance.');
      return;
    }

    try {
      const res = await api.assignments.unbind(
        selectedBinding.id,
        unbindReason,
        unbindReplacementId || undefined
      );

      showNotification('success', res.message || 'Accountant unbound successfully.');
      setIsUnbindModalOpen(false);
      setSelectedBinding(null);
      await loadData();
      if (onRefreshNeeded) onRefreshNeeded();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to unbind accountant.');
    }
  };

  const handleToggleSuspend = async (binding: ClientAccountantBinding) => {
    try {
      if (binding.status === 'active') {
        const res = await api.assignments.suspend(binding.id, 'Administrative caseload pause');
        showNotification('success', res.message || 'Binding suspended.');
      } else {
        const res = await api.assignments.restore(binding.id);
        showNotification('success', res.message || 'Binding restored.');
      }
      await loadData();
      if (onRefreshNeeded) onRefreshNeeded();
    } catch (err: any) {
      showNotification('error', err.message || 'Could not update binding state.');
    }
  };

  const handleReviewReassignment = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      const res = await api.assignments.reviewReassignmentRequest(requestId, action, `Admin reviewed and ${action}`);
      showNotification('success', res.message || `Reassignment request ${action}.`);
      await loadData();
      if (onRefreshNeeded) onRefreshNeeded();
    } catch (err: any) {
      showNotification('error', err.message || 'Error reviewing reassignment request.');
    }
  };

  const toggleScope = (scopeKey: string) => {
    setNewScopes(prev => 
      prev.includes(scopeKey) 
        ? prev.filter(s => s !== scopeKey) 
        : [...prev, scopeKey]
    );
  };

  const safeUsers = users || [];
  const clientsList = safeUsers.filter(u => u.role === 'client' || u.role === 'prospective_client');
  const accountantsList = safeUsers.filter(u => ['accountant', 'senior_reviewer', 'admin', 'super_admin'].includes(u.role));

  const filteredBindings = (bindings || []).filter(b => {
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesSearch = 
      (b.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.accountantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.assignmentType || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Alert Banner */}
      {actionNotice && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold ${
          actionNotice.type === 'success' 
            ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200' 
            : 'bg-rose-950/80 border border-rose-500/50 text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header & Primary Actions */}
      <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E3A5F] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F] text-[10px] font-bold uppercase tracking-wider">
                Server-Enforced Access Controls
              </span>
              <span className="text-xs text-slate-400">Zero-Trust Caseload Governance</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mt-1">
              Client-Accountant Bindings & Workload Manager
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Authorize, reassign, suspend, and unbind accountants from client financial records. Only accountants with an active, cryptographically logged binding can access tax documents, journal ledgers, or messages.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setNewClientId(clientsList[0]?.id || '');
                setNewAccountantId(accountantsList[0]?.id || '');
                setIsBindModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#07172B] font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Bind New Client to Accountant
            </button>
          </div>
        </div>

        {/* Workload / Capacity Metrics */}
        <div>
          <h3 className="font-serif text-base font-bold text-white mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#C6A15B]" />
            Staff Preparer Capacity & Active Caseloads
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(accountantWorkloads || []).map(acc => {
              const capacityPercent = acc.maxCapacity ? Math.round((acc.activeClientCount / acc.maxCapacity) * 100) : 0;
              const isFull = acc.activeClientCount >= (acc.maxCapacity || 1);

              return (
                <div 
                  key={acc.userId}
                  className="p-5 rounded-2xl bg-[#07172B] border border-[#1E3A5F] space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-serif text-sm font-bold text-white">{acc.name}</h4>
                      <p className="text-[11px] text-[#C6A15B] font-medium">{acc.title}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isFull 
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {isFull ? 'At Capacity' : 'Accepting'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Caseload Capacity</span>
                      <span className="font-mono text-white font-bold">{acc.activeClientCount} / {acc.maxCapacity} clients ({capacityPercent}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#0D2340] rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          capacityPercent > 85 ? 'bg-amber-500' : capacityPercent > 95 ? 'bg-rose-500' : 'bg-[#C6A15B]'
                        }`}
                        style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex flex-wrap gap-1">
                    {(acc.specializations || []).slice(0, 3).map((spec, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#0D2340] text-slate-300 border border-[#1E3A5F]">
                        {spec}
                      </span>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-400 pt-1 border-t border-[#1E3A5F]/60">
                    Professional credential status is verified server-side; identifiers are restricted.
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pending Client Reassignment Requests */}
      {(reassignmentRequests || []).length > 0 && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-[#0D2340] to-[#07172B] border border-amber-500/40 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-amber-400" />
            <h3 className="font-serif text-lg font-bold text-white">
              Pending Client Reassignment Requests ({(reassignmentRequests || []).filter(r => r.status === 'pending').length})
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            Clients can submit change-of-accountant requests. Administrators must review the rationale, evaluate caseload balance, and execute reassignments.
          </p>

          <div className="space-y-3">
            {(reassignmentRequests || []).map(req => (
              <div 
                key={req.id}
                className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{req.clientName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#0D2340] text-amber-300 border border-amber-500/30 uppercase font-mono">
                      {req.status}
                    </span>
                    <span className="text-slate-400 text-[11px] font-mono">Submitted {new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-300">
                    <strong>Reason:</strong> {req.reason}
                  </p>
                  {req.preferredSpecialization && (
                    <p className="text-[#C6A15B]">
                      <strong>Preferred Specialization:</strong> {req.preferredSpecialization}
                    </p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReviewReassignment(req.id, 'approved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Approve & Reassign
                    </button>
                    <button
                      onClick={() => handleReviewReassignment(req.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200 font-bold text-xs"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Bindings Table & Filters */}
      <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#C6A15B]" />
            <h3 className="font-serif text-xl font-bold text-white">Client-Accountant Caseload Registry</h3>
            <span className="text-xs text-slate-400 font-mono">({filteredBindings.length} Records)</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search client or preparer..."
                className="bg-[#07172B] border border-[#1E3A5F] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C6A15B]"
              />
            </div>

            {/* Status Filter */}
            <div className="flex rounded-xl bg-[#07172B] p-1 border border-[#1E3A5F] text-xs">
              {(['all', 'active', 'suspended', 'unbound'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all ${
                    statusFilter === st
                      ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Registry Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#1E3A5F]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#07172B] text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-[#1E3A5F]">
              <tr>
                <th className="py-3 px-4">Client Dossier</th>
                <th className="py-3 px-4">Assigned Preparer</th>
                <th className="py-3 px-4">Role / Type</th>
                <th className="py-3 px-4">Permission Scopes</th>
                <th className="py-3 px-4">Effective Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Governance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]">
              {filteredBindings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No client-accountant bindings found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredBindings.map(b => (
                  <tr key={b.id} className="hover:bg-[#132E52]/40 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">
                      <div>{b.clientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {b.clientId}</div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#C6A15B]" />
                        {b.accountantName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">By: {b.assignedByName}</div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F]">
                        {b.assignmentType}
                      </span>
                    </td>

                    <td className="py-4 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {b.accessScope.map(sc => (
                          <span key={sc} className="text-[9px] px-1.5 py-0.5 rounded bg-[#07172B] text-slate-300 font-mono border border-[#1E3A5F]">
                            {sc.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-slate-300 font-mono text-[11px]">
                      {new Date(b.effectiveDate).toLocaleDateString()}
                    </td>

                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                        b.status === 'active' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                          : b.status === 'suspended'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}>
                        {b.status === 'active' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        {b.status === 'suspended' && <PauseCircle className="w-3 h-3 text-amber-400" />}
                        {b.status === 'unbound' && <XCircle className="w-3 h-3 text-rose-400" />}
                        {b.status}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {b.status !== 'unbound' && (
                          <>
                            {/* Reassign button */}
                            <button
                              onClick={() => {
                                setSelectedBinding(b);
                                setReassignTargetAccountantId('');
                                setIsReassignModalOpen(true);
                              }}
                              title="Reassign to another staff member"
                              className="px-2.5 py-1 rounded-lg bg-[#07172B] hover:bg-[#132E52] border border-[#1E3A5F] text-[#C6A15B] font-semibold text-xs flex items-center gap-1"
                            >
                              <ArrowRightLeft className="w-3 h-3" /> Reassign
                            </button>

                            {/* Suspend / Restore button */}
                            <button
                              onClick={() => handleToggleSuspend(b)}
                              title={b.status === 'active' ? 'Suspend access' : 'Restore access'}
                              className="px-2.5 py-1 rounded-lg bg-[#07172B] hover:bg-[#132E52] border border-[#1E3A5F] text-slate-300 font-semibold text-xs flex items-center gap-1"
                            >
                              {b.status === 'active' ? (
                                <>
                                  <PauseCircle className="w-3 h-3 text-amber-400" /> Pause
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="w-3 h-3 text-emerald-400" /> Resume
                                </>
                              )}
                            </button>

                            {/* Unbind button */}
                            <button
                              onClick={() => {
                                setSelectedBinding(b);
                                setUnbindReason('');
                                setUnbindReplacementId('');
                                setIsUnbindModalOpen(true);
                              }}
                              title="Unbind accountant with audit log"
                              className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-600/40 text-rose-200 font-semibold text-xs flex items-center gap-1"
                            >
                              <UserX className="w-3 h-3" /> Unbind
                            </button>
                          </>
                        )}
                        {b.status === 'unbound' && (
                          <span className="text-[11px] text-slate-500 italic">
                            Unbound on {b.unboundAt ? new Date(b.unboundAt).toLocaleDateString() : 'N/A'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE BINDING */}
      {isBindModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D2340] border border-[#C6A15B] rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#C6A15B]" />
                <h3 className="font-serif text-lg font-bold text-white">Create Client-Accountant Binding</h3>
              </div>
              <button onClick={() => setIsBindModalOpen(false)} className="text-slate-400 hover:text-white text-base">✕</button>
            </div>

            <form onSubmit={handleCreateBinding} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Client</label>
                <select
                  value={newClientId}
                  onChange={e => setNewClientId(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                  required
                >
                  <option value="">-- Choose a Client --</option>
                  {clientsList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.companyName || c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assign to Preparer / Accountant</label>
                <select
                  value={newAccountantId}
                  onChange={e => setNewAccountantId(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                  required
                >
                  <option value="">-- Choose an Accountant --</option>
                  {accountantsList.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assignment Role / Type</label>
                  <select
                    value={newAssignmentType}
                    onChange={e => setNewAssignmentType(e.target.value)}
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                  >
                    <option value="primary">Primary Preparer</option>
                    <option value="secondary">Secondary / Associate</option>
                    <option value="reviewer">Quality Reviewer</option>
                    <option value="specialist">Tax Specialist</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Effective Date</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                  />
                </div>
              </div>

              {/* Granular Permission Scopes */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Granular Access Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#07172B] p-3 rounded-xl border border-[#1E3A5F]">
                  {[
                    { id: 'view_accounting_records', label: 'View Accounting & GL Records' },
                    { id: 'upload_workpapers', label: 'Upload Workpapers & Schedules' },
                    { id: 'prepare_tax_work', label: 'Prepare Tax Work & Returns' },
                    { id: 'review_tax_work', label: 'Review & Certify Returns' },
                    { id: 'communicate_with_client', label: 'Client Messaging & Notes' },
                    { id: 'manage_integrations', label: 'QuickBooks / Xero Sync' }
                  ].map(item => (
                    <label key={item.id} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newScopes.includes(item.id)}
                        onChange={() => toggleScope(item.id)}
                        className="rounded border-[#1E3A5F] text-[#C6A15B] focus:ring-0"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assignment Rationale (Audit Log)</label>
                <input
                  type="text"
                  value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                  placeholder="Rationale for this client-accountant binding..."
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Internal Notes (Confidential)</label>
                <textarea
                  value={newInternalNotes}
                  onChange={e => setNewInternalNotes(e.target.value)}
                  rows={2}
                  placeholder="Notes for the accountant regarding this client..."
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setIsBindModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#07172B] text-slate-300 font-bold hover:bg-[#132E52]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#07172B] font-bold shadow-lg"
                >
                  Confirm & Provision Binding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REASSIGN CLIENT */}
      {isReassignModalOpen && selectedBinding && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D2340] border border-[#C6A15B] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-[#C6A15B]" />
                <h3 className="font-serif text-lg font-bold text-white">Reassign Client Caseload</h3>
              </div>
              <button onClick={() => setIsReassignModalOpen(false)} className="text-slate-400 hover:text-white text-base">✕</button>
            </div>

            <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] space-y-1">
              <div className="text-slate-400">Client: <strong className="text-white">{selectedBinding.clientName}</strong></div>
              <div className="text-slate-400">Current Preparer: <strong className="text-[#C6A15B]">{selectedBinding.accountantName}</strong></div>
            </div>

            <form onSubmit={handleReassign} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Assigned Preparer</label>
                <select
                  value={reassignTargetAccountantId}
                  onChange={e => setReassignTargetAccountantId(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                  required
                >
                  <option value="">-- Choose New Accountant --</option>
                  {accountantsList
                    .filter(a => a.id !== selectedBinding.accountantId)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role.replace(/_/g, ' ')})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reassignment Rationale</label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={e => setReassignReason(e.target.value)}
                  placeholder="Reason for changing preparer..."
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setIsReassignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#07172B] text-slate-300 font-bold hover:bg-[#132E52]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#07172B] font-bold shadow-lg"
                >
                  Execute Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UNBIND ACCOUNTANT */}
      {isUnbindModalOpen && selectedBinding && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D2340] border border-rose-500/60 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <UserX className="w-5 h-5" />
                <h3 className="font-serif text-lg font-bold text-white">Unbind Accountant from Client</h3>
              </div>
              <button onClick={() => setIsUnbindModalOpen(false)} className="text-slate-400 hover:text-white text-base">✕</button>
            </div>

            <p className="text-slate-300">
              Revoking this binding immediately terminates <strong className="text-white">{selectedBinding.accountantName}’s</strong> server-side access to <strong className="text-white">{selectedBinding.clientName}’s</strong> tax and accounting documents.
            </p>

            <form onSubmit={handleUnbind} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mandatory Unbinding Reason (IRS & Compliance Log)
                </label>
                <textarea
                  value={unbindReason}
                  onChange={e => setUnbindReason(e.target.value)}
                  rows={2}
                  placeholder="State the reason why access is being terminated..."
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Optional Replacement Accountant</label>
                <select
                  value={unbindReplacementId}
                  onChange={e => setUnbindReplacementId(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white focus:border-[#C6A15B] outline-none"
                >
                  <option value="">-- No Immediate Replacement --</option>
                  {accountantsList
                    .filter(a => a.id !== selectedBinding.accountantId)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role.replace(/_/g, ' ')})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setIsUnbindModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#07172B] text-slate-300 font-bold hover:bg-[#132E52]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg"
                >
                  Confirm Immediate Revocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
