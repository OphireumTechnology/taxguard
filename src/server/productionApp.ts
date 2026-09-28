import express from 'express';
import { authRouter } from './routes/auth.routes';
import { caseAuthorityRouter } from './routes/case-authority.routes';
import { ProviderReadinessRegistry } from './taxguard/providerReadiness.service';

/** Shared Node/Cloud Functions boundary. Only durable APIs are released. */
export function createProductionApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.vary('Origin');
    const origin = req.headers.origin;
    if (origin && !['https://artaxserv.com', 'https://www.artaxserv.com'].includes(origin)) {
      return res.status(403).json({ code: 'ORIGIN_DENIED' });
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    // Fail closed if the managed runtime is accidentally configured as development.
    if (process.env.NODE_ENV !== 'production') return res.status(503).json({ code: 'PRODUCTION_RUNTIME_REQUIRED' });
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'available', documentIntakeEnabled: false }));
  app.get('/api/provider-readiness', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ providers: ProviderReadinessRegistry.getAllProviderStatuses() });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/case-authority', caseAuthorityRouter);
  app.use('/api', (_req, res) => res.status(503).json({ code: 'API_NOT_RELEASED', error: 'This service is not available for production use yet.' }));
  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND' }));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error?.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ code: 'REQUEST_FAILED' });
  });
  return app;
}
