import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  CameraOff, 
  Mic, 
  MicOff, 
  Volume2, 
  ShieldCheck, 
  Wifi, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Play
} from 'lucide-react';
import { BrandedButton } from '../ui/BrandedButton';
import { BrandedSelect } from '../ui/BrandedSelect';

export interface PreCallWaitingRoomProps {
  roomTitle: string;
  referenceCode: string;
  hostName: string;
  clientName: string;
  isHost: boolean;
  scheduledTime: string;
  onJoinRoom: (mediaState: {
    audioMuted: boolean;
    videoMuted: boolean;
    selectedAudioDeviceId: string;
    selectedVideoDeviceId: string;
    agreedToTerms: boolean;
  }) => void;
}

export const PreCallWaitingRoom: React.FC<PreCallWaitingRoomProps> = ({
  roomTitle,
  referenceCode,
  hostName,
  clientName,
  isHost,
  scheduledTime,
  onJoinRoom
}) => {
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');

  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [hasTestedMedia, setHasTestedMedia] = useState(false);

  // Mandatory compliance agreements
  const [agreedToNoRecording, setAgreedToNoRecording] = useState(false);
  const [acknowledgedCircular230, setAcknowledgedCircular230] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize hardware media devices & live preview
  useEffect(() => {
    let active = true;

    async function setupDevices() {
      try {
        setPermissionError(null);
        // Request stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });

        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasTestedMedia(true);

        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevs = devices.filter(d => d.kind === 'videoinput');
        const aDevs = devices.filter(d => d.kind === 'audioinput');
        setVideoDevices(vDevs);
        setAudioDevices(aDevs);
        if (vDevs.length > 0) setSelectedVideoId(vDevs[0].deviceId);
        if (aDevs.length > 0) setSelectedAudioId(aDevs[0].deviceId);

        // Setup audio level meter
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!active) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (err: any) {
        console.warn('Media devices could not be initialized:', err);
        setPermissionError(
          'Camera or microphone access was restricted or not available. You may still proceed in audio/view-only mode.'
        );
        setHasTestedMedia(true);
      }
    }

    setupDevices();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle hardware mute/unmute
  const toggleVideo = () => {
    if (streamRef.current) {
      const vTrack = streamRef.current.getVideoTracks()[0];
      if (vTrack) {
        vTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    } else {
      setVideoEnabled(!videoEnabled);
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const aTrack = streamRef.current.getAudioTracks()[0];
      if (aTrack) {
        aTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    } else {
      setAudioEnabled(!audioEnabled);
    }
  };

  // Speaker audio test chime
  const playSpeakerTest = () => {
    try {
      setSpeakerTesting(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.15); // A5
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.3); // D6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);

      setTimeout(() => setSpeakerTesting(false), 700);
    } catch (e) {
      setSpeakerTesting(false);
    }
  };

  const canProceed = agreedToNoRecording && acknowledgedCircular230;

  const handleJoin = () => {
    if (!canProceed) return;
    onJoinRoom({
      audioMuted: !audioEnabled,
      videoMuted: !videoEnabled,
      selectedAudioDeviceId: selectedAudioId,
      selectedVideoDeviceId: selectedVideoId,
      agreedToTerms: true
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6 animate-fade-in">
      {/* Executive Header Banner */}
      <div className="bg-[#081E36] border border-[#244567] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D2746] border border-[#B98B32] text-[#E2B957] text-xs font-bold uppercase tracking-wider mb-2">
              <Lock className="w-3.5 h-3.5" />
              <span>A/R Virtual SafeRoom &bull; WebRTC Encrypted</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#F7F1E5]">
              {roomTitle}
            </h1>
            <p className="text-xs sm:text-sm text-[#EAD7A3] mt-1">
              Confidential Consultation &bull; Ref: <strong className="font-mono text-white">{referenceCode}</strong> &bull; Scheduled: {scheduledTime}
            </p>
          </div>

          <div className="bg-[#06172C] p-3.5 rounded-xl border border-[#244567] text-xs text-slate-300 shrink-0">
            <div className="text-[11px] text-[#C99A3D] font-bold uppercase tracking-wider">Host & Participant</div>
            <div className="font-semibold text-white mt-0.5">{hostName} <span className="text-[#E2B957]">(Host)</span></div>
            <div className="text-slate-400 mt-0.5">{clientName} <span className="text-slate-400">(Client)</span></div>
          </div>
        </div>
      </div>

      {/* Media Test Stage & Camera Preview */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Camera Preview Box */}
        <div className="md:col-span-7 bg-[#081E36] border border-[#244567] rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E2B957]">Device Verification</span>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Wifi className="w-3.5 h-3.5" />
                <span>Low Latency DTLS/SRTP</span>
              </div>
            </div>

            {/* Video Viewport */}
            <div className="relative aspect-video rounded-xl bg-[#06172C] border border-[#244567] overflow-hidden flex items-center justify-center">
              {videoEnabled ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-16 h-16 rounded-full bg-[#0D2746] border border-[#244567] flex items-center justify-center mx-auto text-[#718096]">
                    <CameraOff className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">Camera preview is paused</p>
                </div>
              )}

              {/* Watermark preview overlay */}
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-[#06172C]/80 border border-[#244567] text-[10px] text-white font-mono flex items-center gap-1.5 backdrop-blur-xs pointer-events-none">
                <ShieldCheck className="w-3 h-3 text-[#E2B957]" />
                <span>{clientName} &bull; {referenceCode}</span>
              </div>

              {/* Controls bar overlaid at bottom */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#081E36]/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#244567] shadow-xl">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className={`p-2.5 rounded-full transition-all ${
                    audioEnabled
                      ? 'bg-[#0D2746] text-[#F7F1E5] hover:bg-[#14375D] border border-[#244567]'
                      : 'bg-[#B42318] text-white'
                  }`}
                  title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`p-2.5 rounded-full transition-all ${
                    videoEnabled
                      ? 'bg-[#0D2746] text-[#F7F1E5] hover:bg-[#14375D] border border-[#244567]'
                      : 'bg-[#B42318] text-white'
                  }`}
                  title={videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                  {videoEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Audio Volume Bar */}
            <div className="mt-4 flex items-center gap-3 bg-[#06172C] p-3 rounded-xl border border-[#244567]">
              <div className="flex items-center gap-1.5 text-xs text-[#E2B957] font-semibold shrink-0">
                <Mic className="w-4 h-4" />
                <span>Input Level:</span>
              </div>
              <div className="flex-1 h-2 rounded-full bg-[#0D2746] overflow-hidden">
                <div
                  className="h-full transition-all duration-75 rounded-full bg-gradient-to-r from-emerald-500 to-[#C99A3D]"
                  style={{ width: `${audioEnabled ? audioVolume : 0}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-slate-400 shrink-0 w-8 text-right">
                {audioEnabled ? `${audioVolume}%` : 'Muted'}
              </span>
            </div>
          </div>

          {/* Speaker Test Action */}
          <div className="mt-4 pt-4 border-t border-[#244567] flex items-center justify-between">
            <span className="text-xs text-slate-300">Test audio output hardware:</span>
            <button
              type="button"
              onClick={playSpeakerTest}
              disabled={speakerTesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D2746] text-[#E2B957] text-xs font-semibold hover:bg-[#14375D] border border-[#244567] transition-all"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{speakerTesting ? 'Playing Chime...' : 'Test Speaker'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Confidentiality Agreement & Entry Checklist */}
        <div className="md:col-span-5 bg-[#FBF8F1] border border-[#D8C9A5] rounded-2xl p-5 shadow-lg text-[#10233D] flex flex-col justify-between space-y-5">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#10233D] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#B98B32]" />
              <span>Confidentiality Protocols</span>
            </h3>
            <p className="text-xs text-[#52657B] mt-1 leading-relaxed">
              Consultations involve confidential tax preparation materials governed by IRC § 7216 and Treasury Circular 230 regulations.
            </p>

            {/* Checklist Agreements */}
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-[#D8C9A5] bg-[#F7F1E5] cursor-pointer hover:border-[#B98B32] transition-colors">
                <input
                  type="checkbox"
                  checked={agreedToNoRecording}
                  onChange={e => setAgreedToNoRecording(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#C99A3D] focus:ring-[#C99A3D]"
                />
                <span className="text-xs text-[#10233D] leading-snug">
                  <strong>Strict No Unauthorized Recording:</strong> I certify that I will not capture, screenshot, or record this session without prior written bilateral authorization.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-[#D8C9A5] bg-[#F7F1E5] cursor-pointer hover:border-[#B98B32] transition-colors">
                <input
                  type="checkbox"
                  checked={acknowledgedCircular230}
                  onChange={e => setAcknowledgedCircular230(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#C99A3D] focus:ring-[#C99A3D]"
                />
                <span className="text-xs text-[#10233D] leading-snug">
                  <strong>IRC § 7216 Notice:</strong> Federal law strictly protects confidentiality of tax returns and records. All shared documents are dynamically watermarked for your identity.
                </span>
              </label>
            </div>

            {permissionError && (
              <div className="mt-3 p-3 rounded-xl bg-[#FFF1F0] border border-[#B42318]/30 text-[#B42318] text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{permissionError}</span>
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <div className="pt-4 border-t border-[#D8C9A5] space-y-2">
            <BrandedButton
              size="lg"
              variant="primary"
              disabled={!canProceed}
              disabledReason={!canProceed ? 'Please acknowledge the confidentiality checkboxes to proceed' : undefined}
              onClick={handleJoin}
              className="w-full"
            >
              {isHost ? 'Launch Host Room' : 'Enter Secure Waiting Room'}
            </BrandedButton>

            <p className="text-[11px] text-[#718096] text-center">
              Session is encrypted peer-to-peer. A/R Tax Services, LLC &bull; Columbia, SC
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
