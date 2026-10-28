/**
 * A/R Tax Services, LLC - Secure Virtual Consultation Room Types
 * Production standards-based WebRTC encrypted video conferencing,
 * waiting rooms, dynamic watermarking, IRC § 7216 compliance, and audit logging.
 */

export type MeetingRoomStatus =
  | 'scheduled'
  | 'waiting_room_open'
  | 'host_not_present'
  | 'ready_to_join'
  | 'in_progress'
  | 'temporarily_interrupted'
  | 'completed'
  | 'canceled'
  | 'expired'
  | 'security_terminated';

export type ParticipantMeetingRole =
  | 'host'
  | 'client'
  | 'founder'
  | 'consultant'
  | 'accountant'
  | 'reviewer'
  | 'admin';

export type ParticipantJoinStatus =
  | 'waiting'
  | 'admitted'
  | 'denied'
  | 'in_call'
  | 'in_meeting'
  | 'left'
  | 'disconnected';

export interface MeetingRoomPermissions {
  canShareScreen: boolean;
  canReviewDocuments: boolean;
  canAdmitWaitingRoom: boolean;
  canEndMeeting: boolean;
  canAddInternalNotes: boolean;
  canMuteParticipants: boolean;
}

export interface SecureMeetingRoom {
  id: string; // e.g. "room_apt_123"
  appointmentId: string;
  referenceCode: string;
  title: string;
  serviceType: string;
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  hostUserId: string;
  hostName: string;
  hostRole: ParticipantMeetingRole;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  status: MeetingRoomStatus;
  waitingRoomEnabled: boolean;
  recordingDisabledEnforced: boolean; // Recording is strictly disabled by default
  screenShareAllowedHostOnly: boolean;
  activeScreenSharerId?: string;
  startedAt?: string;
  endedAt?: string;
  securityTerminationReason?: string;
  clientNotesSummary?: string;
  internalStaffNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ConsultationRoom = SecureMeetingRoom;

export interface MeetingParticipant {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  userName?: string;
  email: string;
  role: ParticipantMeetingRole;
  isHost: boolean;
  status: ParticipantJoinStatus;
  joinedWaitingRoomAt?: string;
  admittedAt?: string;
  joinedCallAt?: string;
  leftCallAt?: string;
  audioMuted: boolean;
  videoMuted: boolean;
  screenSharingActive: boolean;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  rttMs?: number;
  selectedAudioDeviceId?: string;
  selectedVideoDeviceId?: string;
  consentAgreed: boolean;
  consentTimestamp?: string;
}

export interface MeetingTokenResponse {
  token: string;
  roomId: string;
  participantId: string;
  userId: string;
  name: string;
  role: ParticipantMeetingRole;
  isHost: boolean;
  roomStatus: MeetingRoomStatus;
  permissions: MeetingRoomPermissions;
  expiresAt: string;
}

export interface MeetingChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: ParticipantMeetingRole;
  message: string;
  text?: string;
  timestamp: string;
  isConfidential: boolean;
}

export interface MeetingDocumentReview {
  id: string;
  roomId: string;
  documentId: string;
  title: string;
  docType: string;
  taxYear: number;
  sampleContent?: string;
  fileUrl?: string;
  totalPages: number;
  currentPage: number;
  clientAcknowledged: boolean;
  clientAcknowledgmentTimestamp?: string;
  reviewerNotes: Array<{
    id: string;
    authorId: string;
    authorName: string;
    text: string;
    timestamp: string;
    isInternal: boolean;
  }>;
}

export interface MeetingFollowUpTask {
  id: string;
  roomId: string;
  engagementId?: string;
  title: string;
  description: string;
  assignedToId: string;
  assignedToName: string;
  assignedRole: ParticipantMeetingRole;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  documentRequestType?: string;
  createdAt: string;
}

export interface MeetingAuditEvent {
  id: string;
  roomId: string;
  timestamp: string;
  eventType:
    | 'room_created'
    | 'token_issued'
    | 'waiting_room_entered'
    | 'participant_admitted'
    | 'participant_denied'
    | 'participant_joined'
    | 'participant_left'
    | 'audio_toggled'
    | 'video_toggled'
    | 'screen_share_started'
    | 'screen_share_stopped'
    | 'document_opened'
    | 'document_reviewed'
    | 'privacy_blur_activated'
    | 'consent_recorded'
    | 'meeting_completed'
    | 'security_terminated'
    | 'incident_reported';
  userId: string;
  userName: string;
  role: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export interface SecurityIncident {
  id: string;
  roomId: string;
  reporterId: string;
  reporterName: string;
  timestamp: string;
  incidentType:
    | 'unauthorized_presence'
    | 'suspicious_activity'
    | 'potential_recording'
    | 'inappropriate_conduct'
    | 'tampering';
  description: string;
  actionTaken: string;
  status: 'reported' | 'investigating' | 'resolved';
}

export interface WebRtcSignalingMessage {
  roomId: string;
  fromParticipantId: string;
  toParticipantId?: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'room-state-update';
  payload: any;
  timestamp: string;
}
