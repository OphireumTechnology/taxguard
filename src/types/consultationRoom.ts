export interface MeetingParticipant {
  id: string;
  name: string;
  role: string;
  isHost?: boolean;
  avatar?: string;
  hasAudio?: boolean;
  hasVideo?: boolean;
}

export interface MeetingDocumentReview {
  id: string;
  title: string;
  url: string;
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
}

export interface ConsultationRoom {
  id: string;
  title: string;
  status: string;
  participants: MeetingParticipant[];
  documents: MeetingDocumentReview[];
  messages: MeetingChatMessage[];
  scheduledAt?: string;
  [key: string]: any;
}
