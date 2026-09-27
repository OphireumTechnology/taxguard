import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  MessageSquare,
  HelpCircle,
  Calendar,
  Video,
  Bell,
  Phone,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Paperclip,
  CheckCheck,
  ChevronRight,
  Sparkles,
  ExternalLink,
  FileText
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { MessagesTab } from '../../../types/clientPortal';
import { BRAND_ASSETS } from '../../../utils/assets';

interface MessagesViewProps {
  onOpenUpload: () => void;
  initialTab?: MessagesTab;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  onOpenUpload,
  initialTab = 'conversations'
}) => {
  const { messages, currentUser, sendMessage, notifications } = useApp();
  const [activeTab, setActiveTab] = useState<MessagesTab>(initialTab);

  // Chat state
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Requests for Information (RFIs)
  const [rfis, setRfis] = useState([
    {
      id: 'rfi_01',
      advisorName: 'Desmond Hinds, Founder & CEO',
      question: 'Regarding the $14,250 consulting income deposit in October: Was this received under your personal SSN or under Perotti Advisory Group EIN?',
      taxYear: 2025,
      status: 'answered' as const,
      clientResponse: 'It was paid to the S-Corp (EIN ••-•••4912) and deposited into our business checking account.',
      date: '2026-03-08'
    },
    {
      id: 'rfi_02',
      advisorName: 'Elena Rostova, CPA',
      question: 'Please confirm total business vehicle mileage for 2025: Does the 18,420 mile figure include personal commuting, or is that 100% substantiated business log?',
      taxYear: 2025,
      status: 'pending' as const,
      clientResponse: '',
      date: '2026-03-12'
    }
  ]);
  const [rfiReplyText, setRfiReplyText] = useState<{ [id: string]: string }>({});

  // Appointment booking state
  const [selectedDate, setSelectedDate] = useState('2026-03-24');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('10:30 AM EST');
  const [appointmentBooked, setAppointmentBooked] = useState(false);

  // Read notifications
  const [readNotifIds, setReadNotifIds] = useState<{ [id: string]: boolean }>({});

  const clientMessages = messages.filter(
    (m) => m.clientId === currentUser?.id || m.senderId === currentUser?.id || m.senderRole === 'client'
  );

  useEffect(() => {
    if (activeTab === 'conversations') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [clientMessages.length, activeTab]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(inputText.trim(), false);
      setInputText('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleReplyRfi = (rfiId: string) => {
    const reply = rfiReplyText[rfiId];
    if (!reply || !reply.trim()) return;

    setRfis(prev => prev.map(r => r.id === rfiId ? {
      ...r,
      status: 'answered',
      clientResponse: reply.trim()
    } : r));

    setRfiReplyText(prev => ({ ...prev, [rfiId]: '' }));
  };

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setAppointmentBooked(true);
  };

  return (
    <div className="space-y-6" id="client-messages-container">
      {/* Header & Module Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#0B2748]">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
            Communications &amp; Advisor Inquiries
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight mt-0.5">
            Client Communications Hub
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Encrypted messaging, advisor inquiries, appointment scheduling, and notification alerts.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-[#07172B] border border-[#1E3A5F] p-1 rounded-xl text-xs overflow-x-auto">
          {[
            { key: 'conversations', label: 'Conversations', icon: MessageSquare },
            { key: 'requests_for_info', label: 'Inquiries (RFIs)', icon: HelpCircle },
            { key: 'appointments', label: 'Schedule Meeting', icon: Calendar },
            { key: 'consultation_room', label: 'Consultation Room', icon: Video },
            { key: 'notifications', label: 'Alerts', icon: Bell }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as MessagesTab)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#C99A3D] text-[#06172C] shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#0A1F38]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 1. SECURE CONVERSATIONS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'conversations' && (
        <div className="space-y-4">
          {/* Advisor Header Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#07172B] border border-[#1E3A5F] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#06172C] border border-[#C99A3D]/50 p-0.5 overflow-hidden flex-shrink-0">
                <img
                  src={BRAND_ASSETS.founderPng}
                  alt="Desmond Hinds, CEO"
                  className="w-full h-full object-cover object-top rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-bold text-white">Desmond Hinds</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Senior Advisory Lead
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Founder &amp; CEO &bull; Direct Confidential Client Advisory Thread
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Privileged Practitioner Thread (IRC § 7525)</span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="p-5 rounded-2xl bg-[#07172B] border border-[#1E3A5F] shadow-xl min-h-[420px] max-h-[550px] flex flex-col justify-between space-y-4">
            <div className="overflow-y-auto space-y-3.5 pr-2 flex-1">
              <div className="p-3 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-[11px] text-slate-400 text-center flex items-center justify-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Protected by Federal statutory tax practitioner confidentiality under IRC § 7525.</span>
              </div>

              {clientMessages.length === 0 ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-[#06172C] border border-[#C99A3D]/50 text-[#C99A3D] font-bold flex items-center justify-center text-xs flex-shrink-0">
                      DH
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#06172C] border border-[#1E3A5F] text-xs text-slate-200 space-y-1">
                      <div className="flex items-center justify-between gap-4 text-[10px] text-slate-400">
                        <span className="font-bold text-[#E2BD67]">Desmond Hinds, Founder &amp; CEO</span>
                        <span>Yesterday at 4:15 PM</span>
                      </div>
                      <p className="leading-relaxed">
                        Good afternoon Robert and Sarah. We have incorporated your final Schedule K-1 data and verified your Section 179 equipment deductions. Your 2025 locked review draft is ready in your Return Review tab.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                clientMessages.map((msg) => {
                  const isMe = msg.senderRole === 'client' || msg.senderId === currentUser?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isMe ? 'bg-[#C99A3D] text-[#06172C] border-[#E2BD67]' : 'bg-[#06172C] border-[#C99A3D]/40 text-[#C99A3D]'
                      }`}>
                        {isMe ? 'You' : 'DH'}
                      </div>
                      <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                        isMe ? 'bg-[#0D2340] border-[#C99A3D]/60 text-white' : 'bg-[#06172C] border-[#1E3A5F] text-slate-200'
                      }`}>
                        <div className="flex items-center justify-between gap-4 text-[10px] text-slate-400">
                          <span className="font-bold text-slate-300">{isMe ? 'You' : msg.senderName || 'Desmond Hinds'}</span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="pt-2 border-t border-[#0B2748] flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenUpload}
                title="Attach Document"
                className="p-2.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-slate-400 hover:text-white hover:border-[#C99A3D] transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a confidential message to Desmond Hinds..."
                className="flex-1 bg-[#06172C] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#C99A3D]"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="px-4 py-2.5 rounded-xl bg-[#C99A3D] hover:brightness-105 text-[#06172C] font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. REQUESTS FOR INFORMATION (RFIs) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'requests_for_info' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-xl font-bold text-white">
              Advisor Clarification Inquiries (RFIs)
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Direct questions from your preparation team to verify transactions, pass-through distributions, or deduction limits.
            </p>
          </div>

          <div className="space-y-4">
            {rfis.map((rfi) => (
              <div
                key={rfi.id}
                className="p-5 rounded-2xl bg-[#06172C] border border-[#1E3A5F] space-y-3 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{rfi.advisorName}</span>
                    <span className="text-slate-400">&bull; {rfi.date}</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    rfi.status === 'answered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {rfi.status === 'answered' ? '✓ Answered' : 'Awaiting Your Response'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-slate-200">
                  <strong className="text-[#E2BD67]">Inquiry:</strong> {rfi.question}
                </div>

                {rfi.status === 'answered' ? (
                  <div className="p-3.5 rounded-xl bg-[#06172C] border border-emerald-500/30 text-slate-200">
                    <strong className="text-emerald-400">Your Response:</strong> {rfi.clientResponse}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={3}
                      value={rfiReplyText[rfi.id] || ''}
                      onChange={(e) => setRfiReplyText({ ...rfiReplyText, [rfi.id]: e.target.value })}
                      placeholder="Type your response to this clarification inquiry..."
                      className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#C99A3D]"
                    />
                    <button
                      type="button"
                      onClick={() => handleReplyRfi(rfi.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow"
                    >
                      Submit Response
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. APPOINTMENT SCHEDULING */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'appointments' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-6">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-xl font-bold text-white">
              Schedule Private Advisory Consultation
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Select an available consultation slot with Desmond Hinds or a Senior Tax Associate.
            </p>
          </div>

          {appointmentBooked ? (
            <div className="p-6 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="font-serif text-lg font-bold text-white">Consultation Confirmed</h3>
              <p className="text-xs text-slate-200 max-w-md mx-auto">
                Your private strategy session with Desmond Hinds is scheduled for <strong>{selectedDate} at {selectedTimeSlot}</strong>. A calendar invite and encrypted meeting link have been transmitted to your email.
              </p>
              <button
                type="button"
                onClick={() => setAppointmentBooked(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0B2748] text-white hover:bg-[#11355F]"
              >
                Schedule Another Time
              </button>
            </div>
          ) : (
            <form onSubmit={handleBookAppointment} className="space-y-4 max-w-xl text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Select Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#C99A3D]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Available Consultation Slots:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {['09:00 AM EST', '10:30 AM EST', '01:00 PM EST', '02:30 PM EST', '04:00 PM EST'].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        selectedTimeSlot === slot
                          ? 'bg-[#C99A3D] text-[#06172C] border-[#E2BD67]'
                          : 'bg-[#06172C] border-[#1E3A5F] text-slate-300 hover:text-white'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Consultation Focus:</label>
                <select className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#C99A3D]">
                  <option>Form 1040 Final Draft Review &amp; E-File Q&amp;A</option>
                  <option>S-Corporation Reasonable Compensation &amp; Distribution Strategy</option>
                  <option>Section 179 Capital Depreciation Planning</option>
                  <option>Business Closure &amp; Dissolution Guidance</option>
                </select>
              </div>

              <button
                type="submit"
                className="px-6 py-3 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow"
              >
                Confirm Consultation Booking
              </button>
            </form>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. VIRTUAL CONSULTATION ROOM */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'consultation_room' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 sm:p-8 shadow-lg space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#06172C] border border-[#C99A3D]/50 flex items-center justify-center mx-auto text-[#C99A3D]">
            <Video className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="font-serif text-2xl font-bold text-white">
              A/R Tax Services Virtual Consultation Suite
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Secure, end-to-end encrypted virtual meeting room for one-on-one video reviews with Desmond Hinds.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] max-w-md mx-auto text-xs text-slate-300 space-y-2">
            <div className="flex justify-between">
              <span>Next Meeting:</span>
              <strong className="text-white">Form 1040 Draft Review</strong>
            </div>
            <div className="flex justify-between">
              <span>Security Level:</span>
              <span className="text-emerald-400 font-semibold">TLS 1.3 &bull; AES-256</span>
            </div>
            <div className="flex justify-between">
              <span>Advisor:</span>
              <span className="text-slate-200">Desmond Hinds, Founder &amp; CEO</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => alert('Launching private encrypted virtual consultation room...')}
              className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-lg flex items-center gap-2"
            >
              <Video className="w-4 h-4" />
              <span>Enter Virtual Consultation Room</span>
            </button>
            <button
              type="button"
              onClick={() => alert('Direct dial telephone access: +1 (843) 555-0199 (PIN: 8192)')}
              className="px-5 py-3 rounded-xl font-bold text-xs text-white bg-[#0B2748] hover:bg-[#11355F] border border-[#1E3A5F] transition-colors flex items-center gap-2"
            >
              <Phone className="w-4 h-4 text-[#C99A3D]" />
              <span>Telephone Conference Option</span>
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 5. NOTIFICATION CENTER */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'notifications' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-xl font-bold text-white">
              System Alerts &amp; Regulatory Notifications
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Real-time audit updates, MeF milestone notices, and IRS regulatory bulletins.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              {
                id: 'notif_1',
                title: 'Locked Review Copy Published',
                text: 'Desmond Hinds has uploaded the locked 2025 Form 1040 draft for your inspection.',
                time: '2 hours ago',
                type: 'info'
              },
              {
                id: 'notif_2',
                title: 'IRC § 179 Depreciation Reconciled',
                text: 'Workstation asset expensed on Form 4562; $2,450 tax reduction applied.',
                time: 'Yesterday',
                type: 'success'
              },
              {
                id: 'notif_3',
                title: 'Statutory Filing Deadline Notice',
                text: 'Form 1040 statutory due date is April 15, 2026. Extension Form 4868 available if required.',
                time: '3 days ago',
                type: 'alert'
              }
            ].map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs flex items-start gap-3"
              >
                <div className="mt-0.5">
                  {n.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : n.type === 'alert' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <FileText className="w-4 h-4 text-[#C99A3D]" />
                  )}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{n.title}</span>
                    <span className="text-[10px] text-slate-400">{n.time}</span>
                  </div>
                  <p className="text-slate-300">{n.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
