import React, { useState } from 'react';
import {
  Building2,
  User,
  ShieldCheck,
  Edit3,
  Plus,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  FileText,
  Clock,
  Share2,
  Send,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientProfileEntitiesSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
}

export const ClientProfileEntitiesSection: React.FC<ClientProfileEntitiesSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant
}) => {
  const [activeTab, setActiveTab] = useState<'entity' | 'individual' | 'owners' | 'obligations' | 'change_requests'>('entity');
  const [showTIN, setShowTIN] = useState(false);
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [changeField, setChangeField] = useState('');
  const [changeProposedValue, setChangeProposedValue] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changeNotice, setChangeNotice] = useState<string | null>(null);

  // Entities list
  const [selectedEntityId, setSelectedEntityId] = useState('ent_01');

  const entities = [
    {
      id: 'ent_01',
      legalName: 'Perotti Capital Holdings LLC',
      tradeName: 'Perotti Capital',
      entityType: 'S-Corporation (Elective Subchapter S under IRC § 1362)',
      stateOfFormation: 'South Carolina',
      formationDate: 'March 14, 2018',
      ein: '57-9842109',
      einMasked: '••-•••2109',
      accountingMethod: 'Accrual Basis (IRC § 446)',
      fiscalYearEnd: 'December 31 (Calendar Tax Year)',
      naicsCode: '523920 - Portfolio Management & Private Equity Holding',
      principalAddress: '1201 Main Street, Suite 1940, Columbia, SC 29201',
      mailingAddress: 'PO Box 7812, Columbia, SC 29202',
      registeredAgent: 'Columbia Corporate Agents, LLC',
      bookkeepingCadence: 'Monthly Closing with Quarterly Tax True-Up',
      activeEngagement: '2025 Form 1120-S Corporate & Multi-State Compliance'
    },
    {
      id: 'ent_02',
      legalName: 'Palmetto Point Real Estate Partners, LLC',
      tradeName: 'Palmetto Point Holdings',
      entityType: 'Partnership (Form 1065 / Multi-Member LLC)',
      stateOfFormation: 'South Carolina',
      formationDate: 'August 22, 2021',
      ein: '84-1290384',
      einMasked: '••-•••0384',
      accountingMethod: 'Cash Basis',
      fiscalYearEnd: 'December 31',
      naicsCode: '531120 - Lessors of Nonresidential Buildings',
      principalAddress: '800 Gervais St, Columbia, SC 29201',
      mailingAddress: 'Same as principal',
      registeredAgent: 'Columbia Corporate Agents, LLC',
      bookkeepingCadence: 'Quarterly Closing',
      activeEngagement: '2025 Form 1065 Pass-Through Tax Filing'
    }
  ];

  const currentEntity = entities.find(e => e.id === selectedEntityId) || entities[0];

  const owners = [
    {
      id: 'own_1',
      name: 'Michael Perotti',
      role: 'Managing Member & President',
      ownershipPercent: 85.0,
      taxIdMasked: '•••-••-4890',
      officerCompensationW2: '$175,000.00',
      activeInOperations: true,
      form7203BasisTracking: 'Active ($842,500 Adjusted Stock Basis)'
    },
    {
      id: 'own_2',
      name: 'Sarah Perotti',
      role: 'Member / Shareholder',
      ownershipPercent: 15.0,
      taxIdMasked: '•••-••-9122',
      officerCompensationW2: '$0.00 (Passive)',
      activeInOperations: false,
      form7203BasisTracking: 'Active ($148,650 Adjusted Stock Basis)'
    }
  ];

  const statutoryObligations = [
    {
      jurisdiction: 'Federal (IRS)',
      form: 'Form 1120-S',
      description: 'U.S. Income Tax Return for an S Corporation',
      frequency: 'Annual',
      dueDate: 'March 15, 2026',
      status: 'In Senior Review'
    },
    {
      jurisdiction: 'South Carolina DOR',
      form: 'SC 1120-S',
      description: 'S Corporation Income Tax Return & PTE Election (SC Act 61)',
      frequency: 'Annual',
      dueDate: 'March 15, 2026',
      status: 'Ready for Signature'
    },
    {
      jurisdiction: 'Federal (IRS)',
      form: 'Form 941 (Q1-Q4)',
      description: "Employer's Quarterly Federal Tax Return",
      frequency: 'Quarterly',
      dueDate: 'April 30, July 31, Oct 31, Jan 31',
      status: 'Fully Reconciled (Tie-out Complete)'
    },
    {
      jurisdiction: 'South Carolina DOR',
      form: 'SC WH-1605',
      description: 'South Carolina Quarterly Withholding Tax Return',
      frequency: 'Quarterly',
      dueDate: 'Quarterly',
      status: 'Reconciled'
    },
    {
      jurisdiction: 'Federal (IRS)',
      form: 'Form 1099-NEC / 1099-MISC',
      description: 'Nonemployee Compensation (Independent Contractors)',
      frequency: 'Annual',
      dueDate: 'January 31, 2026',
      status: 'Filed & Transmitted'
    }
  ];

  const changeRequests = [
    {
      id: 'cr_101',
      field: 'Principal Operating Address',
      currentVal: '1201 Main Street, Suite 1940, Columbia, SC 29201',
      proposedVal: '1201 Main Street, Suite 2100, Columbia, SC 29201',
      reason: 'Office expansion into 21st floor suite',
      submittedAt: '2026-02-10',
      status: 'Approved by CPA Elena Rostova',
      notes: 'Updated on draft Form 1120-S header and SC DOR nexus schedules.'
    }
  ];

  const handleSubmitChangeRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeField || !changeProposedValue || !changeReason) {
      alert('Please complete all change request fields.');
      return;
    }

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Submitted Profile Change Request',
      record: `${currentEntity.legalName}: ${changeField}`,
      result: 'Success (Simulated)',
      reason: changeReason
    });

    setChangeNotice(`Change Request for "${changeField}" submitted successfully for CPA review.`);
    setIsChangeModalOpen(false);
    setChangeField('');
    setChangeProposedValue('');
    setChangeReason('');
    setTimeout(() => setChangeNotice(null), 5000);
  };

  return (
    <div className="space-y-6" id="client-profile-entities-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Taxpayer Dossier
              </span>
              <span className="text-xs text-[#667085]">Entity &amp; Jurisdiction Master Profile</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Profile, Business Entities &amp; Ownership Structure
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Verified legal records, masked statutory identifiers, tax classification, and governance controls.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsChangeModalOpen(true)}
              className="px-3.5 py-2 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Propose Profile Update</span>
            </button>
            {onOpenAssistant && (
              <button
                onClick={onOpenAssistant}
                className="p-2 border border-[#C99A32] text-[#C99A32] hover:bg-[#FAF9F5] rounded transition-colors"
                title="Ask TaxGuard about entity restructuring"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Change Notice */}
        {changeNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{changeNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Logged to immutable audit history</span>
          </div>
        )}

        {/* Entity Switcher Pills */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto">
          <span className="text-xs font-bold text-[#061A2F] whitespace-nowrap mr-2">Active Entity:</span>
          {entities.map(ent => (
            <button
              key={ent.id}
              onClick={() => setSelectedEntityId(ent.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                selectedEntityId === ent.id
                  ? 'bg-[#061A2F] border-[#061A2F] text-[#F7F4ED]'
                  : 'bg-white border-[#D8DCE2] text-[#667085] hover:border-[#061A2F]'
              }`}
            >
              {ent.legalName}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D8DCE2] bg-white px-4 rounded-t-lg">
        {[
          { id: 'entity', label: 'Entity Profile & Tax Info', icon: Building2 },
          { id: 'owners', label: 'Owners & Shareholders', icon: User },
          { id: 'obligations', label: 'Statutory Filing Obligations', icon: FileText },
          { id: 'change_requests', label: 'Audit Change Requests', icon: Clock }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#061A2F] text-[#061A2F]'
                  : 'border-transparent text-[#667085] hover:text-[#061A2F]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C99A32]' : 'text-[#667085]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: ENTITY PROFILE */}
      {activeTab === 'entity' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#667085] block">Legal Entity Name</label>
              <div className="text-sm font-bold text-[#061A2F]">{currentEntity.legalName}</div>
              <div className="text-xs text-[#667085]">DBA / Trade: {currentEntity.tradeName}</div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#667085] block">Tax Classification</label>
              <div className="text-sm font-bold text-[#061A2F]">{currentEntity.entityType}</div>
              <div className="text-xs text-[#1B5E20] font-medium">Form 2553 Election Active</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase text-[#667085]">Employer Identification Number (EIN)</label>
                <span className="text-[10px] font-mono text-[#C99A32] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Masked (IRC § 7216)</span>
                </span>
              </div>
              <div className="text-sm font-mono font-bold text-[#061A2F]">
                {currentEntity.einMasked}
              </div>
              <div className="text-[10px] text-[#667085]">State Jurisdiction: {currentEntity.stateOfFormation} &bull; Full TIN never exposed</div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#667085] block">Tax Accounting Method</label>
              <div className="text-sm font-bold text-[#061A2F]">{currentEntity.accountingMethod}</div>
              <div className="text-xs text-[#667085]">Permissible under Rev. Proc. 2002-28</div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#667085] block">Fiscal / Tax Year End</label>
              <div className="text-sm font-bold text-[#061A2F]">{currentEntity.fiscalYearEnd}</div>
              <div className="text-xs text-[#667085]">Calendar Year Reporting</div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#667085] block">Bookkeeping Cadence</label>
              <div className="text-sm font-bold text-[#061A2F]">{currentEntity.bookkeepingCadence}</div>
              <div className="text-xs text-[#1B5E20] font-medium">QBO Feed Linked</div>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#667085] block">Principal Place of Business</label>
              <div className="text-sm font-medium text-[#061A2F]">{currentEntity.principalAddress}</div>
              <div className="text-xs text-[#667085]">Mailing: {currentEntity.mailingAddress}</div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#667085] block">Primary NAICS Industry Activity</label>
              <div className="text-sm font-medium text-[#061A2F]">{currentEntity.naicsCode}</div>
              <div className="text-xs text-[#667085]">Line of Business: Asset Management &amp; Advisory</div>
            </div>
          </div>

          <div className="border-t border-[#D8DCE2] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#667085]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1B5E20]" />
              <span><strong>Immutable Filing Baseline:</strong> Changes to filed tax year parameters require formal CPA change verification.</span>
            </div>
            <span className="font-mono text-[11px]">Last certified: Elena Rostova, CPA on Jan 12, 2026</span>
          </div>
        </div>
      )}

      {/* TAB CONTENT: OWNERS & SHAREHOLDERS */}
      {activeTab === 'owners' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4">
          <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#061A2F]">Shareholders, Members &amp; Ownership Cap Table</h3>
              <p className="text-xs text-[#667085]">Form 1120-S Schedule K-1 allocation and Form 7203 basis schedules.</p>
            </div>
            <span className="px-2.5 py-1 bg-[#FAF9F5] border border-[#C99A32] text-[#061A2F] rounded text-xs font-bold">
              100.0% Aggregate Ownership
            </span>
          </div>

          <div className="space-y-3">
            {owners.map(owner => (
              <div key={owner.id} className="border border-[#D8DCE2] rounded p-4 bg-[#FBFAF7] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#061A2F]">{owner.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-white border border-[#D8DCE2] text-[#061A2F] rounded">
                      {owner.role}
                    </span>
                  </div>
                  <div className="text-xs text-[#667085] mt-1 space-x-3">
                    <span>SSN: <strong className="font-mono">{owner.taxIdMasked}</strong></span>
                    <span>•</span>
                    <span>W-2 Officer Salary: <strong className="text-[#061A2F]">{owner.officerCompensationW2}</strong></span>
                    <span>•</span>
                    <span>Basis: <strong className="text-[#1B5E20]">{owner.form7203BasisTracking}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-[#667085]">Schedule K-1 Ratio</div>
                    <div className="text-lg font-bold text-[#061A2F]">{owner.ownershipPercent.toFixed(1)}%</div>
                  </div>
                  <button
                    onClick={() => alert(`Showing K-1 allocation details for ${owner.name}`)}
                    className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F]"
                  >
                    View Basis History
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: STATUTORY FILING OBLIGATIONS */}
      {activeTab === 'obligations' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Statutory Federal &amp; State Compliance Matrix</h3>
            <p className="text-xs text-[#667085]">Authorized filing calendar and tax return schedule monitored by A/R Tax Services.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-[#D8DCE2]">
              <thead className="bg-[#FBFAF7] border-b border-[#D8DCE2] text-[#667085] uppercase text-[10px] font-mono">
                <tr>
                  <th className="p-3">Jurisdiction</th>
                  <th className="p-3">Form</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Frequency</th>
                  <th className="p-3">Next Due Date</th>
                  <th className="p-3">Compliance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DCE2]">
                {statutoryObligations.map((ob, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF9F5]">
                    <td className="p-3 font-semibold text-[#061A2F]">{ob.jurisdiction}</td>
                    <td className="p-3 font-mono font-bold text-[#061A2F]">{ob.form}</td>
                    <td className="p-3 text-[#4B5563]">{ob.description}</td>
                    <td className="p-3 text-[#667085]">{ob.frequency}</td>
                    <td className="p-3 font-mono font-medium text-[#061A2F]">{ob.dueDate}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF9F5] border border-[#C99A32] text-[#061A2F]">
                        {ob.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CHANGE REQUESTS */}
      {activeTab === 'change_requests' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4">
          <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#061A2F]">Profile &amp; Entity Change History</h3>
              <p className="text-xs text-[#667085]">Maker-checker audit log of all profile and ownership modifications.</p>
            </div>
            <button
              onClick={() => setIsChangeModalOpen(true)}
              className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#0A2544]"
            >
              + New Change Request
            </button>
          </div>

          <div className="space-y-3">
            {changeRequests.map(cr => (
              <div key={cr.id} className="border border-[#D8DCE2] rounded p-4 bg-[#FBFAF7] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-[#061A2F] flex items-center gap-2">
                    <span>{cr.field}</span>
                    <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-semibold">
                      {cr.status}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#667085]">Submitted: {cr.submittedAt}</span>
                </div>
                <div className="text-xs text-[#4B5563] grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2.5 rounded border border-[#E5E7EB]">
                  <div><strong className="text-[#667085]">Original:</strong> {cr.currentVal}</div>
                  <div><strong className="text-[#061A2F]">Proposed:</strong> {cr.proposedVal}</div>
                </div>
                <div className="text-xs text-[#667085]">
                  <strong>Business Justification:</strong> {cr.reason} • <em>{cr.notes}</em>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: PROPOSE PROFILE UPDATE */}
      {isChangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="border-b border-[#D8DCE2] pb-3">
              <h3 className="text-sm font-bold text-[#061A2F]">Propose Profile or Entity Change</h3>
              <p className="text-xs text-[#667085]">
                Under CPA firm policy, changes affecting filed returns or active workpapers require formal review.
              </p>
            </div>

            <form onSubmit={handleSubmitChangeRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#061A2F] mb-1">Target Field or Parameter</label>
                <select
                  value={changeField}
                  onChange={e => setChangeField(e.target.value)}
                  className="w-full p-2 border border-[#D8DCE2] rounded bg-white"
                  required
                >
                  <option value="">Select parameter...</option>
                  <option value="Principal Business Address">Principal Business Address</option>
                  <option value="Mailing Address">Mailing Address</option>
                  <option value="Registered Agent">Registered Agent Information</option>
                  <option value="Officer / Shareholder Compensation">Officer / Shareholder Compensation</option>
                  <option value="Shareholder Ownership Ratio">Shareholder Ownership Ratio</option>
                  <option value="State Nexus or Apportionment Jurisdictions">State Nexus or Apportionment Jurisdictions</option>
                  <option value="NAICS Business Activity Code">NAICS Business Activity Code</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#061A2F] mb-1">Proposed Value</label>
                <input
                  type="text"
                  value={changeProposedValue}
                  onChange={e => setChangeProposedValue(e.target.value)}
                  placeholder="Enter the proposed new value..."
                  className="w-full p-2 border border-[#D8DCE2] rounded bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#061A2F] mb-1">Reason / Business Justification</label>
                <textarea
                  value={changeReason}
                  onChange={e => setChangeReason(e.target.value)}
                  placeholder="Explain why this change occurred (e.g. lease agreement signed, relocation)..."
                  className="w-full p-2 border border-[#D8DCE2] rounded bg-white h-20"
                  required
                />
              </div>

              <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-[11px] text-[#4B5563] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#C99A32] flex-shrink-0 mt-0.5" />
                <span>
                  Submitted change requests are automatically routed to senior reviewer Elena Rostova, CPA. No existing tax forms are altered until approved.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8DCE2]">
                <button
                  type="button"
                  onClick={() => setIsChangeModalOpen(false)}
                  className="px-4 py-2 border border-[#D8DCE2] rounded text-[#667085] hover:text-[#061A2F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white font-bold rounded hover:bg-[#0A2544]"
                >
                  Submit Change Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
