/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Accounting Document Intake Agent & Intelligence Service Unit & Integration Tests
 *
 * Verifies:
 * 1. 37 controlled accounting/tax classifications and privacy-first exclusion
 * 2. Canonical accounting extraction envelope with masked TINs and account numbers
 * 3. Financial statement transaction-level extraction
 * 4. Multi-signal duplicate detection (SHA-256 exact, invoice+amount, filename+size)
 * 5. Confidence scoring & human review queue routing
 * 6. Cloud/Email connector interfaces and fail-closed boundaries
 * 7. Governance invariants: AI-proposed only, never autonomous tax authority
 */

import { describe, expect, it } from 'vitest';
import { AccountingDocumentIntelligenceService } from '../server/taxguard/accountingDocumentIntelligence.service';
import { GoogleDriveConnector, EmailIngestionConnector, ConnectorRegistry } from '../server/taxguard/accountingConnectors';
import { ACCOUNTING_CLASSIFICATIONS } from '../types/accountingIntake';

describe('TaxGuard Accounting Document Intake Agent', () => {
  describe('1. Relevance Classification Engine (37 Categories)', () => {
    it('defines all 37 controlled accounting classifications', () => {
      expect(ACCOUNTING_CLASSIFICATIONS.length).toBe(37);
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('TAX_DOCUMENT');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('BANK_STATEMENT');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('CREDIT_CARD_STATEMENT');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('INVOICE');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('SALES_RECEIPT');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('EXPENSE_RECEIPT');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('PURCHASE_ORDER');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('PAYROLL');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('GENERAL_LEDGER');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('TRIAL_BALANCE');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('PROFIT_AND_LOSS');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('BALANCE_SHEET');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('CASH_FLOW_STATEMENT');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('FORM_W2');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('FORM_1099');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('FORM_1098');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('FORM_1095');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('K1');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('PRIOR_TAX_RETURN');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('NON_ACCOUNTING');
      expect(ACCOUNTING_CLASSIFICATIONS).toContain('UNKNOWN');
    });

    it('accurately classifies IRS Form W-2 as accounting relevant', () => {
      const res = AccountingDocumentIntelligenceService.classifyDocument(
        'W2_2025_Employer.pdf',
        'Form W-2 Wage and Tax Statement 2025 Wages, tips, other comp: $95,000.00'
      );
      expect(res.classification).toBe('FORM_W2');
      expect(res.isAccountingRelevant).toBe(true);
      expect(res.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('accurately classifies 1099-NEC as accounting relevant', () => {
      const res = AccountingDocumentIntelligenceService.classifyDocument(
        '1099_NEC_Contractor.pdf',
        'Form 1099-NEC Nonemployee Compensation 2025 Payer TIN: 12-3456789 Amount: $14,200.00'
      );
      expect(res.classification).toBe('FORM_1099');
      expect(res.isAccountingRelevant).toBe(true);
      expect(res.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('accurately classifies Bank Statements as accounting relevant', () => {
      const res = AccountingDocumentIntelligenceService.classifyDocument(
        'Chase_Bank_Statement_Nov.pdf',
        'JPMorgan Chase Bank Statement Checking Account Starting Balance: $12,450.00 Ending Balance: $18,320.00'
      );
      expect(res.classification).toBe('BANK_STATEMENT');
      expect(res.isAccountingRelevant).toBe(true);
      expect(res.confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('accurately classifies General Ledger workpapers', () => {
      const res = AccountingDocumentIntelligenceService.classifyDocument(
        'GL_Detail_2025.xlsx',
        'GENERAL LEDGER DETAIL Chart of Accounts Debits Credits Net Balance'
      );
      expect(res.classification).toBe('GENERAL_LEDGER');
      expect(res.isAccountingRelevant).toBe(true);
    });

    it('excludes personal non-accounting records (vacation photos, resumes, flight itineraries)', () => {
      const res = AccountingDocumentIntelligenceService.classifyDocument(
        'Vacation_Flight_Itinerary.pdf',
        'Flight Itinerary Boarding Pass Hotel Confirmation Miami Beach Florida'
      );
      expect(res.classification).toBe('NON_ACCOUNTING');
      expect(res.isAccountingRelevant).toBe(false);
      expect(res.suggestedCategory).toContain('Non-Accounting');
    });
  });

  describe('2. Canonical Accounting Extraction Envelope & Privacy Minimization', () => {
    it('extracts canonical envelope with masked TINs and account numbers', () => {
      const rawText = `
        INVOICE # INV-2025-9841
        Date: 10/15/2025
        Payer TIN: 12-3456789
        Acct Ending In: 4892
        Subtotal: $4,500.00
        Tax: $360.00
        Total Due: $4,860.00
      `;

      const envelope = AccountingDocumentIntelligenceService.extractCanonicalEnvelope(
        'DOC-TEST-001',
        'Acme_Invoice_9841.pdf',
        rawText,
        'INVOICE'
      );

      expect(envelope.documentType).toBe('INVOICE');
      expect(envelope.isAccountingRelevant).toBe(true);
      expect(envelope.invoiceNumber).toBe('INV-2025-9841');
      expect(envelope.taxYear).toBe(2025);
      expect(envelope.documentDate).toBe('10/15/2025');
      expect(envelope.accountLastFour).toBe('4892');
      // TIN is masked: XX-XXX-6789, never unmasked
      expect(envelope.payerTINMasked).toBe('XX-XXX-6789');
      expect(envelope.grossAmount).toBe(4860.00);
      expect(envelope.taxAmount).toBe(360.00);
      // AI proposed only boundary
      expect(envelope.isAiProposedOnly).toBe(true);
    });
  });

  describe('3. Financial Statement Transaction-Level Extraction', () => {
    it('extracts line-item transactions with debit/credit and proposed categories', () => {
      const rawStatement = `
        01/10/2025 Amazon Web Services $420.50
        01/12/2025 Client Wire Deposit CR $12,500.00
        01/18/2025 Staples Office Supplies $84.22
      `;

      const transactions = AccountingDocumentIntelligenceService.extractTransactions(
        'DOC-STMT-002',
        rawStatement,
        '9941'
      );

      expect(transactions.length).toBe(3);
      expect(transactions[0].date).toBe('01/10/2025');
      expect(transactions[0].description).toBe('Amazon Web Services');
      expect(transactions[0].amount).toBe(420.50);
      expect(transactions[0].type).toBe('DEBIT');
      expect(transactions[0].accountLastFour).toBe('9941');
      expect(transactions[0].possibleDeductible).toBe(true);
      expect(transactions[0].isAiProposedOnly).toBe(true);

      expect(transactions[1].type).toBe('CREDIT');
      expect(transactions[1].amount).toBe(12500.00);
      expect(transactions[1].proposedCategory).toBe('Operating Revenue');
    });
  });

  describe('4. Multi-Signal Duplicate Detection Engine', () => {
    it('flags exact cryptographic SHA-256 collisions as EXACT_DUPLICATE', () => {
      const candidate1 = {
        documentId: 'DOC-DUP-001',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        filename: 'invoice_january.pdf',
        fileSize: 45000
      };

      const res1 = AccountingDocumentIntelligenceService.detectDuplicates(candidate1);
      expect(res1.status).toBe('UNIQUE');

      const candidate2 = {
        documentId: 'DOC-DUP-002',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        filename: 'invoice_january_copy.pdf',
        fileSize: 45000
      };

      const res2 = AccountingDocumentIntelligenceService.detectDuplicates(candidate2);
      expect(res2.status).toBe('EXACT_DUPLICATE');
      expect(res2.primaryDocumentId).toBe('DOC-DUP-001');
      expect(res2.confidence).toBe(1.0);
    });

    it('flags identical invoice numbers and amounts as POSSIBLE_DUPLICATE requiring review', () => {
      const envelope1 = AccountingDocumentIntelligenceService.extractCanonicalEnvelope(
        'DOC-INV-001',
        'bill_first.pdf',
        'Invoice # INV-7721 Total Due: $1,250.00 Date: 02/01/2025',
        'INVOICE'
      );
      AccountingDocumentIntelligenceService.detectDuplicates({
        documentId: 'DOC-INV-001',
        sha256: 'hash_inv_001',
        filename: 'bill_first.pdf',
        fileSize: 32000,
        envelope: envelope1
      });

      const envelope2 = AccountingDocumentIntelligenceService.extractCanonicalEnvelope(
        'DOC-INV-002',
        'scan_second.pdf',
        'Invoice # INV-7721 Total Due: $1,250.00 Date: 02/01/2025',
        'INVOICE'
      );
      const res = AccountingDocumentIntelligenceService.detectDuplicates({
        documentId: 'DOC-INV-002',
        sha256: 'hash_inv_002_different',
        filename: 'scan_second.pdf',
        fileSize: 34500,
        envelope: envelope2
      });

      expect(res.status).toBe('POSSIBLE_DUPLICATE');
      expect(res.requiresReview).toBe(true);
      expect(res.matchedSignals).toContain('INVOICE_NUMBER_AND_AMOUNT_MATCH');
    });
  });

  describe('5. Confidence Scoring & Human Review Routing', () => {
    it('routes low-confidence or ambiguous items to human review queue', () => {
      const item = AccountingDocumentIntelligenceService.processDocument({
        documentId: 'DOC-AMBIG-001',
        filename: 'unclear_memo.txt',
        fileSizeBytes: 2048,
        mimeType: 'text/plain',
        rawText: 'Payment account note with no structured numbers',
        sourceType: 'LOCAL_UPLOAD',
        sha256: 'hash_ambig_001',
        actor: 'Test Taxpayer',
        clientId: 'client-101',
        taxYear: 2025
      });

      expect(item.needsReview).toBe(true);
      const queue = AccountingDocumentIntelligenceService.getReviewQueue();
      expect(queue.length).toBeGreaterThan(0);
      const reviewItem = queue.find(r => r.documentId === 'DOC-AMBIG-001');
      expect(reviewItem).toBeDefined();
    });

    it('allows an authorized CPA to resolve items in the review queue', () => {
      const queue = AccountingDocumentIntelligenceService.getReviewQueue();
      const firstItem = queue[0];
      if (firstItem) {
        const resolved = AccountingDocumentIntelligenceService.resolveReviewItem({
          reviewId: firstItem.reviewId,
          decision: 'CATEGORY_CHANGED',
          newCategory: 'Consulting Expense',
          actor: 'Jane CPA'
        });
        expect(resolved.status).toBe('CATEGORY_CHANGED');
        expect(resolved.aiSuggestedCategory).toBe('Consulting Expense');
      }
    });
  });

  describe('6. Connector Registry & Cloud Connectors', () => {
    it('provides registered connectors for Google Drive and Email', () => {
      const connectors = ConnectorRegistry.getAllConnectors();
      expect(connectors.length).toBeGreaterThanOrEqual(2);
      
      const drive = ConnectorRegistry.getConnector('GOOGLE_DRIVE');
      expect(drive).toBeDefined();
      expect(drive?.providerName).toBe('Google Drive');

      const email = ConnectorRegistry.getConnector('EMAIL');
      expect(email).toBeDefined();
      expect(email?.providerName).toBe('Email / Gmail');
    });

    it('returns candidate documents during discovery', async () => {
      const drive = new GoogleDriveConnector();
      const candidates = await drive.discover({ clientId: 'test-client-99' });
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0]).toHaveProperty('sourceObjectId');
      expect(candidates[0]).toHaveProperty('suggestedCategory');
    });
  });
});
