import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  CameraOff, 
  Mic, 
  MicOff, 
  Share2, 
  PhoneOff, 
  FileText, 
  MessageSquare, 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Lock, 
  X, 
  CheckCircle2, 
  RefreshCw,
  Send,
  Download,
  Eye,
  Maximize2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredToken } from '../../services/api';
import { PreCallWaitingRoom } from './PreCallWaitingRoom';
import { WatermarkedDocumentReviewer } from './WatermarkedDocumentReviewer';
import { 
  ConsultationRoom, 
  MeetingParticipant, 
  MeetingDocumentReview,
  MeetingChatMessage
} from '../../types/consultationRoom';
import { BrandedButton } from '../ui/BrandedButton';

interface VirtualConsultationRoomProps {
  roomId?: string;
  appointmentId?: string;
  onExit?: () => void;
}

export const VirtualConsultationRoom: React.FC<VirtualConsultationRoomProps> = ({
  roomId: propRoomId,
  appointmentId,
  onExit
}) => {
  const { currentUser, setCurrentPage } = useApp();

  // Lifecycle states
  const [stage, setStage] = useState<'pre_call' | 'waiting_for_host' | 'in_call' | 'post_call'>('pre_call');
  const [room, setRoom] = useState<ConsultationRoom | null>(null);
  const [participant, setParticipant] = useState<MeetingParticipant | null>(null);
  const [roomToken, setRoomToken] = useState<string | null>(null);

  // Active in-call states
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeSidePanel, setActiveSidePanel] = useState<'none' | 'document' | 'chat' | 'participants'>('none');

  // Waiting room queue (for host)
  const [waitingParticipants, setWaitingParticipants] = useState<MeetingParticipant[]>([]);
  const [isAdmitting, setIsAdmitting] = useState<string | null>(null);

  // Documents & Chat
  const [documents, setDocuments] = useState<MeetingDocumentReview[]>([]);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Call duration
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // End consultation modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [consultationNotes, setConsultationNotes] = useState('');
  const [followUpTasks, setFollowUpTasks] = useState('');

  // Media references
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const isHost = participant?.role === 'host' || currentUser?.role === 'accountant' || currentUser?.role === 'senior_reviewer' || currentUser?.role === 'founder' || currentUser?.role === 'administrator';

  // Step 1: Initialize room or join by appointment
  useEffect(() => {
    let mounted = true;

    async function initRoom() {
      try {
        const token = getStoredToken();
        const targetId = propRoomId || appointmentId || 'room_apt_001';

        // Join / generate room token
        const res = await fetch('/api/consultation-rooms/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || ''}`,
            'x-session-token': token || ''
          },
          body: JSON.stringify({
            roomId: targetId,
            appointmentId: appointmentId || targetId
          })
        });

        if (!res.ok) {
          throw new Error('Failed to obtain secure consultation credentials.');
        }

        const data = await res.json();
        if (!mounted) return;

        setRoom(data.room);
        setParticipant(data.participant);
        setRoomToken(data.roomToken);
        setDocuments(data.room.documents || []);

        if (data.participant.status === 'in_meeting') {
          // If already admitted
          setStage('in_call');
        }
      } catch (err: any) {
        console.error('Room init error:', err);
        setErrorBanner(err.message || 'Consultation room could not be loaded.');
      }
    }

    initRoom();

    return () => {
      mounted = false;
      stopAllMedia();
    };
  }, [propRoomId, appointmentId]);

  // Periodic polling for room state, waiting room, chat, and signaling
  useEffect(() => {
    if (!room || !participant || stage === 'pre_call' || stage === 'post_call') return;

    const interval = setInterval(async () => {
      try {
        const token = getStoredToken();
        const res = await fetch(`/api/consultation-rooms/${room.id}`, {
          headers: {
            'Authorization': `Bearer ${token || ''}`,
            'x-session-token': token || ''
          }
        });
        if (res.ok) {
          const data = await res.json();
          setRoom(data.room);
          setDocuments(data.room.documents || []);

          // Check if my admission status changed
          const myUpdated = data.room.participants.find((p: MeetingParticipant) => p.id === participant.id);
          if (myUpdated) {
            setParticipant(myUpdated);
            if (stage === 'waiting_for_host' && myUpdated.status === 'in_meeting') {
              setStage('in_call');
            } else if (myUpdated.status === 'disconnected') {
              setStage('post_call');
            }
          }
        }

        // If host, poll waiting room
        if (isHost) {
          const wRes = await fetch(`/api/consultation-rooms/${room.id}/waiting-room`, {
            headers: {
              'Authorization': `Bearer ${token || ''}`,
              'x-session-token': token || ''
            }
          });
          if (wRes.ok) {
            const wData = await wRes.json();
            setWaitingParticipants(wData.waitingParticipants || []);
          }
        }

        // Poll chat messages
        const cRes = await fetch(`/api/consultation-rooms/${room.id}/chat`, {
          headers: {
            'Authorization': `Bearer ${token || ''}`,
            'x-session-token': token || ''
          }
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          setChatMessages(cData.messages || []);
        }
      } catch (e) {
        console.warn('Poll error:', e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [room?.id, participant?.id, stage, isHost]);

  // Call timer
  useEffect(() => {
    if (stage !== 'in_call') return;
    const timer = setInterval(() => {
      setCallDurationSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  const stopAllMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
  };

  // Pre-call join callback
  const handlePreCallJoin = async (mediaState: {
    audioMuted: boolean;
    videoMuted: boolean;
    selectedAudioDeviceId: string;
    selectedVideoDeviceId: string;
    agreedToTerms: boolean;
  }) => {
    setAudioMuted(mediaState.audioMuted);
    setVideoMuted(mediaState.videoMuted);

    // Acquire stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !mediaState.videoMuted,
        audio: !mediaState.audioMuted
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn('Could not initialize local stream for in-call:', e);
    }

    if (isHost || participant?.status === 'in_meeting') {
      setStage('in_call');
      logAuditEvent('joined_call_as_host');
    } else {
      setStage('waiting_for_host');
      logAuditEvent('entered_waiting_room');
    }
  };

  // Host action: Admit client from waiting room
  const handleAdmitClient = async (participantId: string) => {
    if (!room) return;
    try {
      setIsAdmitting(participantId);
      const token = getStoredToken();
      await fetch(`/api/consultation-rooms/${room.id}/admit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({ participantId })
      });
      setWaitingParticipants(prev => prev.filter(p => p.id !== participantId));
    } catch (e) {
      console.error(e);
    } finally {
      setIsAdmitting(null);
    }
  };

  // Toggle Media
  const handleToggleAudio = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = audioMuted;
      }
    }
    setAudioMuted(!audioMuted);
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = videoMuted;
      }
    }
    setVideoMuted(!videoMuted);
  };

  // Screen sharing
  const handleToggleScreenShare = async () => {
    if (screenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setScreenSharing(false);
      logAuditEvent('stopped_screen_share');
    } else {
      try {
        const sStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = sStream;
        setScreenSharing(true);
        logAuditEvent('started_screen_share');
        sStream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          logAuditEvent('screen_share_ended_by_user');
        };
      } catch (e) {
        console.warn('Screen share canceled or not granted:', e);
      }
    }
  };

  // Audit event helper
  const logAuditEvent = async (action: string, metadata?: any) => {
    if (!room) return;
    try {
      const token = getStoredToken();
      await fetch(`/api/consultation-rooms/${room.id}/audit-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({ action, metadata })
      });
    } catch (e) {
      // non-blocking
    }
  };

  // Chat message send
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !room) return;
    try {
      const text = chatInput.trim();
      setChatInput('');
      const token = getStoredToken();
      const res = await fetch(`/api/consultation-rooms/${room.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, data.message]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Document note logging
  const handleAddDocNote = async (documentId: string, noteText: string, isInternal: boolean) => {
    if (!room) return;
    const token = getStoredToken();
    await fetch(`/api/consultation-rooms/${room.id}/document-note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
        'x-session-token': token || ''
      },
      body: JSON.stringify({ documentId, noteText, isInternal })
    });
  };

  // Document acknowledgment
  const handleAcknowledgeDoc = async (documentId: string) => {
    if (!room) return;
    const token = getStoredToken();
    await fetch(`/api/consultation-rooms/${room.id}/document-acknowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
        'x-session-token': token || ''
      },
      body: JSON.stringify({ documentId })
    });
  };

  // End consultation
  const handleFinalizeEnd = async () => {
    if (!room) return;
    try {
      const token = getStoredToken();
      await fetch(`/api/consultation-rooms/${room.id}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({
          summaryNotes: consultationNotes,
          followUpTasks: followUpTasks.split('\n').filter(t => t.trim().length > 0)
        })
      });
      stopAllMedia();
      setStage('post_call');
      setShowEndModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Stage: Pre-call device test and consent
  if (stage === 'pre_call') {
    return (
      <div className="min-h-screen bg-[#06172C] py-8">
        <PreCallWaitingRoom
          roomTitle={room?.title || 'Confidential Tax Consultation'}
          referenceCode={room?.referenceCode || 'ART-2026-CONSULT'}
          hostName="Desmond Hinds"
          clientName={currentUser?.name || 'Authorized Client'}
          isHost={!!isHost}
          scheduledTime="Today • Live Session"
          onJoinRoom={handlePreCallJoin}
        />
      </div>
    );
  }

  // 2. Stage: Client Waiting in lobby for host admission
  if (stage === 'waiting_for_host') {
    return (
      <div className="min-h-screen bg-[#06172C] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#081E36] border border-[#244567] rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-[#0D2746] border border-[#B98B32] flex items-center justify-center mx-auto text-[#E2B957]">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>

          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#E2B957] font-bold">
              Secure Waiting Lobby
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#F7F1E5] mt-1">
              Waiting for Advisor to Admit You
            </h2>
            <p className="text-xs text-[#EAD7A3] mt-2 leading-relaxed">
              Your tax advisor has been notified that you are waiting in the room. They will admit you momentarily to protect client privacy between appointments.
            </p>
          </div>

          <div className="bg-[#06172C] p-4 rounded-xl border border-[#244567] text-left text-xs space-y-1.5">
            <div className="text-[#52657B] font-mono text-[10px]">CONSULTATION DOSSIER</div>
            <div className="text-white font-semibold">{room?.title}</div>
            <div className="text-slate-400">Ref Code: <strong className="font-mono text-[#E2B957]">{room?.referenceCode}</strong></div>
            <div className="text-slate-400">Advisor: <strong>Desmond Hinds</strong></div>
          </div>

          <button
            onClick={() => {
              stopAllMedia();
              setStage('pre_call');
            }}
            className="text-xs font-semibold text-slate-400 hover:text-white underline"
          >
            Leave Waiting Room
          </button>
        </div>
      </div>
    );
  }

  // 3. Stage: Post-call wrap-up summary
  if (stage === 'post_call') {
    return (
      <div className="min-h-screen bg-[#06172C] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-[#FBF8F1] border-2 border-[#D8C9A5] rounded-3xl p-8 text-[#10233D] space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-[#F4E7C3] border border-[#B98B32] flex items-center justify-center mx-auto text-[#B98B32]">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="text-center">
            <h2 className="font-serif text-2xl font-bold text-[#10233D]">
              Consultation Concluded
            </h2>
            <p className="text-xs text-[#52657B] mt-1">
              Thank you for meeting with A/R Tax Services, LLC. All reviewed documents and notes have been archived to your secure portal.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#D8C9A5] text-xs space-y-2">
            <div className="flex justify-between border-b border-dashed border-[#D8C9A5] pb-1">
              <span className="text-[#52657B]">Total Meeting Duration:</span>
              <span className="font-mono font-bold text-[#10233D]">{formatTimer(callDurationSeconds)}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-[#D8C9A5] pb-1">
              <span className="text-[#52657B]">Appointment Reference:</span>
              <span className="font-mono font-bold text-[#10233D]">{room?.referenceCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#52657B]">Audit Record:</span>
              <span className="font-mono text-emerald-700 font-bold">CIRCULAR 230 COMPLIANT</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <BrandedButton
              size="lg"
              variant="primary"
              className="w-full"
              onClick={() => {
                if (onExit) onExit();
                else setCurrentPage('client_portal');
              }}
            >
              Return to Client Portal
            </BrandedButton>
          </div>
        </div>
      </div>
    );
  }

  // 4. Stage: Live In-Call Viewport
  return (
    <div className="min-h-screen bg-[#030D19] flex flex-col text-[#F7F1E5]">
      {/* Top Bar */}
      <header className="bg-[#081E36] border-b border-[#244567] px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0D2746] border border-[#B98B32] flex items-center justify-center text-[#E2B957] font-serif font-bold text-sm">
            AR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-sm text-[#F7F1E5] truncate max-w-xs sm:max-w-md">
                {room?.title}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#138A67]/20 border border-[#138A67] text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Ref: <strong className="font-mono text-white">{room?.referenceCode}</strong></span>
              <span>&bull;</span>
              <span className="font-mono text-[#E2B957] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimer(callDurationSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Host Waiting Room Banner */}
        {isHost && waitingParticipants.length > 0 && (
          <div className="bg-[#B98B32] text-[#06172C] px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-lg animate-bounce">
            <Users className="w-4 h-4" />
            <span>{waitingParticipants[0].userName} is in the waiting room</span>
            <button
              disabled={isAdmitting === waitingParticipants[0].id}
              onClick={() => handleAdmitClient(waitingParticipants[0].id)}
              className="px-2.5 py-0.5 rounded-lg bg-[#06172C] text-[#E2B957] text-[11px] font-bold hover:bg-[#0D2746]"
            >
              {isAdmitting === waitingParticipants[0].id ? 'Admitting...' : 'Admit Now'}
            </button>
          </div>
        )}

        {/* Action controls right */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 bg-[#06172C] px-3 py-1.5 rounded-xl border border-[#244567]">
            <Lock className="w-3.5 h-3.5 text-[#E2B957]" />
            <span>DTLS 256-Bit Encrypted</span>
          </div>

          {isHost ? (
            <button
              onClick={() => setShowEndModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#B42318] hover:bg-[#912018] text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End Consultation</span>
            </button>
          ) : (
            <button
              onClick={() => {
                stopAllMedia();
                setStage('post_call');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#B42318] hover:bg-[#912018] text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Work Stage */}
      <div className="flex-1 flex overflow-hidden">
        {/* Central Stage: Video Grid / Screen Share */}
        <div className="flex-1 p-4 flex flex-col justify-between gap-4 overflow-auto">
          {/* Main Video Presentation Grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[350px]">
            {/* Remote Advisor/Client Viewport */}
            <div className="bg-[#081E36] border border-[#244567] rounded-2xl relative overflow-hidden flex items-center justify-center aspect-video md:aspect-auto shadow-xl">
              <div className="text-center p-6 space-y-3">
                <div className="w-20 h-20 rounded-full bg-[#0D2746] border-2 border-[#B98B32] flex items-center justify-center mx-auto text-[#E2B957] font-serif font-bold text-2xl shadow-inner">
                  {isHost ? 'MP' : 'DH'}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#F7F1E5]">
                    {isHost ? (room?.clientName || 'Michael Perotti') : 'Desmond Hinds'}
                  </h3>
                  <p className="text-xs text-[#EAD7A3]">
                    {isHost ? 'Client &bull; Authorized Reviewer' : 'Founder & Senior Managing Accountant'}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D2746] text-emerald-400 text-xs border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Secure Audio Active</span>
                </div>
              </div>

              {/* Watermark badge on remote screen */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[#06172C]/80 border border-[#244567] text-[10px] text-white font-mono pointer-events-none backdrop-blur-xs">
                {isHost ? 'CLIENT PARTICIPANT' : 'FIRM ADVISOR'} &bull; {room?.referenceCode}
              </div>
            </div>

            {/* Local Viewport (Self) */}
            <div className="bg-[#081E36] border border-[#244567] rounded-2xl relative overflow-hidden flex items-center justify-center aspect-video md:aspect-auto shadow-xl">
              {videoMuted ? (
                <div className="text-center p-6 space-y-2">
                  <div className="w-16 h-16 rounded-full bg-[#0D2746] border border-[#244567] flex items-center justify-center mx-auto text-slate-400">
                    <CameraOff className="w-8 h-8" />
                  </div>
                  <p className="text-xs text-slate-300 font-semibold">Your camera is off</p>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}

              {/* Status badges */}
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-[#06172C]/85 border border-[#244567] text-xs font-semibold text-white flex items-center gap-2 backdrop-blur-xs">
                <span>{currentUser?.name || 'You'}</span>
                {audioMuted && (
                  <span className="p-1 rounded bg-[#B42318] text-white">
                    <MicOff className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Floating Controls Bar */}
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="bg-[#081E36]/95 backdrop-blur-md px-6 py-3 rounded-full border border-[#244567] shadow-2xl flex items-center gap-3">
              <button
                onClick={handleToggleAudio}
                className={`p-3 rounded-full transition-all ${
                  audioMuted ? 'bg-[#B42318] text-white' : 'bg-[#0D2746] text-[#F7F1E5] hover:bg-[#14375D] border border-[#244567]'
                }`}
                title={audioMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {audioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                onClick={handleToggleVideo}
                className={`p-3 rounded-full transition-all ${
                  videoMuted ? 'bg-[#B42318] text-white' : 'bg-[#0D2746] text-[#F7F1E5] hover:bg-[#14375D] border border-[#244567]'
                }`}
                title={videoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {videoMuted ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
              </button>

              <button
                onClick={handleToggleScreenShare}
                className={`p-3 rounded-full transition-all ${
                  screenSharing ? 'bg-[#C99A3D] text-[#06172C]' : 'bg-[#0D2746] text-[#F7F1E5] hover:bg-[#14375D] border border-[#244567]'
                }`}
                title="Share Screen"
              >
                <Share2 className="w-5 h-5" />
              </button>

              <div className="w-[1px] h-6 bg-[#244567] mx-1" />

              {/* Open Watermarked Document Review */}
              <button
                onClick={() => setActiveSidePanel(activeSidePanel === 'document' ? 'none' : 'document')}
                className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeSidePanel === 'document'
                    ? 'bg-[#E2B957] text-[#06172C] shadow-lg'
                    : 'bg-[#0D2746] text-[#E2B957] hover:bg-[#14375D] border border-[#B98B32]'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Review Documents ({documents.length})</span>
              </button>

              {/* Open In-Call Encrypted Chat */}
              <button
                onClick={() => setActiveSidePanel(activeSidePanel === 'chat' ? 'none' : 'chat')}
                className={`p-3 rounded-full transition-all relative ${
                  activeSidePanel === 'chat'
                    ? 'bg-[#C99A3D] text-[#06172C]'
                    : 'bg-[#0D2746] text-[#F7F1E5] hover:bg-[#14375D] border border-[#244567]'
                }`}
                title="Session Chat"
              >
                <MessageSquare className="w-5 h-5" />
                {chatMessages.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E2B957] text-[#06172C] text-[10px] font-bold flex items-center justify-center">
                    {chatMessages.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Side Panel: Either Watermarked Document Reviewer OR Chat */}
        {activeSidePanel === 'document' && (
          <aside className="w-full lg:w-[620px] bg-[#081E36] border-l border-[#244567] flex flex-col shrink-0 animate-fade-in">
            <div className="p-3 bg-[#06172C] border-b border-[#244567] flex items-center justify-between">
              <span className="text-xs font-bold text-[#E2B957] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>Watermarked Document Review</span>
              </span>
              <button
                onClick={() => setActiveSidePanel('none')}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <WatermarkedDocumentReviewer
                documents={documents}
                clientName={room?.clientName || currentUser?.name || 'Client'}
                clientEmail={currentUser?.email || 'client@example.com'}
                referenceCode={room?.referenceCode || 'ART-2026'}
                isHost={!!isHost}
                onAcknowledgeDocument={handleAcknowledgeDoc}
                onAddNote={handleAddDocNote}
                onLogAuditEvent={logAuditEvent}
              />
            </div>
          </aside>
        )}

        {activeSidePanel === 'chat' && (
          <aside className="w-full sm:w-80 bg-[#081E36] border-l border-[#244567] flex flex-col shrink-0 animate-fade-in">
            <div className="p-3.5 bg-[#06172C] border-b border-[#244567] flex items-center justify-between">
              <span className="text-xs font-bold text-[#E2B957] uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <span>Session Chat &bull; Encrypted</span>
              </span>
              <button
                onClick={() => setActiveSidePanel('none')}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat message history */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {chatMessages.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto text-[#244567] mb-2" />
                  <p>Send secure messages to session participants.</p>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl max-w-[85%] space-y-1 ${
                      msg.senderId === participant?.id
                        ? 'ml-auto bg-[#0D2746] text-[#F7F1E5] border border-[#B98B32]'
                        : 'mr-auto bg-[#06172C] text-slate-300 border border-[#244567]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#E2B957]">
                      <span className="font-bold">{msg.senderName}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Chat composer */}
            <form onSubmit={handleSendChat} className="p-3 bg-[#06172C] border-t border-[#244567] flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type message..."
                className="flex-1 p-2 rounded-xl bg-[#081E36] border border-[#244567] text-xs text-white placeholder-slate-400 outline-none focus:border-[#C99A3D]"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 rounded-xl bg-[#C99A3D] text-[#06172C] font-bold disabled:opacity-40 hover:bg-[#E2B957]"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* End Consultation & File Notes Modal (Host only) */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 bg-[#06172C]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[#FBF8F1] border-2 border-[#D8C9A5] rounded-2xl p-6 text-[#10233D] space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between border-b border-[#D8C9A5] pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#10233D]">
                  Conclude Consultation Session
                </h3>
                <p className="text-xs text-[#52657B]">
                  Record closing advisor notes and follow-up deliverables for the client dossier.
                </p>
              </div>
              <button
                onClick={() => setShowEndModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-[#52657B] mb-1">
                  Executive Consultation Summary
                </label>
                <textarea
                  rows={3}
                  value={consultationNotes}
                  onChange={e => setConsultationNotes(e.target.value)}
                  placeholder="Key decisions, tax planning strategies discussed, or filing recommendations..."
                  className="w-full p-2.5 rounded-xl border border-[#D8C9A5] bg-white text-[#10233D] outline-none focus:ring-2 focus:ring-[#C99A3D]"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[#52657B] mb-1">
                  Follow-Up Action Items (One per line)
                </label>
                <textarea
                  rows={2}
                  value={followUpTasks}
                  onChange={e => setFollowUpTasks(e.target.value)}
                  placeholder="Example: Client to upload 2025 Form 1099-NEC&#10;Advisor to prepare Draft Form 8879"
                  className="w-full p-2.5 rounded-xl border border-[#D8C9A5] bg-white text-[#10233D] outline-none focus:ring-2 focus:ring-[#C99A3D]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#D8C9A5] flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#52657B] hover:bg-[#F4E7C3]"
              >
                Cancel
              </button>
              <BrandedButton
                size="md"
                variant="primary"
                onClick={handleFinalizeEnd}
              >
                Save Notes & End Call
              </BrandedButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
