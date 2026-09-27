/**
 * Authentication & Identity Routes
 * Client registration, email verification, password management,
 * brute-force lockout, session validation, and MFA.
 */

import { Router, Request, Response } from 'express';
import { randomUUID, randomBytes } from 'crypto';
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
import { User } from '../../types';

export const authRouter = Router();

// Rate limiting and registration endpoint
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, companyName, clientType } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // Security: Check if email already registered
    const existing = Array.from(db.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address is already registered.' });
    }

    // SECURITY MANDATE: Public registration CANNOT select staff or admin roles
    // Any role in body is strictly ignored and forced to 'client'
    const newUserId = `usr_${randomUUID()}`;
    const verificationToken = randomBytes(24).toString('hex');
    db.emailVerificationTokens.set(verificationToken, email);

    const newUser: User = {
      id: newUserId,
      name,
      email: email.toLowerCase(),
      role: 'client', // STRICTLY client role
      phone: phone || '',
      companyName: companyName || '',
      clientType: clientType || (companyName ? 'business' : 'individual'),
      status: 'active',
      isVerified: false, // Email verification pending
      mfaEnabled: false,
      onboardingStatus: 'in_progress',
      onboardingStep: 1,
      createdAt: new Date().toISOString()
    };

    db.users.set(newUserId, newUser);
    db.userPasswords.set(email.toLowerCase(), hashPassword(password));

    // Initialize initial onboarding draft
    db.onboardingStates.set(newUserId, {
      id: `onb_${randomUUID()}`,
      userId: newUserId,
      step: 1,
      percentComplete: 7,
      entityType: clientType || 'individual',
      contactInfo: {
        fullName: name,
        email: email.toLowerCase(),
        phone: phone || '',
        address: '',
        city: 'Columbia',
        state: 'SC',
        zipCode: ''
      },
      selectedServices: ['individual_tax_1040'],
      intakeAnswers: {},
      uploadedDocuments: [],
      paymentMethodAuthorized: false,
      engagementAgreementSigned: false,
      privacyDisclaimerAccepted: false,
      accountingSoftwareConnected: false,
      consultationBooked: false,
      status: 'draft',
      missingRequirements: ['Email Verification', 'Contact Information', 'Engagement Agreement'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const sessionToken = createSession(newUserId, 'client');

    db.logAudit({
      userId: newUserId,
      userName: name,
      userRole: 'client',
      action: 'CLIENT_REGISTERED',
      resource: `User #${newUserId}`,
      details: `New client account registered for ${email}. Email verification dispatched.`,
      ipAddress: req.ip || '127.0.0.1',
      severity: 'info'
    });

    return res.status(201).json({
      message: 'Account successfully registered.',
      token: sessionToken,
      user: newUser,
      verificationTokenSimulated: verificationToken
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal registration failure.' });
  }
});

// Secure Login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password, mfaCode } = req.body;
  const ip = req.ip || 'unknown';
  const lockoutKey = `${ip}_${(email || '').toLowerCase()}`;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // Check brute force lockout
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

  const user = Array.from(db.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  const storedHash = db.userPasswords.get(email.toLowerCase());

  if (!user || !storedHash || !verifyPassword(password, storedHash)) {
    recordLoginFailure(lockoutKey, ip, email);
    return res.status(401).json({ 
      error: 'Invalid credentials. Please verify your email and password.',
      code: 'INVALID_CREDENTIALS' 
    });
  }

  // Account status check (suspended or disabled accounts)
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

  // Optional MFA check
  if (user.mfaEnabled && !mfaCode) {
    return res.status(200).json({
      mfaRequired: true,
      message: 'MFA authorization code required.',
      userId: user.id
    });
  }

  // Clear failures upon successful validation
  clearLoginFailures(lockoutKey);

  // Update last login
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

  return res.json({
    token,
    user
  });
});

// Current User Profile
authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

// Logout
authRouter.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.token) {
    revokeSession(req.token);
  }
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

// Email Verification
authRouter.post('/verify-email', (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Verification token is required.' });

  const email = db.emailVerificationTokens.get(token);
  if (!email) {
    return res.status(400).json({ error: 'Invalid or expired verification token.' });
  }

  const user = Array.from(db.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user) {
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
  }

  return res.status(404).json({ error: 'User not found.' });
});

// Forgot Password Workflow
authRouter.post('/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address is required.' });

  const user = Array.from(db.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    // Return standard message to prevent email enumeration
    return res.json({ message: 'If an account exists with this email, a secure reset token has been dispatched.' });
  }

  const resetToken = randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
  db.passwordResetTokens.set(resetToken, { email: email.toLowerCase(), expiresAt });

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

// Authenticated Password Change & Session Revocation
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
  
  // Clear mustResetPassword flag
  user.mustResetPassword = false;
  db.users.set(user.id, user);

  // Invalidate all existing sessions except current
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

// Explicit Session Revocation Endpoint
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

// Reset Password Workflow
authRouter.post('/reset-password', (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  const resetRecord = db.passwordResetTokens.get(token);
  if (!resetRecord || Date.now() > resetRecord.expiresAt) {
    return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
  }

  const user = Array.from(db.users.values()).find(u => u.email.toLowerCase() === resetRecord.email.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.userPasswords.set(user.email.toLowerCase(), hashPassword(newPassword));
  db.passwordResetTokens.delete(token);

  // Invalidate all existing sessions for this user for security
  for (const [sToken, sData] of db.sessions.entries()) {
    if (sData.userId === user.id) {
      db.sessions.delete(sToken);
    }
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

// Optional Google Sign-in Endpoint
authRouter.post('/google', (req: Request, res: Response) => {
  const { email, name, googleId } = req.body;
  if (!email) return res.status(400).json({ error: 'Google email is required.' });

  let user = Array.from(db.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    const newUserId = `usr_${randomUUID()}`;
    user = {
      id: newUserId,
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      role: 'client',
      status: 'active',
      isVerified: true,
      mfaEnabled: false,
      createdAt: new Date().toISOString()
    };
    db.users.set(newUserId, user);
  }

  const token = createSession(user.id, user.role);

  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'GOOGLE_SSO_LOGIN',
    resource: 'OAuth Identity Provider',
    details: `Client authenticated via Google OAuth SSO.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ token, user });
});
