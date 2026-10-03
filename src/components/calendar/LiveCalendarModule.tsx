/**
 * A/R TAX SERVICES, LLC - Live Availability & Consultation Scheduling Engine
 * Production-ready component covering:
 * - Real-time availability calculation with buffer & holiday awareness
 * - 10-minute atomic concurrency slot holding
 * - Executive founder sessions & standard consultation tracks
 * - Multi-modality meeting selection (Video, Phone, Office)
 * - Reschedule and cancellation workflows
 * - Canonical dark navy & gold design system
 */

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  Phone, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  User, 
  X, 
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  AppointmentTypeCode, 
  AvailableTimeSlot, 
  CalendarConnection 
} from '../../types/calendar';
import { BrandedSelect, BrandedSelectOption } from '../ui/BrandedSelect';
import { BrandedButton } from '../ui/BrandedButton';
import { BrandedDatePicker } from '../ui/BrandedDatePicker';
import { getStoredToken } from '../../services/api';

const APPOINTMENT_TYPES: Array<{
  code: AppointmentTypeCode;
  title: string;
  duration: number;
  price: number;
  depositRequired: boolean;
  founderOnly?: boolean;
}> = [
  { code: 'new_client_consultation', title: 'New Client Consultation', duration: 30, price: 0, depositRequired: false },
  { code: 'founder_consultation', title: 'Founder Executive Consultation (Desmond Hinds)', duration: 45, price: 150, depositRequired: true, founderOnly: true },
  { code: 'individual_tax_consultation', title: 'Individual Tax Consultation (Form 1040)', duration: 30, price: 0, depositRequired: false },
  { code: 'business_tax_consultation', title: 'Business Tax Consultation (1120-S/LLC)', duration: 45, price: 0, depositRequired: false },
  { code: 'tax_planning_session', title: 'Strategic Tax Planning & Advisory Session', duration: 60, price: 250, depositRequired: true },
  { code: 'bookkeeping_consultation', title: 'Monthly Bookkeeping & Ledger Maintenance', duration: 30, price: 0, depositRequired: false },
  { code: 'payroll_consultation', title: 'Payroll Compliance & W-2/941 Advisory', duration: 30, price: 0, depositRequired: false },
  { code: 'irs_notice_consultation', title: 'IRS / State Audit Notice Resolution', duration: 45, price: 150, depositRequired: true },
  { code: 'accounting_software_setup', title: 'Accounting Software Setup (QBO/Xero)', duration: 60, price: 200, depositRequired: false },
  { code: 'document_review', title: 'Tax Document Review Meeting', duration: 30, price: 0, depositRequired: false },
  { code: 'return_review', title: 'Form 8879 & Tax Return Final Review', duration: 45, price: 0, depositRequired: false },
  { code: 'follow_up_meeting', title: 'Engagement Follow-Up Meeting', duration: 30, price: 0, depositRequired: false },
  { code: 'internal_staff_meeting', title: 'Internal Staff Quality Review', duration: 30, price: 0, depositRequired: false }
];

export interface LiveCalendarModuleProps {
  embedded?: boolean;
}

function formatFriendlyDate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return isoDate;
}

function formatFriendlyMonthDay(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }
  return isoDate;
}

export const LiveCalendarModule: React.FC<LiveCalendarModuleProps> = ({ embedded = false }) => {
  const { currentUser, setCurrentPage } = useApp();
  const [activeTab, setActiveTab] = useState<'book' | 'my_appointments' | 'sync' | 'founder' | 'admin'>('book');

  // Booking state
  const [selectedServiceCode, setSelectedServiceCode] = useState<AppointmentTypeCode>('new_client_consultation');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [availableSlots, setAvailableSlots] = useState<AvailableTimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableTimeSlot | null>(null);
  const [meetingType, setMeetingType] = useState<'virtual' | 'telephone' | 'in_office'>('virtual');
  const [clientNotes, setClientNotes] = useState('');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Concurrency Slot Hold
  const [heldSlotKey, setHeldSlotKey] = useState<string | null>(null);
  const [holdCountdown, setHoldCountdown] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Appointments List
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  // Reschedule / Cancel Modal
  const [rescheduleModalApt, setRescheduleModalApt] = useState<any | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [newRescheduleTime, setNewRescheduleTime] = useState('10:00');
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Calendar Sync Connections
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // Founder Controls (Desmond Hinds)
  const [founderControls, setFounderControls] = useState<any>({
    acceptsNewClients: true,
    existingClientsOnly: false,
    referralRequired: false,
    adminApprovalRequired: false,
    paidConsultationRequired: true,
    consultationFeeCents: 15000,
    maxMeetingsPerDay: 5
  });
  const [isSavingFounderControls, setIsSavingFounderControls] = useState(false);

  // Admin Overview
  const [adminOverview, setAdminOverview] = useState<any | null>(null);

  const isStaffOrAdmin = currentUser && ['accountant', 'reviewer', 'senior_reviewer', 'founder', 'administrator', 'super_administrator', 'admin'].includes(currentUser.role);
  const isFounder = currentUser && (currentUser.role === 'founder' || currentUser.id === 'user_accountant_desmond');
  const isAdmin = currentUser && ['administrator', 'super_administrator', 'admin'].includes(currentUser.role);

  // Load available slots
  useEffect(() => {
    if (activeTab === 'book' && selectedDate) {
      loadSlots();
    }
  }, [selectedDate, selectedServiceCode, activeTab]);

  // Load appointments
  useEffect(() => {
    if (activeTab === 'my_appointments' || activeTab === 'admin') {
      loadAppointments();
    }
    if (activeTab === 'sync' && isStaffOrAdmin) {
      loadConnections();
    }
    if (activeTab === 'founder' && (isFounder || isAdmin)) {
      loadFounderControls();
    }
    if (activeTab === 'admin' && isAdmin) {
      loadAdminOverview();
    }
  }, [activeTab]);

  // Hold countdown
  useEffect(() => {
    if (!holdCountdown) return;
    const interval = setInterval(() => {
      setHoldCountdown(prev => {
        if (!prev || prev <= 1) {
          clearInterval(interval);
          setHeldSlotKey(null);
          setSelectedSlot(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [holdCountdown]);

  const loadSlots = async () => {
    try {
      setIsLoadingSlots(true);
      setBookingError(null);
      const token = getStoredToken();
      const res = await fetch(`/api/calendar/available-slots?date=${encodeURIComponent(selectedDate)}&serviceTypeCode=${encodeURIComponent(selectedServiceCode)}${selectedServiceObj?.founderOnly ? '&requestedFounder=true' : ''}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.availableSlots || data.slots || []);
      } else {
        setAvailableSlots([]);
      }
    } catch {
      setAvailableSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleNextAvailableDay = async () => {
    try {
      setIsLoadingSlots(true);
      setBookingError(null);
      const token = getStoredToken();
      const res = await fetch(`/api/calendar/next-available?date=${encodeURIComponent(selectedDate)}&serviceTypeCode=${encodeURIComponent(selectedServiceCode)}${selectedServiceObj?.founderOnly ? '&requestedFounder=true' : ''}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.date) {
          setSelectedDate(data.date);
          setAvailableSlots(data.availableSlots || data.slots || []);
          setSelectedSlot(null);
          setHeldSlotKey(null);
          return;
        }
      }
      // If no slot found in 30-day lookahead or on error, fallback to advancing 1 calendar day
      const next = new Date(selectedDate);
      next.setDate(next.getDate() + 1);
      setSelectedDate(next.toISOString().slice(0, 10));
    } catch {
      const next = new Date(selectedDate);
      next.setDate(next.getDate() + 1);
      setSelectedDate(next.toISOString().slice(0, 10));
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const loadAppointments = async () => {
    try {
      setIsLoadingAppointments(true);
      const token = getStoredToken();
      const res = await fetch('/api/calendar/appointments', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      }
    } catch {
      setAppointments([]);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  const loadConnections = async () => {
    try {
      const token = getStoredToken();
      const res = await fetch('/api/calendar/connections', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch {
      // Graceful error handling
    }
  };

  const loadFounderControls = async () => {
    try {
      const token = getStoredToken();
      const res = await fetch('/api/calendar/founder-controls', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setFounderControls(data.controls || {});
      }
    } catch {
      // Graceful error handling
    }
  };

  const loadAdminOverview = async () => {
    try {
      const token = getStoredToken();
      const res = await fetch('/api/calendar/firm-overview', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminOverview(data);
      }
    } catch {
      // Graceful error handling
    }
  };

  // Hold Slot (10-minute concurrency lock)
  const handleHoldSlot = async (slot: AvailableTimeSlot) => {
    try {
      setIsHolding(true);
      setBookingError(null);
      const token = getStoredToken();
      const idempotencyKey = `hold_${slot.slotKey}_${Date.now()}`;

      const res = await fetch('/api/calendar/hold-slot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({
          staffId: slot.staffId,
          startUtc: slot.startUtc,
          endUtc: slot.endUtc,
          serviceType: selectedServiceCode,
          idempotencyKey
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'This slot is no longer available.');
      }

      setSelectedSlot(slot);
      setHeldSlotKey(slot.slotKey);
      setHoldCountdown(600);
    } catch (err: any) {
      setBookingError(err.message || 'We could not reserve this time. Please try another.');
    } finally {
      setIsHolding(false);
    }
  };

  // Confirm Booking
  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    try {
      setIsHolding(true);
      setBookingError(null);
      const token = getStoredToken();

      const res = await fetch('/api/calendar/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({
          slotKey: selectedSlot.slotKey,
          staffId: selectedSlot.staffId,
          date: selectedDate,
          timeSlot: selectedSlot.clientLocalDisplay.split(' ')[0],
          serviceTypeCode: selectedServiceCode,
          meetingType,
          notes: clientNotes
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'We could not complete your booking. Please try again.');
      }

      const data = await res.json();
      setBookingSuccess(data.appointment);
      setHeldSlotKey(null);
      setHoldCountdown(null);
      setSelectedSlot(null);
      loadAppointments();
    } catch (err: any) {
      setBookingError(err.message || 'Booking could not be finalized. Please try again.');
    } finally {
      setIsHolding(false);
    }
  };

  // Connect Provider
  const handleConnectProvider = async (provider: 'google_calendar' | 'microsoft_outlook') => {
    try {
      setIsConnecting(true);
      const token = getStoredToken();
      const res = await fetch('/api/calendar/connect-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({ provider })
      });
      if (res.ok) {
        await loadConnections();
      }
    } catch {
      // Graceful error
    } finally {
      setIsConnecting(false);
    }
  };

  // Reschedule
  const handleRescheduleSubmit = async () => {
    if (!rescheduleModalApt) return;
    try {
      const token = getStoredToken();
      const res = await fetch('/api/calendar/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({
          appointmentId: rescheduleModalApt.id,
          newDate: newRescheduleDate,
          newTimeSlot: newRescheduleTime,
          reason: rescheduleReason
        })
      });
      if (res.ok) {
        setRescheduleModalApt(null);
        loadAppointments();
      } else {
        const err = await res.json();
        setBookingError(err.error || 'Unable to reschedule.');
      }
    } catch {
      setBookingError('Error during reschedule. Please try again.');
    }
  };

  // Cancel
  const handleCancelAppointment = async (aptId: string) => {
    if (!window.confirm('Are you sure you want to cancel this consultation? Your time slot will be released.')) return;
    try {
      const token = getStoredToken();
      const res = await fetch('/api/calendar/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({ appointmentId: aptId, reason: 'Client schedule conflict' })
      });
      if (res.ok) {
        loadAppointments();
      }
    } catch {
      // Graceful error
    }
  };

  // Save Founder Controls
  const handleSaveFounderControls = async () => {
    try {
      setIsSavingFounderControls(true);
      const token = getStoredToken();
      const res = await fetch('/api/calendar/founder-controls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({ controls: founderControls })
      });
      if (res.ok) {
        alert('Founder availability controls updated successfully.');
      }
    } catch {
      alert('Failed to save controls.');
    } finally {
      setIsSavingFounderControls(false);
    }
  };

  const selectedServiceObj = APPOINTMENT_TYPES.find(t => t.code === selectedServiceCode);

  const appointmentOptions: BrandedSelectOption[] = APPOINTMENT_TYPES.map(srv => ({
    value: srv.code,
    label: srv.title,
    badge: srv.price > 0 ? `$${srv.price}` : 'Complimentary',
    description: `${srv.duration} minutes ${srv.founderOnly ? '• Led by Desmond Hinds, Founder' : '• Certified Tax Professional'}`
  }));

  const meetingOptions = [
    { id: 'virtual', title: 'Video Meeting', sub: 'Google Meet Video', icon: Video },
    { id: 'telephone', title: 'Phone Call', sub: 'Direct phone outbound', icon: Phone },
    { id: 'in_office', title: 'Office Visit', sub: 'Columbia, SC Executive Office', icon: Building2 },
  ];

  const friendlySelectedDate = formatFriendlyDate(selectedDate);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner - shown only if not embedded inside BookConsultationPage */}
      {!embedded && (
        <div className="bg-[#0D2745] text-[#F8FAFC] rounded-2xl p-6 md:p-8 border border-[rgba(148,163,184,0.18)] relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[rgba(212,168,67,0.10)] border border-[rgba(212,168,67,0.40)] text-[#D4A843] text-xs font-semibold mb-3">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Live Availability</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold font-serif text-[#F8FAFC]">
                Schedule a Consultation
              </h1>
              <p className="text-[#A9B7C8] text-sm mt-1 max-w-2xl">
                Choose an available time for your consultation.
              </p>
            </div>

            {/* Role Tab Navigation */}
            <div className="flex items-center space-x-1.5 bg-[#071A2E] p-1.5 rounded-xl border border-[rgba(148,163,184,0.18)] text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('book')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'book' ? 'bg-[#D4A843] text-[#06182B] shadow-xs' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
                }`}
              >
                Book Session
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('my_appointments')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'my_appointments' ? 'bg-[#D4A843] text-[#06182B] shadow-xs' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
                }`}
              >
                Appointments
              </button>
              {isStaffOrAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('sync')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    activeTab === 'sync' ? 'bg-[#D4A843] text-[#06182B] shadow-xs' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
                  }`}
                >
                  Calendar Sync
                </button>
              )}
              {(isFounder || isAdmin) && (
                <button
                  type="button"
                  onClick={() => setActiveTab('founder')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    activeTab === 'founder' ? 'bg-[#D4A843] text-[#06182B] shadow-xs' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
                  }`}
                >
                  Founder Controls
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    activeTab === 'admin' ? 'bg-[#D4A843] text-[#06182B] shadow-xs' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
                  }`}
                >
                  Admin Overview
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff tab navigation if embedded but user is staff */}
      {embedded && isStaffOrAdmin && (
        <div className="flex items-center space-x-1.5 bg-[#0D2745] p-1.5 rounded-xl border border-[rgba(148,163,184,0.18)] text-xs max-w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('book')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'book' ? 'bg-[#D4A843] text-[#06182B]' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
            }`}
          >
            Book Session
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my_appointments')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'my_appointments' ? 'bg-[#D4A843] text-[#06182B]' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
            }`}
          >
            Appointments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'sync' ? 'bg-[#D4A843] text-[#06182B]' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
            }`}
          >
            Calendar Sync
          </button>
          {(isFounder || isAdmin) && (
            <button
              type="button"
              onClick={() => setActiveTab('founder')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'founder' ? 'bg-[#D4A843] text-[#06182B]' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
              }`}
            >
              Founder Controls
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'admin' ? 'bg-[#D4A843] text-[#06182B]' : 'text-[#A9B7C8] hover:text-[#F8FAFC]'
              }`}
            >
              Admin Overview
            </button>
          )}
        </div>
      )}

      {/* SUCCESS CONFIRMATION BANNER */}
      {bookingSuccess && (
        <div className="p-6 bg-[#0D2745] border border-emerald-500/40 rounded-2xl text-[#F8FAFC] space-y-4 shadow-xl">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
            <div>
              <h3 className="font-bold text-base text-[#F8FAFC]">Consultation Confirmed</h3>
              <p className="text-xs text-[#A9B7C8]">
                Reference Code: <strong className="font-mono text-[#D4A843]">{bookingSuccess.referenceCode}</strong>
              </p>
            </div>
          </div>

          <div className="p-4 bg-[#102D4F] rounded-xl border border-[rgba(148,163,184,0.18)] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[#7F91A6] block">Date &amp; Time</span>
              <span className="font-bold text-[#F8FAFC]">{formatFriendlyDate(bookingSuccess.date)} at {bookingSuccess.timeSlot}</span>
            </div>
            <div>
              <span className="text-[#7F91A6] block">Assigned Advisor</span>
              <span className="font-bold text-[#F8FAFC]">{bookingSuccess.accountantName}</span>
            </div>
            <div>
              <span className="text-[#7F91A6] block">Meeting Format</span>
              {bookingSuccess.virtualMeetingUrl ? (
                <a
                  href={bookingSuccess.virtualMeetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[#D4A843] underline hover:text-[#E1BB60] flex items-center space-x-1"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Join Google Meet</span>
                </a>
              ) : (
                <span className="font-bold text-[#F8FAFC]">{bookingSuccess.officeLocationAddress || 'Direct Telephone'}</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBookingSuccess(null)}
            className="text-xs font-semibold text-[#D4A843] hover:text-[#E1BB60] underline"
          >
            Close confirmation
          </button>
        </div>
      )}

      {/* TAB 1: BOOKING WORKFLOW */}
      {activeTab === 'book' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,36%)_minmax(0,1fr)] gap-6 items-start">
          {/* Left Column: Appointment Details Panel */}
          <div className="bg-[rgba(13,39,69,0.94)] backdrop-blur-xs bg-[#0D2745] rounded-2xl p-6 sm:p-7 border border-[rgba(148,163,184,0.18)] text-[#F8FAFC] space-y-5 shadow-xl">
            <h2 className="text-base font-bold text-[#F8FAFC] font-serif border-b border-[rgba(148,163,184,0.18)] pb-3">
              Appointment Details
            </h2>

            {/* 1. Consultation Type */}
            <div>
              <label className="block text-xs font-semibold text-[#A9B7C8] mb-1.5">
                Consultation type
              </label>
              <BrandedSelect
                id="consultation-service-selector"
                options={appointmentOptions}
                value={selectedServiceCode}
                onChange={val => {
                  setSelectedServiceCode(val as any);
                  setSelectedSlot(null);
                  setHeldSlotKey(null);
                }}
                variant="dark"
                searchable
              />
            </div>

            {selectedServiceObj?.founderOnly && (
              <div className="p-3 bg-[rgba(212,168,67,0.10)] border border-[rgba(212,168,67,0.40)] rounded-xl text-[#F8FAFC] text-xs leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-[#D4A843] inline mr-1.5" />
                <strong className="text-[#D4A843]">Founder Consultation:</strong> Executive session led by Desmond Hinds, Founder &amp; Senior Managing Accountant.
              </div>
            )}

            {/* 2. Date */}
            <div>
              <label htmlFor="consultation-date-input" className="block text-xs font-semibold text-[#A9B7C8] mb-1.5">
                Date
              </label>
              <BrandedDatePicker
                id="consultation-date-input"
                value={selectedDate}
                minDate={new Date().toISOString().slice(0, 10)}
                onChange={newDate => {
                  setSelectedDate(newDate);
                  setSelectedSlot(null);
                  setHeldSlotKey(null);
                }}
              />
            </div>

            {/* 3. Meeting Modality */}
            <div>
              <label className="block text-xs font-semibold text-[#A9B7C8] mb-2">
                How would you like to meet?
              </label>
              <div className="space-y-2">
                {meetingOptions.map(m => {
                  const Icon = m.icon;
                  const isSelected = meetingType === m.id;
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                        isSelected
                          ? 'border-[rgba(212,168,67,0.80)] bg-[rgba(212,168,67,0.12)] text-[#F8FAFC] shadow-xs'
                          : 'border-[rgba(148,163,184,0.18)] bg-[#102D4F] text-[#A9B7C8] hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="modality"
                        checked={isSelected}
                        onChange={() => setMeetingType(m.id as any)}
                        className="hidden"
                      />
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#D4A843]' : 'text-[#7F91A6]'}`} />
                        <div>
                          <div className={`font-semibold ${isSelected ? 'text-[#F8FAFC]' : 'text-slate-200'}`}>
                            {m.title}
                          </div>
                          <div className="text-[10px] text-[#7F91A6]">{m.sub}</div>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#D4A843] shrink-0" />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. Notes */}
            <div>
              <label htmlFor="consultation-notes-input" className="block text-xs font-semibold text-[#A9B7C8] mb-1.5">
                What would you like to discuss? (optional)
              </label>
              <textarea
                id="consultation-notes-input"
                rows={2}
                placeholder="Briefly state your primary tax question or filing needs..."
                value={clientNotes}
                onChange={e => setClientNotes(e.target.value)}
                className="w-full p-3 rounded-xl text-xs bg-[#102D4F] border border-[rgba(148,163,184,0.18)] text-[#F8FAFC] placeholder-[#7F91A6] focus:border-[#D4A843] outline-none transition-all"
              />
            </div>
          </div>

          {/* Right Column: Available Times Panel */}
          <div className="bg-[rgba(13,39,69,0.94)] backdrop-blur-xs bg-[#0D2745] rounded-2xl p-6 sm:p-7 border border-[rgba(148,163,184,0.18)] text-[#F8FAFC] flex flex-col justify-between space-y-6 shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-[rgba(148,163,184,0.18)] pb-4 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC] font-serif">Available times</h2>
                  <p className="text-xs text-[#A9B7C8] mt-0.5">
                    Choose a time that works for you • <span className="text-[#D4A843] font-medium">{friendlySelectedDate}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadSlots}
                  disabled={isLoadingSlots}
                  className="p-2 text-[#A9B7C8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#102D4F] transition-colors"
                  title="Refresh slots"
                  aria-label="Refresh availability"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingSlots ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Temporary Hold Banner */}
              {heldSlotKey && holdCountdown && (
                <div className="mb-4 flex items-center justify-between bg-[rgba(212,168,67,0.10)] border border-[rgba(212,168,67,0.40)] text-[#F8FAFC] px-4 py-2.5 rounded-xl text-xs font-semibold">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-[#D4A843]" />
                    <span>
                      Time Reserved: <strong>{selectedSlot?.clientLocalDisplay}</strong> ({selectedSlot?.staffName})
                    </span>
                  </div>
                  <div className="font-mono bg-[#071A2E] px-2.5 py-1 rounded-lg text-[#D4A843] text-xs font-bold border border-[rgba(148,163,184,0.18)]">
                    Hold: {Math.floor(holdCountdown / 60)}:{(holdCountdown % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              )}

              {bookingError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/40 text-red-200 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-medium">{bookingError}</span>
                </div>
              )}

              {isLoadingSlots ? (
                <div className="py-12 text-center text-[#A9B7C8] text-xs flex flex-col items-center space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#D4A843]" />
                  <span className="font-medium">Checking available times...</span>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="py-12 px-6 text-center rounded-2xl border border-[rgba(148,163,184,0.14)] bg-[#102D4F]/60 flex flex-col items-center justify-center space-y-3 min-h-[260px]">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-1 border border-[rgba(212,168,67,0.30)] bg-[rgba(212,168,67,0.10)] text-[#D4A843]">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-[#F8FAFC]">
                    No times available on {formatFriendlyMonthDay(selectedDate)}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A9B7C8] max-w-md leading-relaxed">
                    Choose another date or view the next available day.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleNextAvailableDay}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors"
                    >
                      Next available day
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const dateInput = document.getElementById('consultation-date-input') as HTMLButtonElement | null;
                        dateInput?.focus();
                        dateInput?.click();
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-[#F8FAFC] bg-[#143657] border border-[rgba(148,163,184,0.18)] hover:border-[#D4A843]/50 transition-colors"
                    >
                      Choose another date
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {availableSlots.map(slot => {
                    const isSelected = selectedSlot?.slotKey === slot.slotKey || heldSlotKey === slot.slotKey;
                    return (
                      <button
                        key={slot.slotKey}
                        type="button"
                        disabled={isHolding}
                        onClick={() => handleHoldSlot(slot)}
                        className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-[rgba(212,168,67,0.80)] bg-[rgba(212,168,67,0.14)] text-[#F8FAFC] shadow-sm ring-1 ring-[#D4A843]'
                            : 'bg-[#102D4F] border-[rgba(148,163,184,0.18)] hover:border-[rgba(212,168,67,0.40)] text-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs sm:text-sm text-[#F8FAFC]">{slot.clientLocalDisplay}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#D4A843]" />}
                        </div>
                        <div className="text-[10px] text-[#A9B7C8] mt-1 truncate">
                          {slot.staffName}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Action Section */}
            <div className="pt-4 border-t border-[rgba(148,163,184,0.18)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#A9B7C8]">
                {selectedSlot ? (
                  <span>
                    Selected: <strong className="text-[#F8FAFC]">{selectedSlot.clientLocalDisplay}</strong> with <strong className="text-[#F8FAFC]">{selectedSlot.staffName}</strong>
                  </span>
                ) : (
                  <span>Select an available time to continue.</span>
                )}
              </div>

              <BrandedButton
                variant="primary"
                size="md"
                disabled={!selectedSlot || isHolding}
                disabledReason={!selectedSlot ? "Please select an available consultation slot above" : undefined}
                isLoading={isHolding}
                onClick={handleConfirmBooking}
                icon={<Check className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Confirm Appointment
              </BrandedButton>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY APPOINTMENTS */}
      {activeTab === 'my_appointments' && (
        <div className="bg-[#0D2745] rounded-2xl p-6 border border-[rgba(148,163,184,0.18)] text-[#F8FAFC] space-y-4">
          <div className="border-b border-[rgba(148,163,184,0.18)] pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC] font-serif">Scheduled Appointments</h2>
              <p className="text-xs text-[#A9B7C8]">Your upcoming and historic consultations.</p>
            </div>
            <button
              type="button"
              onClick={loadAppointments}
              className="p-2 text-[#A9B7C8] hover:text-[#F8FAFC] rounded-lg hover:bg-[#102D4F] transition-colors"
              title="Refresh appointments"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingAppointments ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {appointments.length === 0 ? (
            <div className="py-10 px-6 text-center rounded-2xl border border-[rgba(148,163,184,0.18)] bg-[#102D4F] flex flex-col items-center justify-center space-y-3">
              <CalendarIcon className="w-8 h-8 text-[#D4A843] mb-1" />
              <h3 className="font-serif text-base font-bold text-[#F8FAFC]">No Scheduled Consultations</h3>
              <p className="text-xs text-[#A9B7C8] max-w-sm">
                You do not have any active appointments booked at this time.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('book')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors mt-2"
              >
                Book a Session
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map(apt => (
                <div key={apt.id} className="p-4 rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#102D4F] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-[#F8FAFC]">{apt.serviceType}</span>
                      <span className="text-[10px] font-mono bg-[#071A2E] px-2 py-0.5 rounded text-[#D4A843] border border-[rgba(148,163,184,0.18)] font-semibold">
                        {apt.referenceCode || apt.id}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        apt.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {apt.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 text-xs text-[#A9B7C8]">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-[#D4A843]" />
                        <span>{formatFriendlyDate(apt.date)} at {apt.timeSlot}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <User className="w-3.5 h-3.5 text-[#D4A843]" />
                        <span>{apt.accountantName || 'Tax Strategist'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage('virtual_consultation_room', { appointmentId: apt.id, roomId: apt.id })}
                        className="text-[#D4A843] hover:text-[#E1BB60] font-semibold underline flex items-center space-x-1"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Virtual SafeRoom</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {apt.status === 'confirmed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleModalApt(apt);
                            setNewRescheduleDate(apt.date);
                            setNewRescheduleTime(apt.timeSlot);
                          }}
                          className="px-3 py-1.5 bg-[#143657] border border-[rgba(148,163,184,0.18)] rounded-lg text-xs font-semibold text-[#F8FAFC] hover:border-[#D4A843]/50 transition-colors"
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelAppointment(apt.id)}
                          className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CALENDAR SYNC (STAFF & ADVISORS) */}
      {activeTab === 'sync' && isStaffOrAdmin && (
        <div className="bg-[#0D2745] rounded-2xl p-6 border border-[rgba(148,163,184,0.18)] text-[#F8FAFC] space-y-6">
          <div className="border-b border-[rgba(148,163,184,0.18)] pb-4">
            <h2 className="text-lg font-bold text-[#F8FAFC] font-serif">External Calendar Synchronization</h2>
            <p className="text-xs text-[#A9B7C8]">
              Connect Google Calendar and Microsoft Outlook for two-way free/busy synchronization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Calendar Card */}
            <div className="p-5 rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#102D4F] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                    G
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#F8FAFC]">Google Calendar</h3>
                    <p className="text-xs text-[#A9B7C8]">OAuth 2.0 Free/Busy &amp; Event Creation</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Connected
                </span>
              </div>

              <div className="text-xs text-[#A9B7C8] space-y-1">
                <div>• Automatic busy block masking as &ldquo;Unavailable&rdquo;</div>
                <div>• Neutral appointment creation (&ldquo;A/R Tax Services Appointment&rdquo;)</div>
                <div>• Automatic Google Meet link synthesis</div>
              </div>

              <button
                type="button"
                disabled={isConnecting}
                onClick={() => handleConnectProvider('google_calendar')}
                className="w-full py-2 bg-[#143657] border border-[rgba(148,163,184,0.18)] rounded-lg text-xs font-semibold text-[#F8FAFC] hover:border-[#D4A843]/50 transition-colors"
              >
                Sync Now / Refresh Connection
              </button>
            </div>

            {/* Microsoft Outlook Card */}
            <div className="p-5 rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#102D4F] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-700 text-white flex items-center justify-center font-bold">
                    O
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#F8FAFC]">Microsoft Outlook</h3>
                    <p className="text-xs text-[#A9B7C8]">Microsoft Graph Calendar Sync</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                  Available
                </span>
              </div>

              <div className="text-xs text-[#A9B7C8] space-y-1">
                <div>• Sync personal Outlook calendar busy times</div>
                <div>• Microsoft Teams meeting integration</div>
                <div>• Enterprise tenant delegation</div>
              </div>

              <button
                type="button"
                disabled={isConnecting}
                onClick={() => handleConnectProvider('microsoft_outlook')}
                className="w-full py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Connect Microsoft Outlook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FOUNDER CALENDAR CONTROLS */}
      {activeTab === 'founder' && (isFounder || isAdmin) && (
        <div className="bg-[#0D2745] rounded-2xl p-6 border border-[rgba(148,163,184,0.18)] text-[#F8FAFC] space-y-6">
          <div className="border-b border-[rgba(148,163,184,0.18)] pb-4">
            <h2 className="text-lg font-bold text-[#F8FAFC] font-serif">Founder Calendar Controls — Desmond Hinds</h2>
            <p className="text-xs text-[#A9B7C8]">
              Configure executive availability, referral requirements, daily booking limits, and consultation fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center space-x-3 p-4 bg-[#102D4F] rounded-xl border border-[rgba(148,163,184,0.18)] cursor-pointer">
              <input
                type="checkbox"
                checked={founderControls.acceptsNewClients}
                onChange={e => setFounderControls({ ...founderControls, acceptsNewClients: e.target.checked })}
                className="rounded accent-[#D4A843]"
              />
              <div>
                <div className="text-sm font-bold text-[#F8FAFC]">Accept New Client Bookings</div>
                <div className="text-xs text-[#A9B7C8]">Allow prospective clients to book direct founder sessions</div>
              </div>
            </label>

            <label className="flex items-center space-x-3 p-4 bg-[#102D4F] rounded-xl border border-[rgba(148,163,184,0.18)] cursor-pointer">
              <input
                type="checkbox"
                checked={founderControls.referralRequired}
                onChange={e => setFounderControls({ ...founderControls, referralRequired: e.target.checked })}
                className="rounded accent-[#D4A843]"
              />
              <div>
                <div className="text-sm font-bold text-[#F8FAFC]">Referral Required</div>
                <div className="text-xs text-[#A9B7C8]">Must have validated referral code or existing client introduction</div>
              </div>
            </label>

            <label className="flex items-center space-x-3 p-4 bg-[#102D4F] rounded-xl border border-[rgba(148,163,184,0.18)] cursor-pointer">
              <input
                type="checkbox"
                checked={founderControls.adminApprovalRequired}
                onChange={e => setFounderControls({ ...founderControls, adminApprovalRequired: e.target.checked })}
                className="rounded accent-[#D4A843]"
              />
              <div>
                <div className="text-sm font-bold text-[#F8FAFC]">Executive Approval Required</div>
                <div className="text-xs text-[#A9B7C8]">Holds slot pending managing partner review before confirmation</div>
              </div>
            </label>

            <div className="p-4 bg-[#102D4F] rounded-xl border border-[rgba(148,163,184,0.18)] space-y-1">
              <label className="block text-xs font-semibold text-[#A9B7C8]">
                Max Daily Founder Meetings
              </label>
              <input
                type="number"
                value={founderControls.maxMeetingsPerDay || 5}
                onChange={e => setFounderControls({ ...founderControls, maxMeetingsPerDay: parseInt(e.target.value, 10) })}
                className="w-full p-2 border border-[rgba(148,163,184,0.18)] rounded-lg text-sm bg-[#071A2E] text-[#F8FAFC] font-mono outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[rgba(148,163,184,0.18)]">
            <button
              type="button"
              disabled={isSavingFounderControls}
              onClick={handleSaveFounderControls}
              className="px-6 py-2.5 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] font-bold rounded-xl text-xs transition-all flex items-center space-x-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Save Founder Controls</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: ADMIN FIRM OVERVIEW */}
      {activeTab === 'admin' && isAdmin && adminOverview && (
        <div className="bg-[#0D2745] rounded-2xl p-6 border border-[rgba(148,163,184,0.18)] text-[#F8FAFC] space-y-6">
          <div className="border-b border-[rgba(148,163,184,0.18)] pb-4">
            <h2 className="text-lg font-bold text-[#F8FAFC] font-serif">Firm Calendar Administration</h2>
            <p className="text-xs text-[#A9B7C8]">Firm-wide scheduling metrics and active holds.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#102D4F] rounded-xl border border-[rgba(148,163,184,0.18)]">
              <span className="text-[#7F91A6] text-xs block">Total Appointments</span>
              <span className="text-2xl font-bold text-[#F8FAFC]">{adminOverview.totalAppointments}</span>
            </div>
            <div className="p-4 bg-[#102D4F] rounded-xl border border-[rgba(148,163,184,0.18)]">
              <span className="text-[#7F91A6] text-xs block">Active Confirmed</span>
              <span className="text-2xl font-bold text-emerald-400">{adminOverview.confirmedAppointments}</span>
            </div>
            <div className="p-4 bg-[#102D4F] rounded-xl border border-[rgba(148,163,184,0.18)]">
              <span className="text-[#7F91A6] text-xs block">Staff Practitioners</span>
              <span className="text-2xl font-bold text-[#F8FAFC]">{adminOverview.staffCount}</span>
            </div>
            <div className="p-4 bg-[#102D4F] rounded-xl border border-[rgba(148,163,184,0.18)]">
              <span className="text-[#7F91A6] text-xs block">Active Holds</span>
              <span className="text-2xl font-bold text-[#D4A843]">{adminOverview.activeHoldsCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleModalApt && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D2745] rounded-2xl max-w-md w-full p-6 border border-[rgba(148,163,184,0.18)] text-[#F8FAFC] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(148,163,184,0.18)] pb-3">
              <h3 className="font-bold text-base text-[#F8FAFC]">Reschedule Consultation</h3>
              <button
                type="button"
                onClick={() => setRescheduleModalApt(null)}
                className="text-[#7F91A6] hover:text-[#F8FAFC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#A9B7C8] mb-1">New Date</label>
                <BrandedDatePicker
                  value={newRescheduleDate}
                  minDate={new Date().toISOString().slice(0, 10)}
                  onChange={setNewRescheduleDate}
                />
              </div>

              <div>
                <label className="block font-semibold text-[#A9B7C8] mb-1">New Time</label>
                <select
                  value={newRescheduleTime}
                  onChange={e => setNewRescheduleTime(e.target.value)}
                  className="w-full p-2.5 border border-[rgba(148,163,184,0.18)] rounded-xl bg-[#102D4F] text-[#F8FAFC] outline-none"
                >
                  <option value="09:00">09:00 AM (EDT)</option>
                  <option value="10:00">10:00 AM (EDT)</option>
                  <option value="11:00">11:00 AM (EDT)</option>
                  <option value="13:00">01:00 PM (EDT)</option>
                  <option value="14:00">02:00 PM (EDT)</option>
                  <option value="15:00">03:00 PM (EDT)</option>
                  <option value="16:00">04:00 PM (EDT)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#A9B7C8] mb-1">Reason for Rescheduling</label>
                <textarea
                  rows={2}
                  placeholder="e.g., Client schedule conflict..."
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  className="w-full p-2.5 border border-[rgba(148,163,184,0.18)] rounded-xl bg-[#102D4F] text-[#F8FAFC] placeholder-[#7F91A6] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-[rgba(148,163,184,0.18)]">
              <button
                type="button"
                onClick={() => setRescheduleModalApt(null)}
                className="px-4 py-2 text-xs font-semibold text-[#A9B7C8] hover:text-[#F8FAFC] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRescheduleSubmit}
                className="px-5 py-2 text-xs font-bold bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] rounded-xl shadow-xs"
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default LiveCalendarModule;
