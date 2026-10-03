import { createProductionApp } from './src/server/productionApp';
/**
 * A/R Tax Services, LLC - Production Server Entry Point
 * Full-stack Express + Vite application with enterprise security headers,
 * role-based access control, cryptographic session handling, LIVE workflow,
 * and TaxGuard AI integration.
 */

import express from 'express';
import path from 'path';
import { protectServerBuildArtifacts } from './src/server/staticAssetPolicy';
import { caseAuthorityRouter } from './src/server/routes/case-authority.routes';
import { createServer as createViteServer } from 'vite';

import {
  initSeedPasswords
} from './src/server/auth';

import {
  authRouter
} from './src/server/routes/auth.routes';

import {
  onboardingRouter
} from './src/server/routes/onboarding.routes';

import {
  documentsRouter
} from './src/server/routes/documents.routes';

import {
  engagementsRouter
} from './src/server/routes/engagements.routes';

import {
  appointmentsRouter
} from './src/server/routes/appointments.routes';

import {
  paymentsRouter
} from './src/server/routes/payments.routes';

import {
  integrationsRouter
} from './src/server/routes/integrations.routes';

import {
  messagesRouter
} from './src/server/routes/messages.routes';

import {
  careersRouter
} from './src/server/routes/careers.routes';

import {
  legalRouter
} from './src/server/routes/legal.routes';

import {
  adminRouter
} from './src/server/routes/admin.routes';

import {
  securityRouter
} from './src/server/routes/security.routes';

import {
  assignmentsRouter
} from './src/server/routes/assignments.routes';

import {
  accountantRouter
} from './src/server/routes/accountant.routes';

import {
  calendarRouter
} from './src/server/routes/calendar.routes';

import {
  consultationRoomRouter
} from './src/server/routes/consultationRoom.routes';

import {
  intakeRouter
} from './src/server/routes/intake.routes';

import {
  stagingRouter
} from './src/server/routes/staging.routes';

import {
  monitoringRouter
} from './src/server/routes/monitoring.routes';

import {
  taxguardRouter,
  handleLegacyTaxGuardRoute
} from './src/server/routes/taxguard.routes';

import {
  accountingIntakeRouter
} from './src/server/routes/accounting-intake.routes';

import {
  profileAmendmentRouter
} from './src/server/routes/profile-amendment.routes';

import {
  practiceConsoleRouter
} from './src/server/routes/practice-console.routes';

import {
  stageTwoThreeRouter
} from './src/server/routes/stage-two-three.routes';

import {
  bookkeepingRouter
} from './src/server/routes/bookkeeping.routes';

/**
 * TaxGuard LIVE server-authoritative workflow.
 *
 * Final routes:
 *
 * GET  /api/live-workflow/state
 * POST /api/live-workflow/complete-stage
 * GET  /api/live-workflow/eligibility
 */
import liveWorkflowRouter
  from './src/server/routes/live-workflow.routes';

/**
 * M16 — TaxGuard AI Intelligence Layer.
 *
 * Final routes:
 *
 * GET  /api/taxguard-ai/health
 * POST /api/taxguard-ai/propose
 *
 * AI remains proposal-only.
 * It does not replace TaxGuard deterministic calculations,
 * verified authority, governance, or human approval.
 */
import taxguardAiRouter
  from './src/server/routes/taxguard-ai.routes';

import {
  db
} from './src/server/db';

import {
  AuthenticatedRequest
} from './src/server/auth';

import { ProviderReadinessRegistry } from './src/server/taxguard/providerReadiness.service';
import { ensureCanonicalTenantBootstrap } from './src/server/taxguard/tenantBootstrap';

const app =
  express();

const productionApi = createProductionApp();

const PORT = Number(process.env.APP_PORT) || 3000;

/**
 * ============================================================
 * INITIALIZATION
 * ============================================================
 */

if (process.env.NODE_ENV !== 'production') initSeedPasswords();
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return productionApi(req, res, next);
    next();
  });
}

/**
 * ============================================================
 * REQUEST BODY PARSERS
 * ============================================================
 */

app.use(
  express.json({
    limit: '50mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb'
  })
);

/**
 * ============================================================
 * CORS + SECURITY HEADERS
 * ============================================================
 *
 * Production frontend:
 *
 * https://artaxserv.com
 * https://www.artaxserv.com
 *
 * Production API:
 *
 * Render / Node / Express
 */

app.use(
  (
    req,
    res,
    next
  ) => {
    const allowedOrigins =
      new Set([
        'https://artaxserv.com',
        'https://www.artaxserv.com'
      ]);

    const requestOrigin =
      req.headers.origin;

    if (
      requestOrigin &&
      allowedOrigins.has(
        requestOrigin
      )
    ) {
      res.setHeader(
        'Access-Control-Allow-Origin',
        requestOrigin
      );

      res.setHeader(
        'Vary',
        'Origin'
      );
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );

    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-session-token'
    );

    res.setHeader(
      'X-Content-Type-Options',
      'nosniff'
    );

    res.setHeader(
      'Referrer-Policy',
      'strict-origin-when-cross-origin'
    );

    /**
     * Existing application behavior retained.
     *
     * The application may be rendered in supported preview
     * environments, so X-Frame-Options is not forced here.
     */
    res.removeHeader(
      'X-Frame-Options'
    );

    if (
      req.method ===
      'OPTIONS'
    ) {
      return res.sendStatus(
        200
      );
    }

    next();
  }
);

/**
 * ============================================================
 * PRODUCTION HEALTH
 * ============================================================
 */

app.get(
  '/api/health',
  (
    _req,
    res
  ) => {
    res.json({
      status:
        'healthy',

      firm:
        'A/R TAX SERVICES, LLC',

      location:
        'Columbia, South Carolina, USA',

      founder:
        'Desmond Hinds',

      tagline:
        'Preserving Wealth. Building Legacies.',

      serverTime:
        new Date()
          .toISOString(),

      aiConfigured:
        Boolean(
          process.env
            .OPENAI_API_KEY
        )
    });
  }
);

app.get(
  '/api/provider-readiness',
  (
    _req,
    res
  ) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      providers: ProviderReadinessRegistry.getAllProviderStatuses()
    });
  }
);

app.get(
  '/api/readiness',
  (
    _req,
    res
  ) => {
    res.setHeader('Cache-Control', 'no-store');
    const dbStatus = ProviderReadinessRegistry.getProviderStatus('DATABASE');
    const authStatus = ProviderReadinessRegistry.getProviderStatus('AUTHENTICATION');
    const isReady = process.env.NODE_ENV !== 'production' || (dbStatus.isOperational && authStatus.isOperational);

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'degraded',
      process: 'healthy',
      dependencies: {
        database: dbStatus.status,
        authentication: authStatus.status,
        ai: ProviderReadinessRegistry.getProviderStatus('AI').status
      },
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * ============================================================
 * API ROUTES
 * ============================================================
 */

app.use(
  '/api/auth',
  authRouter
);

app.use(
  '/api/onboarding',
  onboardingRouter
);

app.use(
  '/api/documents',
  documentsRouter
);

app.use(
  '/api/engagements',
  engagementsRouter
);

app.use(
  '/api/appointments',
  appointmentsRouter
);

app.use(
  '/api/payments',
  paymentsRouter
);

app.use(
  '/api/integrations',
  integrationsRouter
);

app.use(
  '/api/messages',
  messagesRouter
);

app.use(
  '/api/careers',
  careersRouter
);

app.use(
  '/api/legal',
  legalRouter
);

app.use(
  '/api/admin',
  adminRouter
);

app.use(
  '/api/security',
  securityRouter
);

app.use(
  '/api/assignments',
  assignmentsRouter
);

app.use(
  '/api/accountant',
  accountantRouter
);

app.use(
  '/api/calendar',
  calendarRouter
);

app.use(
  '/api/consultation-rooms',
  consultationRoomRouter
);

app.use(
  '/api/intake',
  intakeRouter
);

app.use(
  '/api/staging',
  stagingRouter
);

app.use(
  '/api/monitoring',
  monitoringRouter
);

app.use(
  '/api/taxguard',
  taxguardRouter
);

app.use(
  '/api/accounting-intake',
  accountingIntakeRouter
);

app.use(
  ['/api/profile', '/api/profile-amendment'],
  profileAmendmentRouter
);

app.use(
  '/api/practice-console',
  practiceConsoleRouter
);

app.use(
  ['/api/stage-two-three', '/api/stage-workflow'],
  stageTwoThreeRouter
);

/**
 * ============================================================
 * TAXGUARD LIVE WORKFLOW AUTHORITY
 * ============================================================
 *
 * This must remain mounted before the SPA fallback.
 *
 * Final endpoints:
 *
 * GET  /api/live-workflow/state
 * POST /api/live-workflow/complete-stage
 * GET  /api/live-workflow/eligibility
 */

app.use(
  '/api/live-workflow',
  liveWorkflowRouter
);

app.use(
  '/api/bookkeeping',
  bookkeepingRouter
);

/**
 * ============================================================
 * M16 — TAXGUARD AI INTELLIGENCE
 * ============================================================
 *
 * Server-side only.
 *
 * Server-side AI gateway credentials are read from the server environment.
 * They are never exposed to the Vite frontend.
 *
 * Final endpoints:
 *
 * GET  /api/taxguard-ai/health
 * POST /api/taxguard-ai/propose
 *
 * Governance:
 *
 * AI proposes.
 * Evidence supports.
 * Rules validate.
 * Calculations compute.
 * Governance controls.
 * Authorized humans approve material tax decisions.
 *
 * External tax submission remains disabled.
 */

app.use(
  '/api/taxguard-ai',
  taxguardAiRouter
);

/**
 * ============================================================
 * LEGACY TAXGUARD ROUTE
 * ============================================================
 *
 * Preserve existing compatibility/security behavior.
 */

app.use(
  [
    '/taxguard',
    '/taxguard/*'
  ],
  (
    req:
      AuthenticatedRequest,
    res,
    _next
  ) => {
    const authHeader =
      req.headers
        .authorization;

    const token =
      authHeader &&
      authHeader.startsWith(
        'Bearer '
      )
        ? authHeader.substring(
            7
          )
        : (
            req.headers[
              'x-session-token'
            ] as string
          );

    if (token) {
      const session =
        db.sessions.get(
          token
        );

      if (
        session &&
        Date.now() <=
          session.expiresAt
      ) {
        const user =
          db.users.get(
            session.userId
          );

        if (
          user &&
          user.status !==
            'disabled' &&
          user.status !==
            'suspended'
        ) {
          req.user =
            user;

          req.token =
            token;
        }
      }
    }

    handleLegacyTaxGuardRoute(
      req,
      res
    );
  }
);

/**
 * ============================================================
 * PUBLIC STATIC ASSETS
 * ============================================================
 */

app.use(
  express.static(
    path.join(
      process.cwd(),
      'public'
    ),
    {
      setHeaders: (
        res,
        filePath
      ) => {
        if (
          filePath.match(
            /\.(png|jpg|jpeg|webp|gif|svg)$/i
          )
        ) {
          res.setHeader(
            'Cache-Control',
            'no-cache, must-revalidate'
          );
        }
      }
    }
  )
);

/**
 * ============================================================
 * SERVER STARTUP
 * ============================================================
 */

async function startServer() {
  await ensureCanonicalTenantBootstrap().catch(err => console.warn('[Tenant Bootstrap] Warning:', err?.message || err));
  app.use('/api/case-authority', caseAuthorityRouter);
  /**
   * Development:
   * Vite runs as Express middleware.
   */

  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    const vite =
      await createViteServer({
        server: {
          middlewareMode:
            true
        },

        appType:
          'spa'
      });

    app.use(
      vite.middlewares
    );
  } else {
    /**
     * Production:
     * serve the compiled Vite frontend.
     */

    const distPath =
      path.join(
        process.cwd(),
        'dist'
      );

    /**
     * Redirect legacy /ar-tax-portal URLs.
     */

    app.use(
      (
        req,
        res,
        next
      ) => {
        if (
          req.path ===
            '/ar-tax-portal' ||
          req.path ===
            '/ar-tax-portal/'
        ) {
          return res.redirect(
            301,
            '/'
          );
        }

        if (
          req.path.startsWith(
            '/ar-tax-portal/'
          )
        ) {
          const cleanPath =
            req.path.replace(
              /^\/ar-tax-portal/,
              ''
            );

          return res.redirect(
            301,
            cleanPath || '/'
          );
        }

        next();
      }
    );

    /**
     * Serve compiled production assets.
     */

    app.use(
      protectServerBuildArtifacts,
      express.static(
        distPath
      )
    );

    /**
     * SPA fallback.
     *
     * Registered API routes are above this fallback.
     */

    app.get(
      '*',
      (
        _req,
        res
      ) => {
        res.sendFile(
          path.join(
            distPath,
            'index.html'
          )
        );
      }
    );
  }

  /**
   * Render provides PORT dynamically.
   *
   * Local development defaults to port 3000.
   */

  const server = app.listen(
    PORT,
    '0.0.0.0',
    () => {
      console.log(
        `[A/R Tax Services] Server successfully initialized on port ${PORT}`
      );

      console.log(
        `[TaxGuard AI] OpenAI configured: ${
          Boolean(
            process.env
              .OPENAI_API_KEY
          )
            ? 'YES'
            : 'NO'
        }`
      );

      console.log(
        `[TaxGuard Engine] Supabase configured: ${
          Boolean(
            process.env
              .SUPABASE_URL
          )
            ? 'YES'
            : 'NO'
        }`
      );
    }
  );

  const gracefulShutdown = (signal: string) => {
    console.log(`[TaxGuard Server] Received ${signal}. Initiating graceful shutdown...`);
    server.close(() => {
      console.log('[TaxGuard Server] HTTP server closed gracefully.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[TaxGuard Server] Forceful shutdown timeout exceeded.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * ============================================================
 * FATAL STARTUP PROTECTION
 * ============================================================
 */

startServer()
  .catch(
    error => {
      console.error(
        'Fatal server startup error:',
        error
      );

      process.exit(
        1
      );
    }
  );
