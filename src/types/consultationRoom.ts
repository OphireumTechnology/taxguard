export interface MeetingParticipant {
  id: string;
  name: string;
  role: string;
  joinedAt?: string;
  isMuted?: boolean;
  cameraEnabled?: boolean;
  [key: string]: any;
}

export interface MeetingDocumentReview {
  id: string;
  title: string;
  fileName?: string;
  url?: string;
  pageCount?: number;
  watermarked?: boolean;
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
  title?: string;
  status: string;
  participants: MeetingParticipant[];
  documents?: MeetingDocumentReview[];
  messages?: MeetingChatMessage[];
  scheduledAt?: string;
  [key: string]: any;
}
