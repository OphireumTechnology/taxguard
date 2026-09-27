import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Check, ArrowRight } from 'lucide-react';

interface PublicV2ContactPageProps {
  onNavigate: (path: string) => void;
  onOpenConsultation: () => void;
}

export const PublicV2ContactPage: React.FC<PublicV2ContactPageProps> = ({
  onNavigate,
  onOpenConsultation
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    clientType: 'individual',
    service: 'Individual Tax Preparation',
    state: 'CA',
    consultationType: 'Virtual Video (Confidential)',
    message: '',
    consent: false
  });

  const [submitted, setSubmitted] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent) return;
    const code = `AR-DEMO-${Math.floor(100000 + Math.random() * 900000)}`;
    setConfirmationCode(code);
    setSubmitted(true);
  };

  return (
    <div className="bg-white text-black space-y-16 py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="border-b border-black pb-8 space-y-3">
        <div className="inline-block border border-black bg-neutral-100 px-3 py-1 text-[11px] font-mono text-black">
          Direct Inquiries & Practice Communication
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-black">
          Contact A/R Tax Services, LLC
        </h1>
        <p className="text-base sm:text-lg text-neutral-700 max-w-3xl leading-relaxed">
          Reach our team for tax preparation scheduling, bookkeeping engagements, notice review, or corporate advisory.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Contact Info & Office Details */}
        <div className="space-y-6">
          <div className="border border-black p-6 bg-white space-y-5">
            <h2 className="text-base font-bold text-black border-b border-neutral-200 pb-2">
              Principal Office Location
            </h2>

            <div className="space-y-4 text-xs text-neutral-700">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-black flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-black block text-sm">A/R Tax Services, LLC</strong>
                  <span>2603 Camino Ramon, Suite 200</span><br />
                  <span>San Ramon, CA 94583</span>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-neutral-100 pt-3">
                <Phone className="w-4 h-4 text-black flex-shrink-0" />
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-mono">Office Direct:</span>
                  <a href="tel:+19253971040" className="text-black font-semibold hover:underline text-sm">
                    (925) 397-1040
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-neutral-100 pt-3">
                <Mail className="w-4 h-4 text-black flex-shrink-0" />
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-mono">Official Email:</span>
                  <a href="mailto:contact@artaxserv.com" className="text-black font-semibold hover:underline">
                    contact@artaxserv.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-neutral-100 pt-3">
                <Clock className="w-4 h-4 text-black flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-mono">Operating Hours (PST):</span>
                  <span>Monday – Friday: 8:30 AM – 5:30 PM</span><br />
                  <span>Saturday: By appointment during tax season</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-neutral-300 p-6 bg-neutral-50 space-y-3 text-xs">
            <h3 className="font-bold text-black">Developer & Systems Contact</h3>
            <p className="text-neutral-600">
              For technical queries regarding this demonstration applet:
            </p>
            <div className="pt-1">
              <a href="tel:+639179668814" className="text-black font-mono font-bold hover:underline">
                +63 917 966 8814
              </a>
            </div>
          </div>
        </div>

        {/* Form Column */}
        <div className="lg:col-span-2 border border-black p-6 sm:p-10 bg-white">
          <div className="border-b border-neutral-200 pb-4 mb-6">
            <h2 className="text-xl font-bold text-black tracking-tight">
              Inquiry & Consultation Form
            </h2>
            <p className="text-xs text-neutral-600 mt-1">
              Submit your project parameters. In demonstration mode, a mock confirmation record is registered locally.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4 py-8">
              <div className="p-4 border border-black bg-neutral-50 flex items-start gap-3">
                <div className="p-1 bg-black text-white flex-shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-black text-sm">
                    Inquiry Confirmed (Demonstration Mode)
                  </h3>
                  <p className="text-xs text-neutral-700">
                    Tracking Number: <span className="font-mono font-bold text-black">{confirmationCode}</span>
                  </p>
                  <p className="text-xs text-neutral-600 pt-1 leading-relaxed">
                    Thank you, {formData.name}. Your demonstration request regarding {formData.service} ({formData.state}) has been logged locally. No external email was transmitted.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="contact-name">
                    Full Legal Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="contact-email">
                    Email Address *
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@example.com"
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="contact-phone">
                    Telephone *
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(925) 000-0000"
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="contact-type">
                    Profile *
                  </label>
                  <select
                    id="contact-type"
                    value={formData.clientType}
                    onChange={(e) => setFormData({ ...formData, clientType: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-black border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none"
                  >
                    <option value="individual">Individual Taxpayer</option>
                    <option value="business">Business / Corporate</option>
                    <option value="both">Individual & Business</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="contact-state">
                    U.S. State *
                  </label>
                  <select
                    id="contact-state"
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
                    <option value="OTHER">Other State / U.S. Territory</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="contact-service">
                    Primary Service Needed *
                  </label>
                  <select
                    id="contact-service"
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
                  <label className="block text-xs font-semibold text-black mb-1" htmlFor="contact-consult-type">
                    Preferred Format *
                  </label>
                  <select
                    id="contact-consult-type"
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
                <label className="block text-xs font-semibold text-black mb-1" htmlFor="contact-msg">
                  Message / Situation Details
                </label>
                <textarea
                  id="contact-msg"
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Provide context regarding prior tax years, business revenue, or current IRS notices..."
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

              <div className="pt-4 border-t border-neutral-200 flex justify-end">
                <button
                  type="submit"
                  disabled={!formData.consent}
                  className="px-8 py-3 bg-black text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                >
                  Submit Inquiry
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
