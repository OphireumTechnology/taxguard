export interface MeetingParticipant {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
}

export interface MeetingDocumentReview {
  id: string;
  documentName: string;
  totalPages: number;
  currentPage: number;
  watermarkText: string;
  downloadRestricted: boolean;
}

export interface MeetingChatMessage {
  id: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: string;
}

export interface ConsultationRoom {
  roomId: string;
  roomName: string;
  status: 'waiting' | 'active' | 'ended';
  participants: MeetingParticipant[];
  activeDocument?: MeetingDocumentReview;
  messages: MeetingChatMessage[];
}
