export interface MeetingParticipant {
  id: string;
  name: string;
  role: 'host' | 'client' | 'guest' | string;
  joinedAt?: string;
  audioMuted?: boolean;
  videoMuted?: boolean;
  [key: string]: any;
}

export interface MeetingDocumentReview {
  id: string;
  name: string;
  url?: string;
  watermarkText?: string;
  pageCount?: number;
  currentPage?: number;
  [key: string]: any;
}

export interface MeetingChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  isHost?: boolean;
  [key: string]: any;
}

export interface ConsultationRoom {
  id: string;
  name?: string;
  appointmentId?: string;
  status: 'scheduled' | 'active' | 'ended' | string;
  hostId?: string;
  participants?: MeetingParticipant[];
  [key: string]: any;
}
