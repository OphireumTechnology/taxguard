import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  Phone, 
  Building2, 
  CheckCircle2, 
  User, 
  ShieldCheck, 
  MapPin, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { LiveCalendarModule } from '../calendar/LiveCalendarModule';

export const BookConsultationPage: React.FC = () => {
  const { bookAppointment, currentUser, setCurrentPage } = useApp();
  const [bookingMode, setBookingMode] = useState<'live_calendar' | 'fast_form'>('live_calendar');

  const [serviceType, setServiceType] = useState('Individual Tax Strategy & Year-End Planning');
  const [consultationType, setConsultationType] = useState<'virtual' | 'phone' | 'in_office'>('virtual');
  const [requestFounder, setRequestFounder] = useState(true);
  const [selectedDate, setSelectedDate] = useState('2026-09-16');
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
    <div className="space-y-16 pb-20 text-slate-100">
      
      {/* Header Banner */}
      <section className="relative pt-12 pb-14 border-b border-[#1E3A5F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Confidential Advisory • Columbia, SC</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-extrabold text-white">
            Schedule a Consultation
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Reserve a dedicated strategy session with Founder Desmond Hinds or our senior tax specialists. 
            Select your preferred consultation medium and appointment time below.
          </p>
        </div>
      </section>

      {/* Booking Mode Switcher */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-[#0D2340] border border-[#1E3A5F]">
          <button
            type="button"
            onClick={() => setBookingMode('live_calendar')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              bookingMode === 'live_calendar'
                ? 'bg-[#C6A15B] text-[#07172B] shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Interactive Live Calendar & Slot Locks</span>
          </button>
          <button
            type="button"
            onClick={() => setBookingMode('fast_form')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              bookingMode === 'fast_form'
                ? 'bg-[#C6A15B] text-[#07172B] shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Express Intake Form</span>
          </button>
        </div>
      </div>

      {bookingMode === 'live_calendar' ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LiveCalendarModule />
        </section>
      ) : (
        /* Main Form or Confirmation */
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="p-8 sm:p-10 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl space-y-8">
            
            {/* 1. Consultation Medium */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#C6A15B]">
                Step 1: Choose Consultation Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: 'virtual', label: 'Virtual Meeting', sub: 'Google Meet Video', icon: Video },
                  { id: 'phone', label: 'Phone Consultation', sub: 'Direct Call to You', icon: Phone },
                  { id: 'in_office', label: 'In-Office Meeting', sub: 'Columbia, SC Office', icon: Building2 },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setConsultationType(type.id as any)}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      consultationType === type.id
                        ? 'bg-[#07172B] border-[#C6A15B] ring-1 ring-[#C6A15B]'
                        : 'bg-[#07172B]/60 border-[#1E3A5F] hover:border-slate-500'
                    }`}
                  >
                    <type.icon className="w-5 h-5 text-[#C6A15B] mb-2" />
                    <div>
                      <div className="text-xs font-bold text-white">{type.label}</div>
                      <div className="text-[11px] text-slate-400">{type.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Service & Specialist Preference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#C6A15B]">
                  Step 2: Service Focus
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#C6A15B]"
                >
                  <option value="Individual Tax Strategy & Year-End Planning">Individual Tax Strategy (Form 1040)</option>
                  <option value="Business Entity Filings (S-Corp / LLC / 1120-S)">Business Entity Filings (S-Corp / LLC)</option>
                  <option value="Monthly Bookkeeping & Financial Organization">Monthly Bookkeeping & Accounting</option>
                  <option value="Prior-Year Back Taxes & IRS Transcript Audit">Prior-Year Back Taxes / IRS Transcripts</option>
                  <option value="Financial Protection & Estate Coordination">Financial Protection & Estate Coordination</option>
                  <option value="Credit Solutions & Financial Consultation">Credit & Financial Consultation</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#C6A15B]">
                  Specialist Preference
                </label>
                <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Desmond Hinds, Founder</div>
                    <div className="text-[10px] text-[#C6A15B]">Senior Tax Strategist</div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={requestFounder} 
                      onChange={(e) => setRequestFounder(e.target.checked)} 
                      className="rounded accent-[#C6A15B] h-4 w-4"
                    />
                    <span>Request Directly</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 3. Date & Time Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#C6A15B]">
                Step 3: Choose Date & Available Slot
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="booking-date" className="block text-[11px] text-slate-400 mb-1">Appointment Date (Mon-Fri)</label>
                  <input
                    id="booking-date"
                    type="date"
                    value={selectedDate}
                    min="2026-09-09"
                    max="2026-12-31"
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] focus:border-[#C6A15B]"
                  />
                </div>

                <div>
                  <label htmlFor="booking-time" className="block text-[11px] text-slate-400 mb-1">Available Eastern Time (EST) Slot</label>
                  <select
                    id="booking-time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] focus:border-[#C6A15B]"
                  >
                    {availableTimes.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#C6A15B]" />
                <span>Firm business hours: Monday–Friday, 9:00 AM–6:00 PM Eastern Time.</span>
              </div>
            </div>

            {/* 4. Client Contact Details */}
            <div className="space-y-4 pt-4 border-t border-[#1E3A5F]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#C6A15B]">
                Step 4: Your Contact Information
              </label>

              {/* Sensitive Information Warning Banner */}
              <div className="p-3.5 rounded-xl bg-[#07172B] border border-amber-500/40 text-xs text-amber-200/90 space-y-1">
                <strong className="text-white block font-semibold">Important Privacy &amp; Data Notice:</strong>
                <p>
                  Please do not submit Social Security numbers, tax documents, banking information, or other sensitive personal information through this form. Existing clients should use the{' '}
                  <button
                    type="button"
                    onClick={() => setCurrentPage('client_portal')}
                    className="text-[#C6A15B] underline hover:text-[#E2BD67] font-semibold"
                  >
                    secure client portal
                  </button>.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label htmlFor="booking-name" className="block text-slate-300 font-semibold mb-1">
                    Full Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="booking-name"
                    type="text"
                    required
                    aria-required="true"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] focus:border-[#C6A15B]"
                  />
                </div>

                <div>
                  <label htmlFor="booking-email" className="block text-slate-300 font-semibold mb-1">
                    Email Address <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="booking-email"
                    type="email"
                    required
                    aria-required="true"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] focus:border-[#C6A15B]"
                  />
                </div>

                <div>
                  <label htmlFor="booking-phone" className="block text-slate-300 font-semibold mb-1">
                    Phone Number <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="booking-phone"
                    type="tel"
                    required
                    aria-required="true"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 803-555-0123"
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] focus:border-[#C6A15B]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="booking-notes" className="block text-xs text-slate-300 font-semibold mb-1">
                  Briefly Explain Your Goals or Filing Needs (Optional)
                </label>
                <textarea
                  id="booking-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., S-Corp election for 2026, W-2 plus rental property deductions, multi-state filing questions..."
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#C6A15B] focus:border-[#C6A15B]"
                />
              </div>

              {/* Engagement Letter Disclaimer */}
              <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] text-[11px] text-slate-400 leading-relaxed">
                <strong>No Professional Relationship Created:</strong> Submitting this consultation request does not establish an accountant-client relationship. A professional engagement commences only upon the mutual execution of a formal written engagement letter specifying services and terms.
              </div>
            </div>

            {/* Submit CTA */}
            <div className="pt-4 border-t border-[#1E3A5F] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-[#C6A15B]" />
                <span>Encrypted booking. No payment required for initial intake.</span>
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all shadow-xl"
              >
                Confirm Appointment Request
              </button>
            </div>

          </form>
        ) : (
          <div className="p-10 rounded-3xl bg-[#0D2340] border border-[#C6A15B]/50 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#C6A15B]">
                Consultation Confirmed
              </span>
              <h2 className="font-serif text-3xl font-bold text-white">
                We Look Forward to Speaking With You!
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Your consultation has been reserved for <strong className="text-white">{selectedDate}</strong> at <strong className="text-white">{selectedTime}</strong> with <strong className="text-[#C6A15B]">{requestFounder ? 'Desmond Hinds' : 'our Senior Tax Team'}</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#07172B] border border-[#1E3A5F] max-w-md mx-auto text-left text-xs space-y-2 text-slate-300">
              <div><strong>Format:</strong> {consultationType === 'virtual' ? 'Virtual Google Meet' : consultationType === 'phone' ? 'Direct Telephone Call' : 'Executive Suite in Columbia, SC'}</div>
              <div><strong>Client Name:</strong> {name}</div>
              <div><strong>Email:</strong> {email}</div>
              <div><strong>Status:</strong> Confirmed & Synchronized with Calendar</div>
            </div>

            <div className="pt-4 flex flex-wrap justify-center gap-4">
              <button
                onClick={() => setCurrentPage('client_portal')}
                className="px-6 py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A]"
              >
                View in Client Portal
              </button>
              <button
                onClick={() => setIsSubmitted(false)}
                className="px-6 py-3 rounded-xl font-semibold text-xs text-slate-300 hover:text-white border border-[#1E3A5F]"
              >
                Book Another Time
              </button>
            </div>
          </div>
        )}
        </section>
      )}

    </div>
  );
};
