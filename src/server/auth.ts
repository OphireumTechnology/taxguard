/**
 * Authentication & Role-Based Access Control (RBAC) Module
 * Cryptographic security, PBKDF2 password hashing, session tokens,
 * brute-force lockout, and strict role authorization.
 */

import { Request, Response, NextFunction } from 'express';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import { db } from './db';
import { User, UserRole } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  token?: string;
}

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const ITERATIONS = 10000;
const DIGEST = 'sha512';
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const computedHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    const originalBuffer = Buffer.from(originalHash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');
    if (originalBuffer.length !== computedBuffer.length) return false;
    return timingSafeEqual(originalBuffer, computedBuffer);
  } catch {
    return false;
  }
}

// Initialize seed user passwords
export function initSeedPasswords() {
  const clientSeed = process.env.SEED_CLIENT_PASSWORD || (process.env.NODE_ENV === 'production' ? randomBytes(16).toString('hex') : 'ClientPass123!');
  const staffSeed = process.env.SEED_STAFF_PASSWORD || (process.env.NODE_ENV === 'production' ? randomBytes(24).toString('hex') : 'FirmPass123!');

  const clientHash = hashPassword(clientSeed);
  db.userPasswords.set('m.perotti@example.com', clientHash);
  db.userPasswords.set('comfort.d@example.com', clientHash);
  db.userPasswords.set('suspended.test@example.com', clientHash);

  const staffHash = hashPassword(staffSeed);
  db.userPasswords.set('dhinds@artaxservices.com', staffHash);
  db.userPasswords.set('mvance@artaxservices.com', staffHash);
  db.userPasswords.set('erostova@artaxservices.com', staffHash);
  db.userPasswords.set('recruiter@artaxservices.com', staffHash);
  db.userPasswords.set('admin@artaxservices.com', staffHash);
  db.userPasswords.set('security@artaxservices.com', staffHash);

  // In production, flag accounts for mandatory password reset upon first login
  if (process.env.NODE_ENV === 'production') {
    db.users.forEach(user => {
      user.mustResetPassword = true;
    });
  }
}

// Check brute-force lockout status
export function checkBruteForceLockout(key: string): { locked: boolean; remainingSec: number } {
  const attempt = db.loginAttempts.get(key);
  if (!attempt) return { locked: false, remainingSec: 0 };
  const now = Date.now();
  if (attempt.lockedUntil > now) {
    return { 
      locked: true, 
      remainingSec: Math.ceil((attempt.lockedUntil - now) / 1000) 
    };
  }
  if (attempt.lockedUntil > 0 && attempt.lockedUntil <= now) {
    db.loginAttempts.delete(key);
  }
  return { locked: false, remainingSec: 0 };
}

// Record login failure and potentially lock account
export function recordLoginFailure(key: string, ip: string, email: string) {
  const now = Date.now();
  const existing = db.loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  const newCount = existing.count + 1;
  
  if (newCount >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_DURATION_MS;
    db.loginAttempts.set(key, { count: newCount, lockedUntil });
    db.logSecurityEvent({
      eventType: 'BRUTE_FORCE_LOCKOUT_TRIGGERED',
      ipAddress: ip,
      details: `Target ${email} locked out for 15 minutes after ${newCount} consecutive failed authentications.`,
      severity: 'warning'
    });
  } else {
    db.loginAttempts.set(key, { count: newCount, lockedUntil: 0 });
  }
}

// Clear login failures on success
export function clearLoginFailures(key: string) {
  db.loginAttempts.delete(key);
}

// Generate secure session token
export function createSession(userId: string, role: string): string {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  db.sessions.set(token, {
    userId,
    role,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS
  });
  return token;
}

export function revokeSession(token: string) {
  db.sessions.delete(token);
}

export function revokeAllUserSessions(userId: string): number {
  let count = 0;
  for (const [token, session] of db.sessions.entries()) {
    if (session.userId === userId) {
      db.sessions.delete(token);
      count++;
    }
  }
  return count;
}

// Authentication Middleware
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : (req.headers['x-session-token'] as string);

  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required. No session token provided.',
      code: 'AUTH_REQUIRED' 
    });
  }

  const session = db.sessions.get(token);
  if (!session) {
    return res.status(401).json({ 
      error: 'Invalid or expired session token.',
      code: 'SESSION_INVALID' 
    });
  }

  // Check expiration
  if (Date.now() > session.expiresAt) {
    db.sessions.delete(token);
    return res.status(401).json({ 
      error: 'Session expired. Please log in again.',
      code: 'SESSION_EXPIRED' 
    });
  }

  const user = db.users.get(session.userId);
  if (!user) {
    db.sessions.delete(token);
    return res.status(401).json({ 
      error: 'User associated with session not found.',
      code: 'USER_NOT_FOUND' 
    });
  }

  // Suspended or disabled accounts check (Immediate revocation test)
  if (user.status === 'disabled' || user.status === 'suspended') {
    db.sessions.delete(token);
    db.logSecurityEvent({
      eventType: 'DISABLED_USER_SESSION_BLOCKED',
      ipAddress: req.ip || 'unknown',
      userId: user.id,
      details: `Active session for ${user.email} was terminated because account status is ${user.status}.`,
      severity: 'critical'
    });
    return res.status(403).json({ 
      error: `Access Denied: Your account has been ${user.status}. Contact firm compliance at info@artaxservices.com.`,
      code: 'ACCOUNT_DISABLED' 
    });
  }

  // Slide expiration window on activity
  session.expiresAt = Date.now() + SESSION_DURATION_MS;
  req.user = user;
  req.token = token;
  next();
}

// Role authorization middleware
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. Authentication required.' });
    }

    // Super Admin has universal operational override
    if (req.user.role === 'super_admin' || req.user.role === 'super_administrator') {
      return next();
    }

    const effectiveAllowed = new Set(allowedRoles);
    if (effectiveAllowed.has('administrator')) effectiveAllowed.add('admin');
    if (effectiveAllowed.has('admin')) effectiveAllowed.add('administrator');
    if (effectiveAllowed.has('super_administrator')) effectiveAllowed.add('super_admin');
    if (effectiveAllowed.has('super_admin')) effectiveAllowed.add('super_administrator');

    if (!effectiveAllowed.has(req.user.role)) {
      db.logSecurityEvent({
        eventType: 'RBAC_ACCESS_DENIED',
        ipAddress: req.ip || 'unknown',
        userId: req.user.id,
        details: `User ${req.user.email} (Role: ${req.user.role}) attempted unauthorized access to route requiring ${allowedRoles.join(', ')}.`,
        severity: 'warning'
      });

      return res.status(403).json({
        error: 'Forbidden: Insufficient privileges to access this resource.',
        code: 'ACCESS_DENIED',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
}

// Client isolation middleware: Clients can only access their own data
export function requireClientIsolation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const requestedClientId = req.params.clientId || req.query.clientId as string || req.body.clientId;

  if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    if (requestedClientId && requestedClientId !== req.user.id) {
      db.logSecurityEvent({
        eventType: 'CLIENT_ISOLATION_VIOLATION_ATTEMPT',
        ipAddress: req.ip || 'unknown',
        userId: req.user.id,
        details: `Client ${req.user.email} attempted to access data belonging to client ID ${requestedClientId}. Blocked by isolation filter.`,
        severity: 'critical'
      });

      return res.status(403).json({
        error: 'Forbidden: You are only authorized to access your own client records.',
        code: 'CLIENT_ISOLATION_VIOLATION'
      });
    }
  }

  next();
}

// Accountant assignment middleware: Accountants can only access assigned clients
export function requireAccountantAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  // Admins, Super Admins can access across firm
  if (['admin', 'super_admin'].includes(req.user.role)) {
    return next();
  }

  if (req.user.role === 'accountant' || req.user.role === 'senior_reviewer') {
    const requestedClientId = req.params.clientId || req.query.clientId as string || req.body?.clientId;
    if (requestedClientId) {
      const isAssigned = db.isAccountantAssignedToClient(req.user.id, requestedClientId);
      const client = db.users.get(requestedClientId);
      const isLegacyAssigned = client && (client.assignedAccountantId === req.user.id || client.assignedReviewerId === req.user.id);

      if (!isAssigned && !isLegacyAssigned) {
        db.logSecurityEvent({
          eventType: 'ACCOUNTANT_UNASSIGNED_ACCESS_BLOCKED',
          ipAddress: req.ip || 'unknown',
          userId: req.user.id,
          details: `Accountant ${req.user.name} (${req.user.id}) attempted to view unassigned client ${client?.name || requestedClientId} (${requestedClientId}). Access revoked/unbound.`,
          severity: 'warning'
        });

        return res.status(403).json({
          error: 'Forbidden: You are not assigned to this client caseload or your assignment is inactive.',
          code: 'UNASSIGNED_CLIENT_ACCESS_DENIED'
        });
      }
    }
  }

  next();
}

// Granular permission check middleware for accountant actions
export function requireAssignmentPermission(scope: any) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // Admins and Super Admins have full access
    if (['admin', 'super_admin'].includes(req.user.role)) {
      return next();
    }

    if (req.user.role === 'accountant' || req.user.role === 'senior_reviewer') {
      const requestedClientId = req.params.clientId || req.query.clientId as string || req.body?.clientId;
      if (requestedClientId) {
        const hasScope = db.hasPermissionScope(req.user.id, requestedClientId, scope);
        if (!hasScope) {
          db.logSecurityEvent({
            eventType: 'ACCOUNTANT_SCOPE_RESTRICTION',
            ipAddress: req.ip || 'unknown',
            userId: req.user.id,
            details: `Accountant ${req.user.email} lacks permission scope "${scope}" for client ${requestedClientId}.`,
            severity: 'warning'
          });

          return res.status(403).json({
            error: `Forbidden: Your active assignment does not permit the "${scope}" permission scope.`,
            code: 'INSUFFICIENT_SCOPE_PERMISSION'
          });
        }
      }
    }

    next();
  };
}

// Recruiter boundary: Recruiters can access applicant records, but NEVER client tax records
export function blockRecruiterFromTaxRecords(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user && req.user.role === 'recruiter') {
    db.logSecurityEvent({
      eventType: 'RECRUITER_TAX_ACCESS_ATTEMPT',
      ipAddress: req.ip || 'unknown',
      userId: req.user.id,
      details: `Recruiter ${req.user.email} attempted to query confidential client tax records.`,
      severity: 'critical'
    });

    return res.status(403).json({
      error: 'Forbidden: Recruiter role is strictly segregated from client financial and tax return records.',
      code: 'RECRUITER_TAX_RESTRICTION'
    });
  }
  next();
}

// Tenant isolation middleware: Staff in Tenant A cannot access Tenant B records
export function requireTenantIsolation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const requestedTenantId = req.headers['x-tenant-id'] || req.params.tenantId || req.query.tenantId || req.body?.tenantId;
  const userTenantId = (req.user as any).tenantId || 'tenant_ar_tax_prod';

  if (requestedTenantId && requestedTenantId !== userTenantId) {
    db.logSecurityEvent({
      eventType: 'CROSS_TENANT_ACCESS_ATTEMPT',
      ipAddress: req.ip || 'unknown',
      userId: req.user.id,
      details: `User ${req.user.email} (Tenant: ${userTenantId}) attempted cross-tenant access to ${requestedTenantId}.`,
      severity: 'critical'
    });

    return res.status(403).json({
      error: 'Forbidden: Cross-tenant access is strictly prohibited by security isolation boundary.',
      code: 'TENANT_ISOLATION_VIOLATION'
    });
  }

  next();
}

// Professional Practitioner Authority: Only CPAs/EAs can approve tax positions, sign returns, or submit resolution requests
export function requirePractitionerAuthority(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const role = req.user.role;
  // Compliance staff, recruiters, support staff, and administrators do NOT have authority to approve tax positions or sign returns
  if (['compliance', 'recruiter', 'support', 'client', 'prospective_client', 'admin', 'administrator', 'super_admin'].includes(role)) {
    db.logSecurityEvent({
      eventType: 'UNAUTHORIZED_TAX_APPROVAL_ATTEMPT',
      ipAddress: req.ip || 'unknown',
      userId: req.user.id,
      details: `Non-practitioner user ${req.user.email} (Role: ${role}) attempted to certify/approve a tax filing or resolution position.`,
      severity: 'critical'
    });

    return res.status(403).json({
      error: 'Forbidden: Circular 230 practitioner credential (CPA/EA/Attorney) required. Compliance, administrative, and support roles cannot approve tax positions or filing packages.',
      code: 'PRACTITIONER_AUTHORITY_REQUIRED'
    });
  }

  next();
}

// Maker-Checker authorization gate: Preparer cannot approve own work; requires separate Senior Reviewer
export function requireMakerChecker(getPreparerId?: (req: AuthenticatedRequest) => string | undefined) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const preparerId = getPreparerId ? getPreparerId(req) : (req.body?.preparerId || req.query?.preparerId);

    // Maker cannot approve own work
    if (preparerId && req.user.id === preparerId) {
      db.logSecurityEvent({
        eventType: 'MAKER_CHECKER_SELF_APPROVAL_ATTEMPT',
        ipAddress: req.ip || 'unknown',
        userId: req.user.id,
        details: `Preparer ${req.user.name} (${req.user.id}) attempted to self-approve/certify their own workpaper or filing package.`,
        severity: 'critical'
      });

      return res.status(403).json({
        error: 'Forbidden: Maker-Checker violation. The preparer cannot review and finally certify their own filing-critical work. Independent Senior Reviewer (CPA/EA) sign-off required.',
        code: 'MAKER_CHECKER_SELF_APPROVAL_FORBIDDEN'
      });
    }

    // Role must be senior reviewer or partner
    if (['accountant', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: Maker-Checker violation. Preparer role cannot provide final quality review sign-off. Senior Reviewer (CPA/EA) required.',
        code: 'MAKER_CHECKER_REVIEWER_REQUIRED'
      });
    }

    // Administrators cannot bypass maker-checker
    if (['admin', 'administrator', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: Administrative bypass prohibited. System administrators do not automatically receive professional authority to approve tax positions or filing packages.',
        code: 'ADMIN_TAX_APPROVAL_FORBIDDEN'
      });
    }

    next();
  };
}

// Scrub internal reviewer notes when serving to clients
export function filterReviewerNotesForClients(data: any, userRole: string): any {
  if (userRole === 'client' || userRole === 'prospective_client') {
    if (Array.isArray(data)) {
      return data.map(item => filterReviewerNotesForClients(item, userRole));
    }
    if (data && typeof data === 'object') {
      const sanitized = { ...data };
      delete sanitized.internalReviewerNotes;
      delete sanitized.reviewerNotes;
      delete sanitized.qcFlags;
      delete sanitized.preparerNotes;
      return sanitized;
    }
  }
  return data;
}
