export interface MeetingParticipant {
  id: string;
  userId?: string;
  userName?: string;
  name?: string;
  email?: string;
  role: 'host' | 'client' | 'guest' | 'reviewer' | string;
  status: 'waiting' | 'in_meeting' | 'left' | 'admitted' | string;
  joinedAt?: string;
  audioMuted?: boolean;
  videoMuted?: boolean;
}

export interface MeetingDocumentReview {
  id: string;
  documentId?: string;
  title: string;
  docType: string;
  taxYear?: number;
  totalPages: number;
  sampleContent?: string;
  clientAcknowledged?: boolean;
  clientAcknowledgmentTimestamp?: string;
  reviewerNotes?: Array<{
    id?: string;
    authorName?: string;
    text: string;
    isInternal?: boolean;
    timestamp?: string;
  }>;
}

export interface MeetingChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  text: string;
  timestamp: string;
}

export interface ConsultationRoom {
  id: string;
  appointmentId?: string;
  referenceCode?: string;
  clientName?: string;
  title?: string;
  status: 'waiting' | 'active' | 'ended' | string;
  hostId?: string;
  hostName?: string;
  participants: MeetingParticipant[];
  documents?: MeetingDocumentReview[];
  startedAt?: string;
  endedAt?: string;
}
