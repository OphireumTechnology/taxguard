/**
 * TaxGuard Practice Operations API Routes
 * Comprehensive endpoints for:
 * - Durable background jobs & dead-letter queue
 * - Practice tasks & authoritative dependency gates
 * - Staff assignments & caseload workload
 * - Deadlines & escalation triggers
 * - Client communications (CLIENT_VISIBLE vs INTERNAL_ONLY)
 * - Request center lifecycle
 * - Notification orchestration & user preferences
 * - Service catalog, engagements, and deterministic invoicing
 * - Stripe webhook verification with durable idempotency
 * - Global operational search with PII scrubbing
 * - Practice analytics & Case Command Center
 * - Data retention, legal hold, archive integrity, and annual rollover
 */

import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../auth';
import { globalDurableJobQueueService } from '../taxguard/operations/durableJobQueue.service';
import { globalPracticeTaskService } from '../taxguard/operations/practiceTask.service';
import { globalStaffAssignmentService } from '../taxguard/operations/staffAssignment.service';
import { globalDeadlineEscalationService } from '../taxguard/operations/deadlineEscalation.service';
import { globalClientCommunicationService } from '../taxguard/operations/clientCommunication.service';
import { globalClientRequestService } from '../taxguard/operations/clientRequest.service';
import { globalNotificationOrchestratorService } from '../taxguard/operations/notificationOrchestrator.service';
import { globalEngagementBillingService } from '../taxguard/operations/engagementBilling.service';
import { globalOperationalSearchService } from '../taxguard/operations/operationalSearch.service';
import { globalPracticeAnalyticsService } from '../taxguard/operations/practiceAnalytics.service';
import { globalDataRetentionRecoveryService } from '../taxguard/operations/dataRetentionRecovery.service';
import { globalDurableIdempotencyService } from '../taxguard/operations/durableIdempotency.service';

export const practiceOperationsRouter = Router();

function getTenantId(req: AuthenticatedRequest): string {
  return (req.user as any)?.tenantId || process.env.TAXGUARD_TENANT_ID || 'tenantA';
}

// ==============================================================================
// PUBLIC / WEBHOOK ROUTES (NO JWT AUTH REQUIRED)
// ==============================================================================

practiceOperationsRouter.post('/payments/webhook', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const result = await globalEngagementBillingService.handleStripeWebhook(payload, signature, secret);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'STRIPE_WEBHOOK_ERROR' });
  }
});

// Authenticate all remaining operational endpoints
practiceOperationsRouter.use(authenticateToken);

// ==============================================================================
// 1. DURABLE BACKGROUND JOBS
// ==============================================================================

practiceOperationsRouter.get('/jobs', (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === 'client') {
    return res.status(403).json({ error: 'FORBIDDEN: Clients cannot inspect background job queues.' });
  }
  const tenantId = getTenantId(req);
  const result = globalDurableJobQueueService.queryJobs({
    tenantId,
    clientId: req.query.clientId as string,
    status: req.query.status as any,
    jobType: req.query.jobType as any,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  });
  res.json(result);
});

practiceOperationsRouter.post('/jobs', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === 'client') {
    return res.status(403).json({ error: 'FORBIDDEN: Clients cannot enqueue background operations.' });
  }
  const tenantId = getTenantId(req);
  try {
    const job = await globalDurableJobQueueService.enqueue({
      tenantId,
      jobType: req.body.jobType,
      payload: req.body.payload,
      clientId: req.body.clientId,
      caseId: req.body.caseId,
      priority: req.body.priority,
      maxAttempts: req.body.maxAttempts,
      idempotencyKey: req.body.idempotencyKey,
    });
    res.status(201).json({ job });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'ENQUEUE_FAILED' });
  }
});

practiceOperationsRouter.post('/jobs/:id/retry', requireRole('admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await globalDurableJobQueueService.retryDeadLetterJob(req.params.id, req.user!.id);
    res.json({ job, message: 'Job successfully re-queued for execution.' });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'RETRY_FAILED' });
  }
});

practiceOperationsRouter.post('/jobs/:id/cancel', requireRole('admin', 'super_admin', 'accountant'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await globalDurableJobQueueService.cancelJob(req.params.id, req.user!.id);
    res.json({ job });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'CANCEL_FAILED' });
  }
});

// ==============================================================================
// 2. PRACTICE TASKS & DEPENDENCY GATES
// ==============================================================================

practiceOperationsRouter.get('/tasks', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const callerClientId = req.user?.clientId || req.user?.id;

  const result = globalPracticeTaskService.queryTasks({
    tenantId,
    clientId: callerRole === 'client' ? callerClientId : (req.query.clientId as string),
    assignedUserId: req.query.assignedUserId as string,
    status: req.query.status as any,
    priority: req.query.priority as any,
  });
  res.json(result);
});

practiceOperationsRouter.post('/tasks', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  try {
    const task = await globalPracticeTaskService.createTask({
      tenantId,
      clientId: req.body.clientId,
      engagementId: req.body.engagementId,
      taxYear: req.body.taxYear,
      caseId: req.body.caseId,
      stage: req.body.stage,
      taskType: req.body.taskType,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      assignedUserId: req.body.assignedUserId,
      assignedRole: req.body.assignedRole,
      createdBy: req.user!.id,
      dueDate: req.body.dueDate,
      dependencies: req.body.dependencies,
      relatedResource: req.body.relatedResource,
    });
    res.status(201).json({ task });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'TASK_CREATION_FAILED' });
  }
});

practiceOperationsRouter.patch('/tasks/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const task = await globalPracticeTaskService.updateStatus(
      req.params.id,
      req.body.status,
      req.user!.id
    );
    res.json({ task });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'STATUS_UPDATE_FAILED' });
  }
});

practiceOperationsRouter.patch('/tasks/:id/reassign', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const task = await globalPracticeTaskService.reassignTask(
      req.params.id,
      req.body.assignedUserId,
      req.body.assignedRole,
      req.user!.id
    );
    res.json({ task });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'REASSIGN_FAILED' });
  }
});

// ==============================================================================
// 3. STAFF ASSIGNMENTS & WORKLOAD
// ==============================================================================

practiceOperationsRouter.get('/assignments/client/:clientId', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  if (req.user?.role === 'client' && (req.user?.clientId !== req.params.clientId && req.user?.id !== req.params.clientId)) {
    return res.status(403).json({ error: 'FORBIDDEN: Client access boundary violation.' });
  }
  const assignments = globalStaffAssignmentService.getClientAssignments(tenantId, req.params.clientId);
  res.json({ assignments });
});

practiceOperationsRouter.post('/assignments', requireRole('admin', 'super_admin', 'senior_reviewer'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  try {
    const assignment = await globalStaffAssignmentService.assignStaff({
      tenantId,
      clientId: req.body.clientId,
      role: req.body.role,
      userId: req.body.userId,
      assignedBy: req.user!.id,
      reason: req.body.reason,
    });
    res.json({ assignment });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'ASSIGNMENT_FAILED' });
  }
});

practiceOperationsRouter.get('/workload', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const targetUserId = (req.query.userId as string) || req.user!.id;
  const workload = globalStaffAssignmentService.getStaffWorkload(tenantId, targetUserId, req.user!.role);
  res.json({ workload });
});

// ==============================================================================
// 4. DEADLINES & ESCALATION
// ==============================================================================

practiceOperationsRouter.get('/deadlines', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const callerClientId = req.user?.clientId || req.user?.id;

  const deadlines = globalDeadlineEscalationService.queryDeadlines({
    tenantId,
    clientId: callerRole === 'client' ? callerClientId : (req.query.clientId as string),
    status: req.query.status as any,
    category: req.query.category as any,
  });
  res.json({ deadlines });
});

practiceOperationsRouter.post('/deadlines/sweep', requireRole('accountant', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const result = globalDeadlineEscalationService.runEscalationSweep(tenantId);
  res.json(result);
});

// ==============================================================================
// 5. CLIENT COMMUNICATIONS (CLIENT_VISIBLE vs INTERNAL_ONLY)
// ==============================================================================

practiceOperationsRouter.get('/communications/threads', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const callerClientId = req.user?.clientId || req.user?.id;

  const threads = globalClientCommunicationService.queryThreads({
    tenantId,
    clientId: req.query.clientId as string,
    callerRole,
    callerClientId,
  });
  res.json({ threads });
});

practiceOperationsRouter.post('/communications/threads', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const clientId = callerRole === 'client' ? (req.user?.clientId || req.user?.id) : req.body.clientId;

  try {
    const thread = await globalClientCommunicationService.createThread({
      tenantId,
      clientId,
      subject: req.body.subject,
      category: req.body.category,
      createdBy: req.user!.id,
      engagementId: req.body.engagementId,
      caseId: req.body.caseId,
    });
    res.status(201).json({ thread });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'THREAD_CREATION_FAILED' });
  }
});

practiceOperationsRouter.get('/communications/threads/:id/messages', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const callerClientId = req.user?.clientId || req.user?.id;

  const messages = globalClientCommunicationService.getThreadMessages(
    req.params.id,
    tenantId,
    callerRole,
    callerClientId
  );
  res.json({ messages });
});

practiceOperationsRouter.post('/communications/threads/:id/messages', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const callerClientId = req.user?.clientId || req.user?.id;

  try {
    const message = await globalClientCommunicationService.postMessage({
      threadId: req.params.id,
      tenantId,
      clientId: callerRole === 'client' ? callerClientId! : req.body.clientId,
      senderId: req.user!.id,
      senderRole: callerRole,
      visibility: req.body.visibility || 'CLIENT_VISIBLE',
      content: req.body.content,
      attachments: req.body.attachments,
    });
    res.status(201).json({ message });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'MESSAGE_POST_FAILED' });
  }
});

// ==============================================================================
// 6. CLIENT REQUEST CENTER
// ==============================================================================

practiceOperationsRouter.get('/requests', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const callerClientId = req.user?.clientId || req.user?.id;

  const requests = globalClientRequestService.queryRequests({
    tenantId,
    clientId: req.query.clientId as string,
    status: req.query.status as any,
    requestType: req.query.requestType as any,
    callerRole,
    callerClientId,
  });
  res.json({ requests });
});

practiceOperationsRouter.post('/requests', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  try {
    const request = await globalClientRequestService.createRequest({
      tenantId,
      clientId: req.body.clientId,
      requestType: req.body.requestType,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      dueDate: req.body.dueDate,
      createdBy: req.user!.id,
      engagementId: req.body.engagementId,
      caseId: req.body.caseId,
    });
    res.status(201).json({ request });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'REQUEST_CREATION_FAILED' });
  }
});

practiceOperationsRouter.patch('/requests/:id/respond', async (req: AuthenticatedRequest, res: Response) => {
  const clientId = req.user?.clientId || req.user?.id;
  try {
    const request = await globalClientRequestService.submitResponse({
      requestId: req.params.id,
      clientId: clientId!,
      responseText: req.body.responseText,
      responseData: req.body.responseData,
      attachments: req.body.attachments,
    });
    res.json({ request });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'RESPONSE_SUBMISSION_FAILED' });
  }
});

practiceOperationsRouter.patch('/requests/:id/resolve', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = await globalClientRequestService.resolveRequest(
      req.params.id,
      req.user!.id,
      req.body.status || 'RESOLVED'
    );
    res.json({ request });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'RESOLVE_FAILED' });
  }
});

// ==============================================================================
// 7. NOTIFICATIONS & PREFERENCES
// ==============================================================================

practiceOperationsRouter.get('/notifications', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const notifications = globalNotificationOrchestratorService.getUserNotifications(tenantId, req.user!.id);
  res.json({ notifications });
});

practiceOperationsRouter.post('/notifications/dispatch', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  try {
    const record = await globalNotificationOrchestratorService.dispatch({
      tenantId,
      recipientId: req.body.recipientId,
      recipientRole: req.body.recipientRole || 'client',
      clientId: req.body.clientId,
      templateType: req.body.templateType,
      channel: req.body.channel,
      title: req.body.title,
      body: req.body.body,
      data: req.body.data,
      isMandatorySecurity: req.body.isMandatorySecurity,
    });
    res.json({ notification: record });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'DISPATCH_FAILED' });
  }
});

practiceOperationsRouter.get('/notifications/preferences', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const prefs = globalNotificationOrchestratorService.getUserPreferences(tenantId, req.user!.id);
  res.json({ preferences: prefs });
});

practiceOperationsRouter.put('/notifications/preferences', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  globalNotificationOrchestratorService.setUserPreferences({
    tenantId,
    userId: req.user!.id,
    inAppEnabled: req.body.inAppEnabled ?? true,
    emailEnabled: req.body.emailEnabled ?? true,
    smsEnabled: req.body.smsEnabled ?? false,
    remindersEnabled: req.body.remindersEnabled ?? true,
    updatedAt: new Date().toISOString(),
  });
  res.json({ message: 'Preferences updated successfully.' });
});

// ==============================================================================
// 8. SERVICE CATALOG & DETERMINISTIC INVOICING
// ==============================================================================

practiceOperationsRouter.get('/catalog', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const catalog = globalEngagementBillingService.getServiceCatalog(tenantId);
  res.json({ catalog });
});

practiceOperationsRouter.post('/catalog', requireRole('admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  try {
    const item = await globalEngagementBillingService.addServiceToCatalog({
      tenantId,
      serviceCode: req.body.serviceCode,
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      billingMethod: req.body.billingMethod,
      baseFee: req.body.baseFee,
      isActive: req.body.isActive ?? true,
    });
    res.status(201).json({ item });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'CATALOG_ADD_FAILED' });
  }
});

practiceOperationsRouter.get('/invoices', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const callerClientId = req.user?.clientId || req.user?.id;

  const invoices = globalEngagementBillingService.queryInvoices({
    tenantId,
    clientId: req.query.clientId as string,
    status: req.query.status as any,
    callerRole,
    callerClientId,
  });
  res.json({ invoices });
});

practiceOperationsRouter.post('/invoices', requireRole('accountant', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  try {
    const invoice = await globalEngagementBillingService.createDraftInvoice({
      tenantId,
      clientId: req.body.clientId,
      engagementId: req.body.engagementId,
      dueDate: req.body.dueDate,
      lines: req.body.lines,
      adjustments: req.body.adjustments,
      tax: req.body.tax,
      createdBy: req.user!.id,
    });
    res.status(201).json({ invoice });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'INVOICE_CREATION_FAILED' });
  }
});

practiceOperationsRouter.post('/invoices/:id/issue', requireRole('accountant', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await globalEngagementBillingService.issueInvoice(req.params.id, req.user!.id);
    res.json({ invoice });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'ISSUE_FAILED' });
  }
});

practiceOperationsRouter.post('/invoices/:id/void', requireRole('admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await globalEngagementBillingService.voidInvoice(req.params.id, req.user!.id, req.body.reason);
    res.json({ invoice });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'VOID_FAILED' });
  }
});

practiceOperationsRouter.post('/invoices/:id/payments', requireRole('accountant', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  try {
    const result = await globalEngagementBillingService.recordPayment({
      tenantId,
      invoiceId: req.params.id,
      clientId: req.body.clientId,
      amount: req.body.amount,
      paymentMethod: req.body.paymentMethod || 'MANUAL_ADJUSTMENT',
      recordedBy: req.user!.id,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'PAYMENT_RECORDING_FAILED' });
  }
});

// ==============================================================================
// 9. GLOBAL SEARCH, ANALYTICS & CASE COMMAND CENTER
// ==============================================================================

practiceOperationsRouter.get('/search', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const callerClientId = req.user?.clientId || req.user?.id;

  const result = globalOperationalSearchService.search({
    tenantId,
    query: (req.query.q as string) || '',
    callerRole,
    callerClientId,
    limit: Number(req.query.limit) || 30,
  });
  res.json(result);
});

practiceOperationsRouter.get('/analytics', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const analytics = globalPracticeAnalyticsService.getPracticeAnalytics(tenantId);
  res.json({ analytics });
});

practiceOperationsRouter.get('/command-center/:clientId', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const summary = globalPracticeAnalyticsService.getCaseCommandCenter(tenantId, req.params.clientId);
  res.json({ commandCenter: summary });
});

// ==============================================================================
// 10. RETENTION, LEGAL HOLD, ARCHIVE & ROLLOVER
// ==============================================================================

practiceOperationsRouter.get('/retention/policies', requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const policies = globalDataRetentionRecoveryService.getRetentionPolicies();
  res.json({ policies });
});

practiceOperationsRouter.post('/retention/legal-hold', requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = globalDataRetentionRecoveryService.setLegalHold(
      req.body.recordCategory,
      req.body.active,
      req.user!.id,
      req.body.reason
    );
    res.json({ policy: updated });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'LEGAL_HOLD_UPDATE_FAILED' });
  }
});

practiceOperationsRouter.post('/archive/verify', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const result = globalDataRetentionRecoveryService.verifyArchiveManifest(
    req.body.manifestId,
    req.body.contentPayload,
    req.body.expectedSha256
  );
  res.json(result);
});

practiceOperationsRouter.post('/rollover', requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = globalDataRetentionRecoveryService.executeAnnualRollover({
      clientId: req.body.clientId,
      sourceTaxYear: Number(req.body.sourceTaxYear),
      targetTaxYear: Number(req.body.targetTaxYear),
      actorId: req.user!.id,
    });
    res.json({ rollover: result });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'ROLLOVER_FAILED' });
  }
});
