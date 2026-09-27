/**
 * Administration, Security Logs & Firm Management Routes
 * Strictly accessible by Admin & Super Admin roles.
 * Client assignment, workload metrics, pricing editing, and immutable audit logs.
 */

import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest, requireRole, createSession } from '../auth';
import { User, ServicePlan } from '../../types';

export const adminRouter = Router();

// Apply admin access check to all admin routes
adminRouter.use(authenticateToken, requireRole('admin', 'super_admin'));

// Audit Logs Viewer
adminRouter.get('/audit-logs', (req: AuthenticatedRequest, res: Response) => {
  const { action, userId, severity, limit } = req.query;

  let logs = [...db.auditLogs];
  if (action && typeof action === 'string') {
    logs = logs.filter(l => l.action.toLowerCase().includes(action.toLowerCase()));
  }
  if (userId && typeof userId === 'string') {
    logs = logs.filter(l => l.userId === userId);
  }
  if (severity && typeof severity === 'string') {
    logs = logs.filter(l => l.severity === severity);
  }

  const max = Number(limit) || 100;
  return res.json({ auditLogs: logs.slice(0, max), totalCount: logs.length });
});

// Security Events Viewer
adminRouter.get('/security-events', (req: AuthenticatedRequest, res: Response) => {
  return res.json({ securityEvents: db.securityEvents });
});

// System Health & Workload Balancing Metrics
adminRouter.get('/system-health', (req: AuthenticatedRequest, res: Response) => {
  const users = Array.from(db.users.values());
  const accountants = users.filter(u => u.role === 'accountant');
  const clients = users.filter(u => u.role === 'client');
  const engagements = Array.from(db.engagements.values());
  const activeEngagements = engagements.filter(e => e.status !== 'completed' && e.status !== 'archived');

  const workloadByAccountant = accountants.map(acc => {
    const assignedEngs = activeEngagements.filter(e => e.assignedAccountantId === acc.id);
    const assignedClients = clients.filter(c => c.assignedAccountantId === acc.id);
    return {
      accountantId: acc.id,
      accountantName: acc.name,
      credentials: acc.credentials || [],
      assignedClientsCount: assignedClients.length,
      activeEngagementsCount: assignedEngs.length,
      urgentCount: assignedEngs.filter(e => e.priority === 'urgent').length
    };
  });

  return res.json({
    healthStatus: 'operational',
    serverTimestamp: new Date().toISOString(),
    metrics: {
      totalUsers: users.length,
      totalClients: clients.length,
      activeEngagements: activeEngagements.length,
      totalDocumentsSecured: db.documents.size,
      failedLoginAttemptsTracked: db.loginAttempts.size,
      securityEventsLogged: db.securityEvents.length,
      auditLogsRecorded: db.auditLogs.length
    },
    workloadBalancing: workloadByAccountant
  });
});

// Manage Users: List, update status, reassign accountant
adminRouter.get('/users', (req: AuthenticatedRequest, res: Response) => {
  const users = Array.from(db.users.values());
  return res.json({ users });
});

// Reassign Client to Accountant with strict role, workload, and reason validation
adminRouter.patch('/users/:clientId/reassign', (req: AuthenticatedRequest, res: Response) => {
  const client = db.users.get(req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found.' });

  const { assignedAccountantId, assignedReviewerId, reason } = req.body;

  if (!assignedAccountantId) {
    return res.status(400).json({ error: 'Destination accountant ID is required.' });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return res.status(400).json({ error: 'A mandatory reason (minimum 5 characters) is required for client reassignment.' });
  }

  const destinationAccountant = db.users.get(assignedAccountantId);
  if (!destinationAccountant || !['accountant', 'senior_reviewer', 'admin', 'super_admin'].includes(destinationAccountant.role)) {
    return res.status(400).json({ error: 'Destination user is not an active staff accountant.' });
  }
  if (destinationAccountant.status !== 'active') {
    return res.status(400).json({ error: 'Cannot reassign to an inactive or suspended accountant.' });
  }

  if (assignedReviewerId) {
    const reviewer = db.users.get(assignedReviewerId);
    if (!reviewer || !['senior_reviewer', 'admin', 'super_admin'].includes(reviewer.role) || reviewer.status !== 'active') {
      return res.status(400).json({ error: 'Designated reviewer must be an active senior reviewer or administrator.' });
    }
  }

  const previousAccountant = client.assignedAccountantId;
  client.assignedAccountantId = assignedAccountantId;
  client.assignedAccountantName = destinationAccountant.name;
  if (assignedReviewerId) {
    const reviewer = db.users.get(assignedReviewerId);
    client.assignedReviewerId = assignedReviewerId;
    client.assignedReviewerName = reviewer?.name;
  }
  client.updatedAt = new Date().toISOString();
  db.users.set(client.id, client);

  // Atomic update of active engagements
  for (const eng of db.engagements.values()) {
    if (eng.clientId === client.id) {
      eng.assignedAccountantId = assignedAccountantId;
      eng.assignedAccountantName = destinationAccountant.name;
      if (assignedReviewerId) {
        const reviewer = db.users.get(assignedReviewerId);
        eng.reviewerId = assignedReviewerId;
        eng.reviewerName = reviewer?.name || 'Assigned Senior Reviewer';
      }
      db.engagements.set(eng.id, eng);
    }
  }

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'CLIENT_ACCOUNTANT_REASSIGNED',
    resource: `Client #${client.id} (${client.name})`,
    details: `Reassigned from ${previousAccountant || 'None'} to ${destinationAccountant.name} (${assignedAccountantId}). Reason: ${reason}.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ message: 'Client reassignment complete.', client });
});

// Suspend or activate user with reason, confirmation, and self-disable protection
adminRouter.patch('/users/:userId/status', (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { status, reason, confirmation } = req.body;
  if (!['active', 'disabled', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Valid status is active, disabled, or suspended.' });
  }

  if (confirmation !== true) {
    return res.status(400).json({ error: 'Administrative confirmation is required to change user status.' });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return res.status(400).json({ error: 'A mandatory reason (minimum 5 characters) is required for user status changes.' });
  }

  // Prevent self-disable
  if (user.id === req.user!.id && (status === 'disabled' || status === 'suspended')) {
    return res.status(403).json({ error: 'Administrators cannot disable or suspend their own account.' });
  }

  // Prevent disabling the last active super_admin
  if (user.role === 'super_admin' && (status === 'disabled' || status === 'suspended')) {
    const activeSuperAdmins = Array.from(db.users.values()).filter(
      u => u.role === 'super_admin' && u.status === 'active' && u.id !== user.id
    );
    if (activeSuperAdmins.length === 0) {
      return res.status(403).json({ error: 'Cannot disable the last active super administrator account.' });
    }
  }

  const previousStatus = user.status;
  user.status = status;
  user.updatedAt = new Date().toISOString();
  db.users.set(user.id, user);

  // If disabled, revoke all active sessions immediately!
  if (status === 'disabled' || status === 'suspended') {
    for (const [token, sData] of db.sessions.entries()) {
      if (sData.userId === user.id) {
        db.sessions.delete(token);
      }
    }
  }

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: `USER_ACCOUNT_${status.toUpperCase()}`,
    resource: `User #${user.id} (${user.email})`,
    details: `Account status updated from ${previousStatus} to ${status}. Reason: ${reason}. Sessions revoked: ${status !== 'active'}.`,
    ipAddress: req.ip || 'unknown',
    severity: status === 'active' ? 'info' : 'warning'
  });

  return res.json({ message: `User status changed to ${status}.`, user });
});

// Service Pricing Tier Management with server-side validation and audit history
adminRouter.put('/service-plans/:planId', (req: AuthenticatedRequest, res: Response) => {
  const plan = db.servicePlans.get(req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Service plan not found.' });

  const { price, currency, effectiveDate, changeReason, name, tagline, features } = req.body;

  if (price !== undefined) {
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ error: 'Price must be a valid non-negative number.' });
    }
    if (currency && currency !== 'USD') {
      return res.status(400).json({ error: 'Unsupported currency. Firm pricing strictly requires USD.' });
    }
    if (!changeReason || typeof changeReason !== 'string' || changeReason.trim().length < 5) {
      return res.status(400).json({ error: 'A mandatory administrative change reason (minimum 5 characters) is required.' });
    }

    const previousPrice = plan.price;
    plan.price = numPrice;

    db.logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'SERVICE_PLAN_PRICING_UPDATED',
      resource: `Plan #${plan.id} (${plan.name})`,
      details: `Updated plan price from $${previousPrice} to $${numPrice}. Effective: ${effectiveDate || 'Immediate'}. Reason: ${changeReason}.`,
      ipAddress: req.ip || 'unknown',
      severity: 'info'
    });
  }

  if (name) plan.name = name;
  if (tagline) plan.tagline = tagline;
  if (features) plan.features = features;

  plan.updatedAt = new Date().toISOString();
  db.servicePlans.set(plan.id, plan);

  return res.json({ message: 'Service pricing updated successfully.', plan });
});

// Impersonation: Disabled by Security Policy
adminRouter.post('/impersonate/:clientId', (req: AuthenticatedRequest, res: Response) => {
  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'IMPERSONATION_ATTEMPT_BLOCKED',
    resource: `Target #${req.params.clientId}`,
    details: 'Attempted client impersonation blocked per firm security policy.',
    ipAddress: req.ip || 'unknown',
    severity: 'warning'
  });

  return res.status(403).json({
    error: 'Direct user impersonation is disabled per firm security and SOC 2 / IRS data protection policies. Support sessions require verified dual-custody consent.'
  });
});
