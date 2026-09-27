/**
 * A/R Tax Services, LLC - Secure Virtual Consultation Room Routes
 * Production Express endpoints handling room lifecycle, short-lived tokens,
 * waiting room gating, document review isolation, WebRTC signaling, and audit logging.
 */

import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthenticatedRequest, authenticateToken } from '../auth';
import { db } from '../db';
import {
  SecureMeetingRoom,
  MeetingParticipant,
  MeetingRoomStatus,
  ParticipantMeetingRole,
  MeetingDocumentReview,
  MeetingChatMessage,
  MeetingFollowUpTask,
  MeetingAuditEvent,
  SecurityIncident,
  WebRtcSignalingMessage
} from '../../types/consultationRoom';

export const consultationRoomRouter = Router();

// In-memory data structures for consultation rooms
const meetingRooms = new Map<string, SecureMeetingRoom>();
const meetingParticipants = new Map<string, MeetingParticipant>(); // key: `${roomId}_${userId}`
const meetingSignaling = new Map<string, WebRtcSignalingMessage[]>(); // key: roomId
const meetingChats = new Map<string, MeetingChatMessage[]>(); // key: roomId
const meetingDocuments = new Map<string, MeetingDocumentReview[]>(); // key: roomId
const meetingFollowUpTasks = new Map<string, MeetingFollowUpTask[]>(); // key: roomId
const meetingAuditEvents = new Map<string, MeetingAuditEvent[]>(); // key: roomId
const securityIncidents: SecurityIncident[] = [];

// Helper to seed initial room for apt_001
function getOrCreateRoom(appointmentId: string): SecureMeetingRoom {
  // Check if room already exists for this appointment
  for (const room of meetingRooms.values()) {
    if (room.appointmentId === appointmentId) return room;
  }

  // Find appointment in db
  const apt = db.appointments.get(appointmentId);
  const roomId = `room_${appointmentId}`;

  const hostRole: ParticipantMeetingRole =
    apt && (apt.accountantId === 'user_accountant_desmond' || apt.requestedFounder)
      ? 'founder'
      : 'accountant';

  const newRoom: SecureMeetingRoom = {
    id: roomId,
    appointmentId: apt ? apt.id : appointmentId,
    referenceCode: `ART-${(apt?.id || '001').slice(-3).toUpperCase()}-2026`,
    title: apt ? `${apt.serviceType} Consultation` : 'Executive Strategy Consultation',
    serviceType: apt ? apt.serviceType : 'Individual Tax Strategy & Year-End Review',
    clientUserId: apt ? apt.clientId : 'user_client_1',
    clientName: apt ? apt.clientName : 'Michael Perotti',
    clientEmail: apt ? apt.clientEmail : 'm.perotti@example.com',
    hostUserId: apt ? apt.accountantId : 'user_accountant_desmond',
    hostName: apt ? apt.accountantName : 'Desmond Hinds',
    hostRole,
    scheduledStart: apt ? `${apt.date}T10:00:00Z` : '2026-09-15T10:00:00Z',
    scheduledEnd: apt ? `${apt.date}T11:00:00Z` : '2026-09-15T11:00:00Z',
    durationMinutes: 45,
    status: 'ready_to_join',
    waitingRoomEnabled: true,
    recordingDisabledEnforced: true,
    screenShareAllowedHostOnly: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  meetingRooms.set(roomId, newRoom);

  // Seed permitted documents for Michael Perotti
  const docs: MeetingDocumentReview[] = [
    {
      id: 'mdoc_01',
      roomId,
      documentId: 'doc_w2_2025_01',
      title: '2025 Form W-2 Wage and Tax Statement (Perotti Consulting)',
      docType: 'W-2',
      taxYear: 2025,
      sampleContent: 'Employer: Perotti Financial Consulting LLC\nWages, tips, other comp: $185,000.00\nFederal income tax withheld: $34,250.00\nSocial Security wages: $168,600.00\nMedicare wages: $185,000.00\nBox 12a (401k): $23,000.00',
      totalPages: 2,
      currentPage: 1,
      clientAcknowledged: false,
      reviewerNotes: [
        {
          id: 'note_1',
          authorId: 'user_accountant_desmond',
          authorName: 'Desmond Hinds',
          text: 'Verified matching Social Security cap. Ready for Form 1040 line 1a inclusion.',
          timestamp: new Date().toISOString(),
          isInternal: true
        }
      ]
    },
    {
      id: 'mdoc_02',
      roomId,
      documentId: 'doc_1099_misc_2025',
      title: '2025 Form 1099-NEC Nonemployee Compensation',
      docType: '1099-NEC',
      taxYear: 2025,
      sampleContent: 'Payer: Southern Wealth Partners Group\nRecipient: Michael Perotti\nBox 1 Nonemployee compensation: $42,500.00\nDirect sales indicator: No\nState tax withheld: $2,125.00 (SC)',
      totalPages: 1,
      currentPage: 1,
      clientAcknowledged: true,
      clientAcknowledgmentTimestamp: new Date().toISOString(),
      reviewerNotes: []
    }
  ];
  meetingDocuments.set(roomId, docs);

  // Seed sample chat
  meetingChats.set(roomId, [
    {
      id: 'chat_init_1',
      roomId,
      senderId: 'user_accountant_desmond',
      senderName: 'Desmond Hinds',
      senderRole: 'founder',
      message: 'Welcome to your secure A/R Tax Services consultation room. All video streams and reviewed materials are encrypted in transit.',
      timestamp: new Date().toISOString(),
      isConfidential: true
    }
  ]);

  return newRoom;
}

// Seed default room on startup
getOrCreateRoom('apt_001');

// 1. Issue short-lived access token
consultationRoomRouter.post('/token', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { appointmentId } = req.body;
  const aptId = appointmentId || 'apt_001';
  const room = getOrCreateRoom(aptId);

  // Verify access authorization
  const isClient = req.user.id === room.clientUserId || req.user.email === room.clientEmail;
  const isHost = req.user.id === room.hostUserId || req.user.role === 'founder' || req.user.role === 'admin' || req.user.role === 'super_admin';
  const isReviewer = req.user.role === 'senior_reviewer';

  if (!isClient && !isHost && !isReviewer) {
    return res.status(403).json({
      error: 'Access Denied: You are not authorized to access this confidential consultation room.'
    });
  }

  const role: ParticipantMeetingRole = isHost
    ? (req.user.role === 'founder' ? 'founder' : req.user.role === 'admin' || req.user.role === 'super_admin' ? 'admin' : 'accountant')
    : isReviewer
      ? 'reviewer'
      : 'client';

  const participantKey = `${room.id}_${req.user.id}`;
  let participant = meetingParticipants.get(participantKey);

  if (!participant) {
    participant = {
      id: `part_${randomUUID().slice(0, 8)}`,
      roomId: room.id,
      userId: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role,
      isHost: isHost || role === 'founder',
      status: isHost ? 'admitted' : 'waiting',
      joinedWaitingRoomAt: new Date().toISOString(),
      audioMuted: false,
      videoMuted: false,
      screenSharingActive: false,
      connectionQuality: 'excellent',
      consentAgreed: false
    };
    meetingParticipants.set(participantKey, participant);
  }

  // Token expires in 2 hours
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const token = `vroom_${Buffer.from(JSON.stringify({
    roomId: room.id,
    userId: req.user.id,
    role,
    isHost: participant.isHost,
    exp: expiresAt
  })).toString('base64')}`;

  // Audit log
  logRoomAudit(room.id, 'token_issued', req.user.id, req.user.name, role, {
    ip: req.ip || '127.0.0.1',
    appointmentId: room.appointmentId
  });

  return res.json({
    token,
    roomId: room.id,
    participantId: participant.id,
    userId: req.user.id,
    name: req.user.name,
    role,
    isHost: participant.isHost,
    roomStatus: room.status,
    permissions: {
      canShareScreen: participant.isHost,
      canReviewDocuments: true,
      canAdmitWaitingRoom: participant.isHost,
      canEndMeeting: participant.isHost,
      canAddInternalNotes: participant.isHost || role === 'reviewer',
      canMuteParticipants: participant.isHost
    },
    expiresAt,
    roomDetails: {
      title: room.title,
      referenceCode: room.referenceCode,
      serviceType: room.serviceType,
      hostName: room.hostName,
      clientName: room.clientName,
      scheduledStart: room.scheduledStart,
      durationMinutes: room.durationMinutes,
      recordingDisabledEnforced: true
    }
  });
});

// 2. Get Room Status & Active Participants
consultationRoomRouter.get('/:roomId/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { roomId } = req.params;
  const room = meetingRooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Consultation room not found' });

  const participants = Array.from(meetingParticipants.values()).filter(p => p.roomId === roomId);

  return res.json({
    room,
    participants,
    hostPresent: participants.some(p => p.isHost && (p.status === 'in_call' || p.status === 'admitted')),
    waitingCount: participants.filter(p => p.status === 'waiting').length
  });
});

// 3. Record Pre-Call Consent & Enter Waiting Room
consultationRoomRouter.post('/:roomId/consent', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const { agreedToNoRecording, circular230NoticeAcknowledged } = req.body;

  const participantKey = `${roomId}_${req.user.id}`;
  const participant = meetingParticipants.get(participantKey);
  if (!participant) return res.status(404).json({ error: 'Participant record not found' });

  participant.consentAgreed = !!(agreedToNoRecording && circular230NoticeAcknowledged);
  participant.consentTimestamp = new Date().toISOString();

  logRoomAudit(roomId, 'consent_recorded', req.user.id, req.user.name, participant.role, {
    agreedToNoRecording,
    circular230NoticeAcknowledged,
    ip: req.ip || '127.0.0.1'
  });

  return res.json({ success: true, participant });
});

// 4. Host Admits or Denies Waiting Room Participant
consultationRoomRouter.post('/:roomId/waiting-room/action', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const { targetUserId, action } = req.body; // action: 'admit' | 'deny'

  const hostParticipant = meetingParticipants.get(`${roomId}_${req.user.id}`);
  if (!hostParticipant || !hostParticipant.isHost) {
    return res.status(403).json({ error: 'Only the meeting host can admit or deny participants' });
  }

  const targetParticipant = meetingParticipants.get(`${roomId}_${targetUserId}`);
  if (!targetParticipant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  if (action === 'admit') {
    targetParticipant.status = 'admitted';
    targetParticipant.admittedAt = new Date().toISOString();
    logRoomAudit(roomId, 'participant_admitted', req.user.id, req.user.name, hostParticipant.role, {
      admittedUserId: targetUserId,
      admittedName: targetParticipant.name
    });
  } else {
    targetParticipant.status = 'denied';
    logRoomAudit(roomId, 'participant_denied', req.user.id, req.user.name, hostParticipant.role, {
      deniedUserId: targetUserId
    });
  }

  return res.json({ success: true, participant: targetParticipant });
});

// 5. Update Participant Media State (mute audio/video, screen sharing)
consultationRoomRouter.post('/:roomId/media-state', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const { audioMuted, videoMuted, screenSharingActive, connectionQuality, rttMs } = req.body;

  const participant = meetingParticipants.get(`${roomId}_${req.user.id}`);
  if (!participant) return res.status(404).json({ error: 'Participant not found' });

  if (audioMuted !== undefined) participant.audioMuted = audioMuted;
  if (videoMuted !== undefined) participant.videoMuted = videoMuted;
  if (screenSharingActive !== undefined) {
    participant.screenSharingActive = screenSharingActive;
    logRoomAudit(roomId, screenSharingActive ? 'screen_share_started' : 'screen_share_stopped', req.user.id, req.user.name, participant.role);
  }
  if (connectionQuality) participant.connectionQuality = connectionQuality;
  if (rttMs !== undefined) participant.rttMs = rttMs;

  participant.status = 'in_call';

  return res.json({ success: true, participant });
});

// 6. WebRTC Signaling (Offers, Answers, ICE Candidates)
consultationRoomRouter.post('/:roomId/signaling', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const { toParticipantId, type, payload } = req.body;

  let signals = meetingSignaling.get(roomId);
  if (!signals) {
    signals = [];
    meetingSignaling.set(roomId, signals);
  }

  const signalMsg: WebRtcSignalingMessage = {
    roomId,
    fromParticipantId: req.user.id,
    toParticipantId,
    type,
    payload,
    timestamp: new Date().toISOString()
  };

  signals.push(signalMsg);
  // Keep last 50 signals
  if (signals.length > 50) signals.shift();

  return res.json({ success: true });
});

consultationRoomRouter.get('/:roomId/signaling', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const since = req.query.since as string;

  const signals = meetingSignaling.get(roomId) || [];
  const relevant = signals.filter(s => {
    const isToMe = !s.toParticipantId || s.toParticipantId === req.user?.id;
    const notFromMe = s.fromParticipantId !== req.user?.id;
    const isNew = !since || new Date(s.timestamp) > new Date(since);
    return isToMe && notFromMe && isNew;
  });

  return res.json({ signals: relevant });
});

// 7. Protected Document Review Endpoints
consultationRoomRouter.get('/:roomId/documents', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const room = meetingRooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // Isolation check: Only client, host, or reviewer can view
  const isAuthorized =
    req.user.id === room.clientUserId ||
    req.user.id === room.hostUserId ||
    ['founder', 'accountant', 'senior_reviewer', 'admin', 'super_admin'].includes(req.user.role);

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Unauthorized to view engagement documents' });
  }

  const docs = meetingDocuments.get(roomId) || [];
  return res.json({ documents: docs });
});

consultationRoomRouter.post('/:roomId/documents/review-action', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const { documentId, action, noteText, isInternal } = req.body; // action: 'acknowledge' | 'add_note' | 'page_change'

  const docs = meetingDocuments.get(roomId) || [];
  const doc = docs.find(d => d.documentId === documentId || d.id === documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  if (action === 'acknowledge') {
    doc.clientAcknowledged = true;
    doc.clientAcknowledgmentTimestamp = new Date().toISOString();
    logRoomAudit(roomId, 'document_reviewed', req.user.id, req.user.name, req.user.role, {
      documentId: doc.documentId,
      title: doc.title
    });
  }

  if (action === 'add_note' && noteText) {
    doc.reviewerNotes.push({
      id: `note_${randomUUID().slice(0, 6)}`,
      authorId: req.user.id,
      authorName: req.user.name,
      text: noteText,
      timestamp: new Date().toISOString(),
      isInternal: !!isInternal
    });
  }

  return res.json({ success: true, document: doc });
});

// 8. In-Meeting Chat
consultationRoomRouter.get('/:roomId/chat', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { roomId } = req.params;
  const chats = meetingChats.get(roomId) || [];
  return res.json({ messages: chats });
});

consultationRoomRouter.post('/:roomId/chat', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  let chats = meetingChats.get(roomId);
  if (!chats) {
    chats = [];
    meetingChats.set(roomId, chats);
  }

  const participant = meetingParticipants.get(`${roomId}_${req.user.id}`);
  const senderRole: ParticipantMeetingRole = participant ? participant.role : 'client';

  const newMsg: MeetingChatMessage = {
    id: `chat_${randomUUID().slice(0, 8)}`,
    roomId,
    senderId: req.user.id,
    senderName: req.user.name,
    senderRole,
    message: message.trim(),
    timestamp: new Date().toISOString(),
    isConfidential: true
  };

  chats.push(newMsg);
  return res.json({ success: true, message: newMsg });
});

// 9. End Meeting & Complete Summary
consultationRoomRouter.post('/:roomId/end', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const { clientNotesSummary, internalStaffNotes, followUpTasks } = req.body;

  const room = meetingRooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  room.status = 'completed';
  room.endedAt = new Date().toISOString();
  if (clientNotesSummary) room.clientNotesSummary = clientNotesSummary;
  if (internalStaffNotes) room.internalStaffNotes = internalStaffNotes;

  // Add follow up tasks if provided
  if (Array.isArray(followUpTasks)) {
    let existingTasks = meetingFollowUpTasks.get(roomId) || [];
    followUpTasks.forEach((t: any) => {
      existingTasks.push({
        id: `task_${randomUUID().slice(0, 6)}`,
        roomId,
        title: t.title,
        description: t.description || '',
        assignedToId: t.assignedToId || room.clientUserId,
        assignedToName: t.assignedToName || room.clientName,
        assignedRole: t.assignedRole || 'client',
        dueDate: t.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        status: 'pending',
        documentRequestType: t.documentRequestType,
        createdAt: new Date().toISOString()
      });
    });
    meetingFollowUpTasks.set(roomId, existingTasks);
  }

  logRoomAudit(roomId, 'meeting_completed', req.user.id, req.user.name, req.user.role, {
    endedAt: room.endedAt
  });

  return res.json({ success: true, room });
});

// 10. Security Incident Report & Emergency Termination
consultationRoomRouter.post('/:roomId/report-concern', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { roomId } = req.params;
  const { incidentType, description, terminateMeetingImmediately } = req.body;

  const room = meetingRooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const incident: SecurityIncident = {
    id: `inc_${randomUUID().slice(0, 8)}`,
    roomId,
    reporterId: req.user.id,
    reporterName: req.user.name,
    timestamp: new Date().toISOString(),
    incidentType: incidentType || 'suspicious_activity',
    description: description || 'Reported participant security concern during consultation.',
    actionTaken: terminateMeetingImmediately ? 'Consultation terminated immediately by security protocol.' : 'Logged for firm administrator review.',
    status: 'reported'
  };

  securityIncidents.push(incident);

  if (terminateMeetingImmediately) {
    room.status = 'security_terminated';
    room.securityTerminationReason = description;
    room.endedAt = new Date().toISOString();
    logRoomAudit(roomId, 'security_terminated', req.user.id, req.user.name, req.user.role, { incidentId: incident.id });
  } else {
    logRoomAudit(roomId, 'incident_reported', req.user.id, req.user.name, req.user.role, { incidentId: incident.id });
  }

  return res.json({ success: true, incident, roomStatus: room.status });
});

// Helper to log room audit
function logRoomAudit(
  roomId: string,
  eventType: MeetingAuditEvent['eventType'],
  userId: string,
  userName: string,
  role: string,
  details?: Record<string, any>
) {
  let events = meetingAuditEvents.get(roomId);
  if (!events) {
    events = [];
    meetingAuditEvents.set(roomId, events);
  }

  const auditEvent: MeetingAuditEvent = {
    id: `ev_${randomUUID().slice(0, 8)}`,
    roomId,
    timestamp: new Date().toISOString(),
    eventType,
    userId,
    userName,
    role,
    details
  };

  events.unshift(auditEvent);
  if (events.length > 200) events.pop();
}
