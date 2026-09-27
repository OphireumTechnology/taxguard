/**
 * Messaging & Notifications Routes
 * Engagement-based communication, file attachments, and internal staff notes
 * that are STRICTLY HIDDEN from clients.
 */

import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../auth';
import { Message } from '../../types';

export const messagesRouter = Router();

// List messages for engagement or user
messagesRouter.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { engagementId, recipientId } = req.query;

  let list = Array.from(db.messages.values());

  if (engagementId && typeof engagementId === 'string') {
    list = list.filter(m => m.engagementId === engagementId);
  } else if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    // Client sees messages sent to them or sent by them
    list = list.filter(m => m.senderId === req.user!.id || m.recipientId === req.user!.id);
  }

  // CRITICAL MANDATE: Internal staff notes must be completely HIDDEN from clients!
  if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    list = list.filter(m => !m.isInternalNote);
  }

  return res.json({ messages: list });
});

// Send new message
messagesRouter.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const {
    recipientId,
    recipientName,
    engagementId,
    content,
    isInternalNote,
    attachments
  } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  // Security: Clients cannot mark messages as internal notes
  const isInternal = (req.user.role !== 'client' && req.user.role !== 'prospective_client')
    ? !!isInternalNote
    : false;

  const msgId = `msg_${randomUUID()}`;
  const newMsg: Message = {
    id: msgId,
    senderId: req.user.id,
    senderName: req.user.name,
    senderRole: req.user.role,
    recipientId: recipientId || 'user_accountant_desmond',
    recipientName: recipientName || 'Assigned Accountant',
    engagementId,
    content,
    isInternalNote: isInternal,
    attachments: attachments || [],
    isRead: false,
    createdAt: new Date().toISOString()
  };

  db.messages.set(msgId, newMsg);

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: isInternal ? 'INTERNAL_STAFF_NOTE_POSTED' : 'MESSAGE_SENT',
    resource: `Engagement #${engagementId || 'General'}`,
    details: `${isInternal ? 'Internal staff memo recorded.' : 'Encrypted direct message dispatched.'}`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.status(201).json({ message: 'Message delivered.', messageData: newMsg });
});

// Mark messages as read
messagesRouter.patch('/:id/read', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const msg = db.messages.get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found.' });

  msg.isRead = true;
  db.messages.set(msg.id, msg);

  return res.json({ success: true, message: msg });
});
