/**
 * Secure document vault API (/api/vault). Development-only until proposal 027 is reviewed and
 * applied: answers only with injected dependencies (tests) or TAXGUARD_PRACTICE_STORE=durable
 * against a non-production project; not mounted in createProductionApp. No malware scanner is
 * commissioned by default, so uploaded documents stay quarantined and undownloadable.
 */
import express, { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { DocumentVaultError, DocumentVaultStore } from '../taxguard/documents/documentVaultStore';
import { DocumentRequestStore } from '../taxguard/documents/documentRequestStore';
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, SupabaseVaultStorage } from '../taxguard/documents/vaultIntegrations';
import { practiceStoreConfigured } from './practice.routes';

export function createVaultRouter(deps: { store?: () => DocumentVaultStore; requests?: () => DocumentRequestStore; authenticate?: RequestHandler } = {}) {
  const router = Router();
  let cached: DocumentVaultStore | null = null; let cachedRequests: DocumentRequestStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new DocumentVaultStore(getSupabaseAdmin() as any, new SupabaseVaultStorage(getSupabaseAdmin())));
  const requests = () => deps.requests?.() ?? (cachedRequests ??= new DocumentRequestStore(getSupabaseAdmin() as any));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'DOCUMENT_VAULT_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || user.role === 'recruiter') return res.status(403).json({ code: 'DOCUMENT_ACCESS_DENIED' });
    next();
  });
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler => async (req, res: Response) => {
    try { return res.status(status).json(await handler(req as AuthenticatedRequest)); }
    catch (error) {
      if (error instanceof DocumentVaultError) return res.status(error.status).json({ code: error.code });
      return res.status(503).json({ code: 'DOCUMENT_STORE_UNAVAILABLE' });
    }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!, u = (req: AuthenticatedRequest) => req.user!.id;
  const str = (v: unknown, max = 200) => typeof v === 'string' && v.length <= max ? v : undefined;
  const int = (v: unknown) => typeof v === 'string' && /^\d{1,6}$/.test(v) ? Number(v) : typeof v === 'number' ? v : NaN;
  // Clients may only address their own client ID; the database re-checks every actor.
  const client = (req: AuthenticatedRequest) => {
    const id = req.params.clientId;
    if (['client', 'prospective_client'].includes(req.user!.role) && req.user!.clientId !== id) throw new DocumentVaultError('DOCUMENT_NOT_FOUND', 404);
    return id;
  };

  router.get('/review-queue', run(async req => {
    if (['client', 'prospective_client'].includes(req.user!.role)) throw new DocumentVaultError('DOCUMENT_REVIEW_REQUIRES_STAFF', 403);
    return { items: await store().reviewQueue(t(req), u(req)) };
  }));
  router.get('/clients/:clientId/upload-targets', run(async req => ({ items: await store().uploadTargets(t(req), client(req), u(req)) })));
  router.get('/clients/:clientId/documents', run(async req => ({ items: await store().list(t(req), client(req), u(req), req.query.taxYear ? int(req.query.taxYear) : undefined) })));
  router.post('/clients/:clientId/documents', express.raw({ type: [...ALLOWED_DOCUMENT_TYPES], limit: MAX_DOCUMENT_BYTES }), run(async req => {
    if (!Buffer.isBuffer(req.body)) throw new DocumentVaultError('DOCUMENT_TYPE_NOT_ALLOWED', 415);
    return store().upload(t(req), client(req), u(req), { engagementId: str(req.query.engagementId, 128) ?? '', taxYear: int(req.query.taxYear), caseId: str(req.query.caseId, 128),
      category: str(req.query.category, 32) ?? '', fileName: str(req.query.fileName) ?? '', mimeType: String(req.headers['content-type'] || '').split(';')[0].trim(),
      documentId: str(req.query.documentId, 64), idempotencyKey: req.get('idempotency-key') || '' }, req.body);
  }, 201));
  router.get('/clients/:clientId/documents/:documentId', run(async req => store().detail(t(req), client(req), u(req), req.params.documentId)));
  router.post('/clients/:clientId/documents/:documentId/versions/:version/review', express.json(), run(async req => store().review(t(req), client(req), u(req),
    req.params.documentId, int(req.params.version), req.body?.decision, int(req.body?.rowVersion), str(req.body?.note, 500))));
  router.post('/clients/:clientId/documents/:documentId/versions/:version/download', run(async req => store().downloadUrl(t(req), client(req), u(req), req.params.documentId, int(req.params.version))));
  router.post('/clients/:clientId/extractions/:fieldId/verify', express.json(), run(async req => store().verifyExtraction(t(req), client(req), u(req), req.params.fieldId,
    req.body?.decision, req.body?.value)));
  // Document requests and checklists (proposal 031).
  const staffOnly = (req: AuthenticatedRequest) => { if (['client', 'prospective_client'].includes(req.user!.role)) throw new DocumentVaultError('DOC_REQUEST_STAFF_REQUIRED', 403); };
  const bool = (v: unknown) => v === true || v === 'true';
  router.get('/requests/missing', run(async req => { staffOnly(req);
    return requests().missing(t(req), u(req), { taxYear: req.query.taxYear ? int(req.query.taxYear) : undefined, overdueOnly: bool(req.query.overdueOnly) }); }));
  router.get('/requests/review-queue', run(async req => { staffOnly(req); return { items: await requests().reviewQueue(t(req), u(req)) }; }));
  router.get('/request-templates', run(async req => { staffOnly(req); return { items: await requests().templates(t(req), u(req)) }; }));
  router.post('/request-templates', express.json(), run(async req => { staffOnly(req);
    return requests().saveTemplate(t(req), u(req), { templateId: req.body?.templateId, name: req.body?.name, items: req.body?.items, status: str(req.body?.status, 16) }); }));
  router.get('/clients/:clientId/requests', run(async req => ({ items: await requests().list(t(req), client(req), u(req),
    { engagementId: str(req.query.engagementId, 128), taxYear: req.query.taxYear ? int(req.query.taxYear) : undefined }) })));
  router.post('/clients/:clientId/requests', express.json(), run(async req => { staffOnly(req);
    const b = req.body || {};
    return requests().create(t(req), client(req), u(req), req.get('idempotency-key'), { engagementId: b.engagementId, taxYear: int(b.taxYear), title: b.title, category: b.category,
      instructions: str(b.instructions, 2000), required: b.required !== false, dueDate: str(b.dueDate, 10), acceptedTypes: Array.isArray(b.acceptedTypes) ? b.acceptedTypes : undefined,
      minDocuments: typeof b.minDocuments === 'number' ? b.minDocuments : undefined }); }, 201));
  router.post('/clients/:clientId/requests/apply-template', express.json(), run(async req => { staffOnly(req);
    return requests().applyTemplate(t(req), client(req), u(req), req.body?.templateId, req.body?.engagementId, int(req.body?.taxYear), str(req.body?.dueDate, 10)); }));
  router.post('/clients/:clientId/requests/:requestId/link', express.json(), run(async req => requests().link(t(req), client(req), u(req), req.params.requestId,
    String(req.body?.documentId ?? ''), int(req.body?.version))));
  router.post('/clients/:clientId/requests/:requestId/:action(waive|cancel)', express.json(), run(async req => { staffOnly(req);
    return requests().resolve(t(req), client(req), u(req), req.params.requestId, req.params.action as 'waive' | 'cancel', str(req.body?.reason, 1000) ?? '', int(req.body?.rowVersion)); }));
  router.post('/clients/:clientId/requests/:requestId/remind', run(async req => { staffOnly(req); return requests().remind(t(req), client(req), u(req), req.params.requestId); }));
  router.get('/clients/:clientId/notifications', run(async req => requests().notifications(t(req), client(req), u(req), bool(req.query.unreadOnly))));
  router.post('/clients/:clientId/notifications/:notificationId/read', run(async req => requests().markRead(t(req), client(req), u(req), req.params.notificationId)));
  // Oversized or unsupported bodies are refused by express.raw before the handler runs.
  router.use(((err: any, _req: any, res: Response, next: any) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ code: 'DOCUMENT_TOO_LARGE' });
    return next(err);
  }) as express.ErrorRequestHandler);
  return router;
}
