export type ParticipantMeetingRole = 'host' | 'client' | 'observer' | 'reviewer';

export interface MeetingParticipant {
  userId: string;
  name?: string;
  role: ParticipantMeetingRole;
  joinedAt: string;
  leftAt?: string;
}

export interface MeetingDocumentReview {
  id: string;
  documentId: string;
  name: string;
  url?: string;
}

export interface MeetingChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface MeetingFollowUpTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface MeetingAuditEvent {
  id: string;
  action: string;
  timestamp: string;
}

export interface SecurityIncident {
  id: string;
  severity: string;
  description: string;
}

export interface WebRtcSignalingMessage {
  type: string;
  payload: unknown;
}

export interface SecureMeetingRoom {
  id: string;
  appointmentId?: string;
  status: string;
  participants: MeetingParticipant[];
  createdAt: string;
}
