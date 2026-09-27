import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle2, 
  UploadCloud, 
  ShieldCheck,
  Building2,
  Calendar,
  AlertTriangle,
  Lock,
  Info
} from 'lucide-react';

export const ContactPage: React.FC = () => {
  const { addAuditLog, addNotification, setCurrentPage } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('General Tax Inquiry');
  const [message, setMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // Spam mitigation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Full name is required.';
    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!message.trim()) newErrors.message = 'Please provide a message or inquiry details.';
    if (!consentAcknowledged) {
      newErrors.consent = 'Please confirm acknowledgement of the sensitive data notice.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return; // Silent spam rejection
    if (!validate()) return;

    setIsSubmitting(true);
    await new Promise((res) => setTimeout(res, 800));

    addAuditLog('CONTACT_FORM_SUBMITTED', 'Public Visitor', `Inquiry from ${name} (${email}): ${subject}`);
    addNotification({
      title: 'New Client Inquiry Received',
      message: `${name} submitted an inquiry regarding "${subject}".`,
      type: 'info',
      read: false,
    });

    setIsSubmitting(false);
    setIsSent(true);
  };

  return (
    <div className="space-y-16 pb-20 text-slate-100">
      
      {/* Header Banner */}
      <section className="relative pt-12 pb-14 border-b border-[#1E3A5F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
            <Mail className="w-3.5 h-3.5" />
            <span>Direct Client Support</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-extrabold text-white">
            Connect With A/R Tax Services
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Our Columbia, South Carolina advisory team is ready to answer your questions, 
            support your business accounting, and guide your wealth preservation goals.
          </p>
        </div>
      </section>

      {/* Main Grid: Info + Interactive Form */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Column 1: Firm Contact Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl space-y-6">
              <div>
                <h2 className="font-serif text-2xl font-bold text-white">Our Headquarters</h2>
                <p className="text-xs text-[#C6A15B] mt-1 font-semibold uppercase tracking-wider">
                  Columbia, South Carolina
                </p>
              </div>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F]">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block">Physical Location:</strong>
                    Columbia, South Carolina, USA
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block">Direct Telephone:</strong>
                    <a href="tel:678-205-9486" className="text-slate-200 hover:text-[#C6A15B] transition-colors font-medium">
                      678-205-9486
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block">Official Inquiries:</strong>
                    <a href="mailto:info@artaxservices.com" className="text-slate-200 hover:text-[#C6A15B] transition-colors">
                      info@artaxservices.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-white block">Firm Business Hours:</strong>
                    Monday â€“ Friday: 9:00 AM â€“ 6:00 PM EST<br />
                    Saturday: By Appointment Only<br />
                    Sunday: Closed (Secure Vault Active 24/7)
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center gap-3 text-xs text-slate-300">
                <ShieldCheck className="w-5 h-5 text-[#C6A15B] flex-shrink-0" />
                <span>All documents transmitted via our secure client portal are encrypted in transit and at rest.</span>
              </div>

              <button
                onClick={() => setCurrentPage('book_consultation')}
                className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Book an Executive Consultation
              </button>
            </div>
          </div>

          {/* Column 2: Interactive Contact Form */}
          <div className="lg:col-span-7">
            <div className="p-8 sm:p-10 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl">
              {!isSent ? (
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-white">Send Us a Direct Message</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Fill out the form below. A senior accountant will review your inquiry within one business day.
                    </p>
                  </div>

                  {/* Sensitive Information Warning Banner */}
                  <div className="p-3.5 rounded-xl bg-[#07172B] border border-amber-500/40 flex items-start gap-3 text-xs text-amber-200/90 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-semibold">Important Privacy &amp; Document Notice:</strong>
                      Please do not submit Social Security numbers, tax documents, banking information, or other sensitive personal information through this form. Existing clients should use the{' '}
                      <button
                        type="button"
                        onClick={() => window.location.hash = '#/client/login'}
                        className="text-[#C6A15B] underline hover:text-[#E2BD67] font-semibold"
                      >
                        secure client portal
                      </button>.
                    </div>
                  </div>

                  {/* Honeypot field (hidden from sighted users and assistive tech) */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="website-hp">Leave this blank</label>
                    <input
                      id="website-hp"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label htmlFor="contact-full-name" className="block text-slate-300 font-semibold mb-1">
                        Your Full Name <span className="text-amber-400">*</span>
                      </label>
                      <input
                        id="contact-full-name"
                        type="text"
                        required
                        aria-required="true"
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? "name-error" : undefined}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                        }}
                        placeholder="e.g. Robert Williams"
                        className={`w-full bg-[#07172B] border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] ${
                          errors.name ? 'border-red-500 focus:border-red-500' : 'border-[#1E3A5F] focus:border-[#C6A15B]'
                        }`}
                      />
                      {errors.name && (
                        <p id="name-error" className="text-[11px] text-red-400 mt-1 font-medium">{errors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="contact-email" className="block text-slate-300 font-semibold mb-1">
                        Your Email <span className="text-amber-400">*</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        aria-required="true"
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? "email-error" : undefined}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                        }}
                        placeholder="rwilliams@example.com"
                        className={`w-full bg-[#07172B] border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] ${
                          errors.email ? 'border-red-500 focus:border-red-500' : 'border-[#1E3A5F] focus:border-[#C6A15B]'
                        }`}
                      />
                      {errors.email && (
                        <p id="email-error" className="text-[11px] text-red-400 mt-1 font-medium">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label htmlFor="contact-phone" className="block text-slate-300 font-semibold mb-1">Phone Number (Optional)</label>
                      <input
                        id="contact-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="678-205-9486"
                        className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] focus:border-[#C6A15B]"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact-subject" className="block text-slate-300 font-semibold mb-1">
                        Subject Matter <span className="text-amber-400">*</span>
                      </label>
                      <select
                        id="contact-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] focus:border-[#C6A15B]"
                      >
                        <option value="Individual Tax Strategy">Individual Tax Preparation (1040)</option>
                        <option value="Business Accounting & S-Corp">Business Tax & Corporate Accounting</option>
                        <option value="Bookkeeping Cleanup Services">Bookkeeping & General Ledger Reconciliation</option>
                        <option value="Financial Protection & Estate">Financial Planning & Estate Tax Coordination</option>
                        <option value="IRS Notice Assistance">IRS & State Tax Notice Assistance</option>
                        <option value="Other General Inquiry">Other General Inquiry</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs">
                    <label htmlFor="contact-message" className="block text-slate-300 font-semibold mb-1">
                      Your Message <span className="text-amber-400">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      required
                      aria-required="true"
                      aria-invalid={!!errors.message}
                      aria-describedby={errors.message ? "message-error" : undefined}
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        if (errors.message) setErrors(prev => ({ ...prev, message: '' }));
                      }}
                      placeholder="Please explain how we can assist your tax, accounting, or business advisory situation..."
                      className={`w-full bg-[#07172B] border rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] ${
                        errors.message ? 'border-red-500 focus:border-red-500' : 'border-[#1E3A5F] focus:border-[#C6A15B]'
                      }`}
                    />
                    {errors.message && (
                      <p id="message-error" className="text-[11px] text-red-400 mt-1 font-medium">{errors.message}</p>
                    )}
                  </div>

                  {/* Attachment input (Drag-and-drop & Click supported) */}
                  <div className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="contact-attachment" className="block text-slate-300 font-semibold">
                        Attach Public Inquiry File (Optional)
                      </label>
                      <span className="text-[11px] text-slate-400">Non-sensitive materials only</span>
                    </div>
                    <div className="p-4 border-2 border-dashed border-[#1E3A5F] rounded-xl bg-[#07172B] text-center hover:border-[#C6A15B] transition-colors relative cursor-pointer">
                      <input
                        id="contact-attachment"
                        type="file"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setAttachedFile(e.target.files[0].name);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full focus:outline-none focus:ring-2 focus:ring-[#C6A15B]"
                      />
                      <UploadCloud className="w-5 h-5 text-[#C6A15B] mx-auto mb-1" />
                      <span className="text-slate-300 font-medium block">
                        {attachedFile ? attachedFile : 'Drag and drop or click to attach document'}
                      </span>
                      <span className="text-[10px] text-slate-500">PDF, JPG, PNG up to 25MB (Do not upload SSNs or tax returns here)</span>
                    </div>
                  </div>

                  {/* Consent and Disclaimers */}
                  <div className="space-y-2 pt-1">
                    <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentAcknowledged}
                        onChange={(e) => {
                          setConsentAcknowledged(e.target.checked);
                          if (errors.consent) setErrors(prev => ({ ...prev, consent: '' }));
                        }}
                        className="mt-0.5 rounded border-[#1E3A5F] bg-[#07172B] text-[#C6A15B] focus:ring-[#C6A15B]"
                      />
                      <span className="leading-snug">
                        I confirm that no sensitive personal data (e.g. SSNs or full tax returns) is included in this submission. I understand that submitting this inquiry does not create a professional-client relationship, which requires a mutually executed engagement letter. <span className="text-amber-400">*</span>
                      </span>
                    </label>
                    {errors.consent && (
                      <p className="text-[11px] text-red-400 font-medium">{errors.consent}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Transmitting Secure Inquiry...</span>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Inquiry to Advisory Team
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    By submitting this form, you agree to our{' '}
                    <button
                      type="button"
                      onClick={() => setCurrentPage('privacy')}
                      className="text-[#C6A15B] underline hover:text-[#E2BD67]"
                    >
                      Privacy Policy
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => setCurrentPage('disclaimers')}
                      className="text-[#C6A15B] underline hover:text-[#E2BD67]"
                    >
                      Professional Disclaimers
                    </button>.
                  </p>
                </form>
              ) : (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-white">Message Transmitted</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Thank you, <strong className="text-white">{name}</strong>. Your inquiry has been securely routed to Desmond Hinds and the client advisory team. You will receive a response at <strong className="text-white">{email}</strong> shortly.
                  </p>
                  <button
                    onClick={() => {
                      setIsSent(false);
                      setMessage('');
                      setAttachedFile(null);
                    }}
                    className="px-6 py-2.5 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B]"
                  >
                    Send Another Message
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};


