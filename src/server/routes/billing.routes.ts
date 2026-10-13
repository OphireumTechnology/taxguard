/**
 * Billing API (/api/billing). Development-only until proposal 028 is reviewed and applied:
 * answers only with an injected store or TAXGUARD_PRACTICE_STORE=durable against a
 * non-production project; not mounted in createProductionApp. Card payments use the sandbox
 * provider only (never in production); no real payment is processed.
 */
import express, { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { BillingError, BillingStore, SandboxPaymentProvider } from '../taxguard/billing/billingStore';
import { clientBillingView } from '../taxguard/billing/clientBillingView';
import { practiceStoreConfigured } from './practice.routes';

export function createBillingRouter(deps: { store?: () => BillingStore; authenticate?: RequestHandler } = {}) {
  const router = Router();
  router.use(express.json({ limit: '64kb' }));
  let cached: BillingStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new BillingStore(getSupabaseAdmin() as any, new SandboxPaymentProvider()));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'BILLING_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || user.role === 'recruiter') return res.status(403).json({ code: 'BILLING_ACCESS_DENIED' });
    next();
  });
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler => async (req, res: Response) => {
    try {
      const value = await handler(req as AuthenticatedRequest);
      // Clients receive the allow-listed client projection only (no staff-only financial details).
      return res.status(status).json(['client', 'prospective_client'].includes((req as AuthenticatedRequest).user!.role) ? clientBillingView(value) : value);
    }
    catch (error) {
      if (error instanceof BillingError) return res.status(error.status).json({ code: error.code });
      return res.status(503).json({ code: 'BILLING_STORE_UNAVAILABLE' });
    }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!, u = (req: AuthenticatedRequest) => req.user!.id;
  const isClient = (req: AuthenticatedRequest) => ['client', 'prospective_client'].includes(req.user!.role);
  const client = (req: AuthenticatedRequest) => {
    if (isClient(req) && req.user!.clientId !== req.params.clientId) throw new BillingError('INVOICE_NOT_FOUND', 404);
    return req.params.clientId;
  };
  const staffOnly = (req: AuthenticatedRequest) => { if (isClient(req)) throw new BillingError('BILLING_STAFF_REQUIRED', 403); };
  const int = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,9}$/.test(v) ? Number(v) : NaN;
  const idem = (req: AuthenticatedRequest) => req.get('idempotency-key');

  router.get('/catalog', run(async req => { staffOnly(req); return { items: await store().catalog(t(req), u(req)) }; }));
  router.post('/catalog', run(async req => store().upsertService(t(req), u(req), req.body ?? {})));
  router.get('/ar-aging', run(async req => { staffOnly(req); return store().arAging(t(req), u(req), typeof req.query.asOf === 'string' ? req.query.asOf : undefined); }));
  router.get('/clients/:clientId/invoices', run(async req => ({ items: await store().list(t(req), client(req), u(req)) })));
  router.post('/clients/:clientId/invoices', run(async req => store().createInvoice(t(req), client(req), u(req), idem(req), req.body ?? {}), 201));
  router.post('/clients/:clientId/invoices/:invoiceId/lines', run(async req => store().addLine(t(req), client(req), u(req), req.params.invoiceId, req.body ?? {})));
  router.post('/clients/:clientId/invoices/:invoiceId/lines/:lineNo/remove', run(async req => store().removeLine(t(req), client(req), u(req), req.params.invoiceId, int(req.params.lineNo))));
  router.post('/clients/:clientId/invoices/:invoiceId/:action(submit|approve|return|void)', run(async req => store().transition(t(req), client(req), u(req), req.params.invoiceId,
    req.params.action, int(req.body?.rowVersion), typeof req.body?.note === 'string' ? req.body.note : undefined)));
  router.post('/clients/:clientId/invoices/:invoiceId/payments', run(async req => store().recordManualPayment(t(req), client(req), u(req), req.params.invoiceId,
    { amount: req.body?.amount, method: req.body?.method, idempotencyKey: idem(req) }), 201));
  router.post('/clients/:clientId/invoices/:invoiceId/pay-sandbox', run(async req => store().paySandbox(t(req), client(req), u(req), req.params.invoiceId,
    { amount: req.body?.amount, idempotencyKey: idem(req), testCard: String(req.body?.testCard ?? '') }), 201));
  router.post('/clients/:clientId/payments/:paymentId/refund', run(async req => store().refund(t(req), client(req), u(req), req.params.paymentId, req.body?.amount, req.body?.reason)));
  router.post('/clients/:clientId/invoices/:invoiceId/credits', run(async req => store().requestCredit(t(req), client(req), u(req), req.params.invoiceId, req.body?.amount, req.body?.reason), 201));
  router.post('/clients/:clientId/credits/:creditId/:decision(apply|reject)', run(async req => store().decideCredit(t(req), client(req), u(req), req.params.creditId, req.params.decision === 'apply')));
  return router;
}
