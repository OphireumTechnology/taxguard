/**
 * TaxGuard AI – Unified Action Center
 * Centralized role-based queue for Document Requests, Staff Tasks, Review Gate Approvals,
 * Signature Requests, Filing Submissions, Notice Responses, and Estimated Payments.
 */

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  PenTool, 
  Send, 
  ShieldCheck, 
  Filter, 
  Search,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';

export type ActionTaskType = 
  | 'Document Request'
  | 'Client Response'
  | 'Staff Task'
  | 'Review Request'
  | 'Approval Request'
  | 'Signature Request'
  | 'Filing Task'
  | 'Notice Response'
  | 'Strategy Implementation'
  | 'Estimated Payment'
  | 'Renewal'
  | 'Retention Approval';

export interface ActionCenterTask {
  id: string;
  type: ActionTaskType;
  title: string;
  clientName: string;
  assignedRole: string;
  deadline: string;
  riskScore: 'Critical' | 'Approaching' | 'Scheduled' | 'Completed';
  requiredAction: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

const INITIAL_TASKS: ActionCenterTask[] = [
  {
    id: 'tsk_001',
    type: 'Approval Request',
    title: 'Senior CPA Review & Sign-Off: Form 1120-S Lead Workpapers',
    clientName: 'Summit Peak Construction',
    assignedRole: 'reviewer',
    deadline: '2024-09-20',
    riskScore: 'Critical',
    requiredAction: 'Verify Schedule M-1 adjustments and sign Form 4562 schedule.',
    completed: false
  },
  {
    id: 'tsk_002',
    type: 'Notice Response',
    title: 'IRS Notice CP2000 Response Packet Transmission',
    clientName: 'Perotti Holdings, LLC',
    assignedRole: 'resolution',
    deadline: '2024-10-18',
    riskScore: 'Approaching',
    requiredAction: 'Transmit dispute statement and Form 8857 documentation.',
    completed: false
  },
  {
    id: 'tsk_003',
    type: 'Signature Request',
    title: 'Form 8879 Client e-File Authorization Signature',
    clientName: 'Palmetto Commercial Properties, LLC',
    assignedRole: 'client',
    deadline: '2024-09-25',
    riskScore: 'Approaching',
    requiredAction: 'Client digital signature required prior to batch transmission.',
    completed: false
  },
  {
    id: 'tsk_004',
    type: 'Document Request',
    title: 'Contemporaneous November Vehicle Mileage Log (§ 280F)',
    clientName: 'Summit Peak Construction',
    assignedRole: 'accountant',
    deadline: '2024-09-22',
    riskScore: 'Critical',
    requiredAction: 'Obtain November mileage log from client portal vault.',
    completed: false
  },
  {
    id: 'tsk_005',
    type: 'Estimated Payment',
    title: 'Q3 Estimated Tax Payment Voucher Preparation (SC1040ES)',
    clientName: 'Michael Perotti',
    assignedRole: 'billing',
    deadline: '2024-09-16',
    riskScore: 'Scheduled',
    requiredAction: 'Verify EFTPS confirmation code against bank statement.',
    completed: true,
    completedAt: '2024-09-15 11:30',
    completedBy: 'Billing Department'
  }
];

export const UnifiedActionCenter: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [tasks, setTasks] = useState<ActionCenterTask[]>(INITIAL_TASKS);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleCompleteTask = (taskId: string) => {
    const taskToComplete = tasks.find(t => t.id === taskId);
    if (taskToComplete && (taskToComplete.type === 'Approval Request' || taskToComplete.type === 'Review Request')) {
      if (['admin', 'compliance', 'billing', 'recruiter'].includes(userRole)) {
        setActionNotice('Professional Boundary Enforced: Only credentialed Senior Reviewers (CPA/EA) possess authority to approve tax positions or filing packages. System administrators, compliance officers, and non-practitioners cannot approve.');
        setTimeout(() => setActionNotice(null), 5000);
        return;
      }
    }

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        TaxGuardAuditService.logEvent({
          tenantId: 'tenant_ar_tax_prod',
          userId: userRole,
          userEmail: `${userRole}@artaxservices.com`,
          userRole,
          action: 'ACTION_CENTER_TASK_COMPLETED',
          recordType: 'task',
          recordId: taskId,
          ipAddress: '127.0.0.1 (authenticated)',
          result: 'success',
          riskLevel: 'routine',
          details: `Completed action item: "${t.title}" for ${t.clientName}`
        });
        return {
          ...t,
          completed: true,
          completedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
          completedBy: userRole,
          riskScore: 'Completed'
        };
      }
      return t;
    }));
    setActionNotice('Task executed and logged into permanent activity record.');
    setTimeout(() => setActionNotice(null), 3500);
  };

  const filteredTasks = tasks.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterRisk !== 'all' && t.riskScore !== filterRisk) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="border border-neutral-300 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#C99A32] font-bold tracking-wider">
              A/R Tax Services, LLC • Unified Operating System
            </div>
            <h2 className="text-base font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#061A2F]" />
              <span>Unified Action Center &amp; Deadline Governance</span>
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Role-orchestrated queue for document requests, reviews, signatures, filing submissions, and notice deadlines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-rose-50 border border-rose-300 text-rose-800 text-[11px] font-mono font-bold">
              {tasks.filter(t => !t.completed && t.riskScore === 'Critical').length} Critical Deadlines
            </span>
          </div>
        </div>

        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <input
            type="text"
            placeholder="Search tasks or clients..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="p-1.5 border border-neutral-300 w-48 font-mono text-xs"
          />

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="p-1.5 border border-neutral-300 font-sans"
          >
            <option value="all">All Action Types</option>
            <option value="Approval Request">Approval Request</option>
            <option value="Notice Response">Notice Response</option>
            <option value="Signature Request">Signature Request</option>
            <option value="Document Request">Document Request</option>
            <option value="Estimated Payment">Estimated Payment</option>
          </select>

          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
            className="p-1.5 border border-neutral-300 font-sans"
          >
            <option value="all">All Urgencies</option>
            <option value="Critical">Critical (&lt;48h)</option>
            <option value="Approaching">Approaching</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Task Queue List */}
      <div className="border border-neutral-300 bg-white p-5 space-y-4">
        <h3 className="text-sm font-bold text-[#061A2F] uppercase border-b border-neutral-200 pb-3">
          Active Action Queue ({filteredTasks.length} Items)
        </h3>

        <div className="space-y-3">
          {filteredTasks.map(task => (
            <div
              key={task.id}
              className={`p-4 border text-xs space-y-2 transition-colors ${
                task.completed
                  ? 'bg-neutral-50 border-neutral-200 opacity-75'
                  : task.riskScore === 'Critical'
                  ? 'bg-rose-50/40 border-rose-300'
                  : 'bg-white border-neutral-200 hover:border-neutral-400'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#061A2F] text-white font-mono font-bold text-[10px] uppercase">
                    {task.type}
                  </span>
                  <span className="font-bold text-neutral-900">{task.title}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 font-bold uppercase font-mono border ${
                    task.completed
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : task.riskScore === 'Critical'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {task.riskScore}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">Due: {task.deadline}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <div className="text-neutral-700">{task.requiredAction}</div>
                  <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
                    Client: <strong>{task.clientName}</strong> • Role: {task.assignedRole}
                  </div>
                </div>

                <div>
                  {!task.completed ? (
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="px-3.5 py-1.5 bg-[#061A2F] hover:bg-neutral-800 text-white text-[11px] font-bold uppercase transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Complete Task</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-bold font-mono">
                      Completed at {task.completedAt}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
