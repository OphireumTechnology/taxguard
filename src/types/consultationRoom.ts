export interface MeetingParticipant {
  id: string;
  name: string;
  role: string;
  isHost?: boolean;
  isMuted?: boolean;
  isVideoOn?: boolean;
  status?: 'connected' | 'waiting' | 'disconnected' | string;
  [key: string]: any;
}

export interface MeetingDocumentReview {
  id: string;
  documentId?: string;
  fileName: string;
  title?: string;
  category?: string;
  watermarkText?: string;
  pageCount?: number;
  previewUrl?: string;
  content?: string;
  sharedBy?: string;
  sharedAt?: string;
  [key: string]: any;
}

export interface MeetingChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  text: string;
  body?: string;
  timestamp: string;
  [key: string]: any;
}

export interface ConsultationRoom {
  id: string;
  appointmentId?: string;
  title: string;
  status: 'waiting' | 'live' | 'ended' | 'scheduled' | string;
  scheduledAt?: string;
  participants: MeetingParticipant[];
  documents?: MeetingDocumentReview[];
  messages?: MeetingChatMessage[];
  recordingEnabled?: boolean;
  [key: string]: any;
}
