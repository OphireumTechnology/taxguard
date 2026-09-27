/**
 * A/R Tax Services, LLC - Production Server Entry Point
 * Full-stack Express + Vite application with enterprise security headers,
 * role-based access control, cryptographic session handling, and Gemini AI pipeline.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initSeedPasswords } from './src/server/auth';
import { authRouter } from './src/server/routes/auth.routes';
import { onboardingRouter } from './src/server/routes/onboarding.routes';
import { documentsRouter } from './src/server/routes/documents.routes';
import { engagementsRouter } from './src/server/routes/engagements.routes';
import { appointmentsRouter } from './src/server/routes/appointments.routes';
import { paymentsRouter } from './src/server/routes/payments.routes';
import { integrationsRouter } from './src/server/routes/integrations.routes';
import { messagesRouter } from './src/server/routes/messages.routes';
import { careersRouter } from './src/server/routes/careers.routes';
import { legalRouter } from './src/server/routes/legal.routes';
import { adminRouter } from './src/server/routes/admin.routes';
import { securityRouter } from './src/server/routes/security.routes';
import { assignmentsRouter } from './src/server/routes/assignments.routes';
import { accountantRouter } from './src/server/routes/accountant.routes';
import { calendarRouter } from './src/server/routes/calendar.routes';
import { consultationRoomRouter } from './src/server/routes/consultationRoom.routes';
import { intakeRouter } from './src/server/routes/intake.routes';
import { stagingRouter } from './src/server/routes/staging.routes';
import { monitoringRouter } from './src/server/routes/monitoring.routes';
import { taxguardRouter, handleLegacyTaxGuardRoute } from './src/server/routes/taxguard.routes';
import { db } from './src/server/db';
import { AuthenticatedRequest } from './src/server/auth';

const app = express();
const PORT = 3000;

// Initialize seed credentials
initSeedPasswords();

// Parse JSON and form payloads with generous limits for file base64 data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS and Security Headers allowing AI Studio iframe embedding and preview
app.use((req, res, next) => {
  // Allow AI Studio preview frames and cross-origin previews
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Explicitly remove X-Frame-Options so the AI Studio preview iframe can render
  res.removeHeader('X-Frame-Options');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    firm: 'A/R TAX SERVICES, LLC',
    location: 'Columbia, South Carolina, USA',
    founder: 'Desmond Hinds',
    tagline: 'Preserving Wealth. Building Legacies.',
    serverTime: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/engagements', engagementsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/careers', careersRouter);
app.use('/api/legal', legalRouter);
app.use('/api/admin', adminRouter);
app.use('/api/security', securityRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/accountant', accountantRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/consultation-rooms', consultationRoomRouter);
app.use('/api/intake', intakeRouter);
app.use('/api/staging', stagingRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/taxguard', taxguardRouter);

// Legacy /taxguard route redirection and security gate
app.use(['/taxguard', '/taxguard/*'], (req: AuthenticatedRequest, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.headers['x-session-token'] as string);

  if (token) {
    const session = db.sessions.get(token);
    if (session && Date.now() <= session.expiresAt) {
      const user = db.users.get(session.userId);
      if (user && user.status !== 'disabled' && user.status !== 'suspended') {
        req.user = user;
        req.token = token;
      }
    }
  }

  handleLegacyTaxGuardRoute(req, res);
});

// Serve public assets explicitly with cache revalidation
app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// Vite middleware for dev vs static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Redirect any legacy /ar-tax-portal requests to root domain paths
    app.use((req, res, next) => {
      if (req.path === '/ar-tax-portal' || req.path === '/ar-tax-portal/') {
        return res.redirect(301, '/');
      }
      if (req.path.startsWith('/ar-tax-portal/')) {
        const cleanPath = req.path.replace(/^\/ar-tax-portal/, '');
        return res.redirect(301, cleanPath || '/');
      }
      next();
    });
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[A/R Tax Services] Server successfully initialized on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
