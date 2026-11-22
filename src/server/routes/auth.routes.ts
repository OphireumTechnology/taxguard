import { Router } from 'express';
import {
  authenticateToken,
  checkBruteForceLockout,
  clearLoginFailures,
  createSession,
  hashPassword,
  recordLoginFailure,
  revokeSession,
  verifyPassword,
  type AuthenticatedRequest,
} from '../auth';
import { db } from '../db';
import { randomUUID } from 'node:crypto';

export const authRouter = Router();

authRouter.get('/local-login-status', (_req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    localLoginAvailable: !isProd,
    mode: isProd ? 'provider_only' : 'local_development',
  });
});

authRouter.post('/login', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(410).json({ code: 'LOCAL_LOGIN_RETIRED', error: 'Use the configured identity provider.' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ code: 'CREDENTIALS_REQUIRED', error: 'Email and password are required.' });
  }
  const ip = req.ip || 'unknown';
  const lockKey = `${email}:${ip}`;
  const lock = checkBruteForceLockout(lockKey);
  if (lock.locked) {
    return res.status(429).json({
      code: 'ACCOUNT_LOCKED',
      error: `Too many failed attempts. Try again in ${lock.remainingSec}s.`,
    });
  }

  const user = Array.from(db.users.values()).find((u) => u.email.toLowerCase() === email);
  const storedHash = db.userPasswords.get(email);
  if (!user || !storedHash || !verifyPassword(password, storedHash)) {
    recordLoginFailure(lockKey, ip, email);
    return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid email or password.' });
  }
  if (user.status === 'disabled' || user.status === 'suspended') {
    return res.status(403).json({ code: 'ACCOUNT_DISABLED', error: 'This account is currently disabled.' });
  }

  clearLoginFailures(lockKey);
  const token = createSession(user.id, user.role, Boolean(req.body?.mfaCode));
  user.lastLoginAt = new Date().toISOString();
  return res.json({ token, user });
});

authRouter.post('/register', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(410).json({ code: 'LOCAL_REGISTER_RETIRED', error: 'Use the configured identity provider.' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim() || email.split('@')[0];
  if (!email || password.length < 8) {
    return res.status(400).json({ code: 'INVALID_REGISTRATION', error: 'Valid email and password (8+ chars) required.' });
  }
  const existing = Array.from(db.users.values()).find((u) => u.email.toLowerCase() === email);
  if (existing) {
    return res.status(409).json({ code: 'EMAIL_EXISTS', error: 'An account with this email already exists.' });
  }
  const id = `user_client_${randomUUID().slice(0, 8)}`;
  const clientId = `TG-${Date.now().toString(36).toUpperCase()}`;
  const newUser: any = {
    id,
    clientId,
    tenantId: process.env.TAXGUARD_TENANT_ID || 'tenantA',
    email,
    name,
    role: 'client',
    phone: req.body?.phone || '',
    companyName: req.body?.companyName || '',
    clientType: req.body?.clientType || 'individual',
    mfaEnabled: false,
    status: 'active',
    isVerified: true,
    onboardingStatus: 'in_progress',
    onboardingStep: 1,
    createdAt: new Date().toISOString(),
  };
  db.users.set(id, newUser);
  db.userPasswords.set(email, hashPassword(password));
  const token = createSession(id, 'client', false);
  return res.status(201).json({ token, user: newUser });
});

authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

authRouter.post('/logout', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (req.token) revokeSession(req.token);
  return res.json({ success: true });
});

authRouter.post('/supabase-session', (_req, res) => {
  return res.status(503).json({
    code: 'IDENTITY_PROVIDER_NOT_CONFIGURED',
    error: 'Supabase identity provider bridge is not configured in this environment.',
  });
});
