/**
 * A/R Tax Services, LLC - Client Authorized Contacts & Power of Attorney
 * Compliance with Sections 4 & 24: Entity signing authorities, Form 2848 representatives,
 * and access authorizations.
 */

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Mail,
  Phone,
  Building,
  Key,
  CheckCircle2,
  FileText,
  Lock
} from 'lucide-react';

export interface AuthorizedContact {
  id: string;
  name: string;
  role: string;
  relationship: string;
  email: string;
  phone: string;
  hasSigningAuthority: boolean;
  hasPoa2848: boolean;
  accessLevel: 'Full Signer' | 'Tax Liaison' | 'Billing Only' | 'Read Only';
}

const INITIAL_CONTACTS: AuthorizedContact[] = [
  {
    id: 'ct-1',
    name: 'Desmond Hinds',
    role: 'Managing Member & CEO',
    relationship: 'Primary Taxpayer / Officer',
    email: 'dhenzeconstruction@gmail.com',
    phone: '(240) 413-0570',
    hasSigningAuthority: true,
    hasPoa2848: true,
    accessLevel: 'Full Signer'
  },
  {
    id: 'ct-2',
    name: 'Elena Rostova',
    role: 'Chief Financial Officer',
    relationship: 'Corporate Controller',
    email: 'elena.rostova@henzeholding.demo',
    phone: '(240) 555-0199',
    hasSigningAuthority: true,
    hasPoa2848: false,
    accessLevel: 'Full Signer'
  },
  {
    id: 'ct-3',
    name: 'Marcus Vance',
    role: 'External Corporate Legal Counsel',
    relationship: 'Legal Representative',
    email: 'marcus.vance@vancelegal.demo',
    phone: '(202) 555-0144',
    hasSigningAuthority: false,
    hasPoa2848: true,
    accessLevel: 'Tax Liaison'
  }
];

export const ClientContactsSection: React.FC = () => {
  const [contacts, setContacts] = useState<AuthorizedContact[]>(INITIAL_CONTACTS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [newContact, setNewContact] = useState<Partial<AuthorizedContact>>({
    name: '',
    role: '',
    relationship: '',
    email: '',
    phone: '',
    hasSigningAuthority: false,
    hasPoa2848: false,
    accessLevel: 'Read Only'
  });

  const handleAdd = () => {
    if (!newContact.name?.trim() || !newContact.email?.trim()) {
      setModalError('Legal Name and Email address are required fields.');
      return;
    }
    const created: AuthorizedContact = {
      id: `ct-${Date.now()}`,
      name: newContact.name.trim(),
      role: newContact.role?.trim() || 'Authorized Agent',
      relationship: newContact.relationship?.trim() || 'Representative',
      email: newContact.email.trim(),
      phone: newContact.phone?.trim() || '(555) 000-0000',
      hasSigningAuthority: !!newContact.hasSigningAuthority,
      hasPoa2848: !!newContact.hasPoa2848,
      accessLevel: (newContact.accessLevel as any) || 'Read Only'
    };
    setContacts(prev => [...prev, created]);
    setIsAddModalOpen(false);
    setModalError(null);
    setNewContact({
      name: '',
      role: '',
      relationship: '',
      email: '',
      phone: '',
      hasSigningAuthority: false,
      hasPoa2848: false,
      accessLevel: 'Read Only'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0A2544]" />
              <h2 className="text-xl font-bold text-neutral-900">Authorized Contacts & Powers of Attorney</h2>
            </div>
            <p className="text-sm text-neutral-600 mt-1">
              Designated corporate representatives, signing officers, and Form 2848 IRS Power of Attorney appointees.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-[#061A2F] text-white hover:bg-[#0A2544] text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <UserPlus className="w-4 h-4 text-[#D7AC4A]" />
            <span>Add Authorized Representative</span>
          </button>
        </div>
      </div>

      {/* Contacts Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="p-5 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">{contact.name}</h3>
                  <div className="text-xs text-neutral-600 font-medium">{contact.role}</div>
                  <div className="text-[11px] text-neutral-500 font-mono">{contact.relationship}</div>
                </div>

                <span
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                    contact.accessLevel === 'Full Signer'
                      ? 'bg-[#0A2544] text-[#E8C66A]'
                      : 'bg-neutral-100 text-neutral-700 border border-neutral-300'
                  }`}
                >
                  {contact.accessLevel}
                </span>
              </div>

              <div className="space-y-1 text-xs text-neutral-600 pt-2 border-t border-neutral-200">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="truncate">{contact.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{contact.phone}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">e-Signature Authority:</span>
                {contact.hasSigningAuthority ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Enabled
                  </span>
                ) : (
                  <span className="text-neutral-400">Disabled</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">IRS Form 2848 POA:</span>
                {contact.hasPoa2848 ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> On File
                  </span>
                ) : (
                  <span className="text-neutral-400">None</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-300 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-neutral-900">Add Authorized Representative</h3>

            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-300 text-red-800 rounded text-xs">
                {modalError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Full Legal Name:</label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="e.g., Jane Doe"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Corporate Role / Title:</label>
                <input
                  type="text"
                  value={newContact.role}
                  onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                  placeholder="e.g., Vice President of Finance"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Email Address:</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="e.g., jane@company.com"
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Portal Access Level:</label>
                <select
                  value={newContact.accessLevel}
                  onChange={(e) => setNewContact({ ...newContact, accessLevel: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded bg-white"
                >
                  <option value="Full Signer">Full Signer (Can sign Form 8879)</option>
                  <option value="Tax Liaison">Tax Liaison (Upload and review)</option>
                  <option value="Billing Only">Billing Only (Invoices & payments)</option>
                  <option value="Read Only">Read Only (Inspection only)</option>
                </select>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newContact.hasSigningAuthority}
                    onChange={(e) => setNewContact({ ...newContact, hasSigningAuthority: e.target.checked })}
                  />
                  <span>Signing Authority</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newContact.hasPoa2848}
                    onChange={(e) => setNewContact({ ...newContact, hasPoa2848: e.target.checked })}
                  />
                  <span>Form 2848 POA on File</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 border border-neutral-300 rounded text-xs font-semibold hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-[#061A2F] text-white rounded text-xs font-semibold hover:bg-[#0A2544]"
              >
                Save Representative
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
