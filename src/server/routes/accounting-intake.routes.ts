/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Accounting Document Intake & Extraction Routes
 *
 * Provides RESTful endpoints for:
 * - Local bulk files & folder ingestion
 * - Connector discovery (Google Drive, Email) & selective import
 * - Asynchronous, resumable batch job tracking
 * - Accounting review queue & human decision gate
 * - Strict client/tenant isolation & fail-closed security
 */

import { Router, Response } from 'express';
import crypto from 'node:crypto';
import {
  authenticateToken,
  AuthenticatedRequest,
  blockRecruiterFromTaxRecords
} from '../auth';
import { AccountingDocumentIntelligenceService } from '../taxguard/accountingDocumentIntelligence.service';
import { ConnectorRegistry } from '../taxguard/accountingConnectors';
import { IntakeSourceType } from '../../types/accountingIntake';

export const accountingIntakeRouter = Router();

// 1. List Connectors & Status
accountingIntakeRouter.get(
  '/connectors',
  authenticateToken,
  blockRecruiterFromTaxRecords,
  (_req: AuthenticatedRequest, res: Response) => {
    const connectors = ConnectorRegistry.getAllConnectors();
    return res.json({ connectors });
  }
);

// 2. Discover Candidates from Source Connector (Google Drive / Email)
accountingIntakeRouter.post(
  '/connectors/:type/discover',
  authenticateToken,
  blockRecruiterFromTaxRecords,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const type = req.params.type.toUpperCase() as IntakeSourceType;
    const connector = ConnectorRegistry.getConnector(type);
    if (!connector) {
      return res.status(404).json({ error: `Connector ${req.params.type} not found.` });
    }

    const clientId = req.user.role === 'client' ? req.user.id : (req.body.clientId || req.user.id);
    const query = req.body.query;

    try {
      const candidates = await connector.discover({ clientId, query });
      return res.json({
        sourceType: type,
        provider: connector.providerName,
        candidatesFound: candidates.length,
        candidates
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'DISCOVERY_FAILED', message: err?.message || 'Failed to scan connector.' });
    }
  }
);

// 3. Import Selected Candidates into TaxGuard Intake
accountingIntakeRouter.post(
  '/connectors/:type/import',
  authenticateToken,
  blockRecruiterFromTaxRecords,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const type = req.params.type.toUpperCase() as IntakeSourceType;
    const connector = ConnectorRegistry.getConnector(type);
    if (!connector) {
      return res.status(404).json({ error: `Connector ${req.params.type} not found.` });
    }

    const { candidateIds, taxYear = 2025 } = req.body;
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ error: 'candidateIds array is required.' });
    }

    const clientId = req.user.role === 'client' ? req.user.id : (req.body.clientId || req.user.id);
    const actor = req.user.name || req.user.email || 'Authorized User';

    try {
      const imported = await connector.importSelected({
        candidateIds,
        clientId,
        actor
      });

      // Process each imported document through the intelligence pipeline
      const processedItems = imported.map(doc => {
        return AccountingDocumentIntelligenceService.processDocument({
          documentId: doc.documentId,
          filename: doc.originalFilename,
          fileSizeBytes: doc.fileSizeBytes,
          mimeType: doc.originalMimeType,
          rawText: `${doc.originalFilename} ${doc.sourceProvider} statement tax year ${taxYear}`,
          sourceType: doc.sourceType,
          sha256: doc.hash,
          actor,
          clientId,
          taxYear
        });
      });

      const batchId = `BATCH-${Date.now().toString(36).toUpperCase()}`;
      const batchJob = AccountingDocumentIntelligenceService.createBatchJob({
        batchId,
        clientId,
        taxYear,
        items: processedItems
      });

      return res.json({
        success: true,
        batchId,
        importedCount: imported.length,
        batch: batchJob
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'IMPORT_FAILED', message: err?.message || 'Failed to import documents.' });
    }
  }
);

// 4. Bulk Local Upload Ingestion (Files & Folders)
accountingIntakeRouter.post(
  '/bulk-upload',
  authenticateToken,
  blockRecruiterFromTaxRecords,
  (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { files, taxYear = 2025 } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array is required for bulk upload.' });
    }

    const clientId = req.user.role === 'client' ? req.user.id : (req.body.clientId || req.user.id);
    const actor = req.user.name || req.user.email || 'Authorized Taxpayer';

    const processedItems = files.map((file: any) => {
      const filename = file.filename || file.name || 'unnamed_document.pdf';
      const fileSizeBytes = file.size || file.fileSizeBytes || 1024;
      const mimeType = file.mimeType || file.type || 'application/pdf';
      const rawText = file.textPreview || file.rawText || filename;
      const sha256 = file.sha256 || crypto.createHash('sha256').update(filename + fileSizeBytes).digest('hex');
      const documentId = file.documentId || `DOC-${taxYear}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      return AccountingDocumentIntelligenceService.processDocument({
        documentId,
        filename,
        fileSizeBytes,
        mimeType,
        rawText,
        sourceType: file.folderPath ? 'LOCAL_UPLOAD' : 'LOCAL_UPLOAD',
        sha256,
        actor,
        clientId,
        taxYear
      });
    });

    const batchId = req.body.batchId || `BATCH-${Date.now().toString(36).toUpperCase()}`;
    const batchJob = AccountingDocumentIntelligenceService.createBatchJob({
      batchId,
      clientId,
      taxYear,
      items: processedItems
    });

    return res.json({
      success: true,
      batchId,
      documentsFound: batchJob.documentsFound,
      accountingRelevant: batchJob.accountingRelevant,
      needsReview: batchJob.needsReview,
      duplicates: batchJob.duplicates,
      notAccountingRelated: batchJob.notAccountingRelated,
      batch: batchJob
    });
  }
);

// 5. Get Batch Job Status & Queue Summary
accountingIntakeRouter.get(
  '/batches/:batchId',
  authenticateToken,
  blockRecruiterFromTaxRecords,
  (req: AuthenticatedRequest, res: Response) => {
    const batch = AccountingDocumentIntelligenceService.getBatchJob(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'BATCH_NOT_FOUND', message: `Batch ${req.params.batchId} not found.` });
    }

    // Client isolation check
    if (req.user?.role === 'client' && batch.clientId !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this batch.' });
    }

    return res.json({ batch });
  }
);

// 6. Get Accounting Review Queue
accountingIntakeRouter.get(
  '/review-queue',
  authenticateToken,
  blockRecruiterFromTaxRecords,
  (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.role === 'client' ? req.user.id : undefined;
    const items = AccountingDocumentIntelligenceService.getReviewQueue(clientId);
    return res.json({
      count: items.length,
      items
    });
  }
);

// 7. Human Review Decision Gate
accountingIntakeRouter.post(
  '/review-queue/:id/decision',
  authenticateToken,
  blockRecruiterFromTaxRecords,
  (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { decision, newCategory, notes } = req.body;
    if (!['ACCEPTED', 'CATEGORY_CHANGED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be ACCEPTED, CATEGORY_CHANGED, or REJECTED.' });
    }

    try {
      const resolved = AccountingDocumentIntelligenceService.resolveReviewItem({
        reviewId: req.params.id,
        decision,
        newCategory,
        actor: req.user.name || req.user.email || 'Staff Reviewer',
        notes
      });

      return res.json({
        success: true,
        resolvedItem: resolved
      });
    } catch (err: any) {
      return res.status(404).json({ error: 'ITEM_NOT_FOUND', message: err?.message || 'Review item not found.' });
    }
  }
);
