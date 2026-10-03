import express from 'express';
import { authRouter } from './routes/auth.routes';
import { caseAuthorityRouter } from './routes/case-authority.routes';
import { profileAmendmentRouter } from './routes/profile-amendment.routes';
import { stageTwoThreeRouter } from './routes/stage-two-three.routes';
import { bookkeepingRouter } from './routes/bookkeeping.routes';
import { practiceOperationsRouter } from './routes/practice-operations.routes';
import { ProviderReadinessRegistry } from './taxguard/providerReadiness.service';
import {
  protectServerBuildArtifacts,
  resolveProductionDistPath,
  resolvePublicAssetsPath,
  createSpaFallbackHandler,
} from './staticAssetPolicy';

/** Shared Node/Cloud Functions boundary. Only durable APIs are released; clean frontend routes serve the SPA. */
export function createProductionApp(options?: { distPath?: string; publicPath?: string }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // 1. Global / Security Middleware
  app.use((req, _res, next) => {
    if (req.url.startsWith('/taxguardApi/')) {
      req.url = req.url.slice('/taxguardApi'.length);
    } else if (req.url === '/taxguardApi') {
      req.url = '/';
    }
    next();
  });

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.vary('Origin');
    const origin = req.headers.origin;
    if (origin && !['https://artaxserv.com', 'https://www.artaxserv.com'].includes(origin)) {
      return res.status(403).json({ code: 'ORIGIN_DENIED' });
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(protectServerBuildArtifacts);

  // 2. API Middleware and API Routes
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Fail closed if the managed runtime is accidentally configured as development.
    if (process.env.NODE_ENV !== 'production') {
      return res.status(503).json({ code: 'PRODUCTION_RUNTIME_REQUIRED' });
    }
    next();
  });

  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) =>
    res.json({ status: 'available', provider: 'supabase', documentIntakeEnabled: false })
  );

  app.get('/api/provider-readiness', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ providers: ProviderReadinessRegistry.getAllProviderStatuses() });
  });

  app.get('/api/readiness', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const dbStatus = ProviderReadinessRegistry.getProviderStatus('DATABASE');
    const authStatus = ProviderReadinessRegistry.getProviderStatus('AUTHENTICATION');
    const schemaResult = await ProviderReadinessRegistry.checkDatabaseSchemaReadiness().catch(() => ({
      state: 'DATABASE_UNAVAILABLE' as const,
      verifiedTablesCount: 0,
      totalRequiredTables: 6,
      description: 'Schema verification check failed.',
      checkedAt: new Date().toISOString(),
    }));
    const isReady = dbStatus.isOperational && authStatus.isOperational && schemaResult.state === 'DATABASE_READY';
    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'degraded',
      process: 'healthy',
      dependencies: {
        database: dbStatus.status,
        schema: schemaResult.state,
        authentication: authStatus.status,
        ai: ProviderReadinessRegistry.getProviderStatus('AI').status,
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/case-authority', caseAuthorityRouter);
  app.use(['/api/profile', '/api/profile-amendment'], profileAmendmentRouter);
  app.use(['/api/stage-two-three', '/api/stage-workflow'], stageTwoThreeRouter);
  app.use('/api/bookkeeping', bookkeepingRouter);
  app.use('/api/operations', practiceOperationsRouter);

  // API production boundary: never allow unknown /api or /webhooks routes to reach SPA fallback
  app.use('/api', (_req, res) =>
    res.status(503).json({
      code: 'API_NOT_RELEASED',
      error: 'This service is not available for production use yet.',
    })
  );

  app.use(['/webhooks', '/webhooks/*'], (_req, res) =>
    res.status(404).json({
      code: 'WEBHOOK_NOT_FOUND',
      error: 'The requested webhook endpoint is not configured.',
    })
  );

  // 3. Production Static Assets
  const publicDir = resolvePublicAssetsPath(options?.publicPath);
  const distDir = resolveProductionDistPath(options?.distPath);

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

  app.use(
    protectServerBuildArtifacts,
    express.static(publicDir, {
      setHeaders: (res, filePath) => {
        if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
      },
    })
  );

  app.use(protectServerBuildArtifacts, express.static(distDir));

  // 4. Frontend SPA Fallback
  app.get('*', createSpaFallbackHandler(distDir));

  // 5. Appropriate Error Handling
  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND' }));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error?.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ code: 'REQUEST_FAILED' });
  });

  return app;
}

