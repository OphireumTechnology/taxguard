/**
 * A/R Tax Services, LLC - Lifecycle Roles Unified Dashboard View
 * Comprehensive, interactive dashboard view for expanded lifecycle roles:
 * reception, engagement-manager, verification, documents, data-entry,
 * accounts-payable, accounts-receivable, quality-control, filing,
 * acknowledgements, correspondence, resolution, audit, amendments,
 * records, client-success, support.
 *
 * Strictly adheres to 29 roles, 18 stages, 30 statuses, and black-and-white minimalist design.
 */

import React, { useState, useEffect } from 'react';
import { demoDataStore } from '../services/DemoDataService';
import {
  receptionService,
  engagementService,
  verificationService,
  documentIntakeService,
  dataEntryService,
  accountsPayableService,
  accountsReceivableService,
  qualityControlService,
  filingService,
  acknowledgementService,
  governmentCorrespondenceService,
  taxResolutionService,
  auditService,
  amendmentService,
  recordsService,
  renewalService,
  supportService,
  handoffService,
  governmentAgencyRegistryService
} from '../services/mockServices';
import {
  DemoRole,
  WorkCycleStage,
  ReceptionInquiry,
  AppointmentRecord,
  ScopeChangeOrder,
  WorkloadTimelineItem,
  IdentityVerificationRecord,
  IntakeDocumentRecord,
  DataEntryBatch,
  VendorBillRecord,
  PaymentBatchRecord,
  ClientArRecord,
  QualityInspectionRecord,
  FilingSubmissionBatch,
  AcknowledgementRecord,
  GovernmentNoticeRecord,
  TaxResolutionCase,
  AuditCaseRecord,
  AmendmentCaseRecord,
  ArchiveRecord,
  ClientRenewalRecord,
  SupportTicketRecord,
  GovernmentAgencyAuthority
} from '../types';
import {
  CheckCircle2,
  Send,
  UploadCloud,
  FileText,
  DollarSign,
  Layers,
  Archive,
  RefreshCw,
  Sparkles,
  Check,
  RotateCcw
} from 'lucide-react';
import { 
  VerificationPanel,
  ClassificationReview,
  ExtractionReview,
  DiscrepancyPanel,
  AIResearchAssistant
} from '../../taxguard';

interface LifecycleRoleDashboardViewProps {
  role: DemoRole;
  activeNavId: string;
  onOpenAiAssistant: () => void;
}

export const LifecycleRoleDashboardView: React.FC<LifecycleRoleDashboardViewProps> = ({
  role,
  activeNavId: _activeNavId,
  onOpenAiAssistant
}) => {
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'main' | 'handoffs' | 'agencies'>('main');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Re-render whenever DemoDataStore updates
  useEffect(() => {
    const unsub = demoDataStore.subscribe(() => {
      setTick(t => t + 1);
    });
    return unsub;
  }, []);

  const showNotice = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handoffs = handoffService.getHandoffsForRole(role);
  const allHandoffs = handoffService.getAllHandoffs();
  const agencies = governmentAgencyRegistryService.getAllAuthorities();

  // Map roles to their primary operating cycle stage
  const getStageForRole = (r: DemoRole): WorkCycleStage => {
    switch (r) {
      case 'reception': return 'Onboard';
      case 'engagement-manager': return 'Onboard';
      case 'verification': return 'Validate';
      case 'documents': return 'Collect';
      case 'data-entry': return 'Record';
      case 'accounts-payable': return 'Record';
      case 'accounts-receivable': return 'Record';
      case 'quality-control': return 'Approve';
      case 'filing': return 'File';
      case 'acknowledgements': return 'Government Feedback';
      case 'correspondence': return 'Resolve';
      case 'resolution': return 'Resolve';
      case 'audit': return 'Resolve';
      case 'amendments': return 'Resolve';
      case 'records': return 'Archive';
      case 'client-success': return 'Renew';
      case 'support': return 'Monitor';
      default: return 'Onboard';
    }
  };

  // 1. RECEPTION VIEW
  const renderReceptionView = () => {
    const inquiries = receptionService.getInquiries();
    const appointments = receptionService.getAppointments();
    const calls = receptionService.getCallLogs();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Active Inquiries</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{inquiries.length}</div>
            <div className="text-xs text-zinc-500 mt-1">{inquiries.filter(i => i.status === 'New').length} pending initial review</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Scheduled Consultations</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{appointments.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Calendar appointments recorded</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Switchboard Log</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{calls.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Telephone calls routed today</div>
          </div>
        </div>

        {/* Inquiries List */}
        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Inbound Client Inquiries</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Triage intake requests and convert into formal onboarding engagements</p>
            </div>
            <button
              onClick={() => {
                receptionService.addInquiry({
                  contactName: 'David Sterling, MD',
                  companyName: 'Carolina Spine Center LLC',
                  phone: '(843) 555-0144',
                  email: 'dsterling@carolinaspine.org',
                  source: 'Referral',
                  inquiryType: 'Tax Return',
                  urgentNoticeFlag: false,
                  communicationPreference: 'Phone',
                  notes: 'S-Corp election and commercial lease deductions',
                  status: 'New'
                });
                showNotice('Registered new incoming client inquiry.');
              }}
              className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium uppercase tracking-wider hover:bg-zinc-800 transition"
            >
              + Quick Inquiry
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {inquiries.map((inq: ReceptionInquiry) => (
              <div key={inq.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{inq.contactName}</span>
                    <span className="text-xs text-zinc-500">{inq.phone}</span>
                    <span className="px-2 py-0.5 border text-xs uppercase tracking-wider font-mono border-zinc-300 text-zinc-700 bg-zinc-50">
                      {inq.source}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{inq.inquiryType} — {inq.notes}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    inq.status === 'New' ? 'border-zinc-400 bg-zinc-100 text-zinc-900' :
                    inq.status === 'Scheduled' ? 'border-zinc-500 bg-zinc-200 text-zinc-950' :
                    'border-zinc-300 bg-zinc-50 text-zinc-700'
                  }`}>
                    {inq.status}
                  </span>
                  {inq.status === 'New' && (
                    <button
                      onClick={() => {
                        receptionService.updateInquiryStatus(inq.id, 'Scheduled', 'Front Desk');
                        showNotice(`Consultation scheduled for ${inq.contactName}.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-300 text-xs text-zinc-900 hover:bg-zinc-100 transition"
                    >
                      Schedule
                    </button>
                  )}
                  {inq.status === 'Scheduled' && (
                    <button
                      onClick={() => {
                        receptionService.updateInquiryStatus(inq.id, 'Routed to Intake', 'Front Desk');
                        showNotice(`Routed ${inq.contactName} to Intake specialist.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800 transition"
                    >
                      Route to Intake
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Appointments Section */}
        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Upcoming Consultations</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Automated SMS and email reminders queued</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {appointments.map((apt: AppointmentRecord) => (
              <div key={apt.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-zinc-900">{apt.clientName}</div>
                  <div className="text-xs text-zinc-500">{apt.dateTime} • Staff: {apt.staffName} ({apt.consultationType})</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 border border-zinc-300 text-xs font-mono">{apt.status}</span>
                  <button
                    onClick={() => {
                      receptionService.sendSimulatedReminder(apt.id);
                      showNotice(`Simulated reminder sent to ${apt.clientName}.`);
                    }}
                    className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                  >
                    Send Reminder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 2. ENGAGEMENT MANAGER VIEW
  const renderEngagementManagerView = () => {
    const changeOrders = engagementService.getChangeOrders();
    const timeline = engagementService.getWorkloadTimeline('eng_2025_perotti');

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Active Scope Change Orders</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {changeOrders.filter(c => c.status === 'Sent for Approval').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Awaiting client signature & approval</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Scope Revenue Delta</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              +${changeOrders.reduce((sum, c) => sum + c.priceDelta, 0).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Scope adjustments captured</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Timeline Stages Monitored</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{timeline.length} Stages</div>
            <div className="text-xs text-zinc-500 mt-1">Across full 18-stage operating cycle</div>
          </div>
        </div>

        {/* Change Orders */}
        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Scope Change Orders (SCO)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Formal addenda for out-of-scope schedules, cleanups, or audit defense</p>
            </div>
            <button
              onClick={() => {
                engagementService.createChangeOrder({
                  engagementId: 'eng_2025_perotti',
                  clientName: 'Perotti Capital Holdings LLC',
                  title: 'Multi-State Nexus Analysis (NC / GA)',
                  scopeDescription: 'Add South Carolina, North Carolina, and Georgia composite apportionment workpapers.',
                  priceDelta: 1250,
                  originalBudget: 4500,
                  revisedBudget: 5750,
                  status: 'Sent for Approval'
                });
                showNotice('Issued new Scope Change Order.');
              }}
              className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium uppercase tracking-wider hover:bg-zinc-800 transition"
            >
              + Issue SCO
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {changeOrders.map((sco: ScopeChangeOrder) => (
              <div key={sco.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{sco.title}</span>
                    <span className="text-xs font-mono font-bold text-zinc-900">+${sco.priceDelta.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{sco.scopeDescription}</div>
                  <div className="text-xs text-zinc-400 mt-1">Client: {sco.clientName} • Created: {sco.createdAt}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    sco.status === 'Sent for Approval' ? 'border-zinc-400 bg-zinc-100 text-zinc-900' :
                    sco.status === 'Client Accepted' ? 'border-black bg-black text-white' :
                    'border-zinc-300 bg-zinc-50 text-zinc-700'
                  }`}>
                    {sco.status}
                  </span>
                  {sco.status === 'Sent for Approval' && (
                    <button
                      onClick={() => {
                        engagementService.updateChangeOrderStatus(sco.id, 'Client Accepted', 'Brandon Cole');
                        showNotice(`Change Order ${sco.title} accepted.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Simulate Acceptance
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workload Timeline */}
        <div className="border border-zinc-200 bg-white p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900 mb-4">Operating Cycle Stage SLA Track</h3>
          <div className="space-y-3">
            {timeline.map((item: WorkloadTimelineItem, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 border border-zinc-100 bg-zinc-50">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-mono font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="text-xs font-medium text-zinc-900">{item.stage}</div>
                    <div className="text-xs text-zinc-500">Owner: {item.responsibleRole} • Gate: {item.handoffGate}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-zinc-500">Target: {item.targetDays} days</span>
                  <span className={`px-2 py-0.5 border ${
                    item.status === 'Completed' ? 'border-black bg-black text-white' :
                    item.status === 'In Progress' ? 'border-zinc-500 bg-zinc-200 text-zinc-950' :
                    'border-zinc-200 text-zinc-400'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 3. VERIFICATION VIEW (KYC / Identity)
  const renderVerificationView = () => {
    const verifications = verificationService.getVerificationRecords();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Verification Queue</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{verifications.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Identity verification dossiers</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Verified Identity Records</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {verifications.filter(v => v.idStatus === 'Verified (Simulated)').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Cleared for return preparation</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Discrepancy Flags</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {verifications.filter(v => v.escalationFlag).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Requires supervisor review</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Identity & Authority Verification Queue</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Verify government-issued photo ID, SSN/EIN validation, and signing authority</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {verifications.map((ver: IdentityVerificationRecord) => (
              <div key={ver.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{ver.clientName}</span>
                    <span className="text-xs font-mono text-zinc-500">{ver.idDocumentType} ({ver.maskedSsn})</span>
                    <span className="text-xs text-zinc-500">• Entity: {ver.entityType}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-600 mt-1">
                    <span>Address Match: <strong className="text-zinc-900">{ver.addressMatchStatus}</strong></span>
                    <span>EIN Verification: <strong className="text-zinc-900">{ver.einVerificationStatus}</strong></span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 italic">{ver.notes}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    ver.idStatus === 'Verified (Simulated)' ? 'border-black bg-black text-white' :
                    ver.idStatus === 'Flagged Discrepancy' ? 'border-black bg-zinc-200 text-black font-semibold' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {ver.idStatus}
                  </span>
                  {ver.idStatus !== 'Verified (Simulated)' && (
                    <button
                      onClick={() => {
                        verificationService.updateVerificationStatus(ver.id, 'Verified (Simulated)', 'Verification Specialist');
                        showNotice(`Verified identity for ${ver.clientName}.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Clear ID
                    </button>
                  )}
                  {!ver.escalationFlag && (
                    <button
                      onClick={() => {
                        verificationService.flagSuspiciousRecord(ver.id, 'Address discrepancy on driver license vs tax return', 'Verification Specialist');
                        showNotice(`Flagged ${ver.clientName} for supervisor review.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-400 text-zinc-900 text-xs hover:bg-zinc-100"
                    >
                      Flag Discrepancy
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TaxGuard AI Knowledge-Based Verification & Fraud Detection */}
        <div className="border border-zinc-200 bg-white p-5">
          <VerificationPanel userRole="verification" />
        </div>
      </div>
    );
  };

  // 4. DOCUMENTS VIEW (Intake & Routing)
  const renderDocumentsView = () => {
    const intakeDocs = documentIntakeService.getIntakeQueue();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Intake Queue</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{intakeDocs.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Multi-source document ingest pipeline</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Multi-Page Bundles</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {intakeDocs.filter(d => d.packageCondition.includes('Multi-Page')).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Require splitting into indexed workpapers</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Routed to Preparers</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {intakeDocs.filter(d => d.status === 'Routed').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Indexed in workpaper folders</div>
          </div>
        </div>

        {/* TaxGuard AI Intelligent Classification & OCR Extraction Triage */}
        <div className="border border-zinc-200 bg-white p-5 space-y-6">
          <div className="border-b border-zinc-200 pb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">TaxGuard AI Automated Classification &amp; OCR Extraction</h3>
            <p className="text-xs text-zinc-500 mt-0.5">High-confidence OCR, document boundary detection, and automatic tax schedule mapping.</p>
          </div>
          <div className="space-y-6">
            <ClassificationReview userRole="documents" />
            <ExtractionReview userRole="documents" />
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Document Intake & Classification Triage</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Classify raw scans, split multi-page bundles, and attach to tax workpaper binders</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {intakeDocs.map((doc: IntakeDocumentRecord) => (
              <div key={doc.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{doc.fileName}</span>
                    <span className="text-xs font-mono text-zinc-500">({doc.fileSize}, {doc.packageCondition})</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Client: {doc.clientName} • Category: {doc.classification} • Target: <strong className="text-zinc-900">{doc.assignedRole}</strong>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Chain of Custody: {doc.chainOfCustody[doc.chainOfCustody.length - 1]?.action} ({doc.chainOfCustody[doc.chainOfCustody.length - 1]?.actor})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    doc.status === 'Routed' ? 'border-black bg-black text-white' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {doc.status}
                  </span>
                  {doc.packageCondition.includes('Multi-Page') && (
                    <button
                      onClick={() => {
                        documentIntakeService.splitPackage(doc.id, 4, 'Document Specialist');
                        showNotice(`Split multi-page dossier into 4 indexed workpaper files.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                    >
                      Split Dossier
                    </button>
                  )}
                  {doc.status !== 'Routed' && (
                    <button
                      onClick={() => {
                        documentIntakeService.classifyDocument(doc.id, 'Tax Form (W-2/1099/K-1)', 'accountant', 'Document Specialist');
                        showNotice(`Classified ${doc.fileName} and routed to Tax Preparer.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Route to Tax Prep
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 5. DATA ENTRY VIEW
  const renderDataEntryView = () => {
    const batches = dataEntryService.getBatches();
    const cashEntries = demoDataStore.getCashEntries();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Batch Queue</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{batches.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Manual data digitization batches</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Transcribed Total</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              ${cashEntries.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Across {cashEntries.length} transaction slips</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Ready for Bookkeeping</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {batches.filter(b => b.status === 'Submitted to Bookkeeping').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Passed maker-checker entry verification</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Data Entry Batches</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Digitize physical receipt stubs, cash ledgers, and credit card chits</p>
            </div>
            <button
              onClick={() => {
                dataEntryService.addTransactionEntry({
                  batchId: 'bat_2026_01',
                  date: '2025-12-14',
                  vendorOrPayee: 'Lowe’s Home Improvement',
                  description: 'Office drywall repair and hardware supplies',
                  suggestedAccount: 'Repairs & Maintenance',
                  amount: 284.50,
                  status: 'Entered'
                });
                showNotice('Added digitized cash expense entry to Batch #1.');
              }}
              className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium uppercase tracking-wider hover:bg-zinc-800 transition"
            >
              + Quick Entry
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {batches.map((batch: DataEntryBatch) => (
              <div key={batch.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm text-zinc-900">{batch.batchName} ({batch.clientName})</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Entries: {batch.totalEntries} • Digitized Volume: <strong className="text-zinc-900">${batch.totalAmount.toLocaleString()}</strong> • Source: {batch.sourceType}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    batch.status === 'Submitted to Bookkeeping' ? 'border-black bg-black text-white' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {batch.status}
                  </span>
                  {batch.status !== 'Submitted to Bookkeeping' && (
                    <button
                      onClick={() => {
                        dataEntryService.submitBatchToBookkeeping(batch.id, 'Data Entry Specialist');
                        showNotice(`Batch ${batch.batchName} submitted to Bookkeeping feed.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Submit to Bookkeeper
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 6. ACCOUNTS PAYABLE VIEW
  const renderAccountsPayableView = () => {
    const bills = accountsPayableService.getVendorBills();
    const batches = accountsPayableService.getPaymentBatches();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Vendor Invoices</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{bills.length}</div>
            <div className="text-xs text-zinc-500 mt-1">${bills.reduce((sum, b) => sum + b.amount, 0).toLocaleString()} outstanding liability</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">1099 / W-9 Compliance</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {bills.filter(b => b.w9OnFileType).length} / {bills.length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Vendor W-9 forms validated on file</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">ACH Batches Prepared</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{batches.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Simulated disbursement batches</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Vendor Bills Payable</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Maker-checker approval flow for vendor payables and contractor disbursements</p>
            </div>
            <button
              onClick={() => {
                const unbatched = bills.filter(b => !b.paymentBatchId && b.approvalStatus === 'Approved for Payment').map(b => b.id);
                if (unbatched.length > 0) {
                  accountsPayableService.createPaymentBatch(unbatched, 'AP Specialist');
                  showNotice('Created simulated ACH disbursement batch.');
                } else {
                  showNotice('All approved bills are already batched or pending approval.');
                }
              }}
              className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium uppercase tracking-wider hover:bg-zinc-800 transition"
            >
              + Prepare Payment Batch
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {bills.map((bill: VendorBillRecord) => (
              <div key={bill.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{bill.vendorName}</span>
                    <span className="text-xs text-zinc-500">Invoice #{bill.invoiceNumber}</span>
                    <span className="font-mono font-semibold text-xs text-zinc-900">${bill.amount.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Due: {bill.dueDate} • GL Account: {bill.suggestedGlAccount} • W-9: {bill.w9OnFileType ? 'On File' : 'MISSING (1099 HOLD)'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    bill.approvalStatus.includes('Paid') ? 'border-black bg-black text-white' :
                    bill.approvalStatus.includes('Approved') ? 'border-zinc-500 bg-zinc-200 text-zinc-950' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {bill.approvalStatus}
                  </span>
                  {bill.approvalStatus === 'Pending Review' && (
                    <button
                      onClick={() => {
                        accountsPayableService.approveBillForPayment(bill.id, 'AP Manager');
                        showNotice(`Approved bill from ${bill.vendorName} for payment.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Approve Bill
                    </button>
                  )}
                  {!bill.w9OnFileType && (
                    <button
                      onClick={() => {
                        accountsPayableService.flagMissingW9(bill.id, 'AP Specialist');
                        showNotice(`Applied 1099 compliance hold on ${bill.vendorName}.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-400 text-zinc-900 text-xs hover:bg-zinc-100"
                    >
                      Hold for W-9
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Batches */}
        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Simulated Disbursement Batches</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Demonstration NACHA / ACH release simulation</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {batches.map((bat: PaymentBatchRecord) => (
              <div key={bat.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-zinc-900">Batch #{bat.id} ({bat.billCount} bills)</div>
                  <div className="text-xs text-zinc-500">Date: {bat.batchDate} • Total: ${bat.totalAmount.toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 border border-zinc-300 text-xs font-mono">{bat.status}</span>
                  {bat.status !== 'Released (Simulated)' && (
                    <button
                      onClick={() => {
                        accountsPayableService.executeSimulatedPayment(bat.id, 'AP Manager');
                        showNotice(`Released simulated ACH batch of $${bat.totalAmount.toLocaleString()}.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Release Simulated ACH
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 7. ACCOUNTS RECEIVABLE VIEW
  const renderAccountsReceivableView = () => {
    const arRecords = accountsReceivableService.getArRecords();
    const paymentPlans = accountsReceivableService.getPaymentPlans();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Total A/R Outstanding</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              ${arRecords.reduce((sum, a) => sum + a.balanceDue, 0).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Across {arRecords.length} client invoices</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Aging Status</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {arRecords.filter(a => a.agingBucket !== 'Current').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Invoices past standard 30-day terms</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Active Payment Plans</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{paymentPlans.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Installment payment agreements</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Client Receivable Aging Ledger</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Collections follow-up, payment plans, and write-off requests</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {arRecords.map((ar: ClientArRecord) => (
              <div key={ar.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{ar.clientName}</span>
                    <span className="text-xs text-zinc-500">Invoice #{ar.invoiceNumber}</span>
                    <span className="font-mono font-semibold text-xs text-zinc-900">Due: ${ar.balanceDue.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Aging Bracket: <strong className="text-zinc-900">{ar.agingBucket}</strong> • Payment Plan: {ar.paymentPlanActive ? 'Enrolled' : 'None'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    ar.balanceDue === 0 ? 'border-black bg-black text-white' :
                    ar.agingBucket === '61-90 Days' || ar.agingBucket === '90+ Days' ? 'border-black bg-zinc-200 text-black font-semibold' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {ar.status}
                  </span>
                  {ar.balanceDue > 0 && (
                    <>
                      <button
                        onClick={() => {
                          accountsReceivableService.sendSimulatedReminder(ar.id, 'AR Specialist');
                          showNotice(`Sent simulated payment reminder to ${ar.clientName}.`);
                        }}
                        className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                      >
                        Remind
                      </button>
                      <button
                        onClick={() => {
                          accountsReceivableService.recordSimulatedPayment(ar.id, ar.balanceDue, 'AR Specialist');
                          showNotice(`Recorded simulated receipt of $${ar.balanceDue.toLocaleString()} from ${ar.clientName}.`);
                        }}
                        className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                      >
                        Record Payment
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 8. QUALITY CONTROL VIEW (Pre-Filing Inspection Gate)
  const renderQualityControlView = () => {
    const inspections = qualityControlService.getInspections();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Quality Gate Queue</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{inspections.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Pre-transmission electronic return audit</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Cleared for E-Filing</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {inspections.filter(i => i.qcReleaseStatus === 'Quality Control Cleared').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Passed 7-point quality checklist</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Release Blocked</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {inspections.filter(i => i.qcReleaseStatus.includes('Blocked')).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Critical findings pending remediation</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Pre-Filing Quality Inspection Gate</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Maker-checker separation verification, 8879 consent checks, and calculation trace audits</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {inspections.map((insp: QualityInspectionRecord) => (
              <div key={insp.id} className="p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base text-zinc-900">{insp.clientName}</span>
                      <span className="text-xs font-mono text-zinc-500">TY{insp.taxYear} • {insp.formType}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Inspector: {insp.inspectedBy} • Traceability Score: <strong className="text-zinc-900">{insp.traceabilityScore}%</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-xs uppercase tracking-wider font-mono border ${
                      insp.qcReleaseStatus === 'Quality Control Cleared' ? 'border-black bg-black text-white' :
                      'border-black bg-zinc-200 text-black font-semibold'
                    }`}>
                      {insp.qcReleaseStatus}
                    </span>
                    {insp.qcReleaseStatus !== 'Quality Control Cleared' ? (
                      <button
                        onClick={() => {
                          const res = qualityControlService.clearQualityControl(insp.id, 'Senior QC Inspector');
                          if (res.success) {
                            showNotice(`QC Release Gate CLEARED for ${insp.clientName}. Return unlocked for e-file.`);
                          } else {
                            showNotice(`Cannot clear release: ${res.error}`);
                          }
                        }}
                        className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800"
                      >
                        Verify & Clear QC Gate
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          qualityControlService.blockRelease(insp.id, 'Manual QC Hold: Re-evaluating Section 179 workpapers', 'QC Lead');
                          showNotice(`Release gate blocked for ${insp.clientName}.`);
                        }}
                        className="px-2.5 py-1 border border-zinc-400 text-zinc-900 text-xs hover:bg-zinc-100"
                      >
                        Re-apply Hold
                      </button>
                    )}
                  </div>
                </div>

                {/* 7-Point Quality Inspection Checklist */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-zinc-100 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    <span>Maker/Checker Separation</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    <span>Form 8879-S Signature</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    <span>Schedule M-1 Trace</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    <span>IRC § 7216 Consent</span>
                  </div>
                </div>

                {/* Findings List */}
                <div className="bg-zinc-50 border border-zinc-200 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-700">Audit Findings & Observations</div>
                  {insp.findings.map((finding, fIdx) => (
                    <div key={fIdx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[10px] font-mono uppercase ${
                          finding.severity === 'Critical' ? 'bg-zinc-200 text-black font-bold' :
                          finding.severity === 'Warning' ? 'bg-zinc-100 text-zinc-900' :
                          'bg-zinc-200 text-zinc-700'
                        }`}>
                          {finding.severity}
                        </span>
                        <span className={finding.remediated ? 'line-through text-zinc-400' : 'text-zinc-800'}>
                          {finding.description}
                        </span>
                      </div>
                      {!finding.remediated ? (
                        <button
                          onClick={() => {
                            qualityControlService.resolveFinding(insp.id, fIdx, 'QC Inspector');
                            showNotice(`Remediated finding #${fIdx + 1}.`);
                          }}
                          className="px-2 py-0.5 border border-zinc-300 text-[11px] hover:bg-zinc-100"
                        >
                          Mark Remediated
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-black font-semibold">Remediated</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TaxGuard AI Automated Discrepancy & Variance QC Engine */}
        <div className="border border-zinc-200 bg-white p-5">
          <DiscrepancyPanel userRole="quality-control" />
        </div>
      </div>
    );
  };

  // 9. FILING VIEW (MeF Batch Transmission)
  const renderFilingView = () => {
    const batches = filingService.getSubmissionBatches();
    const gates = filingService.checkFilingGates('eng_2025_perotti');

    return (
      <div className="space-y-6">
        {/* Filing Gates Summary Banner */}
        <div className="border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Electronic Filing Release Gates</h3>
              <p className="text-xs text-zinc-500 mt-0.5">All statutory gates must be unlocked before IRS Modernized e-File (MeF) transmission</p>
            </div>
            <div className="px-3 py-1 border border-zinc-300 font-mono text-xs text-zinc-700">
              IRS EFIN: 489201 • State SC DOR E-File Ready
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2 border border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <span>Preparer Sign-off</span>
              <span className="text-black font-semibold font-mono font-semibold">VERIFIED</span>
            </div>
            <div className="p-2 border border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <span>Reviewer CPA Approval</span>
              <span className="text-black font-semibold font-mono font-semibold">VERIFIED</span>
            </div>
            <div className="p-2 border border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <span>Quality Control Clearance</span>
              <span className={`font-mono font-semibold ${gates.qcCleared ? 'text-black font-semibold' : 'text-zinc-700'}`}>
                {gates.qcCleared ? 'CLEARED' : 'PENDING'}
              </span>
            </div>
            <div className="p-2 border border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <span>Form 8879-S Signature</span>
              <span className="text-black font-semibold font-mono font-semibold">EXECUTED</span>
            </div>
          </div>
        </div>

        {/* Transmission Batches */}
        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">MeF Transmission Submission Batches</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Batched transmission to IRS MeF gateway and state Department of Revenue</p>
            </div>
            <button
              onClick={() => {
                filingService.createSubmissionBatch('BATCH-2026-03-SC', 'Form 1120-S / SC1120S', ['Federal IRS', 'South Carolina DOR'], 1);
                showNotice('Created new electronic submission batch.');
              }}
              className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium uppercase tracking-wider hover:bg-zinc-800 transition"
            >
              + Create Batch
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {batches.map((batch: FilingSubmissionBatch) => (
              <div key={batch.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{batch.batchNumber}</span>
                    <span className="text-xs font-mono text-zinc-500">{batch.formType} ({batch.submissionCount} returns)</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Jurisdictions: {batch.jurisdictions.join(', ')} • Schema Status: <strong className="text-zinc-900">{batch.schemaValidationStatus}</strong>
                  </div>
                  {batch.transmissionTimestamp && (
                    <div className="text-xs text-zinc-400 mt-0.5 font-mono">Transmitted at: {batch.transmissionTimestamp}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    batch.status.includes('Transmitted') ? 'border-black bg-black text-white' :
                    'border-zinc-500 bg-zinc-200 text-zinc-950'
                  }`}>
                    {batch.status}
                  </span>
                  <button
                    onClick={() => {
                      const diag = filingService.runSimulatedDiagnostics(batch.id);
                      showNotice(diag.message);
                    }}
                    className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                  >
                    Run Diagnostics
                  </button>
                  {batch.status !== 'Transmitted—Simulated' && (
                    <button
                      onClick={() => {
                        const result = filingService.transmitBatchSimulated(batch.id, 'Filing Specialist');
                        showNotice(`Simulated transmission complete. Submission ID: ${result.submissionId}`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800 font-medium"
                    >
                      Transmit (Simulated)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 10. ACKNOWLEDGEMENTS VIEW
  const renderAcknowledgementsView = () => {
    const acks = acknowledgementService.getAcknowledgements();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Acknowledgements Processed</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{acks.length}</div>
            <div className="text-xs text-zinc-500 mt-1">IRS & State MeF electronic ACK receipts</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Accepted by Authorities</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {acks.filter(a => a.status.includes('Accepted')).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Official submission acceptance timestamps</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Rejections & Schema Warnings</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {acks.filter(a => a.status.includes('Rejected') || a.status.includes('Warning')).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Requires correction case workflow</div>
          </div>
        </div>

        {/* Simulation Control Toolbar */}
        <div className="border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-2">Simulate Government ACK Scenarios</div>
          <div className="flex flex-wrap gap-2">
            {[
              'Federal Accepted',
              'Federal Rejected',
              'State Accepted',
              'State Rejected',
              'Duplicate Filing',
              'Schema Failure',
              'Overdue'
            ].map((scen) => (
              <button
                key={scen}
                onClick={() => {
                  const ack = acknowledgementService.simulateAcknowledgementResponse('10402026883910001', scen as any, 'ACK Specialist');
                  showNotice(`Simulated ACK: ${ack.status} (Code ${ack.returnCode})`);
                }}
                className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100 transition"
              >
                + {scen}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Government Electronic Acknowledgement Log</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Automated MeF acceptance confirmations and error resolution triggers</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {acks.map((ack: AcknowledgementRecord) => (
              <div key={ack.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{ack.clientName}</span>
                    <span className="text-xs font-mono text-zinc-500">{ack.jurisdiction} • {ack.formType}</span>
                    <span className="font-mono text-xs text-zinc-700 font-semibold">Code: {ack.returnCode}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{ack.messageText}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 font-mono">Submission ID: {ack.submissionId} • Timestamp: {ack.timestamp}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    ack.status.includes('Accepted') ? 'border-black bg-black text-white' :
                    ack.status.includes('Rejected') ? 'border-black bg-zinc-200 text-black font-semibold' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {ack.status}
                  </span>
                  {ack.status.includes('Rejected') && (
                    <button
                      onClick={() => {
                        acknowledgementService.createCorrectionCase(ack.id, 'ACK Specialist');
                        showNotice(`Opened rejection correction case for ${ack.clientName}.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Open Correction Case
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 11. CORRESPONDENCE VIEW (Notices)
  const renderCorrespondenceView = () => {
    const notices = governmentCorrespondenceService.getNotices();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Government Notices</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{notices.length}</div>
            <div className="text-xs text-zinc-500 mt-1">IRS CP2000, CP504, SC DOR deficiency notices</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Active Defense Responses</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {notices.filter(n => n.status === 'Drafting Response' || n.status === 'Practitioner Review').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Statutory response deadlines tracked</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Resolved Notices</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {notices.filter(n => n.status === 'Resolved' || n.status === 'Response Submitted—Simulated').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Penalty abatements & corrections submitted</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Government Correspondence & Notice Defense</h3>
              <p className="text-xs text-zinc-500 mt-0.5">30-day statutory response clock, AI defense drafting, and evidence assembly</p>
            </div>
            <button
              onClick={() => {
                governmentCorrespondenceService.createNoticeCase({
                  clientId: 'cl_perotti_01',
                  clientName: 'Perotti Capital Holdings LLC',
                  authority: 'Internal Revenue Service',
                  noticeNumber: 'IRS Notice CP504',
                  taxYear: 2024,
                  noticeDate: '2026-03-01',
                  responseDeadline: '2026-04-12',
                  proposedTaxAmount: 3600,
                  proposedPenaltyAmount: 1250,
                  category: 'Levy or lien warning',
                  assignedPractitioner: 'Notice Specialist'
                }, 'Notice Specialist');
                showNotice('Registered new IRS Notice CP504 defense case.');
              }}
              className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium uppercase tracking-wider hover:bg-zinc-800 transition"
            >
              + Log New Notice
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {notices.map((notice: GovernmentNoticeRecord) => (
              <div key={notice.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{notice.noticeNumber}</span>
                    <span className="text-xs text-zinc-500">Client: {notice.clientName}</span>
                    <span className="text-xs font-mono font-semibold text-black font-semibold">
                      Proposed: ${(notice.proposedTaxAmount + notice.proposedPenaltyAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">Category: {notice.category} • Practitioner: {notice.assignedPractitioner}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Agency: {notice.authority} • Response Deadline: {notice.responseDeadline}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    notice.status.includes('Submitted') ? 'border-black bg-black text-white' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {notice.status}
                  </span>
                  <button
                    onClick={() => {
                      const draft = governmentCorrespondenceService.draftAiResponse(notice.id);
                      showNotice(`Drafted AI defense response with citations: ${draft.citations.join(', ')}`);
                    }}
                    className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-zinc-600" />
                    <span>Draft Defense</span>
                  </button>
                  {notice.status !== 'Response Submitted—Simulated' && (
                    <button
                      onClick={() => {
                        governmentCorrespondenceService.submitResponseSimulated(notice.id, 'Notice Defense Specialist');
                        showNotice(`Simulated response submission filed for ${notice.noticeNumber}.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Submit Response
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 12. RESOLUTION VIEW
  const renderResolutionView = () => {
    const cases = taxResolutionService.getResolutionCases();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Active Resolution Cases</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{cases.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Offers in Compromise, Installment, Penalty Abatement</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Assessed Total Liability</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              ${cases.reduce((sum, c) => sum + c.totalTaxLiability, 0).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Total disputed tax liabilities</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Form 2848 Power of Attorney</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {cases.filter(c => c.form2848OnRecord).length} / {cases.length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Verified with IRS Centralized Auth File (CAF)</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Tax Resolution Case Dossiers</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Form 433-A/B financial statements, IRS Appeals, and collection due process defense</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {cases.map((cs: TaxResolutionCase) => (
              <div key={cs.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{cs.clientName}</span>
                    <span className="text-xs font-mono font-semibold text-zinc-700">{cs.resolutionStrategy}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Liability: ${cs.totalTaxLiability.toLocaleString()} • Stage: {cs.collectionStage} • Years: {cs.openYears.join(', ')}
                  </div>
                  {cs.hearingDate && (
                    <div className="text-xs text-zinc-400 mt-0.5 font-mono">Appeals Conference Date: {cs.hearingDate}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    cs.caseStatus.includes('Accepted') || cs.caseStatus.includes('Closed') ? 'border-black bg-black text-white' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {cs.caseStatus}
                  </span>
                  <button
                    onClick={() => {
                      taxResolutionService.recordHearing(cs.id, '2026-05-18 10:00 AM EST', 'Formal IRS Appeals conference scheduled', 'Resolution EA');
                      showNotice(`Scheduled IRS Appeals conference for ${cs.clientName}.`);
                    }}
                    className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                  >
                    Schedule Hearing
                  </button>
                  <button
                    onClick={() => {
                      taxResolutionService.updateCaseStatus(cs.id, 'Accepted by Appeals', 'Resolution EA');
                      showNotice(`Simulated settlement acceptance recorded for ${cs.clientName}.`);
                    }}
                    className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                  >
                    Accept Settlement
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TaxGuard AI Source-Grounded Legal & Appeals Defense Research */}
        <div className="border border-zinc-200 bg-white p-5">
          <AIResearchAssistant userRole="resolution" />
        </div>
      </div>
    );
  };

  // 13. AUDIT VIEW
  const renderAuditView = () => {
    const auditCases = auditService.getAuditCases();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Examinations Active</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{auditCases.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Field and correspondence audit defenses</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Proposed Adjustments Target</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              ${auditCases.reduce((sum, a) => sum + a.proposedAdjustments, 0).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Potential proposed deficiency adjustments</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">IDR Document Requests</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {auditCases.reduce((sum, a) => sum + a.idrCount, 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Total items requested by revenue agents</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Tax Examination Defense Cases</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Information Document Request (IDR) tracking, Revenue Agent interviews, and workpaper defense</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {auditCases.map((aud: AuditCaseRecord) => (
              <div key={aud.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{aud.clientName}</span>
                    <span className="text-xs font-mono text-zinc-500">{aud.agency} • TY{aud.taxYear}</span>
                    <span className="text-xs text-zinc-500">Examiner: {aud.examinerName}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    IDR Count: {aud.idrCount} • Proposed Adjustment: <strong className="text-zinc-900">${aud.proposedAdjustments.toLocaleString()}</strong>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">Exam Type: {aud.examType} • Lead: {aud.assignedDefenseLead}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    aud.status === 'Settlement Finalized' ? 'border-black bg-black text-white' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {aud.status}
                  </span>
                  <button
                    onClick={() => {
                      auditService.recordIdrResponse(aud.id, 1, 'Contemporaneous travel mileage logs and corporate minutes assembled', 'Audit Defense Lead');
                      showNotice(`Assembled IDR Item response for ${aud.clientName}.`);
                    }}
                    className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                  >
                    Assemble IDR
                  </button>
                  {aud.status !== 'Settlement Finalized' && (
                    <button
                      onClick={() => {
                        auditService.updateAuditStatus(aud.id, 'Settlement Finalized', 'Audit Defense Lead');
                        showNotice(`Recorded settlement conclusion for ${aud.clientName}. Defense finalized.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Finalize Settlement
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TaxGuard AI IDR Defense & Statutory Code Citation Assistant */}
        <div className="border border-zinc-200 bg-white p-5">
          <AIResearchAssistant userRole="audit" />
        </div>
      </div>
    );
  };

  // 14. AMENDMENTS VIEW
  const renderAmendmentsView = () => {
    const amendments = amendmentService.getAmendmentCases();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Amended Returns</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{amendments.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Form 1040-X, 1120-X, 1065-X filings</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Net Refund Claimed</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              ${amendments.reduce((sum, a) => sum + (a.netRefundOrBalanceDue > 0 ? a.netRefundOrBalanceDue : 0), 0).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Amended statutory refund claims</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Filed (Simulated)</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {amendments.filter(a => a.filingStatus.includes('Filed') || a.filingStatus.includes('Accepted')).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Transmitted to IRS MeF</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Amended Return Cases</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Correct prior-year omission of deductions, carrybacks, and Form 1099-B step-up adjustments</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {amendments.map((amd: AmendmentCaseRecord) => (
              <div key={amd.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{amd.clientName}</span>
                    <span className="text-xs font-mono text-zinc-500">{amd.amendedForm} • TY{amd.taxYear}</span>
                    <span className="text-xs font-mono font-semibold text-black font-semibold">Net Refund: ${amd.netRefundOrBalanceDue.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{amd.reasonForAmendment}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Preparer: {amd.preparerAssigned} • Reviewer Approved: {amd.reviewerApproved ? 'Yes' : 'Pending'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    amd.filingStatus.includes('Filed') || amd.filingStatus.includes('Accepted') ? 'border-black bg-black text-white' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {amd.filingStatus}
                  </span>
                  {amd.filingStatus !== 'Filed (Simulated)' && amd.filingStatus !== 'Accepted—Simulated' && (
                    <button
                      onClick={() => {
                        amendmentService.simulateFilingAmendment(amd.id, 'Amendment Specialist');
                        showNotice(`Filed amended return ${amd.amendedForm} for ${amd.clientName}.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      File Amendment
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 15. RECORDS VIEW (Retention & Legal Holds)
  const renderRecordsView = () => {
    const archives = recordsService.getArchiveRecords();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Archived Dossiers</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{archives.length}</div>
            <div className="text-xs text-zinc-500 mt-1">7-Year statutory retention compliance</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Active Legal Holds</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {archives.filter(a => a.legalHoldActive).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Destruction suspended indefinitely</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Rolled Forward to Next Cycle</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {archives.filter(a => a.rolledForward).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Depreciation schedules and carryovers prepared</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Statutory Tax Records Retention Archive</h3>
            <p className="text-xs text-zinc-500 mt-0.5">IRC § 6001 retention schedules, legal preservation holds, and certified destruction records</p>
          </div>
          <div className="divide-y divide-zinc-200">
            {archives.map((arc: ArchiveRecord) => (
              <div key={arc.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{arc.clientName}</span>
                    <span className="text-xs font-mono text-zinc-500">TY{arc.taxYear} • {arc.packageType}</span>
                    <span className="text-xs text-zinc-500">({arc.documentCount} documents)</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Archived: {arc.archiveDate} • Retention Expiry: <strong className="text-zinc-900">{arc.retentionExpiryDate}</strong> • Rolled Forward: {arc.rolledForward ? 'Yes' : 'No'}
                  </div>
                  {arc.legalHoldActive && (
                    <div className="text-xs font-mono text-black font-semibold font-bold mt-0.5">LEGAL HOLD ACTIVE: Automated purge disabled</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    arc.legalHoldActive ? 'border-black bg-zinc-200 text-black font-semibold' :
                    'border-zinc-300 bg-zinc-50 text-zinc-700'
                  }`}>
                    {arc.destructionStatus}
                  </span>
                  <button
                    onClick={() => {
                      recordsService.applyLegalHold(arc.id, !arc.legalHoldActive, 'Records Custodian');
                      showNotice(`Legal hold ${!arc.legalHoldActive ? 'APPLIED to' : 'REMOVED from'} ${arc.clientName}.`);
                    }}
                    className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                  >
                    {arc.legalHoldActive ? 'Lift Legal Hold' : 'Apply Legal Hold'}
                  </button>
                  <button
                    onClick={() => {
                      const cert = recordsService.generateSimulatedDestructionCertificate(arc.id, 'Records Custodian');
                      showNotice(`Simulated destruction certificate issued: ${cert}`);
                    }}
                    className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                  >
                    Generate Cert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 16. CLIENT SUCCESS VIEW (Renewals)
  const renderClientSuccessView = () => {
    const renewals = renewalService.getRenewalRecords();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Renewal Pipeline</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{renewals.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Tax year renewal engagements</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Client Satisfaction Score</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {(renewals.reduce((sum, r) => sum + r.feedbackScore, 0) / (renewals.length || 1)).toFixed(1)} / 10
            </div>
            <div className="text-xs text-zinc-500 mt-1">Average annual client feedback rating</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Signed Contracts</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {renewals.filter(r => r.renewalStatus === 'Contract Signed').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Rolled forward to next 18-stage operating cycle</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Client Retention & Annual Renewals</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Post-filing debrief, feedback capture, NPS monitoring, and engagement roll-forward</p>
            </div>
            <button
              onClick={() => {
                renewalService.createRenewalProposal({
                  clientId: 'cl_perotti_01',
                  clientName: 'Perotti Capital Holdings LLC',
                  priorTaxYear: 2025,
                  renewalTaxYear: 2026,
                  servicesPriorYear: ['Corporate 1120-S', 'Quarterly Payroll'],
                  proposedServices: ['Corporate 1120-S', 'Quarterly Payroll', 'Tax Advisory'],
                  feedbackScore: 9,
                  clientSatisfaction: 'Delighted',
                  renewalStatus: 'Renewal Proposal Sent',
                  notes: 'Includes expanded quarterly payroll and tax advisory retainer'
                }, 'Client Success Lead');
                showNotice('Issued 2026 Annual Engagement Renewal proposal.');
              }}
              className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium uppercase tracking-wider hover:bg-zinc-800 transition"
            >
              + Propose Renewal
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {renewals.map((ren: ClientRenewalRecord) => (
              <div key={ren.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{ren.clientName}</span>
                    <span className="text-xs font-mono text-zinc-500">TY{ren.renewalTaxYear} Renewal</span>
                    <span className="text-xs font-mono font-semibold text-zinc-900">Satisfaction: {ren.clientSatisfaction}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{ren.notes}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Feedback Score: {ren.feedbackScore}/10 • Proposed: {ren.proposedServices.join(', ')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    ren.renewalStatus === 'Contract Signed' ? 'border-black bg-black text-white' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {ren.renewalStatus}
                  </span>
                  {ren.renewalStatus !== 'Contract Signed' ? (
                    <button
                      onClick={() => {
                        renewalService.updateRenewalStatus(ren.id, 'Contract Signed', 'Client Success Manager');
                        showNotice(`Renewal contract signed by ${ren.clientName}.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Sign Contract
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        renewalService.rollForwardToNewCycle(ren.clientId, ren.renewalTaxYear, 'Client Success Manager');
                        showNotice(`Rolled forward ${ren.clientName} to Stage 1 (Onboard) for TY${ren.renewalTaxYear}!`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Roll Forward Cycle</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 17. SUPPORT VIEW
  const renderSupportView = () => {
    const tickets = supportService.getTickets();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Support Tickets</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">{tickets.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Platform, portal, and security tickets</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Open / Investigating</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">
              {tickets.filter(t => t.status !== 'Resolved (Simulated)').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">SLA target response under 2 hours</div>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Demonstration Sessions</div>
            <div className="text-2xl font-semibold text-zinc-900 mt-1">29 Roles Active</div>
            <div className="text-xs text-zinc-500 mt-1">Full state isolation across all roles</div>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Technical Support & User Access Desk</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Password resets, session recovery, 2FA clearance, and portal diagnostics</p>
            </div>
            <button
              onClick={() => {
                supportService.createTicket({
                  ticketNumber: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
                  userName: 'Marcus Vance',
                  userRole: 'accountant',
                  category: 'Mock Data Desync',
                  severity: 'Medium',
                  browserEnvironment: 'Chrome 122 on macOS',
                  summary: 'QuickBooks desktop export mapping discrepancy on line 14',
                  sanitizedLogs: 'INFO: Mapped 48 lines, line 14 unclassified in chart of accounts',
                  status: 'Open'
                });
                showNotice('Opened support ticket.');
              }}
              className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium uppercase tracking-wider hover:bg-zinc-800 transition"
            >
              + Open Ticket
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {tickets.map((tkt: SupportTicketRecord) => (
              <div key={tkt.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{tkt.ticketNumber}</span>
                    <span className="text-xs font-mono text-zinc-500">User: {tkt.userName} ({tkt.userRole})</span>
                    <span className={`px-1.5 py-0.2 text-[10px] uppercase font-mono ${
                      tkt.severity === 'High' || tkt.severity === 'Critical' ? 'bg-zinc-200 text-black font-bold' : 'bg-zinc-100 text-zinc-700'
                    }`}>
                      {tkt.severity}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{tkt.summary}</div>
                  <div className="text-xs text-zinc-400 mt-0.5 font-mono">Category: {tkt.category} • Created: {tkt.createdAt}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    tkt.status === 'Resolved (Simulated)' ? 'border-black bg-black text-white' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {tkt.status}
                  </span>
                  {tkt.status !== 'Resolved (Simulated)' ? (
                    <button
                      onClick={() => {
                        supportService.updateTicketStatus(tkt.id, 'Resolved (Simulated)', 'Helpdesk Support Lead');
                        showNotice(`Ticket ${tkt.ticketNumber} marked resolved.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                    >
                      Resolve
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        supportService.resetUserSession(tkt.userRole, 'Helpdesk Lead');
                        showNotice(`Reset session credentials for ${tkt.userRole}.`);
                      }}
                      className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                    >
                      Reset Role Session
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 18. HANDOFFS TAB (All Inter-Role Handoffs)
  const renderHandoffsTab = () => {
    return (
      <div className="space-y-6">
        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Inter-Role Workflow Handoff Gate</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Every stage transition enforces an explicit maker-checker handoff record with acceptance, rejection, or escalation.
              </p>
            </div>
            <button
              onClick={() => {
                handoffService.createHandoff({
                  client: 'Perotti Capital Holdings LLC',
                  entity: 'S-Corporation',
                  engagement: '2025 Form 1120-S Corporate Return',
                  taxYear: 2025,
                  jurisdiction: 'Federal / SC',
                  fromRole: role,
                  toRole: 'quality-control',
                  currentStage: 'Review',
                  reason: 'Preparer completed Schedule M-1 and K-1 distributions; routed to QC.',
                  requiredAction: 'Verify maker/checker separation and 8879 consent',
                  requiredDocuments: ['Trial Balance', 'Schedule M-1 Workpaper', 'Form 8879-S'],
                  priority: 'High',
                  internalDeadline: '2026-03-10',
                  statutoryDeadline: '2026-03-15',
                  handoffNotes: 'Passes all basic cross-schedule reconciliations',
                  acceptanceStatus: 'Pending'
                }, 'Operational Dispatch');
                showNotice(`Issued handoff to quality-control.`);
              }}
              className="px-3 py-1.5 border border-zinc-900 bg-zinc-900 text-white text-xs font-medium uppercase tracking-wider hover:bg-zinc-800 transition"
            >
              + Initiate Handoff
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {allHandoffs.map((hnd) => (
              <div key={hnd.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-900">{hnd.client}</span>
                    <span className="text-xs font-mono text-zinc-500">• {hnd.engagement}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 mt-1">
                    <span className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200">{hnd.fromRole}</span>
                    <span>→</span>
                    <span className="px-1.5 py-0.5 bg-zinc-900 text-white font-bold">{hnd.toRole}</span>
                    <span className="text-zinc-400">Stage: {hnd.currentStage}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{hnd.reason}</div>
                  {hnd.rejectionReason && (
                    <div className="text-xs text-black font-semibold font-mono mt-0.5">Rejection Notice: {hnd.rejectionReason}</div>
                  )}
                  {hnd.escalationStatus && (
                    <div className="text-xs text-zinc-700 font-mono mt-0.5">Escalated: {hnd.escalationStatus}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs uppercase tracking-wider font-mono border ${
                    hnd.acceptanceStatus === 'Accepted' ? 'border-black bg-black text-white' :
                    hnd.acceptanceStatus === 'Rejected' ? 'border-black bg-zinc-200 text-black font-semibold' :
                    hnd.acceptanceStatus === 'Escalated' ? 'border-zinc-800 bg-zinc-200 text-zinc-900' :
                    'border-zinc-400 bg-zinc-100 text-zinc-900'
                  }`}>
                    {hnd.acceptanceStatus}
                  </span>
                  {hnd.acceptanceStatus === 'Pending' && (
                    <>
                      <button
                        onClick={() => {
                          handoffService.acceptHandoff(hnd.id, 'Assigned Specialist', role);
                          showNotice(`Accepted handoff for ${hnd.client}.`);
                        }}
                        className="px-2.5 py-1 border border-zinc-900 bg-zinc-900 text-white text-xs hover:bg-zinc-800"
                      >
                        Accept Work
                      </button>
                      <button
                        onClick={() => {
                          handoffService.rejectHandoff(hnd.id, 'Missing supporting trial balance workpapers', 'Assigned Specialist', role);
                          showNotice(`Rejected handoff for ${hnd.client}. Corrections requested.`);
                        }}
                        className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                      >
                        Return for Correction
                      </button>
                      <button
                        onClick={() => {
                          handoffService.escalateHandoff(hnd.id, 'SLA exceeded > 48h with unresolved missing data', 'Assigned Specialist', role);
                          showNotice(`Escalated handoff for ${hnd.client} to Operations Director.`);
                        }}
                        className="px-2.5 py-1 border border-zinc-400 text-zinc-900 text-xs hover:bg-zinc-100"
                      >
                        Escalate
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 19. GOVERNMENT AGENCIES TAB
  const renderAgenciesTab = () => {
    return (
      <div className="space-y-6">
        <div className="border border-zinc-200 bg-white">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">Government Agency & Authority Interface Registry</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Demonstration registry of statutory tax authorities. No real live filings or payments occur in this demo environment.
            </p>
          </div>
          <div className="divide-y divide-zinc-200">
            {agencies.map((agency: GovernmentAgencyAuthority) => (
              <div key={agency.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-900">{agency.agencyName}</span>
                    <span className="text-xs font-mono text-zinc-500">({agency.jurisdiction})</span>
                    <span className="px-2 py-0.5 text-xs font-mono border border-zinc-200 bg-zinc-50">{agency.agencyType}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    Accepted Forms: {agency.returnOrNoticeTypes.join(', ')} • Filing Method: {agency.filingMethod}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 font-mono">
                    Status: {agency.integrationStatus} • Responsible Role: {agency.responsibleStaffRole}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs uppercase tracking-wider font-mono border border-zinc-300 text-zinc-700 bg-zinc-50">
                    {agency.integrationStatus}
                  </span>
                  <button
                    onClick={() => {
                      const res = governmentAgencyRegistryService.testConnectionSimulated(agency.id);
                      showNotice(`${agency.agencyName}: ${res.message}`);
                    }}
                    className="px-2.5 py-1 border border-zinc-300 text-xs hover:bg-zinc-100"
                  >
                    Test Ping (Simulated)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderRoleWorkspace = () => {
    switch (role) {
      case 'reception': return renderReceptionView();
      case 'engagement-manager': return renderEngagementManagerView();
      case 'verification': return renderVerificationView();
      case 'documents': return renderDocumentsView();
      case 'data-entry': return renderDataEntryView();
      case 'accounts-payable': return renderAccountsPayableView();
      case 'accounts-receivable': return renderAccountsReceivableView();
      case 'quality-control': return renderQualityControlView();
      case 'filing': return renderFilingView();
      case 'acknowledgements': return renderAcknowledgementsView();
      case 'correspondence': return renderCorrespondenceView();
      case 'resolution': return renderResolutionView();
      case 'audit': return renderAuditView();
      case 'amendments': return renderAmendmentsView();
      case 'records': return renderRecordsView();
      case 'client-success': return renderClientSuccessView();
      case 'support': return renderSupportView();
      default:
        return (
          <div className="p-8 text-center text-zinc-500">
            Select a specialized workspace module from the navigation sidebar.
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Notification Alert */}
      {actionSuccessMsg && (
        <div className="border border-zinc-900 bg-zinc-900 text-white px-4 py-3 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-zinc-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Workspace Tab Selector */}
      <div className="border-b border-zinc-200 flex items-center justify-between bg-white px-6">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('main')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'main' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Role Operations Console
          </button>
          <button
            onClick={() => setActiveTab('handoffs')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
              activeTab === 'handoffs' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <span>Inter-Role Handoffs</span>
            {handoffs.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-mono bg-zinc-900 text-white rounded-full">
                {handoffs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('agencies')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'agencies' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Tax Authorities ({agencies.length})
          </button>
        </div>

        <button
          onClick={onOpenAiAssistant}
          className="px-3 py-1.5 border border-zinc-300 text-xs text-zinc-800 hover:bg-zinc-100 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
          <span>Role AI Assistant</span>
        </button>
      </div>

      {/* Main Workspace Body */}
      {activeTab === 'main' && renderRoleWorkspace()}
      {activeTab === 'handoffs' && renderHandoffsTab()}
      {activeTab === 'agencies' && renderAgenciesTab()}
    </div>
  );
};
