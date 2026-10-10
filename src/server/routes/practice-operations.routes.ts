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

import { readClientService,readClientServiceConversation,readClientServiceRequest } from '../clientServiceProjection';
import { projectPracticeManager } from '../practiceManagerProjection';
import { globalAuthorityDatabase } from '../taxguard/transactionalDatabase';
import { Router, Response } from 'express';
import {
  authenticateToken,
  AuthenticatedRequest,
  requireRole,
  resolveAuthorizedClientContext
} from '../auth';
import { db } from '../db';
import { getSupabaseAdmin } from '../supabase';
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
import { isStaffCurrentlyAssignedToClient } from '../assignment-authorization';

export const practiceOperationsRouter = Router();

practiceOperationsRouter.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const configured = (process.env.TAXGUARD_TENANT_ID || '').trim();
    if (!configured) {
      return res.status(500).json({
        code: 'PRODUCTION_TENANT_REQUIRED',
        error: 'PRODUCTION_TENANT_REQUIRED: Missing authoritative production TAXGUARD_TENANT_ID.',
      });
    }

    const headerTenant = ((req.headers['x-tenant-id'] as string) || '').trim();
    if (headerTenant && headerTenant !== configured) {
      return res.status(403).json({
        code: 'CROSS_TENANT_ACCESS_DENIED',
        error: 'CROSS_TENANT_ACCESS_DENIED: Request tenant does not match authoritative production tenant.',
      });
    }
  }
  next();
});

function getTenantId(req: AuthenticatedRequest): string {
  const configured = (process.env.TAXGUARD_TENANT_ID || '').trim();
  if (process.env.NODE_ENV === 'production') {
    if (!configured) {
      throw new Error('PRODUCTION_TENANT_REQUIRED: Missing authoritative production TAXGUARD_TENANT_ID.');
    }
    return configured;
  }
  return (req.user as any)?.tenantId || configured || 'tenantA';
}

function resolveRouteClientContext(
  req: AuthenticatedRequest,
  res: Response,
  resourceType: string,
  selectedClientId?: string
) {
  const requested =
    selectedClientId ||
    (req.params.clientId as string | undefined) ||
    (req.query.clientId as string | undefined) ||
    (req.body?.clientId as string | undefined);
  const context = resolveAuthorizedClientContext(req, res, resourceType, requested);
  if (!context) return null;

  const tenantId = getTenantId(req);
  if (context.tenantId !== tenantId) {
    db.logSecurityEvent({
      eventType: 'CROSS_TENANT_ACCESS_ATTEMPT',
      ipAddress: req.ip || 'unknown',
      userId: req.user?.id,
      resourceType,
      authorizationResult: 'denied',
      details: `Denied ${resourceType} access for a session outside the active tenant.`,
      severity: 'critical'
    });
    res.status(403).json({ error: 'Client tenant context is not authorized.', code: 'CLIENT_ACCESS_DENIED' });
    return null;
  }
  return context;
}

// Dedicated operations reads: exact role, canonical membership and verified client grants.
practiceOperationsRouter.get(['/client-service/dashboard','/client-service/search','/client-service/conversation','/client-service/request'],authenticateToken,async(req:AuthenticatedRequest,res)=>{
 res.setHeader('Cache-Control','no-store');const user=req.user!;const tenant=user.tenantId;
 if(user.role!=='operations'||user.status!=='active'||!tenant||(process.env.NODE_ENV==='production'&&tenant!==process.env.TAXGUARD_TENANT_ID?.trim())||(req.query.tenantId&&req.query.tenantId!==tenant)||(req.get('x-tenant-id')&&req.get('x-tenant-id')!==tenant))return res.status(403).json({code:'CLIENT_SERVICE_REQUIRED'});
 const year=req.query.taxYear===undefined?undefined:Number(req.query.taxYear);
 if(year!==undefined&&(!Number.isInteger(year)||year<2022||year>2200))return res.status(400).json({code:'INVALID_TAX_YEAR'});
 if(req.path.endsWith('/search')&&(typeof req.query.q!=='string'||req.query.q.trim().length<2||req.query.q.length>100))return res.status(400).json({code:'INVALID_SEARCH_QUERY'});
 if(process.env.NODE_ENV==='production')return res.status(503).json({code:'DURABLE_CLIENT_SERVICE_PROVIDER_REQUIRED'});
 try{
  const sources={database:globalAuthorityDatabase,requests:globalClientRequestService,communications:globalClientCommunicationService,tasks:globalPracticeTaskService.queryTasks({tenantId:tenant,limit:Number.MAX_SAFE_INTEGER}).tasks,deadlines:globalDeadlineEscalationService.queryDeadlines({tenantId:tenant})};
  const read=await readClientService(sources,tenant,user.id,user.authorizedClientIds||[],year);
  if(req.path.endsWith('/search'))return res.json({tenantId:tenant,matches:globalOperationalSearchService.searchAuthorizedCases(read.snapshot.cases,String(req.query.q))});
  if(req.path.endsWith('/conversation'))return res.json(readClientServiceConversation(sources,read,tenant,String(req.query.threadId||''),String(req.query.caseKey||'')));
  if(req.path.endsWith('/request'))return res.json(readClientServiceRequest(sources,read,tenant,String(req.query.requestId||''),String(req.query.caseKey||'')));
  return res.json(read.snapshot);
 }catch{return res.status(403).json({code:'CLIENT_SERVICE_SCOPE_DENIED'});}
});
// Read-only operational projection. This role is never promoted to administrator.
practiceOperationsRouter.get('/manager-dashboard', authenticateToken, async(req:AuthenticatedRequest,res)=>{
 res.setHeader('Cache-Control','no-store');const user=req.user!;const tenant=user.tenantId;
 if(user.role!=='practice_manager'||user.status!=='active'||!tenant||(process.env.NODE_ENV==='production'&&tenant!==process.env.TAXGUARD_TENANT_ID?.trim())||(req.query.tenantId&&req.query.tenantId!==tenant)||(req.get('x-tenant-id')&&req.get('x-tenant-id')!==tenant))return res.status(403).json({code:'PRACTICE_MANAGER_REQUIRED'});
 const year=req.query.taxYear===undefined?undefined:Number(req.query.taxYear);
 if(year!==undefined && (!Number.isInteger(year)||year<2022||year>2200))return res.status(400).json({code:'INVALID_TAX_YEAR'});
 if(process.env.NODE_ENV==='production')return res.status(503).json({code:'DURABLE_OPERATIONS_PROVIDER_REQUIRED'});
 try{
  const tasks=globalPracticeTaskService.queryTasks({tenantId:tenant,limit:Number.MAX_SAFE_INTEGER}).tasks;
  const deadlines=globalDeadlineEscalationService.queryDeadlines({tenantId:tenant});
  return res.json(await projectPracticeManager(globalAuthorityDatabase,tenant,user.id,user.authorizedClientIds||[],year,tasks,deadlines));
 }catch{return res.status(403).json({code:'PRACTICE_MANAGER_SCOPE_DENIED'});}
});
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
practiceOperationsRouter.use((req: AuthenticatedRequest, res: Response, next) => {
  if (req.user?.role !== 'client' && req.user?.role !== 'prospective_client') return next();
  const selectedClientId =
    (req.params.clientId as string | undefined) ||
    (req.query.clientId as string | undefined) ||
    (req.body?.clientId as string | undefined);
  const context = resolveAuthorizedClientContext(req, res, 'practice_operation', selectedClientId);
  if (!context) return;
  req.authorizedClientContext = context;
  next();
});

// ==============================================================================
// 1. DURABLE BACKGROUND JOBS
// ==============================================================================

practiceOperationsRouter.get('/jobs', (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const isClient = role === 'client' || role === 'prospective_client';
  const isAdministrator = ['admin', 'administrator', 'super_admin', 'super_administrator'].includes(role || '');
  const requestedClientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
  const context = isClient
    ? req.authorizedClientContext
    : requestedClientId
      ? resolveRouteClientContext(req, res, 'job_list', requestedClientId)
      : null;
  if (isClient && !context) {
    return res.status(403).json({ error: 'Authorized client context is unavailable.', code: 'CLIENT_CONTEXT_UNAVAILABLE' });
  }
  if (requestedClientId && !context) return;
  if (!isClient && !requestedClientId && !isAdministrator) {
    return res.status(403).json({ error: 'Explicit assigned-client selection is required.', code: 'CLIENT_ACCESS_DENIED' });
  }
  const tenantId = getTenantId(req);
  const result = globalDurableJobQueueService.queryJobs({
    tenantId,
    clientId: context?.clientId,
    status: req.query.status as any,
    jobType: req.query.jobType as any,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  });
  res.json(result);
});

practiceOperationsRouter.post('/jobs', async (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const isAdministrator = ['admin', 'administrator', 'super_admin', 'super_administrator'].includes(role || '');
  if (role === 'client' || role === 'prospective_client') {
    return res.status(403).json({ error: 'FORBIDDEN: Clients cannot enqueue background operations.' });
  }
  const context = req.body.clientId
    ? resolveRouteClientContext(req, res, 'job_create', req.body.clientId)
    : null;
  if (req.body.clientId && !context) return;
  if (!req.body.clientId && !isAdministrator) {
    return res.status(403).json({ error: 'Explicit assigned-client selection is required.', code: 'CLIENT_ACCESS_DENIED' });
  }
  const tenantId = getTenantId(req);
  try {
    const job = await globalDurableJobQueueService.enqueue({
      tenantId,
      jobType: req.body.jobType,
      payload: req.body.payload,
      clientId: context?.clientId,
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
    const tenantId = getTenantId(req);
    const existingJob = globalDurableJobQueueService.getJob(req.params.id, tenantId);
    if (!existingJob) return res.status(404).json({ error: 'JOB_NOT_FOUND' });

    const isAdministrator = ['admin', 'administrator', 'super_admin', 'super_administrator'].includes(req.user?.role || '');
    if (existingJob.clientId) {
      if (!resolveRouteClientContext(req, res, 'job_cancel', existingJob.clientId)) return;
    } else if (!isAdministrator) {
      return res.status(403).json({ error: 'Explicit authorized tenant scope is required.', code: 'CLIENT_ACCESS_DENIED' });
    }

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
  const context = callerRole === 'client' || callerRole === 'prospective_client'
    ? req.authorizedClientContext
    : (req.query.clientId ? resolveRouteClientContext(req, res, 'task_list') : null);
  if ((callerRole === 'client' || callerRole === 'prospective_client') && !context) return;
  if (req.query.clientId && !context) return;

  const result = globalPracticeTaskService.queryTasks({
    tenantId,
    clientId: context?.clientId,
    assignedUserId: callerRole === 'admin' || callerRole === 'super_admin'
      ? req.query.assignedUserId as string
      : req.user?.id,
    status: req.query.status as any,
    priority: req.query.priority as any,
  });
  res.json(result);
});

practiceOperationsRouter.post('/tasks', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const context = resolveRouteClientContext(req, res, 'task_create');
  if (!context) return;
  try {
    const task = await globalPracticeTaskService.createTask({
      tenantId,
      clientId: context.clientId,
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
  const existingTask = globalPracticeTaskService.queryTasks({ tenantId: getTenantId(req), limit: 1000 })
    .tasks.find(task => task.id === req.params.id);
  if (!existingTask) return res.status(404).json({ error: 'Task not found.' });
  if (!resolveRouteClientContext(req, res, 'task_status', existingTask.clientId)) return;
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
  const existingTask = globalPracticeTaskService.queryTasks({ tenantId: getTenantId(req), limit: 1000 })
    .tasks.find(task => task.id === req.params.id);
  if (!existingTask) return res.status(404).json({ error: 'Task not found.' });
  if (!resolveRouteClientContext(req, res, 'task_reassign', existingTask.clientId)) return;
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
  const context = resolveRouteClientContext(req, res, 'client_assignments', req.params.clientId);
  if (!context) return;
  const assignments = globalStaffAssignmentService.getClientAssignments(tenantId, context.clientId);
  res.json({ assignments });
});

practiceOperationsRouter.post('/assignments', requireRole('admin', 'super_admin', 'senior_reviewer'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const context = resolveRouteClientContext(req, res, 'assignment_create');
  if (!context) return;
  if (process.env.NODE_ENV === 'production') {
    try {
      const { error } = await getSupabaseAdmin().rpc('taxguard_assign_staff', {
        p_tenant_id: tenantId,
        p_client_id: context.clientId,
        p_engagement_id: req.body.engagementId || null,
        p_tax_year: req.body.taxYear || null,
        p_role: req.body.role,
        p_user_id: req.body.userId,
        p_assigned_by: req.user!.id,
        p_reason: req.body.reason || null
      });
      if (error) {
        return res.status(503).json({
          error: 'Staff assignment could not be durably authorized.',
          code: 'STAFF_ASSIGNMENT_PERSISTENCE_UNAVAILABLE'
        });
      }
    } catch {
      return res.status(503).json({
        error: 'Staff assignment could not be durably authorized.',
        code: 'STAFF_ASSIGNMENT_PERSISTENCE_UNAVAILABLE'
      });
    }
  }
  try {
    const assignment = await globalStaffAssignmentService.assignStaff({
      tenantId,
      clientId: context.clientId,
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
  const context = callerRole === 'client' || callerRole === 'prospective_client'
    ? req.authorizedClientContext
    : (req.query.clientId ? resolveRouteClientContext(req, res, 'deadline_list') : null);
  if ((callerRole === 'client' || callerRole === 'prospective_client') && !context) return;
  if (req.query.clientId && !context) return;
  if (!context && !['admin', 'administrator', 'super_admin', 'super_administrator'].includes(callerRole)) {
    return res.status(403).json({ error: 'Explicit assigned-client selection is required.', code: 'CLIENT_ACCESS_DENIED' });
  }

  const deadlines = globalDeadlineEscalationService.queryDeadlines({
    tenantId,
    clientId: context?.clientId,
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
  const isClient = callerRole === 'client' || callerRole === 'prospective_client';
  const context = isClient
    ? req.authorizedClientContext
    : resolveRouteClientContext(req, res, 'communication_threads');
  if (!context) return;

  const threads = globalClientCommunicationService.queryThreads({
    tenantId,
    clientId: context.clientId,
    callerRole: isClient ? 'client' : callerRole,
    callerClientId: context.clientId,
  });
  res.json({ threads });
});

practiceOperationsRouter.post('/communications/threads', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const context = resolveRouteClientContext(req, res, 'communication_thread_create');
  if (!context) return;
  const clientId = context.clientId;

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
  const isClient = callerRole === 'client' || callerRole === 'prospective_client';
  const context = isClient ? req.authorizedClientContext : resolveRouteClientContext(req, res, 'communication_messages');
  if (!context) return;
  const thread = globalClientCommunicationService.getThread(req.params.id, tenantId);
  if (!thread) return res.status(404).json({ error: 'Communication thread not found.' });
  if (!resolveRouteClientContext(req, res, 'communication_messages', thread.clientId)) return;

  try {
    const messages = globalClientCommunicationService.getThreadMessages(
      req.params.id,
      tenantId,
      isClient ? 'client' : callerRole,
      context.clientId,
      context.clientId
    );
    res.json({ messages });
  } catch {
    db.logSecurityEvent({
      eventType: 'CLIENT_RESOURCE_ACCESS_DENIED',
      ipAddress: req.ip || 'unknown',
      userId: req.user?.id,
      resourceType: 'communication_messages',
      authorizationResult: 'denied',
      details: 'Denied communication message access outside the authorized client context.',
      severity: 'warning'
    });
    return res.status(404).json({ error: 'Communication thread not found.' });
  }
});

practiceOperationsRouter.post('/communications/threads/:id/messages', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const callerRole = req.user?.role || 'client';
  const context = resolveRouteClientContext(req, res, 'communication_message_create');
  if (!context) return;

  try {
    const message = await globalClientCommunicationService.postMessage({
      threadId: req.params.id,
      tenantId,
      clientId: context.clientId,
      senderId: req.user!.id,
      senderRole: ['client', 'prospective_client'].includes(callerRole) ? 'client' : callerRole,
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
  const isClient = callerRole === 'client' || callerRole === 'prospective_client';
  const context = isClient
    ? req.authorizedClientContext
    : (req.query.clientId
      ? resolveRouteClientContext(req, res, 'client_requests')
      : null);
  if ((isClient || req.query.clientId) && !context) return;
  if (!isClient && !context && !['admin', 'administrator', 'super_admin', 'super_administrator'].includes(callerRole)) {
    return res.status(403).json({ error: 'Explicit assigned-client selection is required.', code: 'CLIENT_ACCESS_DENIED' });
  }

  const requests = globalClientRequestService.queryRequests({
    tenantId,
    clientId: context?.clientId,
    status: req.query.status as any,
    requestType: req.query.requestType as any,
    callerRole: isClient ? 'client' : callerRole,
    callerClientId: context?.clientId,
  });
  res.json({ requests });
});

practiceOperationsRouter.post('/requests', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const context = resolveRouteClientContext(req, res, 'client_request_create');
  if (!context) return;
  try {
    const request = await globalClientRequestService.createRequest({
      tenantId,
      clientId: context.clientId,
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
  if (!['client', 'prospective_client'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'Client role required.', code: 'CLIENT_ROLE_REQUIRED' });
  }
  const context = req.authorizedClientContext;
  if (!context) return res.status(403).json({ error: 'Authorized client context is unavailable.', code: 'CLIENT_CONTEXT_UNAVAILABLE' });
  try {
    const request = await globalClientRequestService.submitResponse({
      requestId: req.params.id,
      clientId: context.clientId,
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
  const target = globalClientRequestService.getRequest(req.params.id);
  if (!target) return res.status(404).json({ error: 'Client request not found.' });
  if (!resolveRouteClientContext(req, res, 'client_request_resolution', target.clientId)) return;
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

practiceOperationsRouter.post('/notifications/dispatch', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  if (req.body.clientId && !resolveRouteClientContext(req, res, 'notification_dispatch')) return;
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
  const isClient = callerRole === 'client' || callerRole === 'prospective_client';
  const context = isClient
    ? req.authorizedClientContext
    : (req.query.clientId ? resolveRouteClientContext(req, res, 'invoice_list') : null);
  if ((isClient || req.query.clientId) && !context) return;
  if (!isClient && !context && !['admin', 'administrator', 'super_admin', 'super_administrator'].includes(callerRole)) {
    return res.status(403).json({ error: 'Explicit assigned-client selection is required.', code: 'CLIENT_ACCESS_DENIED' });
  }

  const invoices = globalEngagementBillingService.queryInvoices({
    tenantId,
    clientId: context?.clientId,
    status: req.query.status as any,
    callerRole: isClient ? 'client' : callerRole,
    callerClientId: context?.clientId,
  });
  res.json({ invoices });
});

practiceOperationsRouter.post('/invoices', requireRole('accountant', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const context = resolveRouteClientContext(req, res, 'invoice_create');
  if (!context) return;
  try {
    const invoice = await globalEngagementBillingService.createDraftInvoice({
      tenantId,
      clientId: context.clientId,
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
  const invoiceRecord = globalEngagementBillingService.getInvoice(req.params.id);
  if (!invoiceRecord) return res.status(404).json({ error: 'Invoice not found.' });
  if (!resolveRouteClientContext(req, res, 'invoice_issue', invoiceRecord.clientId)) return;
  try {
    const invoice = await globalEngagementBillingService.issueInvoice(req.params.id, req.user!.id);
    res.json({ invoice });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'ISSUE_FAILED' });
  }
});

practiceOperationsRouter.post('/invoices/:id/void', requireRole('admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const invoiceRecord = globalEngagementBillingService.getInvoice(req.params.id);
  if (!invoiceRecord) return res.status(404).json({ error: 'Invoice not found.' });
  if (!resolveRouteClientContext(req, res, 'invoice_void', invoiceRecord.clientId)) return;
  try {
    const invoice = await globalEngagementBillingService.voidInvoice(req.params.id, req.user!.id, req.body.reason);
    res.json({ invoice });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'VOID_FAILED' });
  }
});

practiceOperationsRouter.post('/invoices/:id/payments', requireRole('accountant', 'admin', 'super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const invoiceRecord = globalEngagementBillingService.getInvoice(req.params.id);
  if (!invoiceRecord) return res.status(404).json({ error: 'Invoice not found.' });
  const context = resolveRouteClientContext(
    req,
    res,
    'invoice_payment',
    typeof req.body.clientId === 'string' ? req.body.clientId : invoiceRecord.clientId
  );
  if (!context) return;
  if (context.clientId !== invoiceRecord.clientId) {
    db.logSecurityEvent({
      eventType: 'CLIENT_RESOURCE_ACCESS_DENIED',
      ipAddress: req.ip || 'unknown',
      userId: req.user?.id,
      resourceType: 'invoice_payment',
      authorizationResult: 'denied',
      details: 'Denied payment recording because the requested client does not own the invoice.',
      severity: 'warning'
    });
    return res.status(403).json({ error: 'Access to this invoice is denied.', code: 'CLIENT_ACCESS_DENIED' });
  }
  try {
    const result = await globalEngagementBillingService.recordPayment({
      tenantId,
      invoiceId: req.params.id,
      clientId: context.clientId,
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
  const isClient = callerRole === 'client' || callerRole === 'prospective_client';
  const context = isClient ? req.authorizedClientContext : undefined;
  if (isClient && !context) return res.status(403).json({ error: 'Authorized client context is unavailable.', code: 'CLIENT_CONTEXT_UNAVAILABLE' });

  const result = globalOperationalSearchService.search({
    tenantId,
    query: (req.query.q as string) || '',
    callerRole: isClient ? 'client' : callerRole,
    callerClientId: context?.clientId,
    limit: Number(req.query.limit) || 30,
  });
  if (['admin', 'administrator', 'super_admin', 'super_administrator'].includes(callerRole)) {
    result.matches = result.matches.filter(match => {
      if (!match.clientId) return false;
      const client = db.users.get(match.clientId) ||
        Array.from(db.users.values()).find(candidate =>
          ['client', 'prospective_client'].includes(candidate.role) && candidate.clientId === match.clientId
        );
      return client?.tenantId === tenantId;
    });
    result.totalMatches = result.matches.length;
  }
  if (['accountant', 'senior_reviewer', 'reviewer', 'preparer'].includes(callerRole)) {
    const user = req.user!;
    result.matches = result.matches.filter(match => {
      if (!match.clientId) return false;
      const client = db.users.get(match.clientId) ||
        Array.from(db.users.values()).find(candidate =>
          ['client', 'prospective_client'].includes(candidate.role) && candidate.clientId === match.clientId
        );
      return isStaffCurrentlyAssignedToClient({
        userId: user.id,
        tenantId,
        clientId: match.clientId,
        clientTenantId: client?.tenantId,
        assignments: db.getClientBindings(match.clientId),
        authorizedClientIds: user.authorizedClientIds,
        production: process.env.NODE_ENV === 'production'
      });
    });
    result.totalMatches = result.matches.length;
  } else if (!isClient && !['admin', 'administrator', 'super_admin', 'super_administrator'].includes(callerRole)) {
    result.matches = [];
    result.totalMatches = result.matches.length;
  }
  res.json(result);
});

practiceOperationsRouter.get('/analytics', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const analytics = globalPracticeAnalyticsService.getPracticeAnalytics(tenantId);
  res.json({ analytics });
});

practiceOperationsRouter.get('/command-center/:clientId', requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const context = resolveRouteClientContext(req, res, 'case_command_center', req.params.clientId);
  if (!context) return;
  const summary = globalPracticeAnalyticsService.getCaseCommandCenter(tenantId, context.clientId);
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
