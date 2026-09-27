/**
 * Client-Accountant Binding & Workload Management Routes
 * Enforces server-side relationship binding, access control, maker-checker, and audit logging.
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  authenticateToken, 
  requireRole, 
  AuthenticatedRequest 
} from '../auth';
import { randomUUID } from 'crypto';
import { 
  ClientAccountantBinding, 
  PermissionScope, 
  ALL_PERMISSION_SCOPES,
  AssignmentType,
  ReassignmentRequest 
} from '../../types';

export const assignmentsRouter = Router();

// Require authentication on all assignment endpoints
assignmentsRouter.use(authenticateToken);

/**
 * GET /api/assignments
 * Returns assignments filtered by role:
 * - Admin/Super Admin: All firm assignments
 * - Accountant/Reviewer: Only their assigned client bindings
 * - Client: Only bindings for their account
 */
assignmentsRouter.get('/', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const allBindings = Array.from(db.clientAccountantAssignments.values());

  if (user.role === 'admin' || user.role === 'super_admin') {
    return res.json({ bindings: allBindings });
  }

  if (user.role === 'accountant' || user.role === 'senior_reviewer') {
    const accountantBindings = allBindings.filter(b => b.accountantId === user.id);
    return res.json({ bindings: accountantBindings });
  }

  if (user.role === 'client' || user.role === 'prospective_client') {
    const clientBindings = allBindings.filter(b => b.clientId === user.id);
    return res.json({ bindings: clientBindings });
  }

  res.status(403).json({ error: 'Access denied to assignment registry.' });
});

/**
 * GET /api/assignments/client/:clientId
 * Returns active and historical bindings for a specific client
 */
assignmentsRouter.get('/client/:clientId', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { clientId } = req.params;

  // Authorization check
  if (user.role === 'client' && user.id !== clientId) {
    return res.status(403).json({ error: 'Forbidden: You cannot view other clients\' assignments.' });
  }

  if ((user.role === 'accountant' || user.role === 'senior_reviewer') && !db.isAccountantAssignedToClient(user.id, clientId)) {
    return res.status(403).json({ error: 'Forbidden: You are not assigned to this client.' });
  }

  const clientBindings = db.getClientBindings(clientId);
  res.json({ bindings: clientBindings });
});

/**
 * GET /api/assignments/accountants-workload
 * Returns all accountant profiles with caseload, availability, and capacity
 */
assignmentsRouter.get('/accountants-workload', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  
  // Update caseload counts dynamically
  for (const [profId, profile] of db.accountantProfiles.entries()) {
    const activeCount = Array.from(db.clientAccountantAssignments.values()).filter(
      b => b.accountantId === profile.userId && b.status === 'active'
    ).length;
    profile.currentActiveClients = activeCount;
    if (activeCount >= profile.maxClients) {
      profile.availability = 'at_capacity';
    } else if (activeCount >= profile.maxClients * 0.8) {
      profile.availability = 'near_capacity';
    } else {
      profile.availability = 'available';
    }
  }

  const profiles = Array.from(db.accountantProfiles.values());
  res.json({ profiles });
});

/**
 * POST /api/assignments/bind
 * Admin creates or updates a binding between an accountant and a client.
 * Server validates:
 * 1. Admin only (prevent accountant self-assignment)
 * 2. Client exists and is valid
 * 3. Accountant exists and is valid
 * 4. No duplicate active assignment
 * 5. Scope is within allowed permission list
 */
assignmentsRouter.post('/bind', requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
  const admin = req.user!;
  const { 
    clientId, 
    accountantId, 
    assignmentType = 'primary', 
    accessScope, 
    effectiveDate = new Date().toISOString().split('T')[0],
    expirationDate,
    reason,
    internalNotes 
  } = req.body;

  if (!clientId || !accountantId) {
    return res.status(400).json({ error: 'Both clientId and accountantId are required.' });
  }

  const client = db.users.get(clientId);
  if (!client || (client.role !== 'client' && client.role !== 'prospective_client')) {
    return res.status(404).json({ error: 'Target client not found.' });
  }

  const accountant = db.users.get(accountantId);
  if (!accountant || (accountant.role !== 'accountant' && accountant.role !== 'senior_reviewer')) {
    return res.status(404).json({ error: 'Target staff member is not an authorized accountant or reviewer.' });
  }

  // Duplicate active assignment prevention
  if (db.hasDuplicateActiveAssignment(clientId, accountantId, assignmentType)) {
    return res.status(409).json({ 
      error: `Conflict: An active or pending ${assignmentType} assignment already exists between ${accountant.name} and ${client.name}.`,
      code: 'DUPLICATE_ACTIVE_ASSIGNMENT'
    });
  }

  // Validate or default permissions
  const validatedScopes: PermissionScope[] = Array.isArray(accessScope) && accessScope.length > 0
    ? accessScope.filter(s => ALL_PERMISSION_SCOPES.includes(s))
    : [...ALL_PERMISSION_SCOPES];

  const bindingId = `bind_${randomUUID()}`;
  const binding: ClientAccountantBinding = {
    id: bindingId,
    clientId: client.id,
    clientName: client.name,
    clientCompanyName: client.companyName || client.name,
    accountantId: accountant.id,
    accountantName: accountant.name,
    accountantTitle: accountant.title || 'Tax Accountant',
    assignmentType: assignmentType as AssignmentType,
    status: 'active',
    accessScope: validatedScopes,
    assignedBy: admin.id,
    assignedByName: admin.name,
    assignedAt: new Date().toISOString(),
    effectiveDate,
    expirationDate,
    reason: reason || `Assigned by firm administrator ${admin.name}.`,
    internalNotes,
    lastAccessAt: undefined
  };

  db.clientAccountantAssignments.set(bindingId, binding);

  // Synchronize with client user record
  if (assignmentType === 'primary') {
    client.assignedAccountantId = accountant.id;
    client.assignedAccountantName = accountant.name;
    db.users.set(client.id, client);
  } else if (assignmentType === 'reviewer') {
    client.assignedReviewerId = accountant.id;
    client.assignedReviewerName = accountant.name;
    db.users.set(client.id, client);
  }

  // Audit Log (Immutable)
  db.logAudit({
    userId: admin.id,
    userName: admin.name,
    userRole: admin.role,
    action: 'BIND_ACCOUNTANT_TO_CLIENT',
    entityType: 'ACCOUNTANT_ASSIGNMENT',
    entityId: bindingId,
    details: `Bound accountant ${accountant.name} (${accountant.id}) to client ${client.name} (${client.id}) as ${assignmentType}. Scopes: ${validatedScopes.length} permissions granted.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ 
    message: 'Accountant successfully bound to client.', 
    binding 
  });
});

/**
 * POST /api/assignments/unbind
 * Admin unbinds an accountant from a client.
 * Server verifies:
 * 1. Admin role
 * 2. Mandatory unbinding reason
 * 3. Client records and files remain intact (no data deletion)
 * 4. Revocation is immediate
 */
assignmentsRouter.post('/unbind', requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
  const admin = req.user!;
  const { bindingId, reason, replacementAccountantId } = req.body;

  if (!bindingId) {
    return res.status(400).json({ error: 'bindingId is required.' });
  }

  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: 'A valid explanation reason is mandatory when unbinding an accountant.' });
  }

  const binding = db.clientAccountantAssignments.get(bindingId);
  if (!binding) {
    return res.status(404).json({ error: 'Assignment binding not found.' });
  }

  if (binding.status === 'unbound') {
    return res.status(400).json({ error: 'This assignment is already unbound.' });
  }

  // Mark assignment as unbound
  binding.status = 'unbound';
  binding.unboundBy = admin.id;
  binding.unboundByName = admin.name;
  binding.unboundAt = new Date().toISOString();
  binding.reason = `[Unbound by ${admin.name}] Reason: ${reason}`;
  db.clientAccountantAssignments.set(binding.id, binding);

  const client = db.users.get(binding.clientId);
  if (client) {
    if (binding.assignmentType === 'primary' && client.assignedAccountantId === binding.accountantId) {
      client.assignedAccountantId = replacementAccountantId || undefined;
      if (replacementAccountantId) {
        const rep = db.users.get(replacementAccountantId);
        client.assignedAccountantName = rep?.name || undefined;
      } else {
        client.assignedAccountantName = undefined;
      }
      db.users.set(client.id, client);
    }
  }

  // Audit Log
  db.logAudit({
    userId: admin.id,
    userName: admin.name,
    userRole: admin.role,
    action: 'UNBIND_ACCOUNTANT_FROM_CLIENT',
    entityType: 'ACCOUNTANT_ASSIGNMENT',
    entityId: binding.id,
    details: `Unbound accountant ${binding.accountantName} (${binding.accountantId}) from client ${binding.clientName} (${binding.clientId}). Reason: ${reason}. Client data and history preserved intact.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ 
    message: 'Accountant successfully unbound. Access immediately revoked.', 
    binding 
  });
});

/**
 * POST /api/assignments/suspend
 * Temporarily suspend access without unbinding
 */
assignmentsRouter.post('/suspend', requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
  const admin = req.user!;
  const { bindingId, reason } = req.body;

  const binding = db.clientAccountantAssignments.get(bindingId);
  if (!binding) {
    return res.status(404).json({ error: 'Assignment binding not found.' });
  }

  binding.status = 'suspended';
  binding.internalNotes = `${binding.internalNotes || ''} [Suspended ${new Date().toISOString()}: ${reason || 'Administrative hold'}]`;
  db.clientAccountantAssignments.set(binding.id, binding);

  db.logAudit({
    userId: admin.id,
    userName: admin.name,
    userRole: admin.role,
    action: 'SUSPEND_ACCOUNTANT_ASSIGNMENT',
    entityType: 'ACCOUNTANT_ASSIGNMENT',
    entityId: binding.id,
    details: `Suspended access for ${binding.accountantName} on client ${binding.clientName}. Reason: ${reason}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Assignment access temporarily suspended.', binding });
});

/**
 * POST /api/assignments/restore
 * Restore suspended assignment
 */
assignmentsRouter.post('/restore', requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
  const admin = req.user!;
  const { bindingId } = req.body;

  const binding = db.clientAccountantAssignments.get(bindingId);
  if (!binding) {
    return res.status(404).json({ error: 'Assignment binding not found.' });
  }

  binding.status = 'active';
  binding.internalNotes = `${binding.internalNotes || ''} [Restored active by ${admin.name} on ${new Date().toISOString()}]`;
  db.clientAccountantAssignments.set(binding.id, binding);

  db.logAudit({
    userId: admin.id,
    userName: admin.name,
    userRole: admin.role,
    action: 'RESTORE_ACCOUNTANT_ASSIGNMENT',
    entityType: 'ACCOUNTANT_ASSIGNMENT',
    entityId: binding.id,
    details: `Restored active access for ${binding.accountantName} on client ${binding.clientName}.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: 'Assignment access restored.', binding });
});

/**
 * POST /api/assignments/reassign
 * Reassigns client to another accountant
 */
assignmentsRouter.post('/reassign', requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
  const admin = req.user!;
  const { currentBindingId, newAccountantId, reason } = req.body;

  if (!currentBindingId || !newAccountantId) {
    return res.status(400).json({ error: 'Both currentBindingId and newAccountantId are required.' });
  }

  const oldBinding = db.clientAccountantAssignments.get(currentBindingId);
  if (!oldBinding) {
    return res.status(404).json({ error: 'Existing assignment not found.' });
  }

  const newAccountant = db.users.get(newAccountantId);
  if (!newAccountant || (newAccountant.role !== 'accountant' && newAccountant.role !== 'senior_reviewer')) {
    return res.status(404).json({ error: 'Replacement accountant is not valid.' });
  }

  // Unbind old assignment
  oldBinding.status = 'reassigned';
  oldBinding.unboundBy = admin.id;
  oldBinding.unboundByName = admin.name;
  oldBinding.unboundAt = new Date().toISOString();
  oldBinding.reason = `Reassigned to ${newAccountant.name}. Note: ${reason || 'Caseload transition'}`;
  db.clientAccountantAssignments.set(oldBinding.id, oldBinding);

  // Create new active binding
  const newBindingId = `bind_${randomUUID()}`;
  const newBinding: ClientAccountantBinding = {
    id: newBindingId,
    clientId: oldBinding.clientId,
    clientName: oldBinding.clientName,
    clientCompanyName: oldBinding.clientCompanyName,
    accountantId: newAccountant.id,
    accountantName: newAccountant.name,
    accountantTitle: newAccountant.title || 'Tax Accountant',
    assignmentType: oldBinding.assignmentType,
    status: 'active',
    accessScope: [...oldBinding.accessScope],
    assignedBy: admin.id,
    assignedByName: admin.name,
    assignedAt: new Date().toISOString(),
    effectiveDate: new Date().toISOString().split('T')[0],
    reason: `Reassignment transition from ${oldBinding.accountantName}. ${reason || ''}`,
    internalNotes: oldBinding.internalNotes
  };

  db.clientAccountantAssignments.set(newBindingId, newBinding);

  // Update client record
  const client = db.users.get(oldBinding.clientId);
  if (client && oldBinding.assignmentType === 'primary') {
    client.assignedAccountantId = newAccountant.id;
    client.assignedAccountantName = newAccountant.name;
    db.users.set(client.id, client);
  }

  db.logAudit({
    userId: admin.id,
    userName: admin.name,
    userRole: admin.role,
    action: 'REASSIGN_CLIENT_ACCOUNTANT',
    entityType: 'ACCOUNTANT_ASSIGNMENT',
    entityId: newBindingId,
    details: `Reassigned client ${oldBinding.clientName} from ${oldBinding.accountantName} to ${newAccountant.name}. Old binding marked reassigned.`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({
    message: `Client ${oldBinding.clientName} successfully reassigned to ${newAccountant.name}.`,
    oldBinding,
    newBinding
  });
});

/**
 * POST /api/assignments/request-reassignment
 * Client submits a formal request to change their assigned accountant
 */
assignmentsRouter.post('/request-reassignment', requireRole('client', 'prospective_client'), (req: AuthenticatedRequest, res) => {
  const client = req.user!;
  const { reason, preferredSpecialization } = req.body;

  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide a clear reason for your reassignment request (minimum 10 characters).' });
  }

  const primaryBinding = Array.from(db.clientAccountantAssignments.values()).find(
    b => b.clientId === client.id && b.assignmentType === 'primary' && b.status === 'active'
  );

  const reqId = `reassign_${randomUUID()}`;
  const reassignmentReq: ReassignmentRequest = {
    id: reqId,
    clientId: client.id,
    clientName: client.name,
    currentAccountantId: primaryBinding?.accountantId || client.assignedAccountantId || 'unknown',
    currentAccountantName: primaryBinding?.accountantName || client.assignedAccountantName || 'Assigned Accountant',
    reason,
    preferredSpecialization,
    status: 'pending',
    requestedAt: new Date().toISOString()
  };

  db.reassignmentRequests.set(reqId, reassignmentReq);

  db.logAudit({
    userId: client.id,
    userName: client.name,
    userRole: client.role,
    action: 'CLIENT_REQUESTED_REASSIGNMENT',
    entityType: 'REASSIGNMENT_REQUEST',
    entityId: reqId,
    details: `Client ${client.name} requested reassignment from ${reassignmentReq.currentAccountantName}. Reason: ${reason}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({
    message: 'Your reassignment request has been submitted to Practice Leadership for review.',
    request: reassignmentReq
  });
});

/**
 * GET /api/assignments/reassignment-requests
 * View reassignment requests
 */
assignmentsRouter.get('/reassignment-requests', (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const allReqs = Array.from(db.reassignmentRequests.values());

  if (user.role === 'admin' || user.role === 'super_admin') {
    return res.json({ requests: allReqs });
  }

  if (user.role === 'client') {
    return res.json({ requests: allReqs.filter(r => r.clientId === user.id) });
  }

  res.status(403).json({ error: 'Access denied.' });
});

/**
 * POST /api/assignments/reassignment-requests/:id/review
 * Admin reviews and approves/rejects reassignment request
 */
assignmentsRouter.post('/reassignment-requests/:id/review', requireRole('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
  const admin = req.user!;
  const { id } = req.params;
  const { action, notes } = req.body; // 'approved' | 'rejected'

  const request = db.reassignmentRequests.get(id);
  if (!request) {
    return res.status(404).json({ error: 'Reassignment request not found.' });
  }

  request.status = action === 'approved' ? 'approved' : 'rejected';
  request.reviewedBy = admin.name;
  request.reviewedAt = new Date().toISOString();
  request.notes = notes;
  db.reassignmentRequests.set(id, request);

  db.logAudit({
    userId: admin.id,
    userName: admin.name,
    userRole: admin.role,
    action: `REASSIGNMENT_REQUEST_${action.toUpperCase()}`,
    entityType: 'REASSIGNMENT_REQUEST',
    entityId: id,
    details: `Admin ${admin.name} ${action} reassignment request from client ${request.clientName}. Notes: ${notes || 'None'}`,
    ipAddress: req.ip || '127.0.0.1'
  });

  res.json({ message: `Request successfully ${action}.`, request });
});
