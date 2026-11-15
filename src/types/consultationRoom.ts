export interface ConsultationRoom {
  id: string;
  appointmentId?: string;
  title?: string;
  status: string;
  hostId?: string;
  startedAt?: string;
  [key: string]: any;
}

export interface MeetingParticipant {
  id: string;
  name: string;
  role: string;
  audioMuted?: boolean;
  videoMuted?: boolean;
  [key: string]: any;
}

export interface MeetingDocumentReview {
  id: string;
  fileName: string;
  pageCount?: number;
  watermarkText?: string;
  url?: string;
  [key: string]: any;
}

export interface MeetingChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  [key: string]: any;
}
