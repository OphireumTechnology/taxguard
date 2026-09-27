import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface PublicV2ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultService?: string;
}

export const PublicV2ConsultationModal: React.FC<PublicV2ConsultationModalProps> = ({
  isOpen,
  onClose,
  defaultService = 'Individual Tax Preparation'
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    clientType: 'individual',
    service: defaultService,
    state: 'CA',
    consultationType: 'Virtual Video (Confidential)',
    message: '',
    consent: false
  });

  const [submitted, setSubmitted] = useState(false);
  const [confirmationId, setConfirmationId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent) return;
    const mockId = `AR-DEMO-${Math.floor(100000 + Math.random() * 900000)}`;
    setConfirmationId(mockId);
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setFormData({
      name: '',
      email: '',
      phone: '',
      clientType: 'individual',
      service: defaultService,
      state: 'CA',
      consultationType: 'Virtual Video (Confidential)',
      message: '',
      consent: false
    });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="w-full max-w-2xl bg-white border border-black shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4 mb-6">
          <div>
            <h2 id="modal-title" className="text-xl font-bold text-black tracking-tight">
              Request a Consultation
            </h2>
            <p className="text-xs text-neutral-600 font-mono mt-0.5">
              A/R Tax Services, LLC · Demonstration Scheduling
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-black hover:bg-neutral-100 border border-transparent hover:border-black transition-colors"
            aria-label="Close consultation modal"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {submitted ? (
          <div className="space-y-5 py-4">
            <div className="p-4 border border-black bg-neutral-50 flex items-start gap-3">
              <div className="p-1 bg-black text-white flex-shrink-0 mt-0.5">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-black text-sm">
                  Demonstration Booking Confirmed
                </p>
                <p className="text-xs text-neutral-700 leading-relaxed">
                  Confirmation Code: <span className="font-mono font-bold text-black">{confirmationId}</span>
                </p>
                <p className="text-xs text-neutral-600 leading-relaxed pt-1">
                  Notice: This alternative Public Page 2 website is running in demonstration mode. A local mock record was registered for {formData.name} regarding {formData.service}. No actual email was transmitted.
                </p>
              </div>
            </div>

            <div className="border border-neutral-200 p-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Contact:</span>
                <span className="font-medium text-black">{formData.email} · {formData.phone || 'No phone'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Service Category:</span>
                <span className="font-medium text-black">{formData.service}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Jurisdiction / State:</span>
                <span className="font-medium text-black">{formData.state}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Mode:</span>
                <span className="font-medium text-black">{formData.consultationType}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2 bg-black text-white hover:bg-neutral-800 text-sm font-medium transition-colors"
              >
                Close Confirmation
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-black mb-1" htmlFor="consult-name">
                  Full Legal Name *
                </label>
                <input
                  id="consult-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Sarah Jenkins"
                  className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1" htmlFor="consult-email">
                  Email Address *
                </label>
                <input
                  id="consult-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="s.jenkins@example.com"
                  className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-black mb-1" htmlFor="consult-phone">
                  Telephone *
                </label>
                <input
                  id="consult-phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(925) 000-0000"
                  className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1" htmlFor="consult-type">
                  Taxpayer Profile *
                </label>
                <select
                  id="consult-type"
                  value={formData.clientType}
                  onChange={(e) => setFormData({ ...formData, clientType: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                >
                  <option value="individual">Individual Taxpayer</option>
                  <option value="business">Business / Entity</option>
                  <option value="both">Individual & Business</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1" htmlFor="consult-state">
                  U.S. State *
                </label>
                <select
                  id="consult-state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                >
                  <option value="CA">California (CA)</option>
                  <option value="NY">New York (NY)</option>
                  <option value="TX">Texas (TX)</option>
                  <option value="FL">Florida (FL)</option>
                  <option value="WA">Washington (WA)</option>
                  <option value="IL">Illinois (IL)</option>
                  <option value="NV">Nevada (NV)</option>
                  <option value="AZ">Arizona (AZ)</option>
                  <option value="CO">Colorado (CO)</option>
                  <option value="OTHER">Other U.S. State / Territory</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-black mb-1" htmlFor="consult-service">
                  Primary Service Needed *
                </label>
                <select
                  id="consult-service"
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                >
                  <option value="Individual Tax Preparation">Individual Tax Preparation</option>
                  <option value="Business Tax Preparation">Business Tax Preparation</option>
                  <option value="Bookkeeping and Monthly Close">Bookkeeping and Monthly Close</option>
                  <option value="Payroll Accounting">Payroll Accounting</option>
                  <option value="Tax Planning and Advisory">Tax Planning and Advisory</option>
                  <option value="IRS and State Notice Support">IRS and State Notice Support</option>
                  <option value="Amendments and Corrections">Amendments and Corrections</option>
                  <option value="Business Formation and Closure Support">Business Formation and Closure Support</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black mb-1" htmlFor="consult-pref">
                  Preferred Format *
                </label>
                <select
                  id="consult-pref"
                  value={formData.consultationType}
                  onChange={(e) => setFormData({ ...formData, consultationType: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                >
                  <option value="Virtual Video (Confidential)">Virtual Video Consultation</option>
                  <option value="Telephone (Direct)">Telephone Direct Call</option>
                  <option value="Written Summary">Written Analysis / Email Assessment</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-black mb-1" htmlFor="consult-msg">
                Brief Description of Scope or Objectives
              </label>
              <textarea
                id="consult-msg"
                rows={3}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Include relevant tax years, business structure, or specific accounting challenges..."
                className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none resize-none"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded-none border-neutral-400 text-black focus:ring-black"
                />
                <span className="text-xs text-neutral-600 leading-normal">
                  I understand this demonstration form creates a local mock confirmation and does not transmit confidential financial documents. No email or third-party transmission is initiated.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-neutral-300 text-black hover:bg-neutral-100 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.consent}
                className="px-6 py-2 bg-black text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors"
              >
                Submit Consultation Request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
