/**
 * Accounting Integrations & 5-Stage Controlled Write Authorization
 * Supports QuickBooks Online, Xero, FreshBooks, Sage, and CSV Ledgers.
 * Defaults to Read-Only access. Any write operation strictly requires:
 * 1. Client authorization, 2. Accountant preparation, 3. Reviewer approval,
 * 4. Explicit confirmation, 5. Complete audit logging.
 *
 * No accounting-provider adapter is commissioned (dependency E04). Connection records,
 * authorization gates and audit entries are real; provider sync and ledger commits are
 * reported as unavailable rather than simulated as successful.
 */

import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest, blockRecruiterFromTaxRecords } from '../auth';
import { AccountingConnection } from '../../types';
import { CLIENT_ROLES, canAccessClientRecord } from '../clientAccess';

export const integrationsRouter = Router();

const STAFF_PREPARER_ROLES = new Set(['accountant', 'senior_reviewer', 'admin', 'super_admin']);
const REVIEWER_ROLES = new Set(['senior_reviewer', 'admin', 'super_admin']);
const PROVIDERS = new Set(['quickbooks_online', 'quickbooks', 'xero', 'freshbooks', 'sage', 'csv_manual']);
const PROVIDER_UNAVAILABLE = {
  error: 'No accounting provider integration is commissioned. Nothing was sent to or received from the provider.',
  code: 'ACCOUNTING_PROVIDER_NOT_COMMISSIONED'
};

function emptyWriteAuthorization(): NonNullable<AccountingConnection['writeAuthorization']> {
  return { clientAuthorized: false, accountantPrepared: false, reviewerApproved: false, explicitlyConfirmed: false };
}

/** Loads a connection and enforces client ownership / staff tenant + assignment. Responds and returns null on failure. */
function authorizedConnection(req: AuthenticatedRequest, res: Response): AccountingConnection | null {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const conn = db.accountingConnections.get(req.params.id);
  // Same response for "missing" and "not yours": do not reveal other clients' connections.
  if (!conn || !canAccessClientRecord(req.user, conn.clientId)) {
    res.status(404).json({ error: 'Connection not found.' });
    return null;
  }
  conn.writeAuthorization ??= emptyWriteAuthorization();
  return conn;
}

// List accounting connections the caller is authorized for
integrationsRouter.get('/', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const list = Array.from(db.accountingConnections.values()).filter(c => canAccessClientRecord(req.user!, c.clientId));
  return res.json({ connections: list });
});

// Record a provider connection request (read-only by default). Provider authorization is not commissioned.
integrationsRouter.post('/connect', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { provider, companyName } = req.body ?? {};
  if (typeof provider !== 'string' || !PROVIDERS.has(provider)) {
    return res.status(400).json({ error: 'A supported provider is required (quickbooks_online, xero, freshbooks, sage, csv_manual).', code: 'PROVIDER_INVALID' });
  }

  const isClient = CLIENT_ROLES.has(req.user.role);
  const targetClientId = isClient ? (req.user.clientId || req.user.id) : req.body?.clientId;
  if (typeof targetClientId !== 'string' || !targetClientId || !canAccessClientRecord(req.user, targetClientId)) {
    return res.status(403).json({ error: 'Access to this client resource is denied.', code: 'CLIENT_ACCESS_DENIED' });
  }

  const connId = `conn_${randomUUID()}`;
  const newConn: AccountingConnection = {
    id: connId,
    clientId: targetClientId,
    provider,
    companyName: typeof companyName === 'string' && companyName.trim() ? companyName.trim().slice(0, 200) : `${provider} ledger`,
    // Not connected: no OAuth exchange with the provider has occurred.
    status: 'pending_auth',
    readOnlyDefault: true,
    errorCount: 0,
    syncErrors: [],
    writeAuthorization: emptyWriteAuthorization()
  };
  db.accountingConnections.set(connId, newConn);

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'ACCOUNTING_INTEGRATION_REQUESTED',
    resource: `${provider.toUpperCase()} Integration #${connId}`,
    details: `Read-only ${provider} connection requested; provider authorization not commissioned.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.status(201).json({
    message: `${provider} connection request recorded. Provider authorization is not yet available; no ledger data has been synchronized.`,
    connection: newConn
  });
});

// Re-sync: requires a commissioned provider adapter
integrationsRouter.post('/:id/sync', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const conn = authorizedConnection(req, res);
  if (!conn) return;
  return res.status(503).json(PROVIDER_UNAVAILABLE);
});

// Disconnect integration (local state; revokes all write authorization)
integrationsRouter.post('/:id/disconnect', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  const conn = authorizedConnection(req, res);
  if (!conn) return;

  conn.status = 'disconnected';
  conn.writeAuthorization = emptyWriteAuthorization();
  db.accountingConnections.set(conn.id, conn);

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'ACCOUNTING_INTEGRATION_DISCONNECTED',
    resource: `${(conn.provider || 'unknown').toUpperCase()} #${conn.id}`,
    details: 'Integration disconnected and all write authorizations revoked.',
    ipAddress: req.ip || 'unknown',
    severity: 'warning'
  });

  return res.json({ message: `${conn.provider} disconnected.`, connection: conn });
});

// 5-STAGE WRITE OPERATION AUTHORIZATION PIPELINE
// 1. Client Authorization — the client's own consent; staff cannot record it on the client's behalf.
integrationsRouter.post('/:id/authorize-write/client', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const conn = authorizedConnection(req, res);
  if (!conn) return;
  if (!CLIENT_ROLES.has(req.user!.role)) {
    return res.status(403).json({ error: 'Only the business client can grant client write authorization.', code: 'CLIENT_CONSENT_REQUIRED' });
  }

  conn.writeAuthorization!.clientAuthorized = true;
  conn.writeAuthorization!.clientAuthorizedBy = req.user!.id;
  db.accountingConnections.set(conn.id, conn);

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'WRITE_AUTH_STAGE_1_CLIENT_AUTHORIZED',
    resource: `${conn.provider} #${conn.id}`,
    details: 'Client granted provisional authorization for journal modifications.',
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ message: 'Stage 1: Client write authorization recorded.', writeAuthorization: conn.writeAuthorization });
});

// 2. Accountant Preparation — staff only
integrationsRouter.post('/:id/authorize-write/accountant-prepare', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const conn = authorizedConnection(req, res);
  if (!conn) return;
  if (!STAFF_PREPARER_ROLES.has(req.user!.role)) {
    return res.status(403).json({ error: 'Only authorized accounting staff can prepare a write batch.', code: 'PREPARER_ROLE_REQUIRED' });
  }
  if (!conn.writeAuthorization!.clientAuthorized) {
    return res.status(400).json({ error: 'Stage 1 (Client Authorization) is required before accountant preparation.' });
  }

  conn.writeAuthorization!.accountantPrepared = true;
  conn.writeAuthorization!.preparedBy = req.user!.id;
  db.accountingConnections.set(conn.id, conn);

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'WRITE_AUTH_STAGE_2_ACCOUNTANT_PREPARED',
    resource: `${conn.provider} #${conn.id}`,
    details: 'Accountant prepared the entry batch for independent review.',
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ message: 'Stage 2: Accountant preparation recorded.', writeAuthorization: conn.writeAuthorization });
});

// 3. Reviewer Approval — independent of the preparer (maker-checker)
integrationsRouter.post('/:id/authorize-write/reviewer-approve', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const conn = authorizedConnection(req, res);
  if (!conn) return;
  if (!REVIEWER_ROLES.has(req.user!.role)) {
    return res.status(403).json({ error: 'Only Senior Reviewers or Compliance Admins can grant Stage 3 approval.' });
  }
  if (!conn.writeAuthorization!.clientAuthorized || !conn.writeAuthorization!.accountantPrepared) {
    return res.status(400).json({ error: 'Stages 1 and 2 must be complete before reviewer approval.' });
  }
  if (conn.writeAuthorization!.preparedBy === req.user!.id) {
    return res.status(403).json({ error: 'Maker-Checker Violation: the preparer cannot approve their own write batch.', code: 'MAKER_CHECKER_VIOLATION' });
  }

  conn.writeAuthorization!.reviewerApproved = true;
  conn.writeAuthorization!.approvedBy = req.user!.id;
  db.accountingConnections.set(conn.id, conn);

  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'WRITE_AUTH_STAGE_3_REVIEWER_APPROVED',
    resource: `${conn.provider} #${conn.id}`,
    details: `Independent reviewer ${req.user!.name} approved the journal posting schedule.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ message: 'Stage 3: Reviewer approval granted.', writeAuthorization: conn.writeAuthorization });
});

// 4. Explicit Confirmation & Execution — every gate is enforced; transmission requires a commissioned provider
integrationsRouter.post('/:id/authorize-write/execute-commit', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const conn = authorizedConnection(req, res);
  if (!conn) return;
  if (!STAFF_PREPARER_ROLES.has(req.user!.role)) {
    return res.status(403).json({ error: 'Only authorized accounting staff can execute a ledger write.', code: 'EXECUTOR_ROLE_REQUIRED' });
  }

  const { confirmationPhrase } = req.body ?? {};
  if (confirmationPhrase !== 'CONFIRM_WRITE_TO_LEDGER') {
    return res.status(400).json({ error: 'Explicit confirmation phrase "CONFIRM_WRITE_TO_LEDGER" is required for Stage 4 commitment.' });
  }

  const auth = conn.writeAuthorization!;
  if (!auth.clientAuthorized || !auth.accountantPrepared || !auth.reviewerApproved) {
    return res.status(403).json({
      error: 'Cannot execute write operation: All prior stages (Client Auth, Accountant Prep, Reviewer Approval) must be certified.',
      code: 'STAGE_CHECK_FAILED'
    });
  }

  // 5. Audit the attempt. Nothing is transmitted: no provider adapter is commissioned.
  db.logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.user!.role,
    action: 'WRITE_AUTH_COMMIT_NOT_TRANSMITTED',
    resource: `${(conn.provider || 'unknown').toUpperCase()} #${conn.id}`,
    details: 'All authorization stages verified; ledger write NOT transmitted because no accounting provider is commissioned.',
    ipAddress: req.ip || 'unknown',
    severity: 'warning'
  });

  return res.status(503).json({ ...PROVIDER_UNAVAILABLE, writeAuthorization: auth, transmitted: false });
});
