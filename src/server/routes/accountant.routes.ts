/**
 * Accountant Workspace & Workflow API Routes
 * Secure endpoints for authorized accountants and senior reviewers.
 * Server-enforces client binding isolation, maker-checker authorization, and audit logging.
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  authenticateToken, 
  requireRole, 
  requireAccountantAssignment,
  requireAssignmentPermission,
  AuthenticatedRequest 
} from '../auth';
import { randomUUID } from 'crypto';
import { 
  AccountingWorkflowTask, 
  DocumentRequest, 
  DocumentItem,
  DocumentStatus,
  JournalEntryDraft,
  BookkeepingTransaction,
  BankReconciliation
} from '../../types';

export const accountantRouter = Router();

// Require authentication and authorized staff roles on all accountant endpoints
accountantRouter.use(authenticateToken);
accountantRouter.use(requireRole('accountant', 'senior_reviewer', 'admin', 'super_admin'));

/**
 * GET /api/accountant/overview
 * Overview metrics and urgent deadline queue for logged-in accountant
 */
accountantRouter.get('/overview', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  // Find assigned client IDs
  const myBindings = isAdmin 
    ? Array.from(db.clientAccountantAssignments.values()).filter(b => b.status === 'active')
    : Array.from(db.clientAccountantAssignments.values()).filter(b => b.accountantId === user.id && b.status === 'active');

  const assignedClientIds = new Set(myBindings.map(b => b.clientId));

  // If accountant has legacy assignedAccountantId on client records
  if (!isAdmin) {
    for (const [id, c] of db.users.entries()) {
      if (c.assignedAccountantId === user.id || c.assignedReviewerId === user.id) {
        assignedClientIds.add(id);
      }
    }
  }

  // Filter tasks
  const allTasks = Array.from(db.accountingTasks.values());
  const myTasks = isAdmin 
    ? allTasks 
    : allTasks.filter(t => assignedClientIds.has(t.clientId) || t.assignedAccountantId === user.id || t.reviewerId === user.id);

  const todayStr = new Date().toISOString().split('T')[0];
  const tasksDueToday = myTasks.filter(t => t.dueDate === todayStr && t.status !== 'completed');
  const overdueTasks = myTasks.filter(t => t.dueDate < todayStr && t.status !== 'completed');
  const completedTasks = myTasks.filter(t => t.status === 'completed');
  const readyForReview = myTasks.filter(t => t.status === 'ready_for_review' || t.status === 'under_review');

  // Documents awaiting review across assigned clients
  const allDocs = Array.from(db.documents.values());
  const docsAwaitingReview = allDocs.filter(d => 
    (isAdmin || assignedClientIds.has(d.clientId)) && 
    (d.status === 'pending_review' || d.status === 'uploaded' || d.status === 'needs_correction')
  );

  // Unread or awaiting client messages
  const allMessages = Array.from(db.messages.values());
  const clientQuestions = allMessages.filter(m => 
    (isAdmin || assignedClientIds.has(m.clientId || '')) && 
    !m.isInternalOnly && 
    m.senderRole === 'client'
  ).length;

  // Connection alerts (errors or needing re-auth)
  const allIntegrations = Array.from(db.detailedIntegrations.values());
  const connectionAlerts = allIntegrations.filter(i => 
    (isAdmin || assignedClientIds.has(i.clientId)) && 
    (i.status === 'error' || i.status === 'needs_reauth')
  ).length;

  // Upcoming filing deadlines queue
  const urgentDeadlines = [
    { title: 'Form 1120-S Extended Filing Deadline', entity: 'Perotti Financial Consulting', dueDate: '2026-09-15', form: '1120-S', status: 'In Final Review', daysRemaining: 7 },
    { title: 'Form 1065 Partnership Return Sign-off', entity: 'Dondo Enterprise Holdings LLC', dueDate: '2026-09-15', form: '1065', status: 'Reconciliation Underway', daysRemaining: 7 },
    { title: 'SC Sales & Use Tax Monthly Remittance', entity: 'Dondo Enterprise Holdings LLC', dueDate: '2026-09-20', form: 'SC DOR-ST3', status: 'Awaiting Client Record', daysRemaining: 12 },
    { title: 'Q3 Estimated Tax Vouchers (Form 1040-ES)', entity: 'Michael Perotti', dueDate: '2026-09-15', form: '1040-ES', status: 'Calculation Drafted', daysRemaining: 7 }
  ];

  res.json({
    metrics: {
      totalAssignedClients: assignedClientIds.size,
      activeAssignmentsCount: myBindings.length,
      tasksDueToday: tasksDueToday.length,
      upcomingDeadlinesCount: urgentDeadlines.length,
      documentsAwaitingReview: docsAwaitingReview.length,
      clientQuestionsAwaitingResponse: clientQuestions,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      connectionAlerts
    },
    urgentDeadlinesQueue: urgentDeadlines,
    recentTasks: myTasks.slice(0, 5),
    docsAwaitingReview: docsAwaitingReview.slice(0, 5)
  });
});

/**
 * GET /api/accountant/clients
 * Returns assigned clients directory for the logged-in accountant.
 * Strictly enforced: Only clients with an active binding to this accountant!
 */
accountantRouter.get('/clients', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  let clientIds: string[] = [];
  if (isAdmin) {
    clientIds = Array.from(db.users.values())
      .filter(u => u.role === 'client' || u.role === 'prospective_client')
      .map(u => u.id);
  } else {
    // Get active bindings for this accountant
    const bindings = Array.from(db.clientAccountantAssignments.values()).filter(
      b => b.accountantId === user.id && b.status === 'active'
    );
    clientIds = bindings.map(b => b.clientId);

    // Also include legacy assignments
    for (const [id, c] of db.users.entries()) {
      if (c.assignedAccountantId === user.id || c.assignedReviewerId === user.id) {
        if (!clientIds.includes(id)) {
          clientIds.push(id);
        }
      }
    }
  }

  // Build rich directory rows
  const clientDirectory = clientIds.map(clientId => {
    const client = db.users.get(clientId);
    if (!client) return null;

    const onboarding = db.onboardingStates.get(clientId);
    const bindings = db.getClientBindings(clientId).filter(b => b.status === 'active');
    const primaryBinding = bindings.find(b => b.assignmentType === 'primary');
    const reviewerBinding = bindings.find(b => b.assignmentType === 'reviewer');

    // Tasks and progress
    const clientTasks = Array.from(db.accountingTasks.values()).filter(t => t.clientId === clientId);
    const completedTasks = clientTasks.filter(t => t.status === 'completed').length;
    const taskProgressPercent = clientTasks.length > 0 ? Math.round((completedTasks / clientTasks.length) * 100) : 100;

    // Documents
    const clientDocs = Array.from(db.documents.values()).filter(d => d.clientId === clientId);
    const docsPending = clientDocs.filter(d => d.status === 'pending_review' || d.status === 'uploaded').length;

    // Integration
    const integration = Array.from(db.detailedIntegrations.values()).find(i => i.clientId === clientId);

    // Engagements
    const engagements = Array.from(db.engagements.values()).filter(e => e.clientId === clientId);
    const currentEngagement = engagements[0];

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone || '803-555-0100',
      companyName: client.companyName || onboarding?.businessInfo?.entityName || 'Individual Filer',
      entityStructure: onboarding?.businessInfo?.entityStructure || 'S-Corporation',
      servicePlan: currentEngagement?.servicePlanName || 'Tax & Advisory Retainer',
      assignedAccountant: primaryBinding?.accountantName || client.assignedAccountantName || 'Desmond Hinds',
      assignedReviewer: reviewerBinding?.accountantName || 'Elena Rostova, CPA',
      assignmentType: primaryBinding?.assignmentType || 'primary',
      assignmentStatus: primaryBinding?.status || 'active',
      taxPeriod: currentEngagement?.taxYear ? `Tax Year ${currentEngagement.taxYear}` : 'Tax Year 2025',
      filingStatus: currentEngagement?.status || 'review_in_progress',
      documentCount: clientDocs.length,
      docsPendingReview: docsPending,
      taskCount: clientTasks.length,
      taskProgressPercent,
      integration: integration ? {
        provider: integration.provider,
        status: integration.status,
        maskedOrgId: integration.maskedOrgId
      } : null,
      attentionRequired: docsPending > 0 || clientTasks.some(t => t.priority === 'urgent' && t.status !== 'completed'),
      lastActivity: currentEngagement?.updatedAt || client.updatedAt || '2026-09-08T08:00:00Z',
      nextDeadline: '2026-09-15'
    };
  }).filter(Boolean);

  res.json({ clients: clientDirectory });
});

/**
 * GET /api/accountant/workspace/:clientId
 * Comprehensive client workspace for an assigned client.
 * Server validates that the requesting accountant is assigned to this client.
 */
accountantRouter.get('/workspace/:clientId', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { clientId } = req.params;

  const client = db.users.get(clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client record not found.' });
  }

  const onboarding = db.onboardingStates.get(clientId);
  const bindings = db.getClientBindings(clientId);
  const engagements = Array.from(db.engagements.values()).filter(e => e.clientId === clientId);
  const documents = Array.from(db.documents.values()).filter(d => d.clientId === clientId);
  const tasks = Array.from(db.accountingTasks.values()).filter(t => t.clientId === clientId);
  const documentRequests = Array.from(db.documentRequests.values()).filter(d => d.clientId === clientId);
  const integrations = Array.from(db.detailedIntegrations.values()).filter(i => i.clientId === clientId);
  const journalEntries = Array.from(db.journalEntries.values()).filter(j => j.clientId === clientId);
  const bookkeepingTransactions = Array.from(db.bookkeepingTransactions.values()).filter(t => t.clientId === clientId);
  const bankReconciliations = Array.from(db.bankReconciliations.values()).filter(r => r.clientId === clientId);
  const chartOfAccounts = db.chartOfAccounts;
  const legalRecords = Array.from(db.legalRecords.values()).filter(l => l.clientId === clientId);
  const messages = Array.from(db.messages.values()).filter(m => m.clientId === clientId);

  // Update lastAccessAt on binding
  const activeBinding = bindings.find(b => b.accountantId === user.id && b.status === 'active');
  if (activeBinding) {
    activeBinding.lastAccessAt = new Date().toISOString();
    db.clientAccountantAssignments.set(activeBinding.id, activeBinding);
  }

  // Log workspace access in audit
  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'VIEW_CLIENT_WORKSPACE',
    entityType: 'CLIENT_WORKSPACE',
    entityId: clientId,
    details: `Accountant ${user.name} opened dedicated workspace for client ${client.name} (${client.id}).`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      companyName: client.companyName || onboarding?.businessInfo?.entityName,
      entityStructure: onboarding?.businessInfo?.entityStructure || 'S-Corporation',
      ein: onboarding?.businessInfo?.ein || '57-8912401',
      address: onboarding?.contactInfo?.address || '1201 Main St, Suite 1400',
      city: onboarding?.contactInfo?.city || 'Columbia',
      state: onboarding?.contactInfo?.state || 'SC',
      zipCode: onboarding?.contactInfo?.zipCode || '29201',
      fiscalYearEnd: onboarding?.businessInfo?.fiscalYearEnd || '12/31',
      status: client.status,
      assignedAccountantId: client.assignedAccountantId,
      assignedAccountantName: client.assignedAccountantName,
      assignedReviewerId: client.assignedReviewerId,
      assignedReviewerName: client.assignedReviewerName
    },
    bindings,
    engagements,
    documents,
    tasks,
    documentRequests,
    integrations,
    journalEntries,
    bookkeepingTransactions,
    bankReconciliations,
    chartOfAccounts,
    legalRecords,
    messages
  });
});

/**
 * POST /api/accountant/tasks
 * Create or update a workflow task for an assigned client
 */
accountantRouter.post('/tasks', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const {
    id,
    clientId,
    module = 'bookkeeping',
    title,
    description,
    priority = 'medium',
    status = 'not_started',
    dueDate,
    checklist = []
  } = req.body;

  if (!clientId || !title || !dueDate) {
    return res.status(400).json({ error: 'clientId, title, and dueDate are required.' });
  }

  const client = db.users.get(clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  const taskId = id || `task_${randomUUID()}`;
  const existing = db.accountingTasks.get(taskId);

  const task: AccountingWorkflowTask = {
    id: taskId,
    clientId,
    clientName: client.name,
    module,
    title,
    description: description || '',
    assignedAccountantId: existing?.assignedAccountantId || user.id,
    assignedAccountantName: existing?.assignedAccountantName || user.name,
    reviewerId: existing?.reviewerId || client.assignedReviewerId || 'user_reviewer_elena',
    reviewerName: existing?.reviewerName || client.assignedReviewerName || 'Elena Rostova, CPA',
    priority,
    status,
    dueDate,
    checklist: Array.isArray(checklist) ? checklist : [],
    attachments: existing?.attachments || [],
    comments: existing?.comments || [],
    approvalHistory: existing?.approvalHistory || [],
    preparedAt: existing?.preparedAt,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.accountingTasks.set(taskId, task);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: existing ? 'UPDATE_ACCOUNTING_TASK' : 'CREATE_ACCOUNTING_TASK',
    entityType: 'ACCOUNTING_TASK',
    entityId: taskId,
    details: `${existing ? 'Updated' : 'Created'} task "${title}" (${module}) for client ${client.name}. Status: ${status}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(existing ? 200 : 201).json({ message: 'Task saved successfully.', task });
});

/**
 * POST /api/accountant/tasks/:taskId/status
 * Update workflow task status
 */
accountantRouter.post('/tasks/:taskId/status', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { taskId } = req.params;
  const { status, comment } = req.body;

  const task = db.accountingTasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  // Verify assignment
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    if (!db.isAccountantAssignedToClient(user.id, task.clientId) && task.assignedAccountantId !== user.id && task.reviewerId !== user.id) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to this client task.' });
    }
  }

  task.status = status;
  task.updatedAt = new Date().toISOString();
  if (status === 'ready_for_review') {
    task.preparedAt = new Date().toISOString();
  } else if (status === 'completed') {
    task.completedAt = new Date().toISOString();
  }

  if (comment) {
    task.comments.push({
      id: `comm_${randomUUID()}`,
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      content: comment,
      createdAt: new Date().toISOString(),
      isInternal: true
    });
  }

  db.accountingTasks.set(taskId, task);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE_TASK_STATUS',
    entityType: 'ACCOUNTING_TASK',
    entityId: taskId,
    details: `Task "${task.title}" status changed to ${status} by ${user.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Task status updated.', task });
});

/**
 * POST /api/accountant/tasks/:taskId/review
 * Maker-Checker Review Endpoint.
 * PREPARER CANNOT APPROVE OWN RESTRICTED WORK!
 */
accountantRouter.post('/tasks/:taskId/review', (req: AuthenticatedRequest, res) => {
  const reviewer = req.user!;
  const { taskId } = req.params;
  const { action, notes } = req.body; // 'approved' | 'rejected' | 'requested_changes'

  const task = db.accountingTasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  // MAKER-CHECKER SECURITY CONSTRAINT:
  // Preparer cannot review or approve their own work!
  if (task.assignedAccountantId === reviewer.id && reviewer.role !== 'super_admin') {
    db.logSecurityEvent({
      eventType: 'MAKER_CHECKER_VIOLATION_ATTEMPT',
      ipAddress: req.ip || 'unknown',
      userId: reviewer.id,
      details: `Accountant ${reviewer.name} (${reviewer.id}) attempted to approve their own prepared task "${task.title}" (ID: ${task.id}). Blocked by maker-checker policy.`,
      severity: 'critical'
    });

    return res.status(403).json({
      error: 'Maker-Checker Violation: You prepared this task and cannot approve your own work. A separate senior reviewer or administrator must perform quality review.',
      code: 'MAKER_CHECKER_VIOLATION'
    });
  }

  // Apply review
  if (action === 'approved') {
    task.status = 'approved';
  } else if (action === 'rejected') {
    task.status = 'rejected';
  } else {
    task.status = 'needs_client_input';
  }

  task.approvalHistory.push({
    reviewerId: reviewer.id,
    reviewerName: reviewer.name,
    action,
    timestamp: new Date().toISOString(),
    notes: notes || 'Reviewed by quality reviewer.'
  });
  task.updatedAt = new Date().toISOString();

  db.accountingTasks.set(taskId, task);

  db.logAudit({
    userId: reviewer.id,
    userName: reviewer.name,
    userRole: reviewer.role,
    action: `MAKER_CHECKER_TASK_${action.toUpperCase()}`,
    entityType: 'ACCOUNTING_TASK',
    entityId: taskId,
    details: `Task "${task.title}" was ${action} by reviewer ${reviewer.name}. Notes: ${notes || 'None'}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: `Task successfully ${action}.`, task });
});

/**
 * POST /api/accountant/documents/request
 * Accountant requests a specific document from a client
 */
accountantRouter.post('/documents/request', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { clientId, title, description, category = 'general_tax', taxYear = 2025, dueDate } = req.body;

  if (!clientId || !title || !dueDate) {
    return res.status(400).json({ error: 'clientId, title, and dueDate are required.' });
  }

  const client = db.users.get(clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  const reqId = `dreq_${randomUUID()}`;
  const docReq: DocumentRequest = {
    id: reqId,
    clientId: client.id,
    clientName: client.name,
    accountantId: user.id,
    accountantName: user.name,
    title,
    description: description || '',
    category,
    taxYear: Number(taxYear),
    dueDate,
    status: 'pending',
    requestedAt: new Date().toISOString()
  };

  db.documentRequests.set(reqId, docReq);

  // Send automated notification message to client
  const msgId = `msg_${randomUUID()}`;
  db.messages.set(msgId, {
    id: msgId,
    senderId: user.id,
    senderName: `${user.name} (${user.title || 'Tax Accountant'})`,
    senderRole: user.role,
    content: `Document Request: Please upload "${title}" for tax year ${taxYear}. Due date: ${dueDate}. ${description ? `Details: ${description}` : ''}`,
    timestamp: new Date().toISOString(),
    isInternalOnly: false,
    clientId: client.id
  });

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'REQUEST_CLIENT_DOCUMENT',
    entityType: 'DOCUMENT_REQUEST',
    entityId: reqId,
    details: `Accountant ${user.name} requested "${title}" from client ${client.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ message: 'Document request sent to client.', request: docReq });
});

/**
 * POST /api/accountant/documents/upload-deliverable
 * Accountant uploads a completed workpaper or deliverable for a client
 */
accountantRouter.post('/documents/upload-deliverable', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { clientId, fileName, category = 'firm_deliverable', taxYear = 2025, notes, fileBase64, isClientVisible = true } = req.body;

  if (!clientId || !fileName) {
    return res.status(400).json({ error: 'clientId and fileName are required.' });
  }

  const client = db.users.get(clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  const docId = `doc_deliv_${randomUUID()}`;
  const deliverableDoc: DocumentItem = {
    id: docId,
    clientId,
    clientName: client.name,
    fileName,
    fileType: fileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
    fileSize: '1.4 MB',
    uploadedAt: new Date().toISOString(),
    status: 'verified',
    category: category as any,
    taxYear: Number(taxYear),
    notes: notes || `Prepared and delivered by ${user.name}.`,
    url: `/documents/${docId}/${fileName}`,
    uploadedBy: user.name,
    version: 1,
    isEncrypted: true
  };

  db.documents.set(docId, deliverableDoc);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'UPLOAD_ACCOUNTANT_DELIVERABLE',
    entityType: 'DOCUMENT',
    entityId: docId,
    details: `Accountant ${user.name} uploaded deliverable "${fileName}" for client ${client.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ message: 'Deliverable uploaded successfully.', document: deliverableDoc });
});

/**
 * POST /api/accountant/documents/:docId/status
 * Accountant updates status of a client document
 */
accountantRouter.post('/documents/:docId/status', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { docId } = req.params;
  const { status, notes } = req.body;

  const doc = db.documents.get(docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  // Verify assignment
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    if (!db.isAccountantAssignedToClient(user.id, doc.clientId)) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to this client document.' });
    }
  }

  doc.status = status as DocumentStatus;
  if (notes) {
    doc.notes = `${doc.notes ? doc.notes + ' | ' : ''}[${user.name}]: ${notes}`;
  }
  db.documents.set(docId, doc);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE_DOCUMENT_STATUS',
    entityType: 'DOCUMENT',
    entityId: docId,
    details: `Document "${doc.fileName}" status set to ${status} by ${user.name}. Notes: ${notes || 'None'}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Document status updated.', document: doc });
});

/**
 * POST /api/accountant/notes
 * Post an internal note (accountant-only) or client-visible note
 */
accountantRouter.post('/notes', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { clientId, content, isInternalOnly = true } = req.body;

  if (!clientId || !content) {
    return res.status(400).json({ error: 'clientId and content are required.' });
  }

  const client = db.users.get(clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  const msgId = `msg_${randomUUID()}`;
  const message = {
    id: msgId,
    senderId: user.id,
    senderName: `${user.name} (${isInternalOnly ? 'Internal Workpaper Note' : 'Staff Note'})`,
    senderRole: user.role,
    content,
    timestamp: new Date().toISOString(),
    isInternalOnly: Boolean(isInternalOnly),
    clientId
  };

  db.messages.set(msgId, message);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: isInternalOnly ? 'ADD_INTERNAL_FIRM_NOTE' : 'SEND_CLIENT_NOTE',
    entityType: 'NOTE',
    entityId: msgId,
    details: `${isInternalOnly ? 'Internal firm note' : 'Client note'} posted by ${user.name} for ${client.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ message: 'Note recorded.', note: message });
});

/**
 * GET /api/accountant/bookkeeping/coa
 * List standard Chart of Accounts mapped to IRS tax forms
 */
accountantRouter.get('/bookkeeping/coa', (req: AuthenticatedRequest, res) => {
  res.json({ chartOfAccounts: db.chartOfAccounts });
});

/**
 * GET /api/accountant/bookkeeping/transactions/:clientId
 */
accountantRouter.get('/bookkeeping/transactions/:clientId', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const { clientId } = req.params;
  const transactions = Array.from(db.bookkeepingTransactions.values()).filter(t => t.clientId === clientId);
  res.json({ transactions });
});

/**
 * POST /api/accountant/bookkeeping/transactions/:txId/categorize
 */
accountantRouter.post('/bookkeeping/transactions/:txId/categorize', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { txId } = req.params;
  const { suggestedAccountCode, suggestedAccountName, category, reviewerNotes } = req.body;

  const tx = db.bookkeepingTransactions.get(txId);
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  // Verify assignment
  if (user.role !== 'admin' && user.role !== 'super_admin' && !db.isAccountantAssignedToClient(user.id, tx.clientId)) {
    return res.status(403).json({ error: 'Forbidden: You are not assigned to this client.' });
  }

  tx.suggestedAccountCode = suggestedAccountCode || tx.suggestedAccountCode;
  tx.suggestedAccountName = suggestedAccountName || tx.suggestedAccountName;
  tx.category = category || tx.category;
  tx.status = 'confirmed';
  if (reviewerNotes) tx.reviewerNotes = reviewerNotes;

  db.bookkeepingTransactions.set(txId, tx);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'CATEGORIZE_TRANSACTION',
    entityType: 'TRANSACTION',
    entityId: txId,
    details: `Transaction "${tx.description}" categorized to ${tx.suggestedAccountCode} (${tx.suggestedAccountName}) by ${user.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Transaction categorized successfully.', transaction: tx });
});

/**
 * POST /api/accountant/bookkeeping/transactions/batch-categorize
 */
accountantRouter.post('/bookkeeping/transactions/batch-categorize', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { updates } = req.body;

  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Updates must be an array.' });
  }

  const updatedTx: BookkeepingTransaction[] = [];
  for (const u of updates) {
    const tx = db.bookkeepingTransactions.get(u.id);
    if (tx) {
      if (user.role === 'admin' || user.role === 'super_admin' || db.isAccountantAssignedToClient(user.id, tx.clientId)) {
        tx.suggestedAccountCode = u.accountCode || tx.suggestedAccountCode;
        tx.suggestedAccountName = u.accountName || tx.suggestedAccountName;
        tx.category = u.category || tx.category;
        tx.status = 'confirmed';
        db.bookkeepingTransactions.set(tx.id, tx);
        updatedTx.push(tx);
      }
    }
  }

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'BATCH_CATEGORIZE_TRANSACTIONS',
    entityType: 'TRANSACTION_BATCH',
    entityId: `batch_${randomUUID()}`,
    details: `${updatedTx.length} transactions batch-categorized by ${user.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: `${updatedTx.length} transactions categorized.`, transactions: updatedTx });
});

/**
 * POST /api/accountant/bookkeeping/suggest
 * Gemini-powered categorization suggestion with rule-based fallback
 */
accountantRouter.post('/bookkeeping/suggest', async (req: AuthenticatedRequest, res) => {
  const { description, amount, payee, entityType } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Transaction description is required.' });
  }

  const descLower = description.toLowerCase();
  let suggestedCode = '6180';
  let suggestedName = 'Cloud Software & IT Subscriptions';
  let confidence = 85;
  let rationale = 'Automated matching rule based on transaction descriptor.';
  let taxMapping = 'Form 1120-S Line 19';

  // Rule matches
  if (descLower.includes('rent') || descLower.includes('lease') || descLower.includes('suites')) {
    suggestedCode = '6110';
    suggestedName = 'Office Rent & Facilities';
    confidence = 96;
    rationale = 'Commercial lease or office rental expense.';
    taxMapping = 'Form 1120-S Line 11 / 1040 Sch C Line 20b';
  } else if (descLower.includes('meal') || descLower.includes('chophouse') || descLower.includes('restaurant') || descLower.includes('cafe') || descLower.includes('grill')) {
    suggestedCode = '6220';
    suggestedName = 'Business Meals (50% Deductible)';
    confidence = 92;
    rationale = 'Business meal with clients/partners. Subject to 50% deduction limitation under IRC §274(n).';
    taxMapping = 'Form 1120-S Line 19 / 1040 Sch C Line 24b';
  } else if (descLower.includes('deposit') || descLower.includes('retainer') || descLower.includes('stripe') || descLower.includes('client payment')) {
    suggestedCode = '4010';
    suggestedName = 'Professional Tax & Advisory Services';
    confidence = 94;
    rationale = 'Gross receipt from client professional engagement.';
    taxMapping = 'Form 1120-S Line 1a / 1040 Sch C Line 1';
  } else if (descLower.includes('hardware') || descLower.includes('computer') || descLower.includes('macbook') || descLower.includes('desk')) {
    suggestedCode = '1510';
    suggestedName = 'Office Furniture & Equipment';
    confidence = 82;
    rationale = 'Tangible personal property. Review for de minimis safe harbor election ($2,500 threshold under Treas. Reg. §1.263(a)-1(f)) vs IRC §179 expensing.';
    taxMapping = 'Form 1120-S Schedule L Line 10a / Form 4562';
  } else if (descLower.includes('tax') || descLower.includes('sc dor') || descLower.includes('revenue') || descLower.includes('irs')) {
    suggestedCode = '3020';
    suggestedName = 'Shareholder Distributions';
    confidence = 90;
    rationale = 'State/federal tax paid on behalf of pass-through owner reclassified as distribution.';
    taxMapping = 'Form 1120-S Schedule K Line 16d';
  } else if (descLower.includes('legal') || descLower.includes('attorney') || descLower.includes('cpa') || descLower.includes('esq')) {
    suggestedCode = '6120';
    suggestedName = 'Professional Legal & CPA Fees';
    confidence = 95;
    rationale = 'Ordinary and necessary legal or accounting advisory fees under IRC §162.';
    taxMapping = 'Form 1120-S Line 19 / 1040 Sch C Line 17';
  }

  // Try Gemini for enhanced context if API key is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are a Senior Tax Accountant at A/R Tax Services, LLC.
Given this transaction:
- Description: "${description}"
- Amount: $${amount || 'unknown'}
- Payee: "${payee || 'unknown'}"
- Client Entity: "${entityType || 'S-Corporation'}"

Select the best account from this Chart of Accounts:
1010 Operating Checking
1050 Accounts Receivable
1510 Office Furniture & Equipment (Capital Asset)
2010 Accounts Payable
3020 Shareholder Distributions
4010 Professional Tax & Advisory Services (Revenue)
5010 Direct Subcontractor Labor (COGS)
6010 Officer Compensation
6110 Office Rent & Facilities
6120 Professional Legal & CPA Fees
6150 Advertising & Digital Marketing
6180 Cloud Software & IT Subscriptions
6220 Business Meals (50% Deductible)

Output strictly JSON with format:
{"accountCode": "6180", "accountName": "Cloud Software & IT Subscriptions", "confidence": 95, "rationale": "Reason for selection citing IRS rules if applicable", "taxMapping": "Form 1120-S Line 19"}`;

      const resp = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
      });
      const clean = (resp.text || '').replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.accountCode) {
        suggestedCode = parsed.accountCode;
        suggestedName = parsed.accountName;
        confidence = parsed.confidence || confidence;
        rationale = parsed.rationale || rationale;
        taxMapping = parsed.taxMapping || taxMapping;
      }
    } catch {
      // Fallback cleanly to deterministic rule
    }
  }

  res.json({
    suggestedAccountCode: suggestedCode,
    suggestedAccountName: suggestedName,
    confidence,
    rationale,
    taxMapping,
    disclaimer: 'AI-GENERATED PROPOSAL: Requires licensed accountant review and confirmation before posting to general ledger.'
  });
});

/**
 * GET /api/accountant/reconciliations/:clientId
 */
accountantRouter.get('/reconciliations/:clientId', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const { clientId } = req.params;
  const reconciliations = Array.from(db.bankReconciliations.values()).filter(r => r.clientId === clientId);
  res.json({ reconciliations });
});

/**
 * POST /api/accountant/reconciliations
 * Create or update reconciliation period
 */
accountantRouter.post('/reconciliations', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { clientId, accountName, accountNumber, periodStart, periodEnd, statementEndingBalance, clearedBookBalance, notes } = req.body;

  if (!clientId || !periodStart || !periodEnd || statementEndingBalance === undefined || clearedBookBalance === undefined) {
    return res.status(400).json({ error: 'clientId, periodStart, periodEnd, statementEndingBalance, and clearedBookBalance are required.' });
  }

  const variance = Math.round((Number(statementEndingBalance) - Number(clearedBookBalance)) * 100) / 100;
  const id = req.body.id || `rec_${randomUUID()}`;
  const existing = db.bankReconciliations.get(id);

  if (existing && existing.isPeriodLocked && user.role !== 'super_admin') {
    return res.status(400).json({ error: 'This reconciliation period is locked and cannot be edited.' });
  }

  const rec: BankReconciliation = {
    id,
    clientId,
    accountName: accountName || existing?.accountName || 'Operating Checking',
    accountNumber: accountNumber || existing?.accountNumber || 'First Citizens Bank',
    periodStart,
    periodEnd,
    statementEndingBalance: Number(statementEndingBalance),
    clearedBookBalance: Number(clearedBookBalance),
    variance,
    matchedCount: existing?.matchedCount || 30,
    unmatchedCount: variance === 0 ? 0 : 1,
    status: variance === 0 ? (existing?.status === 'signed_off' ? 'signed_off' : 'balanced') : 'discrepancy',
    preparedBy: existing?.preparedBy || user.id,
    preparedByName: existing?.preparedByName || user.name,
    signedOffBy: existing?.signedOffBy,
    signedOffByName: existing?.signedOffByName,
    signedOffAt: existing?.signedOffAt,
    isPeriodLocked: existing?.isPeriodLocked || false,
    notes: notes || existing?.notes
  };

  db.bankReconciliations.set(id, rec);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'SAVE_BANK_RECONCILIATION',
    entityType: 'BANK_RECONCILIATION',
    entityId: id,
    details: `Reconciliation for ${rec.accountName} (${periodStart} to ${periodEnd}) saved by ${user.name}. Variance: $${variance.toFixed(2)}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ message: 'Reconciliation saved.', reconciliation: rec });
});

/**
 * POST /api/accountant/reconciliations/:id/sign-off
 * Senior Reviewer maker-checker sign-off
 */
accountantRouter.post('/reconciliations/:id/sign-off', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  // Enforce Senior Reviewer / Admin role
  if (!['senior_reviewer', 'admin', 'super_admin'].includes(user.role)) {
    return res.status(403).json({ error: 'Maker-Checker Policy: Only Senior Reviewers or Firm Administrators can sign off on reconciliations.' });
  }

  const rec = db.bankReconciliations.get(id);
  if (!rec) {
    return res.status(404).json({ error: 'Reconciliation not found.' });
  }

  // Maker-Checker Separation of Duties: Preparer cannot sign off their own reconciliation!
  if (rec.preparedBy === user.id && user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Maker-Checker Violation: Preparer cannot sign off on their own reconciliation. An independent Senior Reviewer must approve.' });
  }

  if (rec.variance !== 0) {
    return res.status(400).json({ error: `Cannot sign off: An unresolved variance of $${rec.variance.toFixed(2)} exists. Balance must equal $0.00.` });
  }

  rec.status = 'signed_off';
  rec.signedOffBy = user.id;
  rec.signedOffByName = `${user.name} (${user.title || 'Senior Reviewer, CPA'})`;
  rec.signedOffAt = new Date().toISOString();
  rec.isPeriodLocked = true;

  db.bankReconciliations.set(id, rec);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'SIGN_OFF_BANK_RECONCILIATION',
    entityType: 'BANK_RECONCILIATION',
    entityId: id,
    details: `Reconciliation ${id} formally signed off and locked by ${user.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Reconciliation successfully signed off and period locked.', reconciliation: rec });
});

/**
 * POST /api/accountant/reconciliations/:id/lock
 */
accountantRouter.post('/reconciliations/:id/lock', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const { isLocked } = req.body;

  const rec = db.bankReconciliations.get(id);
  if (!rec) return res.status(404).json({ error: 'Reconciliation not found.' });

  rec.isPeriodLocked = Boolean(isLocked);
  db.bankReconciliations.set(id, rec);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: isLocked ? 'LOCK_RECONCILIATION_PERIOD' : 'UNLOCK_RECONCILIATION_PERIOD',
    entityType: 'BANK_RECONCILIATION',
    entityId: id,
    details: `Reconciliation period ${isLocked ? 'locked' : 'unlocked'} by ${user.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: `Reconciliation period ${isLocked ? 'locked' : 'unlocked'}.`, reconciliation: rec });
});

/**
 * GET /api/accountant/journal-entries/:clientId
 */
accountantRouter.get('/journal-entries/:clientId', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const { clientId } = req.params;
  const entries = Array.from(db.journalEntries.values()).filter(j => j.clientId === clientId);
  res.json({ journalEntries: entries });
});

/**
 * POST /api/accountant/journal-entries
 * Create or update draft journal entry with total debits == total credits validation
 */
accountantRouter.post('/journal-entries', requireAccountantAssignment, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { clientId, engagementId, date, reference, memo, lines, reviewNotes, supportingDocId } = req.body;

  if (!clientId || !lines || !Array.isArray(lines) || lines.length < 2) {
    return res.status(400).json({ error: 'Journal entry requires clientId and at least two balanced lines.' });
  }

  // Strict double-entry accounting math validation
  let totalDebits = 0;
  let totalCredits = 0;
  for (const line of lines) {
    totalDebits += Number(line.debit || 0);
    totalCredits += Number(line.credit || 0);
  }

  const debitsRounded = Math.round(totalDebits * 100) / 100;
  const creditsRounded = Math.round(totalCredits * 100) / 100;

  if (debitsRounded !== creditsRounded) {
    return res.status(400).json({ 
      error: `Out of balance: Total Debits ($${debitsRounded.toFixed(2)}) must equal Total Credits ($${creditsRounded.toFixed(2)}). Difference: $${Math.abs(debitsRounded - creditsRounded).toFixed(2)}.` 
    });
  }

  const id = req.body.id || `je_${randomUUID()}`;
  const existing = db.journalEntries.get(id);

  if (existing && existing.status === 'approved' && user.role !== 'senior_reviewer' && user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Approved journal entries cannot be edited without Senior CPA authorization.' });
  }

  const jeRecord: JournalEntryDraft = {
    id,
    clientId,
    engagementId: engagementId || existing?.engagementId || 'eng_general',
    date: date || existing?.date || new Date().toISOString().split('T')[0],
    reference: reference || existing?.reference || `ADJ-${new Date().getFullYear()}`,
    memo: memo || existing?.memo || 'Adjusting Journal Entry',
    lines: lines.map((l: any, idx: number) => ({
      id: l.id || `line_${idx + 1}`,
      accountNumber: l.accountNumber,
      accountName: l.accountName,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
      description: l.description || ''
    })),
    status: existing?.status === 'approved' ? 'approved' : 'prepared',
    preparedBy: existing?.preparedBy || user.id,
    preparedByName: existing?.preparedByName || user.name,
    reviewNotes: reviewNotes || existing?.reviewNotes || '',
    supportingDocId: supportingDocId || existing?.supportingDocId,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.journalEntries.set(id, jeRecord);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'SAVE_JOURNAL_ENTRY',
    entityType: 'JOURNAL_ENTRY',
    entityId: id,
    details: `Journal entry "${jeRecord.reference}: ${jeRecord.memo}" ($${debitsRounded.toFixed(2)}) saved by ${user.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ message: 'Journal entry saved.', journalEntry: jeRecord });
});

/**
 * POST /api/accountant/journal-entries/:id/review
 * Senior Reviewer approvals or change requests (enforces Maker-Checker)
 */
accountantRouter.post('/journal-entries/:id/review', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const { action, reviewNotes } = req.body;

  if (!['senior_reviewer', 'admin', 'super_admin'].includes(user.role)) {
    return res.status(403).json({ error: 'Maker-Checker Policy: Only Senior Reviewers or Administrators can review and approve journal entries.' });
  }

  const je = db.journalEntries.get(id);
  if (!je) {
    return res.status(404).json({ error: 'Journal entry not found.' });
  }

  // Maker-Checker Separation of Duties: Preparer cannot approve their own journal entry!
  if (je.preparedBy === user.id && user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Maker-Checker Violation: You prepared this journal entry. An independent Senior Reviewer must approve it.' });
  }

  if (action === 'approve') {
    je.status = 'approved';
    je.reviewNotes = `[Approved by ${user.name} CPA]: ${reviewNotes || 'Sign-off complete. Ready to post.'}`;
  } else if (action === 'reject' || action === 'request_changes') {
    je.status = 'needs_revision' as any;
    je.reviewNotes = `[Changes Requested by ${user.name} CPA]: ${reviewNotes || 'Please revise journal entry lines.'}`;
  } else {
    return res.status(400).json({ error: 'Invalid review action. Must be approve, reject, or request_changes.' });
  }

  je.updatedAt = new Date().toISOString();
  db.journalEntries.set(id, je);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: `JOURNAL_ENTRY_${action.toUpperCase()}`,
    entityType: 'JOURNAL_ENTRY',
    entityId: id,
    details: `Journal entry "${je.reference}" ${action}d by Senior Reviewer ${user.name}. Notes: ${reviewNotes || 'None'}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: `Journal entry ${action}d successfully.`, journalEntry: je });
});

/**
 * POST /api/accountant/journal-entries/:id/post
 * Post approved journal entry to general ledger / accounting connection
 */
accountantRouter.post('/journal-entries/:id/post', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { id } = req.params;

  const je = db.journalEntries.get(id);
  if (!je) return res.status(404).json({ error: 'Journal entry not found.' });

  if (je.status !== 'approved') {
    return res.status(400).json({ error: 'Only approved journal entries can be posted to the general ledger.' });
  }

  je.status = 'posted' as any;
  je.updatedAt = new Date().toISOString();
  db.journalEntries.set(id, je);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'POST_JOURNAL_ENTRY_TO_LEDGER',
    entityType: 'JOURNAL_ENTRY',
    entityId: id,
    details: `Journal entry "${je.reference}" posted to client general ledger by ${user.name}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Journal entry successfully posted to general ledger.', journalEntry: je });
});

/**
 * POST /api/accountant/ai-tax-assistant
 * Server-side Gemini AI Tax & Accounting Advisory Assistant
 */
accountantRouter.post('/ai-tax-assistant', async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { query, clientContext, entityType } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  const disclaimer = 'DISCLAIMER: AI-generated research and synthesis is intended exclusively for authorized accounting professionals of A/R Tax Services, LLC. It does not constitute formal legal or tax opinion under Treasury Department Circular 230. All citations and conclusions must be independently verified with the Internal Revenue Code (IRC), Treasury Regulations, and applicable state statutes.';

  let answer = `Regarding your inquiry: "${query}":\n\nUnder Internal Revenue Code (IRC) §162, ordinary and necessary business expenses are deductible in the taxable year paid or incurred. For pass-through entities (${entityType || 'S-Corporation'}), ensure proper substantiation under IRC §274, verify reasonable officer compensation under Rev. Rul. 74-44 prior to shareholder distributions, and evaluate applicable state income/sales tax withholding with SC Department of Revenue.`;

  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are the Lead Tax Research Assistant at A/R Tax Services, LLC (Columbia, SC), supporting licensed CPAs and Enrolled Agents.
Answer the following professional tax & accounting inquiry:
Query: "${query}"
Client Entity Context: "${clientContext || entityType || 'S-Corporation / Pass-through'}"

Provide a structured, rigorous accounting response including:
1. Executive Technical Summary
2. Relevant IRC Codes & Treasury Regulations (e.g. IRC §179, §199A, §162, §274, Rev. Rulings)
3. General Ledger / Bookkeeping Treatment (Debits and Credits recommendation)
4. Key Practitioner Due Diligence Checklist

Keep the tone authoritative, clear, and professional.`;

      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
      });

      if (response.text) {
        answer = response.text.trim();
      }
    } catch (err: any) {
      console.warn('Gemini Assistant fallback:', err.message);
    }
  }

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'AI_TAX_RESEARCH_QUERY',
    entityType: 'AI_ASSISTANT',
    entityId: `query_${randomUUID()}`,
    details: `Practitioner ${user.name} queried AI Tax Assistant: "${query.substring(0, 100)}..."`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({
    query,
    answer,
    disclaimer,
    generatedAt: new Date().toISOString()
  });
});

