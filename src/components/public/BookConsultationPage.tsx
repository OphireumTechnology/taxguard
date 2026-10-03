import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  Phone, 
  Building2, 
  CheckCircle2, 
  ShieldCheck, 
  Check,
  Lock,
  UserCheck,
  CalendarCheck,
  Sparkles
} from 'lucide-react';
import { LiveCalendarModule } from '../calendar/LiveCalendarModule';
import { BrandedDatePicker } from '../ui/BrandedDatePicker';

export const BookConsultationPage: React.FC = () => {
  const { bookAppointment, currentUser, setCurrentPage } = useApp();
  const [bookingMode, setBookingMode] = useState<'live_calendar' | 'fast_form'>('live_calendar');

  const [serviceType, setServiceType] = useState('Individual Tax Strategy & Year-End Planning');
  const [consultationType, setConsultationType] = useState<'virtual' | 'phone' | 'in_office'>('virtual');
  const [requestFounder, setRequestFounder] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [selectedTime, setSelectedTime] = useState('10:00 AM - 11:00 AM EST');
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const availableTimes = [
    '09:00 AM - 10:00 AM EST',
    '10:00 AM - 11:00 AM EST',
    '11:30 AM - 12:30 PM EST',
    '02:00 PM - 03:00 PM EST',
    '03:30 PM - 04:30 PM EST',
    '05:00 PM - 06:00 PM EST',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) return;

    await bookAppointment({
      clientName: name,
      clientEmail: email,
      clientPhone: phone,
      serviceType,
      accountantId: requestFounder ? 'user_accountant_desmond' : 'user_accountant_marcus',
      accountantName: requestFounder ? 'Desmond Hinds (Founder)' : 'Marcus Vance (Staff Accountant)',
      requestedFounder: requestFounder,
      date: selectedDate,
      timeSlot: selectedTime,
      type: consultationType,
      notes,
    });

    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#06182B] text-[#F8FAFC] pb-24 font-sans selection:bg-[#D4A843]/20 selection:text-[#F8FAFC]">
      {/* A. HERO SECTION WITH CINEMATIC PHOTOGRAPHIC BACKGROUND & READABILITY OVERLAYS */}
      <section 
        className="relative overflow-hidden"
        style={{
          backgroundImage: `url('/images/consultation/consultation-hero.webp')`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Readability Overlays: Deep navy gradient protecting text contrast on desktop, high opacity on mobile */}
        <div 
          className="absolute inset-0 bg-[#06182B]/92 sm:bg-transparent"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(6,24,43,0.96) 0%, rgba(6,24,43,0.88) 40%, rgba(6,24,43,0.66) 72%, rgba(6,24,43,0.76) 100%)`,
          }}
        />
        {/* Vignette merging top with navigation header and bottom with trust strip */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#071A2E]/80 via-transparent to-[#071A2E] pointer-events-none" />

        <div className="relative max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 lg:py-20 min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] flex flex-col justify-center">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(212,168,67,0.12)] border border-[rgba(212,168,67,0.30)] text-[#D4A843] text-[11px] sm:text-xs font-semibold tracking-[0.18em] uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PRIVATE TAX & ADVISORY SERVICES</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F8FAFC] tracking-tight leading-tight">
              Schedule a Consultation
            </h1>

            {/* Restrained gold divider */}
            <div className="w-16 h-1 bg-[#D4A843] rounded-full my-3" />

            <p className="text-sm sm:text-base text-[#A9B7C8] max-w-xl leading-relaxed">
              Reserve a dedicated strategy session with our senior tax specialists. Choose a time and meeting option that works for you.
            </p>
          </div>
        </div>
      </section>

      {/* TRUST STRIP (Between hero and booking workspace) */}
      <section className="border-b border-[rgba(148,163,184,0.12)] bg-[#071A2E] py-4">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2.5 text-[#A9B7C8]">
              <ShieldCheck className="w-4 h-4 text-[#D4A843] shrink-0" />
              <span className="font-medium text-[#F8FAFC]">Expert Guidance</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#A9B7C8]">
              <Lock className="w-4 h-4 text-[#D4A843] shrink-0" />
              <span className="font-medium text-[#F8FAFC]">Secure Process</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#A9B7C8]">
              <UserCheck className="w-4 h-4 text-[#D4A843] shrink-0" />
              <span className="font-medium text-[#F8FAFC]">Personalized Service</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#A9B7C8]">
              <CalendarCheck className="w-4 h-4 text-[#D4A843] shrink-0" />
              <span className="font-medium text-[#F8FAFC]">Clear Next Steps</span>
            </div>
          </div>
        </div>
      </section>

      {/* B. BOOKING METHOD (Refined segmented selector) */}
      <div className="max-w-md mx-auto px-4 mt-8 mb-8 sm:mb-10">
        <div className="grid grid-cols-2 p-1.5 rounded-xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] shadow-md">
          <button
            type="button"
            onClick={() => setBookingMode('live_calendar')}
            className={`py-2.5 px-3.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              bookingMode === 'live_calendar'
                ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-xs'
                : 'bg-transparent text-[#A9B7C8] hover:text-[#F8FAFC]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Schedule Online</span>
          </button>
          <button
            type="button"
            onClick={() => setBookingMode('fast_form')}
            className={`py-2.5 px-3.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              bookingMode === 'fast_form'
                ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-xs'
                : 'bg-transparent text-[#A9B7C8] hover:text-[#F8FAFC]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Express Intake</span>
          </button>
        </div>
      </div>

      {/* C. BOOKING WORKFLOW */}
      {bookingMode === 'live_calendar' ? (
        <section className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8">
          <LiveCalendarModule embedded={true} />
        </section>
      ) : (
        /* Express Intake Workflow */
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-2xl bg-[rgba(13,39,69,0.94)] backdrop-blur-xs bg-[#0D2745] border border-[rgba(148,163,184,0.18)] shadow-xl space-y-6">
              
              {/* How would you like to meet? */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#A9B7C8]">
                  How would you like to meet?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'virtual', label: 'Video Meeting', sub: 'Google Meet Video', icon: Video },
                    { id: 'phone', label: 'Phone Call', sub: 'Direct phone outbound', icon: Phone },
                    { id: 'in_office', label: 'Office Visit', sub: 'Columbia, SC Office', icon: Building2 },
                  ].map((type) => {
                    const Icon = type.icon;
                    const isSelected = consultationType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setConsultationType(type.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[rgba(212,168,67,0.10)] border-[rgba(212,168,67,0.80)] text-[#F8FAFC] ring-1 ring-[#D4A843]'
                            : 'bg-[#102D4F] border-[rgba(148,163,184,0.18)] text-[#A9B7C8] hover:border-slate-500 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-[#D4A843]' : 'text-[#7F91A6]'}`} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#D4A843]" />}
                        </div>
                        <div>
                          <div className={`text-xs font-semibold ${isSelected ? 'text-[#F8FAFC]' : 'text-slate-200'}`}>
                            {type.label}
                          </div>
                          <div className="text-[10px] text-[#7F91A6]">{type.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Consultation type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="intake-service-type" className="block text-xs font-semibold text-[#A9B7C8]">
                    Consultation type
                  </label>
                  <select
                    id="intake-service-type"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full min-h-[44px] bg-[#102D4F] border border-[rgba(148,163,184,0.18)] rounded-xl px-3.5 py-2.5 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#D4A843]"
                  >
                    <option value="Individual Tax Strategy & Year-End Planning">Individual Tax Strategy (Form 1040)</option>
                    <option value="Business Entity Filings (S-Corp / LLC / 1120-S)">Business Entity Filings (S-Corp / LLC)</option>
                    <option value="Monthly Bookkeeping & Financial Organization">Monthly Bookkeeping & Accounting</option>
                    <option value="Prior-Year Back Taxes & IRS Transcript Audit">Prior-Year Back Taxes / IRS Transcripts</option>
                    <option value="Financial Protection & Estate Coordination">Financial Protection & Estate Coordination</option>
                    <option value="Credit Solutions & Financial Consultation">Credit & Financial Consultation</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#A9B7C8]">
                    Specialist preference
                  </label>
                  <div className="min-h-[44px] p-2.5 rounded-xl bg-[#102D4F] border border-[rgba(148,163,184,0.18)] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#F8FAFC]">Desmond Hinds, Founder</div>
                      <div className="text-[10px] text-[#D4A843]">Senior Tax Strategist</div>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-[#A9B7C8] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={requestFounder} 
                        onChange={(e) => setRequestFounder(e.target.checked)} 
                        className="rounded accent-[#D4A843] h-4 w-4"
                      />
                      <span>Request</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="intake-date" className="block text-xs font-semibold text-[#A9B7C8]">
                    Date
                  </label>
                  <BrandedDatePicker
                    id="intake-date"
                    value={selectedDate}
                    minDate={new Date().toISOString().slice(0, 10)}
                    onChange={setSelectedDate}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="intake-time" className="block text-xs font-semibold text-[#A9B7C8]">
                    Preferred time
                  </label>
                  <select
                    id="intake-time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full min-h-[44px] bg-[#102D4F] border border-[rgba(148,163,184,0.18)] rounded-xl px-3.5 py-2.5 text-xs text-[#F8FAFC] focus:outline-none focus:border-[#D4A843]"
                  >
                    {availableTimes.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Client Contact Details */}
              <div className="space-y-4 pt-4 border-t border-[rgba(148,163,184,0.18)]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label htmlFor="intake-name" className="block text-[#A9B7C8] font-semibold mb-1">
                      Full Name <span className="text-[#D4A843]">*</span>
                    </label>
                    <input
                      id="intake-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full min-h-[44px] bg-[#102D4F] border border-[rgba(148,163,184,0.18)] rounded-xl px-3 py-2 text-[#F8FAFC] placeholder-[#7F91A6] focus:outline-none focus:border-[#D4A843]"
                    />
                  </div>

                  <div>
                    <label htmlFor="intake-email" className="block text-[#A9B7C8] font-semibold mb-1">
                      Email Address <span className="text-[#D4A843]">*</span>
                    </label>
                    <input
                      id="intake-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full min-h-[44px] bg-[#102D4F] border border-[rgba(148,163,184,0.18)] rounded-xl px-3 py-2 text-[#F8FAFC] placeholder-[#7F91A6] focus:outline-none focus:border-[#D4A843]"
                    />
                  </div>

                  <div>
                    <label htmlFor="intake-phone" className="block text-[#A9B7C8] font-semibold mb-1">
                      Phone Number <span className="text-[#D4A843]">*</span>
                    </label>
                    <input
                      id="intake-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 803-555-0123"
                      className="w-full min-h-[44px] bg-[#102D4F] border border-[rgba(148,163,184,0.18)] rounded-xl px-3 py-2 text-[#F8FAFC] placeholder-[#7F91A6] focus:outline-none focus:border-[#D4A843]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="intake-notes" className="block text-xs text-[#A9B7C8] font-semibold mb-1">
                    What would you like to discuss? (optional)
                  </label>
                  <textarea
                    id="intake-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Briefly state your tax questions, entity types, or filing goals..."
                    className="w-full bg-[#102D4F] border border-[rgba(148,163,184,0.18)] rounded-xl p-3 text-xs text-[#F8FAFC] placeholder-[#7F91A6] focus:outline-none focus:border-[#D4A843]"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-[rgba(148,163,184,0.18)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-[#7F91A6]">
                  <ShieldCheck className="w-4 h-4 text-[#D4A843]" />
                  <span>Confidential intake session.</span>
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors shadow-sm"
                >
                  Book Consultation
                </button>
              </div>

            </form>
          ) : (
            <div className="p-8 rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="font-serif text-xl font-bold text-[#F8FAFC]">
                  Consultation Request Received
                </h3>
                <p className="text-xs text-[#A9B7C8] max-w-md mx-auto">
                  Thank you, <strong className="text-[#F8FAFC]">{name}</strong>. A tax specialist has received your request and will contact you via {email} or {phone} to confirm your appointment.
                </p>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="text-xs font-semibold text-[#D4A843] hover:text-[#E1BB60] underline"
                >
                  Book another session
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
export default BookConsultationPage;
