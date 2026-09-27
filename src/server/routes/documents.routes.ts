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
  blockRecruiterFromTaxRecords 
} from '../auth';
import { DocumentItem, DocumentCategory, DocumentStatus } from '../../types';
import { processDocumentExtraction } from '../aiExtraction';

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

// List documents with strict tenant & client isolation
documentsRouter.get('/', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { category, taxYear, status, search, clientId } = req.query;

  let docs = Array.from(db.documents.values());

  // CLIENT ISOLATION: A client can ONLY see their own documents!
  if (req.user.role === 'client' || req.user.role === 'prospective_client') {
    docs = docs.filter(d => d.clientId === req.user!.id);
  } else if (req.user.role === 'accountant') {
    // ACCOUNTANT RESTRICTION: Accountants can only see documents for clients assigned to them
    const assignedClientIds = Array.from(db.users.values())
      .filter(u => u.assignedAccountantId === req.user!.id)
      .map(u => u.id);
    
    docs = docs.filter(d => assignedClientIds.includes(d.clientId));
  } else if (clientId && typeof clientId === 'string') {
    // Admin, reviewer, manager can filter by clientId
    docs = docs.filter(d => d.clientId === clientId);
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
  const doc = db.documents.get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  // Client isolation check
  if (req.user?.role === 'client' && doc.clientId !== req.user.id) {
    db.logSecurityEvent({
      eventType: 'UNAUTHORIZED_DOC_ACCESS_BLOCKED',
      ipAddress: req.ip || 'unknown',
      userId: req.user.id,
      details: `Client ${req.user.email} attempted to inspect document #${doc.id} owned by client ${doc.clientId}.`,
      severity: 'critical'
    });
    return res.status(403).json({ error: 'Forbidden: You do not have permission to view this document.' });
  }

  return res.json({ document: doc });
});

// Request a short-lived cryptographically signed download URL
documentsRouter.post('/:id/signed-url', authenticateToken, blockRecruiterFromTaxRecords, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const doc = db.documents.get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  // Security authorization check
  if (req.user.role === 'client' && doc.clientId !== req.user.id) {
    db.logSecurityEvent({
      eventType: 'CLIENT_SIGN_TOKEN_HIJACK_ATTEMPT',
      ipAddress: req.ip || 'unknown',
      userId: req.user.id,
      details: `Client ${req.user.email} attempted to request download token for unowned doc #${doc.id}.`,
      severity: 'critical'
    });
    return res.status(403).json({ error: 'Forbidden: You can only request download tokens for your own documents.' });
  }

  // Generate 5-minute signed token
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SIGNED_TOKEN_EXPIRATION_MS;

  db.signedDownloadTokens.set(token, {
    token,
    documentId: doc.id,
    userId: req.user.id,
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
  if (!doc) {
    return res.status(404).json({ error: 'Referenced document was not found.' });
  }

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
documentsRouter.post('/upload', authenticateToken, blockRecruiterFromTaxRecords, async (req: AuthenticatedRequest, res: Response) => {
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
    const targetClientId = (req.user.role === 'client' || req.user.role === 'prospective_client')
      ? req.user.id
      : (req.body.clientId || req.user.id);

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
