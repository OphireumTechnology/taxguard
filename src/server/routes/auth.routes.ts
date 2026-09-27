/**
 * Authentication & Identity Routes
 * Firebase-backed LIVE identity, demonstration login, password management,
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
import {
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
  verifyFirebaseIdToken
} from '../firebase-admin';
import { allocateTaxGuardClientId } from '../client-id.service';

export const authRouter = Router();

/**
 * LIVE public registration must be completed with Firebase Authentication and
 * then bridged through /firebase-session. The legacy endpoint must never mint
 * a LIVE session from caller-supplied profile data.
 */
authRouter.post('/register', (_req: Request, res: Response) => {
  return res.status(410).json({
    error: 'Public registration requires Firebase Authentication.',
    code: 'FIREBASE_REGISTRATION_REQUIRED'
  });
});

const firebaseProvisioningLocks = new Map<string, Promise<void>>();

async function withFirebaseProvisioningLock<T>(firebaseUid: string, operation: () => Promise<T>): Promise<T> {
  const previous = firebaseProvisioningLocks.get(firebaseUid) || Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const tail = previous.catch(() => {}).then(() => gate);
  firebaseProvisioningLocks.set(firebaseUid, tail);

  await previous.catch(() => {});

  try {
    return await operation();
  } finally {
    release();
    if (firebaseProvisioningLocks.get(firebaseUid) === tail) {
      firebaseProvisioningLocks.delete(firebaseUid);
    }
  }
}

/**
 * Firebase -> TaxGuard LIVE session bridge.
 * Firebase proves external identity. TaxGuard restores or provisions the
 * permanent application identity and creates the application session.
 */
authRouter.post('/firebase-session', async (req: Request, res: Response) => {
  const { idToken } = req.body || {};

  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'Firebase ID token is required.' });
  }

  let decodedToken: Awaited<ReturnType<typeof verifyFirebaseIdToken>>;

  try {
    decodedToken = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    console.error('[Firebase Session] Token verification failed.', error);
    return res.status(401).json({ error: 'Firebase authentication could not be verified.' });
  }

  const firebaseUid = decodedToken.uid;
  const tokenEmail = typeof decodedToken.email === 'string'
    ? decodedToken.email.trim().toLowerCase()
    : '';

  if (!firebaseUid || !tokenEmail) {
    return res.status(401).json({
      error: 'Verified Firebase identity does not contain a valid email.'
    });
  }

  const firestore = getFirebaseAdminDb();
  const firebaseAdminAuth = getFirebaseAdminAuth();

  if (!firestore || !firebaseAdminAuth) {
    return res.status(503).json({ error: 'Live account persistence is unavailable.' });
  }

  try {
    const firebaseAccount = await firebaseAdminAuth.getUser(firebaseUid);
    const verifiedEmail = (firebaseAccount.email || '').trim().toLowerCase();

    if (!verifiedEmail || verifiedEmail !== tokenEmail) {
      return res.status(401).json({ error: 'Verified Firebase identity is inconsistent.' });
    }

    const provisioned = await withFirebaseProvisioningLock(firebaseUid, async () => {
      const userRef = firestore.collection('users').doc(firebaseUid);
      const existingSnapshot = await userRef.get();
      const existing = existingSnapshot.exists ? existingSnapshot.data() || {} : {};
      const hadPermanentClientId = Boolean(existing.clientId);

      let clientId: string;
      let clientIdSequence: number | undefined;

      if (hadPermanentClientId) {
        clientId = String(existing.clientId);
      } else {
        const allocation = await allocateTaxGuardClientId(firestore);
        clientId = allocation.clientId;
        clientIdSequence = allocation.sequence;
      }

      const existingDbUser = db.users.get(firebaseUid);
      const persistedStatus = existingDbUser?.status || existing.status;

      if (persistedStatus === 'disabled' || persistedStatus === 'suspended') {
        const blockedError = new Error('ACCOUNT_DISABLED') as Error & { status?: number };
        blockedError.status = 403;
        throw blockedError;
      }

      const verifiedName = firebaseAccount.displayName?.trim() || verifiedEmail;
      const existingPhone = hadPermanentClientId && typeof existing.phone === 'string' ? existing.phone : '';
      const existingCompany = hadPermanentClientId && typeof existing.companyName === 'string' ? existing.companyName : '';
      const existingClientType = hadPermanentClientId && existing.clientType === 'business'
        ? 'business'
        : 'individual';
      const createdAt = typeof existing.createdAt === 'string'
        ? existing.createdAt
        : firebaseAccount.metadata.creationTime || new Date().toISOString();

      const user: User = {
        id: firebaseUid,
        clientId,
        email: verifiedEmail,
        name: verifiedName,
        role: 'client',
        phone: existingPhone || firebaseAccount.phoneNumber || '',
        companyName: existingCompany,
        company: existingCompany,
        clientType: existingClientType,
        status: 'active',
        isVerified: true,
        createdAt,
        mfaEnabled: false
      };

      const persistedProfile: Record<string, unknown> = {
        uid: firebaseUid,
        clientId,
        email: verifiedEmail,
        fullName: verifiedName,
        role: 'client',
        phone: user.phone || '',
        companyName: user.companyName || '',
        clientType: existingClientType,
        status: 'active',
        environment: 'live',
        externalSubmissionEnabled: false,
        updatedAt: new Date().toISOString()
      };

      if (!hadPermanentClientId) {
        persistedProfile.clientIdSequence = clientIdSequence;
        persistedProfile.createdAt = createdAt;
      }

      await userRef.set(persistedProfile, { merge: true });
      db.users.set(firebaseUid, user);

      if (!db.onboardingStates.has(firebaseUid)) {
        const onboardingState: OnboardingState = {
          id: `onb_${randomBytes(16).toString('hex')}`,
          userId: firebaseUid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          step: 1,
          percentComplete: 5,
          entityType: existingClientType,
          contactInfo: {
            fullName: user.name,
            email: user.email,
            phone: user.phone || '',
            address: '',
            city: '',
            state: '',
            zipCode: ''
          },
          selectedServices: [],
          intakeAnswers: {},
          uploadedDocuments: [],
          paymentMethodAuthorized: false,
          engagementAgreementSigned: false,
          privacyDisclaimerAccepted: false,
          accountingSoftwareConnected: false,
          consultationBooked: false,
          status: 'draft',
          missingRequirements: [
            'Complete identity verification',
            'Complete onboarding information'
          ]
        };
        db.onboardingStates.set(firebaseUid, onboardingState);
      }

      return { user, clientId, restored: hadPermanentClientId };
    });

    const sessionToken = createSession(firebaseUid, 'client');

    db.logAudit({
      userId: provisioned.user.id,
      userName: provisioned.user.name,
      userRole: 'client',
      action: provisioned.restored ? 'FIREBASE_SESSION_RESTORED' : 'FIREBASE_CLIENT_PROVISIONED',
      resource: `User #${provisioned.user.id}`,
      details: provisioned.restored
        ? 'LIVE TaxGuard session restored from a verified Firebase identity.'
        : 'LIVE TaxGuard client provisioned from a verified Firebase identity.',
      ipAddress: req.ip || 'unknown',
      severity: 'info'
    });

    return res.status(200).json({
      message: provisioned.restored
        ? 'Live TaxGuard session restored.'
        : 'Live TaxGuard account provisioned.',
      token: sessionToken,
      user: provisioned.user,
      clientId: provisioned.clientId,
      environment: 'live',
      externalSubmissionEnabled: false
    });
  } catch (error: any) {
    if (error?.status === 403 || error?.message === 'ACCOUNT_DISABLED') {
      return res.status(403).json({
        error: 'Access denied because this TaxGuard account is disabled or suspended.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    console.error('[Firebase Session] Provisioning failed.', error);
    return res.status(503).json({ error: 'The LIVE TaxGuard session could not be provisioned.' });
  }
});

// Secure demonstration/staff login. LIVE public clients use Firebase.
authRouter.post('/login', async (req: Request, res: Response) => {
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
  return res.json({ user: req.user });
});

authRouter.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
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
 * users must authenticate through Firebase and use /firebase-session.
 */
authRouter.post('/google', (_req: Request, res: Response) => {
  return res.status(410).json({
    error: 'Google authentication requires a verified Firebase provider token.',
    code: 'FIREBASE_PROVIDER_TOKEN_REQUIRED'
  });
});
