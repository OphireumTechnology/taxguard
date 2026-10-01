/**
 * Authentication & Identity Routes
 * Supabase-backed LIVE identity, demonstration login, password management,
 * brute-force lockout, session validation, and MFA.
 */

import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { db } from '../db';
import {
  hashPassword,
  verifyPassword,
  createSession,
  revokeSession,
  checkBruteForceLockout,
  recordLoginFailure,
  clearLoginFailures,
  authenticateToken,
  AuthenticatedRequest
} from '../auth';
import { User, OnboardingState } from '../../types';
import { AuthorityError } from '../taxguard/authority.repository';
import {
  verifySupabaseAccessToken,
  isSupabaseServerConfigured,
  VerifiedSupabaseUser
} from '../supabase';
import { SupabaseDurableSessions } from '../supabase-db';
import { provisionOrResolveClientOnboarding } from '../taxguard/clientOnboardingProvisioner';

export const authRouter = Router();
authRouter.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !['/supabase-session', '/me', '/logout'].includes(req.path)) {
    return res.status(410).json({ error: 'Use Supabase Authentication for live account operations.', code: 'SUPABASE_AUTH_REQUIRED' });
  }
  next();
});

/**
 * Supabase -> TaxGuard LIVE session bridge.
 * Supabase proves external identity. TaxGuard restores or provisions the
 * permanent application identity, tenant membership, client profile, engagement,
 * tax year, tax case, and Stage 01 state, and creates the server-authoritative session.
 *
 * Security Invariant: Never trust role, tenantId, clientId, engagementId, or caseId
 * supplied by the browser.
 */
authRouter.post('/supabase-session', async (req: Request, res: Response) => {
  const { accessToken } = req.body || {};

  if (!accessToken || typeof accessToken !== 'string') {
    return res.status(400).json({ error: 'Supabase access token is required.', code: 'TOKEN_REQUIRED' });
  }

  let verifiedUser: VerifiedSupabaseUser;

  try {
    verifiedUser = await verifySupabaseAccessToken(accessToken);
  } catch (error: any) {
    console.warn('[Supabase Session] Token verification failed:', error?.message);
    return res.status(401).json({ error: 'Supabase authentication could not be verified.', code: 'INVALID_TOKEN' });
  }

  const uid = verifiedUser.uid;
  const tokenEmail = verifiedUser.email;

  if (!uid || !tokenEmail) {
    return res.status(401).json({
      error: 'Verified Supabase identity does not contain a valid email.',
      code: 'INVALID_IDENTITY'
    });
  }

  try {
    const sessions = new SupabaseDurableSessions();
    const session = await sessions.create(verifiedUser);

    let onboardingBundle = null;
    if (session.user.role === 'client' && session.clientId) {
      onboardingBundle = await provisionOrResolveClientOnboarding({
        tenantId: session.tenantId,
        user: session.user
      });
      if (
        onboardingBundle.workflow?.stage1?.status === 'COMPLETED' ||
        onboardingBundle.taxCase.activeStage >= 2 ||
        (session.user.onboardingStatus || '').toUpperCase() === 'COMPLETED'
      ) {
        session.user.onboardingStatus = 'COMPLETED';
        session.user.onboardingCompletedAt =
          session.user.onboardingCompletedAt ||
          onboardingBundle.workflow.stage1.completedAt ||
          new Date().toISOString();
        db.users.set(session.user.id, session.user);
        sessions.updateUser(session.user.id, {
          onboardingStatus: 'COMPLETED',
          onboardingCompletedAt: session.user.onboardingCompletedAt
        }).catch(() => {});
      }
    }

    return res.status(200).json({
      ...session,
      user: session.user,
      ...(onboardingBundle
        ? {
            tenantId: onboardingBundle.tenant.tenantId,
            clientId: onboardingBundle.client.clientId,
            engagementId: onboardingBundle.engagement.engagementId,
            taxYear: onboardingBundle.taxYearRecord.taxYear,
            caseId: onboardingBundle.taxCase.caseId,
            activeStage: onboardingBundle.taxCase.activeStage,
            stageStates: onboardingBundle.stageStates,
            resumed: onboardingBundle.resumed,
            workflow: onboardingBundle.workflow,
            eligibility: onboardingBundle.eligibility
          }
        : {}),
      message: 'Live TaxGuard session established.'
    });
  } catch (error: any) {
    console.error('[Supabase Session] Session establishment failed:', error);
    const status = error instanceof AuthorityError ? error.status : 503;
    const code = error instanceof AuthorityError ? error.code : 'AUTH_UNAVAILABLE';
    return res.status(status).json({
      error: 'Live identity could not be established. Contact support.',
      code
    });
  }
});

/**
 * Public registration must be completed with Supabase Authentication.
 */
authRouter.post('/register', (_req: Request, res: Response) => {
  return res.status(410).json({
    error: 'Public registration requires Supabase Authentication.',
    code: 'SUPABASE_REGISTRATION_REQUIRED'
  });
});

// Secure demonstration/staff login. LIVE public clients use Supabase.
authRouter.post('/login', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(410).json({ error: 'Supabase authentication is required.', code: 'SUPABASE_AUTH_REQUIRED' });
  const { email, password, mfaCode } = req.body;
  const ip = req.ip || 'unknown';
  const lockoutKey = `${ip}_${(email || '').toLowerCase()}`;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const lockout = checkBruteForceLockout(lockoutKey);
  if (lockout.locked) {
    db.logSecurityEvent({
      eventType: 'LOGIN_ATTEMPT_DURING_LOCKOUT',
      ipAddress: ip,
      details: `Blocked login attempt for ${email}. Account is locked for another ${lockout.remainingSec} seconds.`,
      severity: 'warning'
    });
    return res.status(429).json({
      error: `Too many failed login attempts. Access temporarily locked for ${lockout.remainingSec} seconds. Please try again later.`,
      locked: true,
      remainingSec: lockout.remainingSec
    });
  }

  const user = Array.from(db.users.values()).find(item => item.email.toLowerCase() === email.toLowerCase());
  const storedHash = db.userPasswords.get(email.toLowerCase());

  if (!user || !storedHash || !verifyPassword(password, storedHash)) {
    recordLoginFailure(lockoutKey, ip, email);
    return res.status(401).json({
      error: 'Invalid credentials. Please verify your email and password.',
      code: 'INVALID_CREDENTIALS'
    });
  }

  if (user.status === 'disabled' || user.status === 'suspended') {
    db.logSecurityEvent({
      eventType: 'DISABLED_USER_LOGIN_ATTEMPT',
      ipAddress: ip,
      userId: user.id,
      details: `Blocked login attempt for ${user.email} because status is ${user.status}.`,
      severity: 'critical'
    });
    return res.status(403).json({
      error: `Access Denied: Your account has been ${user.status}. Please contact A/R Tax Services compliance at info@artaxservices.com.`,
      code: 'ACCOUNT_DISABLED'
    });
  }

  if (user.mfaEnabled && !mfaCode) {
    return res.status(200).json({
      mfaRequired: true,
      message: 'MFA authorization code required.',
      userId: user.id
    });
  }

  clearLoginFailures(lockoutKey);
  user.lastLoginAt = new Date().toISOString();
  db.users.set(user.id, user);
  const token = createSession(user.id, user.role);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'USER_LOGIN_SUCCESS',
    resource: 'Session Manager',
    details: `Successful authentication from IP ${ip}. Role: ${user.role}.`,
    ipAddress: ip,
    severity: 'info'
  });

  return res.json({ token, user });
});

authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user && req.user.role === 'client' && req.user.clientId) {
    const existing = db.users.get(req.user.id);
    if (existing) {
      if ((existing.onboardingStatus || '').toUpperCase() === 'COMPLETED') {
        req.user.onboardingStatus = 'COMPLETED';
      } else if (existing.onboardingStatus) {
        req.user.onboardingStatus = existing.onboardingStatus;
      }
      if (existing.onboardingCompletedAt) req.user.onboardingCompletedAt = existing.onboardingCompletedAt;
      if (existing.stageOneDossier) req.user.stageOneDossier = existing.stageOneDossier;
    }
  }
  return res.json({ user: req.user });
});

authRouter.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.token?.startsWith('tg_live_')) {
    try {
      if (isSupabaseServerConfigured()) {
        try {
          await new SupabaseDurableSessions().revoke(req.token);
        } catch {
          // Fall through
        }
      }
      return res.json({ message: 'Logged out successfully.' });
    } catch { return res.status(503).json({ error: 'Session revocation unavailable.' }); }
  }
  if (req.token) revokeSession(req.token);
  db.logAudit({
    userId: req.user?.id || 'unknown',
    userName: req.user?.name || 'Anonymous',
    userRole: req.user?.role || 'client',
    action: 'USER_LOGOUT',
    resource: 'Session Manager',
    details: 'User explicitly logged out and session revoked.',
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });
  return res.json({ message: 'Logged out successfully.' });
});

authRouter.post('/verify-email', (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Verification token is required.' });

  const email = db.emailVerificationTokens.get(token);
  if (!email) return res.status(400).json({ error: 'Invalid or expired verification token.' });

  const user = Array.from(db.users.values()).find(item => item.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.isVerified = true;
  db.users.set(user.id, user);
  db.emailVerificationTokens.delete(token);
  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'EMAIL_VERIFIED',
    resource: `User #${user.id}`,
    details: `Email ${email} verified successfully via cryptographic token.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });
  return res.json({ message: 'Email verified successfully!', user });
});

authRouter.post('/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address is required.' });

  const user = Array.from(db.users.values()).find(item => item.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.json({ message: 'If an account exists with this email, a secure reset token has been dispatched.' });
  }

  const resetToken = randomBytes(24).toString('hex');
  db.passwordResetTokens.set(resetToken, {
    email: email.toLowerCase(),
    expiresAt: Date.now() + 60 * 60 * 1000
  });

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'PASSWORD_RESET_REQUESTED',
    resource: `User #${user.id}`,
    details: `Password reset token generated for ${email}.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({
    message: 'If an account exists with this email, a secure reset token has been dispatched.',
    ...(process.env.NODE_ENV !== 'production' ? { devResetToken: resetToken } : {})
  });
});

authRouter.post('/change-password', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  const storedHash = db.userPasswords.get(user.email.toLowerCase());
  if (!storedHash || !verifyPassword(currentPassword, storedHash)) {
    return res.status(401).json({ error: 'Current password verification failed.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  db.userPasswords.set(user.email.toLowerCase(), hashPassword(newPassword));
  user.mustResetPassword = false;
  db.users.set(user.id, user);

  const currentToken = req.headers.authorization?.replace('Bearer ', '') || (req.headers['x-session-token'] as string);
  let revokedCount = 0;
  for (const [token, session] of db.sessions.entries()) {
    if (session.userId === user.id && token !== currentToken) {
      db.sessions.delete(token);
      revokedCount++;
    }
  }

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'PASSWORD_CHANGED',
    resource: `User #${user.id}`,
    details: `Password successfully updated. ${revokedCount} other active sessions revoked.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({
    message: 'Password successfully changed. Other active sessions have been securely terminated.',
    revokedSessions: revokedCount
  });
});

authRouter.post('/revoke-sessions', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let revokedCount = 0;

  for (const [token, session] of db.sessions.entries()) {
    if (session.userId === user.id) {
      db.sessions.delete(token);
      revokedCount++;
    }
  }

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'ALL_SESSIONS_REVOKED',
    resource: `User #${user.id}`,
    details: `User explicitly revoked all active sessions (${revokedCount} terminated).`,
    ipAddress: req.ip || 'unknown',
    severity: 'warning'
  });

  return res.json({ message: 'All sessions successfully revoked.', revokedCount });
});

authRouter.post('/reset-password', (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });

  const resetRecord = db.passwordResetTokens.get(token);
  if (!resetRecord || Date.now() > resetRecord.expiresAt) {
    return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
  }

  const user = Array.from(db.users.values()).find(item => item.email.toLowerCase() === resetRecord.email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters long.' });

  db.userPasswords.set(user.email.toLowerCase(), hashPassword(newPassword));
  db.passwordResetTokens.delete(token);

  for (const [sessionToken, sessionData] of db.sessions.entries()) {
    if (sessionData.userId === user.id) db.sessions.delete(sessionToken);
  }

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'PASSWORD_RESET_COMPLETED',
    resource: `User #${user.id}`,
    details: 'User password reset completed. All active sessions invalidated.',
    ipAddress: req.ip || 'unknown',
    severity: 'warning'
  });

  return res.json({ message: 'Password has been successfully updated. Please log in with your new credentials.' });
});

/**
 * Caller-asserted Google profile data is not an authentication proof. Google
 * users must authenticate through Supabase OAuth and use /supabase-session.
 */
authRouter.post('/google', (_req: Request, res: Response) => {
  return res.status(410).json({
    error: 'Google authentication requires a verified Supabase provider token.',
    code: 'SUPABASE_PROVIDER_TOKEN_REQUIRED'
  });
});
