/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ConsultationRoom {
  id: string;
  title: string;
  hostId: string;
  participantCount?: number;
  status: 'waiting' | 'in_progress' | 'completed';
}

export interface MeetingParticipant {
  id: string;
  name: string;
  role: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
}

export interface MeetingDocumentReview {
  id: string;
  title: string;
  url?: string;
  watermarkText?: string;
  pageCount?: number;
  currentPage?: number;
}

export interface MeetingChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
}
