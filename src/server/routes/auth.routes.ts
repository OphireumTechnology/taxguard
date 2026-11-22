import express from 'express';
import {
  authenticateToken,
  checkBruteForceLockout,
  clearLoginFailures,
  createSession,
  recordLoginFailure,
  verifyPassword,
  type AuthenticatedRequest,
} from '../auth';
import { db } from '../db';
import { verifyTotpCode, hasTotpSecret } from '../totp';
import { isSupabaseServerConfigured, verifySupabaseAccessToken } from '../supabase';
import { SupabaseDurableSessions } from '../supabase-db';

export const authRouter = express.Router();

authRouter.post('/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.NODE_ENV === 'production') {
    return res.status(410).json({
      code: 'LOCAL_AUTH_RETIRED',
      error: 'Local password login is retired in production. Use the Supabase session bridge.',
    });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const totpCode = typeof req.body?.totpCode === 'string' ? req.body.totpCode.trim() : '';
  const ip = req.ip || 'unknown';
  const lockoutKey = `${ip}:${email}`;

  if (!email || !password) {
    return res.status(400).json({ code: 'CREDENTIALS_REQUIRED', error: 'Email and password are required.' });
  }

  const lock = checkBruteForceLockout(lockoutKey);
  if (lock.locked) {
    return res.status(429).json({
      code: 'ACCOUNT_LOCKED',
      error: `Too many failed attempts. Try again in ${lock.remainingSec}s.`,
    });
  }

  const user = Array.from(db.users.values()).find((u) => (u.email || '').toLowerCase() === email);
  const storedHash = db.userPasswords.get(email);
  if (!user || !storedHash || !verifyPassword(password, storedHash)) {
    recordLoginFailure(lockoutKey, ip, email);
    return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid credentials.' });
  }

  if (user.status === 'disabled' || user.status === 'suspended') {
    return res.status(403).json({ code: 'ACCOUNT_INACTIVE', error: 'Account is suspended or disabled.' });
  }

  let verifiedMfa = false;
  if (user.role === 'super_admin' || hasTotpSecret(user.id)) {
    if (!totpCode || !verifyTotpCode(user.id, totpCode)) {
      recordLoginFailure(lockoutKey, ip, email);
      return res.status(401).json({ code: 'MFA_REQUIRED', error: 'Valid TOTP verification code is required.' });
    }
    verifiedMfa = true;
  }

  clearLoginFailures(lockoutKey);
  const token = createSession(user.id, user.role, verifiedMfa);
  return res.json({ token, user });
});

authRouter.post('/supabase-session', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isSupabaseServerConfigured()) {
    return res.status(503).json({
      code: 'SUPABASE_NOT_CONFIGURED',
      error: 'Durable identity provider is not configured.',
    });
  }
  const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
  if (!accessToken) {
    return res.status(400).json({ code: 'ACCESS_TOKEN_REQUIRED', error: 'Supabase access token is required.' });
  }
  try {
    const verified = await verifySupabaseAccessToken(accessToken);
    const sessions = new SupabaseDurableSessions();
    const session = await sessions.create(verified);
    return res.json(session);
  } catch (err: any) {
    return res.status(err?.status || 401).json({
      code: err?.code || 'SESSION_EXCHANGE_FAILED',
      error: 'Unable to establish authenticated session.',
    });
  }
});

authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: req.user });
});

authRouter.get('/session', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ authenticated: true, user: req.user });
});

authRouter.post('/logout', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.token) {
    db.sessions.delete(req.token);
  }
  res.json({ ok: true });
});
