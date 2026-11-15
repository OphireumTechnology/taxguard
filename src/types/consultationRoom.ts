export interface MeetingParticipant {
  id: string;
  name: string;
  role: string;
  joined: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  [key: string]: any;
}

export interface MeetingDocumentReview {
  id: string;
  fileName: string;
  documentType?: string;
  watermarkText?: string;
  pageCount?: number;
  url?: string;
  approved?: boolean;
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

export interface ConsultationRoom {
  roomId: string;
  appointmentId?: string;
  title?: string;
  status: 'waiting' | 'active' | 'ended' | string;
  participants: MeetingParticipant[];
  documents?: MeetingDocumentReview[];
  messages?: MeetingChatMessage[];
  [key: string]: any;
}
