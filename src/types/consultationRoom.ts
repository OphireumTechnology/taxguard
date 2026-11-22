export interface MeetingParticipant {
  id: string;
  userId?: string;
  name: string;
  role: string;
  status?: string;
  joinedAt?: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
  [key: string]: any;
}

export interface MeetingDocumentReview {
  id: string;
  documentId?: string;
  title: string;
  name?: string;
  fileName?: string;
  url?: string;
  watermarkText?: string;
  pageCount?: number;
  currentPage?: number;
  status?: string;
  [key: string]: any;
}

export interface MeetingChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  [key: string]: any;
}

export interface ConsultationRoom {
  id: string;
  appointmentId?: string;
  clientId?: string;
  title: string;
  status: string;
  scheduledStart?: string;
  participants: MeetingParticipant[];
  documents?: MeetingDocumentReview[];
  messages?: MeetingChatMessage[];
  recordingConsent?: boolean;
  [key: string]: any;
}
