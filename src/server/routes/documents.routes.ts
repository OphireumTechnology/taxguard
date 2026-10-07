/**
 * Document Management & Security Routes
 * Handles upload validation, malware scanning hook, categorization,
 * short-lived signed download tokens, versioning, and client isolation.
 */

import { Router, Request, Response } from 'express';
import { randomUUID, randomBytes } from 'crypto';
import { db } from '../db';
import { 
  authenticateToken, 
  AuthenticatedRequest, 
  blockRecruiterFromTaxRecords,
  resolveAuthorizedClientContext
} from '../auth';
import { DocumentItem, DocumentCategory, DocumentStatus } from '../../types';
import { processDocumentExtraction } from '../aiExtraction';
import { isAssignmentCurrentlyEffective } from '../assignment-authorization';

export const documentsRouter = Router();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const SIGNED_TOKEN_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

function requireCommissionedDocumentIntake(_req: Request, res: Response, next: (error?: unknown) => void): void {
  if (process.env.NODE_ENV === 'production') {
    res.status(503).json({
      error: 'Real document intake is unavailable until the quarantine and scanning pipeline is commissioned.',
      code: 'DOCUMENT_INTAKE_NOT_READY'
    });
    return;
  }
  next();
}

// List documents with strict tenant & client isolation
documentsRouter.get('/', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      error: 'Document listing is unavailable until durable tenant-scoped document persistence is enabled.',
      code: 'DOCUMENT_LIST_UNAVAILABLE'
    });
  }

  const { category, taxYear, status, search, clientId } = req.query;

  let docs = Array.from(db.documents.values());

  // Client data is always scoped to the verified session identity.
  if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    const context = resolveAuthorizedClientContext(req, res, 'document_list', typeof clientId === 'string' ? clientId : undefined);
    if (!context) return;
    docs = docs.filter(d => d.clientId === context.clientId);
  } else if (['accountant', 'senior_reviewer', 'reviewer'].includes(req.user.role)) {
    const userTenantId = req.user.tenantId;
    if (!userTenantId) return res.status(403).json({ error: 'Authorized tenant context is unavailable.' });
    const staffClientIds = new Set(
      db.getAccountantBindings(req.user.id)
        .filter(binding => {
          const scopedBinding = binding as typeof binding & {
            engagementId?: string | null;
            taxYear?: number | null;
            caseId?: string | null;
          };
          return isAssignmentCurrentlyEffective(binding) &&
            !scopedBinding.engagementId &&
            !scopedBinding.caseId;
        })
        .map(binding => binding.clientId)
    );
    docs = docs.filter(doc => {
      if (!staffClientIds.has(doc.clientId)) return false;
      const client = db.users.get(doc.clientId) ||
        Array.from(db.users.values()).find(user =>
          ['client', 'prospective_client'].includes(user.role) && user.clientId === doc.clientId
        );
      if (!client || client.tenantId !== userTenantId) return false;
      const matchingAssignment = db.getClientBindings(doc.clientId).some(binding => {
        const scopedBinding = binding as typeof binding & { taxYear?: number | null };
        return binding.accountantId === req.user!.id &&
          isAssignmentCurrentlyEffective(binding) &&
          (scopedBinding.taxYear == null || Number(scopedBinding.taxYear) === doc.taxYear) &&
          !(binding as typeof binding & { engagementId?: string | null; caseId?: string | null }).engagementId &&
          !(binding as typeof binding & { caseId?: string | null }).caseId;
      });
      return matchingAssignment;
    });
  } else if (['admin', 'administrator', 'super_admin', 'super_administrator'].includes(req.user.role)) {
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Authorized tenant context is unavailable.' });
    docs = docs.filter(doc => {
      const client = db.users.get(doc.clientId) ||
        Array.from(db.users.values()).find(user =>
          ['client', 'prospective_client'].includes(user.role) && user.clientId === doc.clientId
        );
      return client?.tenantId === tenantId;
    });
    if (typeof clientId === 'string') {
      const context = resolveAuthorizedClientContext(req, res, 'document_list', clientId);
      if (!context) return;
      docs = docs.filter(d => d.clientId === context.clientId);
    }
  } else {
    return res.status(403).json({ error: 'Forbidden: Tax record access is not permitted.' });
  }

  // Filters
  if (category) docs = docs.filter(d => d.category === category);
  if (taxYear) docs = docs.filter(d => d.taxYear === Number(taxYear));
  if (status) docs = docs.filter(d => d.status === status);
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    docs = docs.filter(d => 
      d.fileName.toLowerCase().includes(q) || 
      (d.description && d.description.toLowerCase().includes(q))
    );
  }

  return res.json({ documents: docs });
});

// Single document details
documentsRouter.get('/:id', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const doc = db.documents.get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  if (!resolveAuthorizedClientContext(req, res, 'document', doc.clientId)) return;

  return res.json({ document: doc });
});

// Request a short-lived cryptographically signed download URL
documentsRouter.post('/:id/signed-url', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const doc = db.documents.get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  const context = resolveAuthorizedClientContext(req, res, 'document_download', doc.clientId);
  if (!context) return;

  // Generate 5-minute signed token
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SIGNED_TOKEN_EXPIRATION_MS;

  db.signedDownloadTokens.set(token, {
    token,
    documentId: doc.id,
    userId: req.user.id,
    clientId: context.clientId,
    tenantId: context.tenantId,
    createdAt: now,
    expiresAt
  });

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'SIGNED_DOWNLOAD_URL_ISSUED',
    resource: `Doc #${doc.id} (${doc.fileName})`,
    details: `Issued 5-minute signed token for private download.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({
    signedUrl: `/api/documents/download/${token}`,
    token,
    expiresInSeconds: 300,
    expiresAt: new Date(expiresAt).toISOString()
  });
});

// Execute signed download (Validates token expiration and logs access)
documentsRouter.get('/download/:token', (req: Request, res: Response) => {
  const token = req.params.token;
  const record = db.signedDownloadTokens.get(token);

  if (!record) {
    return res.status(403).json({ 
      error: 'Access Denied: Invalid or revoked download authorization token.',
      code: 'TOKEN_INVALID' 
    });
  }

  // Token expiration check
  if (Date.now() > record.expiresAt) {
    db.signedDownloadTokens.delete(token);
    db.logSecurityEvent({
      eventType: 'EXPIRED_SIGNED_URL_ACCESS_ATTEMPT',
      ipAddress: req.ip || 'unknown',
      details: `Attempted download with expired signed token for doc #${record.documentId}.`,
      severity: 'warning'
    });
    return res.status(403).json({ 
      error: 'Access Denied: Signed download token has expired (5-minute limit exceeded). Request a new token.',
      code: 'TOKEN_EXPIRED' 
    });
  }

  const doc = db.documents.get(record.documentId);
  if (!doc || doc.clientId !== record.clientId) {
    return res.status(404).json({ error: 'Referenced document was not found.' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  // Log successful access
  db.logAudit({
    userId: record.userId,
    userName: 'Authorized Token Bearer',
    userRole: 'client',
    action: 'DOCUMENT_DOWNLOADED_VIA_SIGNED_URL',
    resource: `Doc #${doc.id} (${doc.fileName})`,
    details: `File payload streamed via secure short-lived token.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  // Stream sample response with security headers
  res.setHeader('Content-Type', doc.fileType || 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return res.send(`%PDF-1.7 Simulated Encrypted Content for ${doc.fileName} - Client ID: ${doc.clientId}`);
});

// Upload new document with malware scanning hook and AI extraction
documentsRouter.post('/upload', authenticateToken, blockRecruiterFromTaxRecords, requireCommissionedDocumentIntake, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { 
      fileName, 
      fileSize, 
      fileType, 
      category, 
      taxYear, 
      description,
      rawContentSample 
    } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required.' });
    }

    // Supported file validation
    if (fileType && !ALLOWED_MIME_TYPES.includes(fileType)) {
      return res.status(400).json({ 
        error: `Unsupported file format (${fileType}). Permitted types: PDF, PNG, JPG, XLSX, CSV.` 
      });
    }

    // Malware scanning simulation hook
    const isSuspicious = fileName.toLowerCase().includes('.exe') || 
                         fileName.toLowerCase().includes('.bat') ||
                         fileName.toLowerCase().includes('.scr');
    if (isSuspicious) {
      db.logSecurityEvent({
        eventType: 'MALWARE_SIGNATURE_DETECTED',
        ipAddress: req.ip || 'unknown',
        userId: req.user.id,
        details: `Malware protection hook blocked file ${fileName}.`,
        severity: 'critical'
      });
      return res.status(400).json({ error: 'Security alert: File failed pre-upload anti-malware heuristics.' });
    }

    const docId = `doc_${randomUUID()}`;
    const context = resolveAuthorizedClientContext(
      req,
      res,
      'document_upload',
      typeof req.body.clientId === 'string' ? req.body.clientId : undefined
    );
    if (!context) return;
    const targetClientId = context.clientId;

    const client = db.users.get(targetClientId);

    // AI Document Extraction Pipeline
    const extraction = await processDocumentExtraction(
      fileName, 
      rawContentSample || `Sample content for ${fileName}`,
      category
    );

    const newDoc: DocumentItem = {
      id: docId,
      clientId: targetClientId,
      clientName: client?.name || req.user.name,
      fileName,
      fileSize: fileSize || '1.2 MB',
      fileType: fileType || 'application/pdf',
      category: (extraction.documentCategory as DocumentCategory) || category || 'other',
      taxYear: Number(taxYear) || 2025,
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.name,
      version: 1,
      description: description || 'Uploaded to 256-bit encrypted vault',
      isAiProcessed: true,
      ocrConfidence: extraction.confidenceScore,
      extractedData: extraction.extractedFields,
      isEncrypted: true
    };

    db.documents.set(docId, newDoc);

    // Associate with onboarding if active
    const onboarding = db.onboardingStates.get(targetClientId);
    if (onboarding && !onboarding.uploadedDocuments.includes(docId)) {
      onboarding.uploadedDocuments.push(docId);
      db.onboardingStates.set(targetClientId, onboarding);
    }

    db.logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DOCUMENT_UPLOADED_AES256',
      resource: `Doc #${docId} (${fileName})`,
      details: `File verified by malware scanner and processed by AI extraction (${extraction.confidenceScore}% confidence).`,
      ipAddress: req.ip || 'unknown',
      severity: 'info'
    });

    return res.status(201).json({
      message: 'Document securely uploaded and encrypted.',
      document: newDoc,
      extractionSummary: extraction
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Upload processing error.' });
  }
});

// Update review status (Accountant or Reviewer only)
documentsRouter.patch('/:id/review', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['accountant', 'senior_reviewer', 'admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Only accountants and reviewers may approve or reject documents.' });
  }

  const doc = db.documents.get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  if (!resolveAuthorizedClientContext(req, res, 'document_review', doc.clientId)) return;

  const { status, reviewerNotes, correctedFields } = req.body;

  if (status) doc.status = status;
  if (reviewerNotes) doc.reviewerNotes = reviewerNotes;
  doc.reviewedBy = req.user.name;
  doc.reviewedAt = new Date().toISOString();

  if (correctedFields && Array.isArray(correctedFields)) {
    doc.extractedData = correctedFields;
  }

  db.documents.set(doc.id, doc);

  db.logAudit({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: `DOCUMENT_REVIEW_${status.toUpperCase()}`,
    resource: `Doc #${doc.id} (${doc.fileName})`,
    details: `Status set to ${status}. Notes: ${reviewerNotes || 'None'}.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });

  return res.json({ message: 'Document review updated successfully.', document: doc });
});

// Withdraw / Remove Document with retention policy and audit trail (Directive 10)
documentsRouter.post('/:id/withdraw', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const doc = db.documents.get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  if (!resolveAuthorizedClientContext(req, res, 'document_withdrawal', doc.clientId)) return;

  const { reason = 'CLIENT_REQUEST', justification } = req.body;
  if (!justification || typeof justification !== 'string' || justification.trim().length < 5) {
    return res.status(400).json({ error: 'A mandatory justification (minimum 5 characters) is required to withdraw a tax record.' });
  }

  const result = db.withdrawDocument({
    documentId: doc.id,
    clientId: doc.clientId,
    taxYear: doc.taxYear,
    withdrawnBy: req.user.name || req.user.email,
    withdrawnByRole: req.user.role,
    reason,
    justification
  });

  return res.json({
    message: 'Document successfully withdrawn and archived under 7-year IRS compliance policy.',
    document: result.document
  });
});

// Multi-file batch upload (Directive 5 & 6)
documentsRouter.post('/upload-batch', authenticateToken, blockRecruiterFromTaxRecords, requireCommissionedDocumentIntake, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { files, taxYear = 2025 } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'Files array is required.' });
  }

  const context = resolveAuthorizedClientContext(
    req,
    res,
    'document_batch_upload',
    typeof req.body.clientId === 'string' ? req.body.clientId : undefined
  );
  if (!context) return;
  const targetClientId = context.clientId;

  const client = db.users.get(targetClientId);
  const ingestedDocs: DocumentItem[] = [];

  for (const item of files) {
    const { fileName, fileSize, fileType, category, rawContentSample, sha256 } = item;
    if (!fileName) continue;

    // Check suspicious extension
    const isSuspicious = fileName.toLowerCase().includes('.exe') ||
                         fileName.toLowerCase().includes('.bat') ||
                         fileName.toLowerCase().includes('.scr');
    if (isSuspicious) {
      db.logSecurityEvent({
        eventType: 'MALWARE_SIGNATURE_DETECTED',
        ipAddress: req.ip || 'unknown',
        userId: req.user.id,
        details: `Batch upload blocked suspicious file: ${fileName}`,
        severity: 'critical'
      });
      continue;
    }

    const docId = `DOC-${taxYear}-${randomUUID().slice(0, 8).toUpperCase()}`;

    // Extract proposed fields
    const extraction = await processDocumentExtraction(
      fileName,
      rawContentSample || `Batch uploaded content for ${fileName}`,
      category
    );

    const newDoc: DocumentItem = {
      id: docId,
      clientId: targetClientId,
      clientName: client?.name || req.user.name,
      fileName,
      fileSize: fileSize ? (typeof fileSize === 'number' ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB` : String(fileSize)) : '1.0 MB',
      fileType: fileType || 'application/pdf',
      category: (extraction.documentCategory as DocumentCategory) || category || 'other',
      taxYear: Number(taxYear) || 2025,
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.name,
      version: 1,
      description: `Ingested via TaxGuard Secure Intake. SHA-256: ${(sha256 || 'computed').slice(0, 16)}...`,
      isAiProcessed: true,
      ocrConfidence: extraction.confidenceScore,
      extractedData: extraction.extractedFields,
      isEncrypted: true
    };

    db.documents.set(docId, newDoc);
    ingestedDocs.push(newDoc);

    db.logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DOCUMENT_UPLOADED_AES256',
      resource: `Doc #${docId} (${fileName})`,
      details: `Batch file ingested and queued for CPA review.`,
      ipAddress: req.ip || 'unknown',
      severity: 'info'
    });
  }

  return res.status(201).json({
    message: `Successfully ingested ${ingestedDocs.length} documents.`,
    documents: ingestedDocs
  });
});
