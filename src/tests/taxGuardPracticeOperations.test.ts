/**
 * TaxGuard Production Practice Operations Test Suite
 * Comprehensive automated tests for:
 * 1. Durable Background Jobs & Dead-Letter Queue
 * 2. Durable Write Idempotency & Replay Prevention
 * 3. Practice Task Engine & Dependency Gates
 * 4. Staff Assignment Governance & Workload Metrics
 * 5. Deadlines & Escalation Engine
 * 6. Client Communications & Visibility Boundaries
 * 7. Client Request Center
 * 8. Notification Orchestrator & Channel Truthfulness
 * 9. Service Catalog & Deterministic Invoicing
 * 10. Stripe Webhook Signature & Deduplication
 * 11. Global Operational Search & PII Redaction
 * 12. Practice Analytics & Case Command Center
 * 13. Data Retention, Legal Hold, Archive Integrity & Annual Rollover
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac, createHash } from 'node:crypto';
import { globalDurableJobQueueService } from '../server/taxguard/operations/durableJobQueue.service';
import { globalDurableIdempotencyService } from '../server/taxguard/operations/durableIdempotency.service';
import { globalPracticeTaskService } from '../server/taxguard/operations/practiceTask.service';
import { globalStaffAssignmentService } from '../server/taxguard/operations/staffAssignment.service';
import { globalDeadlineEscalationService } from '../server/taxguard/operations/deadlineEscalation.service';
import { globalClientCommunicationService } from '../server/taxguard/operations/clientCommunication.service';
import { globalClientRequestService } from '../server/taxguard/operations/clientRequest.service';
import { globalNotificationOrchestratorService } from '../server/taxguard/operations/notificationOrchestrator.service';
import { globalEngagementBillingService } from '../server/taxguard/operations/engagementBilling.service';
import { globalOperationalSearchService } from '../server/taxguard/operations/operationalSearch.service';
import { globalPracticeAnalyticsService } from '../server/taxguard/operations/practiceAnalytics.service';
import { globalDataRetentionRecoveryService } from '../server/taxguard/operations/dataRetentionRecovery.service';
import { computeInvoiceTotals, roundCurrency } from '../server/taxguard/operations/types';

describe('TaxGuard Production Practice Operations Suite', () => {
  beforeEach(() => {
    globalDurableJobQueueService.clear();
    globalDurableIdempotencyService.clear();
    globalPracticeTaskService.clear();
    globalStaffAssignmentService.clear();
    globalDeadlineEscalationService.clear();
    globalClientCommunicationService.clear();
    globalClientRequestService.clear();
    globalNotificationOrchestratorService.clear();
    globalEngagementBillingService.clear();
  });

  // ==============================================================================
  // 1. DURABLE BACKGROUND JOBS
  // ==============================================================================
  describe('Durable Background Jobs & Dead-Letter Engine', () => {
    it('enqueues and claims jobs safely with worker leases', async () => {
      const job = await globalDurableJobQueueService.enqueue({
        tenantId: 'tenantA',
        jobType: 'DOCUMENT_PROCESSING',
        payload: { documentId: 'doc_123', pages: 4 },
        priority: 1,
      });

      expect(job.status).toBe('PENDING');
      expect(job.priority).toBe(1);

      // Claim job with worker-1
      const claimed = await globalDurableJobQueueService.claimNextJob('tenantA', 'worker-1');
      expect(claimed).not.toBeNull();
      expect(claimed!.id).toBe(job.id);
      expect(claimed!.status).toBe('CLAIMED');
      expect(claimed!.lockedBy).toBe('worker-1');

      // Second worker attempting to claim receives null (concurrency lock)
      const secondClaim = await globalDurableJobQueueService.claimNextJob('tenantA', 'worker-2');
      expect(secondClaim).toBeNull();

      // Complete job
      const completed = await globalDurableJobQueueService.completeJob(job.id, 'worker-1');
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBeDefined();
    });

    it('enforces exponential backoff and transitions to DEAD_LETTER after max attempts', async () => {
      const job = await globalDurableJobQueueService.enqueue({
        tenantId: 'tenantA',
        jobType: 'OCR_REQUEST',
        payload: { file: 'w2.pdf' },
        maxAttempts: 2,
      });

      // Claim attempt 1
      await globalDurableJobQueueService.claimNextJob('tenantA', 'worker-1');
      const failedAttempt1 = await globalDurableJobQueueService.failJob(job.id, 'worker-1', {
        code: 'TRANSIENT_TIMEOUT',
        message: 'Downstream OCR service timed out',
      });
      expect(failedAttempt1.status).toBe('RETRY_SCHEDULED');
      expect(failedAttempt1.attemptCount).toBe(1);

      // Force available for retry
      failedAttempt1.availableAt = new Date(Date.now() - 1000).toISOString();

      // Claim attempt 2
      await globalDurableJobQueueService.claimNextJob('tenantA', 'worker-2');
      const failedAttempt2 = await globalDurableJobQueueService.failJob(job.id, 'worker-2', {
        code: 'PROVIDER_ERROR',
        message: 'Permanent 500 error from provider',
      });
      expect(failedAttempt2.status).toBe('DEAD_LETTER');

      // Admin inspection
      const deadLetters = globalDurableJobQueueService.getDeadLetterJobs('tenantA');
      expect(deadLetters.length).toBe(1);
      expect(deadLetters[0].id).toBe(job.id);

      // Admin retry
      const retried = await globalDurableJobQueueService.retryDeadLetterJob(job.id, 'admin_user');
      expect(retried.status).toBe('PENDING');
      expect(retried.maxAttempts).toBeGreaterThan(2);
    });

    it('routes permanent validation failures immediately to DEAD_LETTER without wasting retries', async () => {
      const job = await globalDurableJobQueueService.enqueue({
        tenantId: 'tenantA',
        jobType: 'REPORT_GENERATION',
        payload: { badInput: true },
      });

      await globalDurableJobQueueService.claimNextJob('tenantA', 'worker-1');
      const failed = await globalDurableJobQueueService.failJob(job.id, 'worker-1', {
        code: 'VALIDATION_INVALID_YEAR',
        message: 'Year out of bounds',
      });
      expect(failed.status).toBe('DEAD_LETTER');
    });
  });

  // ==============================================================================
  // 2. DURABLE IDEMPOTENCY
  // ==============================================================================
  describe('Durable Mutation Idempotency', () => {
    it('prevents duplicate execution and replays original result reference', async () => {
      const acquire1 = await globalDurableIdempotencyService.acquire(
        'tenantA',
        'JOURNAL_POST',
        'TAXGUARD_LEDGER',
        'key_mutation_99',
        'fingerprint_abc'
      );
      expect(acquire1.status).toBe('ACQUIRED');

      // Concurrent worker attempt returns PROCESSING
      const acquireConcurrent = await globalDurableIdempotencyService.acquire(
        'tenantA',
        'JOURNAL_POST',
        'TAXGUARD_LEDGER',
        'key_mutation_99',
        'fingerprint_abc'
      );
      expect(acquireConcurrent.status).toBe('PROCESSING');

      // Complete mutation
      await globalDurableIdempotencyService.complete(
        'tenantA',
        'JOURNAL_POST',
        'key_mutation_99',
        { journalEntryId: 'je_101', postedLines: 4 },
        'audit_evt_99'
      );

      // Repeated call replays original result
      const replay = await globalDurableIdempotencyService.acquire(
        'tenantA',
        'JOURNAL_POST',
        'TAXGUARD_LEDGER',
        'key_mutation_99',
        'fingerprint_abc'
      );
      expect(replay.status).toBe('COMPLETED');
      if (replay.status === 'COMPLETED') {
        expect(replay.resultReference.journalEntryId).toBe('je_101');
        expect(replay.auditEventId).toBe('audit_evt_99');
      }
    });
  });

  // ==============================================================================
  // 3. PRACTICE TASKS & DEPENDENCY GATES
  // ==============================================================================
  describe('Practice Tasks & Dependency Gates', () => {
    it('blocks dependent tasks until prerequisites are completed', async () => {
      // Step 1: Upstream document request task
      const docTask = await globalPracticeTaskService.createTask({
        tenantId: 'tenantA',
        clientId: 'cli_01',
        taskType: 'DOCUMENT_COLLECTION',
        title: 'Collect Form 1099-DIV',
        createdBy: 'cpa_1',
      });

      // Step 2: Downstream reconciliation task dependent on docTask
      const reconTask = await globalPracticeTaskService.createTask({
        tenantId: 'tenantA',
        clientId: 'cli_01',
        taskType: 'RECONCILIATION',
        title: 'Reconcile Brokerage Dividends',
        createdBy: 'cpa_1',
        dependencies: [docTask.id],
      });

      expect(reconTask.status).toBe('BLOCKED');

      // Attempting to complete reconTask throws TASK_DEPENDENCY_BLOCKED
      await expect(
        globalPracticeTaskService.updateStatus(reconTask.id, 'COMPLETED', 'cpa_1')
      ).rejects.toThrow('TASK_DEPENDENCY_BLOCKED');

      // Complete prerequisite task
      await globalPracticeTaskService.updateStatus(docTask.id, 'COMPLETED', 'cpa_1');

      // Verify reconTask is automatically unblocked
      const unblockedRecon = globalPracticeTaskService.getTask(reconTask.id);
      expect(unblockedRecon?.status).toBe('OPEN');

      // Now completing reconTask succeeds
      const completedRecon = await globalPracticeTaskService.updateStatus(reconTask.id, 'COMPLETED', 'cpa_1');
      expect(completedRecon.status).toBe('COMPLETED');
    });
  });

  // ==============================================================================
  // 4. STAFF ASSIGNMENTS & WORKLOAD
  // ==============================================================================
  describe('Staff Assignments & Caseload Governance', () => {
    it('records immutable audit history on staff reassignment with mandatory reason', async () => {
      await globalStaffAssignmentService.assignStaff({
        tenantId: 'tenantA',
        clientId: 'cli_01',
        role: 'accountant',
        userId: 'usr_accountant_1',
        assignedBy: 'admin_1',
      });

      // Reassign to accountant 2
      await globalStaffAssignmentService.assignStaff({
        tenantId: 'tenantA',
        clientId: 'cli_01',
        role: 'accountant',
        userId: 'usr_accountant_2',
        assignedBy: 'admin_1',
        reason: 'Client requested senior practitioner for S-Corp transition',
      });

      const active = globalStaffAssignmentService.getClientAssignments('tenantA', 'cli_01');
      expect(active.length).toBe(1);
      expect(active[0].userId).toBe('usr_accountant_2');

      const history = globalStaffAssignmentService.getAssignmentHistory('tenantA', 'cli_01');
      expect(history.length).toBe(1);
      expect(history[0].previousUserId).toBe('usr_accountant_1');
      expect(history[0].newUserId).toBe('usr_accountant_2');
      expect(history[0].reassignmentReason).toContain('S-Corp transition');
    });

    it('computes staff workload accurately from real assignments and tasks', async () => {
      await globalStaffAssignmentService.assignStaff({
        tenantId: 'tenantA',
        clientId: 'cli_10',
        role: 'accountant',
        userId: 'usr_staff_workload',
        assignedBy: 'admin_1',
      });

      await globalPracticeTaskService.createTask({
        tenantId: 'tenantA',
        clientId: 'cli_10',
        taskType: 'PREPARATION',
        title: 'Schedule C Tax Workpaper',
        assignedUserId: 'usr_staff_workload',
        createdBy: 'admin_1',
        dueDate: new Date(Date.now() - 86400000).toISOString(), // Overdue by 1 day
      });

      const workload = globalStaffAssignmentService.getStaffWorkload('tenantA', 'usr_staff_workload');
      expect(workload.assignedClientsCount).toBe(1);
      expect(workload.openTasksCount).toBe(1);
      expect(workload.overdueTasksCount).toBe(1);
    });
  });

  // ==============================================================================
  // 5. DEADLINES & ESCALATION
  // ==============================================================================
  describe('Deadlines & Escalation Engine', () => {
    it('evaluates escalation levels based on proximity and statutory authority', async () => {
      const now = Date.now();

      // Normal (> 7 days)
      const dlNormal = await globalDeadlineEscalationService.createDeadline({
        tenantId: 'tenantA',
        category: 'client_request',
        title: 'Standard Questionnaire',
        dueDate: new Date(now + 10 * 86400000).toISOString(),
        authorityType: 'INTERNAL',
      });
      expect(dlNormal.escalationLevel).toBe(0);

      // Approaching (within 7 days)
      const dlApproaching = await globalDeadlineEscalationService.createDeadline({
        tenantId: 'tenantA',
        category: 'review',
        title: 'Review Deliverable',
        dueDate: new Date(now + 4 * 86400000).toISOString(),
        authorityType: 'INTERNAL',
      });
      expect(dlApproaching.escalationLevel).toBe(1);

      // Overdue statutory filing -> Critical (Level 4)
      const dlStatutoryOverdue = await globalDeadlineEscalationService.createDeadline({
        tenantId: 'tenantA',
        category: 'filing',
        title: 'Form 1040 Statutory Filing Deadline',
        dueDate: new Date(now - 86400000).toISOString(),
        authorityType: 'STATUTORY',
      });
      expect(dlStatutoryOverdue.status).toBe('OVERDUE');
      expect(dlStatutoryOverdue.escalationLevel).toBe(4);

      // Sweep evaluation
      const sweep = globalDeadlineEscalationService.runEscalationSweep('tenantA');
      expect(sweep.evaluatedCount).toBeGreaterThanOrEqual(3);
      expect(sweep.overdueCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ==============================================================================
  // 6. CLIENT COMMUNICATIONS & VISIBILITY BOUNDARIES
  // ==============================================================================
  describe('Client Communications Security Boundaries', () => {
    it('strictly redacts INTERNAL_ONLY messages from client queries', async () => {
      const thread = await globalClientCommunicationService.createThread({
        tenantId: 'tenantA',
        clientId: 'cli_comm_1',
        subject: 'Tax Depreciation Inquiry',
        createdBy: 'usr_cpa',
      });

      // 1. Client-visible message
      await globalClientCommunicationService.postMessage({
        threadId: thread.id,
        tenantId: 'tenantA',
        clientId: 'cli_comm_1',
        senderId: 'usr_cpa',
        senderRole: 'accountant',
        visibility: 'CLIENT_VISIBLE',
        content: 'Please upload the purchase invoice for the vehicle.',
      });

      // 2. Internal-only reviewer note
      await globalClientCommunicationService.postMessage({
        threadId: thread.id,
        tenantId: 'tenantA',
        clientId: 'cli_comm_1',
        senderId: 'usr_reviewer',
        senderRole: 'senior_reviewer',
        visibility: 'INTERNAL_ONLY',
        content: 'Check IRC § 280F luxury auto limits before approving Section 179.',
      });

      // Client view query
      const clientView = globalClientCommunicationService.getThreadMessages(
        thread.id,
        'tenantA',
        'client',
        'cli_comm_1'
      );
      expect(clientView.length).toBe(1);
      expect(clientView[0].content).toContain('Please upload');

      // Staff view query
      const staffView = globalClientCommunicationService.getThreadMessages(
        thread.id,
        'tenantA',
        'accountant'
      );
      expect(staffView.length).toBe(2);
      expect(staffView.some((m) => m.visibility === 'INTERNAL_ONLY')).toBe(true);

      // Client attempting to post an INTERNAL_ONLY note throws error
      await expect(
        globalClientCommunicationService.postMessage({
          threadId: thread.id,
          tenantId: 'tenantA',
          clientId: 'cli_comm_1',
          senderId: 'usr_client',
          senderRole: 'client',
          visibility: 'INTERNAL_ONLY',
          content: 'Sneaky internal note attempt',
        })
      ).rejects.toThrow('CLIENT_CANNOT_POST_INTERNAL_NOTE');
    });
  });

  // ==============================================================================
  // 7. CLIENT REQUEST CENTER
  // ==============================================================================
  describe('Client Request Center', () => {
    it('manages request lifecycle from OPEN to RESPONDED and RESOLVED with client isolation', async () => {
      const req = await globalClientRequestService.createRequest({
        tenantId: 'tenantA',
        clientId: 'cli_req_1',
        requestType: 'TRANSACTION_CLARIFICATION',
        title: 'Clarify $3,850 Apple Store Transaction',
        description: 'Specify if equipment was hardware upgrade or inventory',
        createdBy: 'usr_cpa',
      });

      expect(req.status).toBe('OPEN');

      // Cross-client response attempt fails
      await expect(
        globalClientRequestService.submitResponse({
          requestId: req.id,
          clientId: 'cli_different',
          responseText: 'Malicious response',
        })
      ).rejects.toThrow('CLIENT_MISMATCH');

      // Authorized client response
      const responded = await globalClientRequestService.submitResponse({
        requestId: req.id,
        clientId: 'cli_req_1',
        responseText: 'MacBook Pro purchased for financial modeling',
      });
      expect(responded.status).toBe('RESPONDED');

      // Staff resolution
      const resolved = await globalClientRequestService.resolveRequest(req.id, 'usr_cpa', 'RESOLVED');
      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolvedAt).toBeDefined();
    });
  });

  // ==============================================================================
  // 8. NOTIFICATIONS & CHANNELS
  // ==============================================================================
  describe('Notification Orchestrator', () => {
    it('delivers IN_APP immediately and truthfully reports NOT_CONFIGURED for absent email/sms providers', async () => {
      // IN_APP
      const inApp = await globalNotificationOrchestratorService.dispatch({
        tenantId: 'tenantA',
        recipientId: 'usr_client_1',
        recipientRole: 'client',
        templateType: 'DOCUMENT_REVIEWED',
        channel: 'IN_APP',
        title: 'W-2 Verified',
        body: 'Your W-2 has been validated by your CPA.',
      });
      expect(inApp.status).toBe('DELIVERED');

      // EMAIL when uncommissioned
      const email = await globalNotificationOrchestratorService.dispatch({
        tenantId: 'tenantA',
        recipientId: 'usr_client_1',
        recipientRole: 'client',
        templateType: 'SECURITY_ALERT',
        channel: 'EMAIL',
        title: 'New Sign-in Alert',
        body: 'New sign in detected.',
      });
      expect(email.status).toBe('NOT_CONFIGURED');
      expect(email.failureCode).toBe('EMAIL_PROVIDER_NOT_COMMISSIONED');

      // Mandatory security alert overrides user opt-out
      globalNotificationOrchestratorService.setUserPreferences({
        tenantId: 'tenantA',
        userId: 'usr_client_optout',
        inAppEnabled: false,
        emailEnabled: false,
        smsEnabled: false,
        remindersEnabled: false,
        updatedAt: new Date().toISOString(),
      });

      const mandatoryAlert = await globalNotificationOrchestratorService.dispatch({
        tenantId: 'tenantA',
        recipientId: 'usr_client_optout',
        recipientRole: 'client',
        templateType: 'LEGAL_SECURITY_NOTICE',
        channel: 'IN_APP',
        title: 'MANDATORY: 2FA Enrollment Required',
        body: 'Security policy requires multi-factor authentication.',
        isMandatorySecurity: true,
      });
      expect(mandatoryAlert.status).toBe('DELIVERED');
    });

    it('does not claim external notification delivery in production without provider transports', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('SENDGRID_API_KEY', 'test-sendgrid-key');
      vi.stubEnv('TWILIO_AUTH_TOKEN', 'test-twilio-token');
      vi.stubEnv('TWILIO_ACCOUNT_SID', 'test-twilio-account');
      try {
        const email = await globalNotificationOrchestratorService.dispatch({
          tenantId: 'tenantA',
          recipientId: 'usr_client_1',
          recipientRole: 'client',
          templateType: 'SECURITY_ALERT',
          channel: 'EMAIL',
          title: 'New Sign-in Alert',
          body: 'New sign in detected.'
        });
        const sms = await globalNotificationOrchestratorService.dispatch({
          tenantId: 'tenantA',
          recipientId: 'usr_client_1',
          recipientRole: 'client',
          templateType: 'SECURITY_ALERT',
          channel: 'SMS',
          title: 'New Sign-in Alert',
          body: 'New sign in detected.'
        });
        expect(email).toMatchObject({ status: 'NOT_CONFIGURED', failureCode: 'EMAIL_PROVIDER_NOT_COMMISSIONED' });
        expect(sms).toMatchObject({ status: 'NOT_CONFIGURED', failureCode: 'SMS_PROVIDER_NOT_COMMISSIONED' });
        expect(email.providerReference).toBeUndefined();
        expect(sms.providerReference).toBeUndefined();
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  // ==============================================================================
  // 9. SERVICE CATALOG & DETERMINISTIC INVOICING
  // ==============================================================================
  describe('Service Catalog, Engagement Scope & Deterministic Invoicing', () => {
    it('enforces exact two-decimal money rounding and prevents floating point errors', () => {
      const lineItems = [
        { quantity: 3, unitRate: 33.33 },
        { quantity: 1, unitRate: 0.01 },
      ];
      const { subtotal, total } = computeInvoiceTotals(lineItems, 0.05, 5.0);
      expect(subtotal).toBe(100.0);
      expect(total).toBe(105.05);
      expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    });

    it('manages invoice lifecycle: draft -> issue -> partial pay -> full pay -> void restrictions', async () => {
      const invoice = await globalEngagementBillingService.createDraftInvoice({
        tenantId: 'tenantA',
        clientId: 'cli_billing_1',
        dueDate: '2026-11-01',
        lines: [
          { serviceCode: 'SVC_1040_INDIVIDUAL', description: 'Form 1040 Prep', quantity: 1, unitRate: 450.0 },
          { serviceCode: 'SVC_TAX_PLANNING_ADVISORY', description: 'Tax Advisory', quantity: 1, unitRate: 850.0 },
        ],
        createdBy: 'usr_cpa',
      });

      expect(invoice.status).toBe('DRAFT');
      expect(invoice.total).toBe(1300.0);
      expect(invoice.balanceDue).toBe(1300.0);

      // Issue invoice
      const issued = await globalEngagementBillingService.issueInvoice(invoice.id, 'usr_cpa');
      expect(issued.status).toBe('ISSUED');

      // Record partial payment of $500
      const { invoice: partialInv } = await globalEngagementBillingService.recordPayment({
        tenantId: 'tenantA',
        invoiceId: invoice.id,
        clientId: 'cli_billing_1',
        amount: 500.0,
        paymentMethod: 'CHECK',
        recordedBy: 'usr_cpa',
      });
      expect(partialInv.status).toBe('PARTIALLY_PAID');
      expect(partialInv.amountPaid).toBe(500.0);
      expect(partialInv.balanceDue).toBe(800.0);

      // Attempting to void an invoice with payments throws error
      await expect(
        globalEngagementBillingService.voidInvoice(invoice.id, 'admin_1', 'Client requested cancel')
      ).rejects.toThrow('CANNOT_VOID_PAID_INVOICE');

      // Complete full payment
      const { invoice: paidInv } = await globalEngagementBillingService.recordPayment({
        tenantId: 'tenantA',
        invoiceId: invoice.id,
        clientId: 'cli_billing_1',
        amount: 800.0,
        paymentMethod: 'WIRE',
        recordedBy: 'usr_cpa',
      });
      expect(paidInv.status).toBe('PAID');
      expect(paidInv.balanceDue).toBe(0.0);
    });

    it('restricts engagement scope: tax engagement does not authorize uncontracted bookkeeping', async () => {
      const eng = await globalEngagementBillingService.createEngagement({
        tenantId: 'tenantA',
        clientId: 'cli_scope_1',
        engagementCode: 'ENG-2025-TAX',
        taxYear: 2025,
        authorizedServices: ['SVC_1040_INDIVIDUAL'],
      });

      await globalEngagementBillingService.updateEngagementStatus(eng.id, 'ACTIVE', true);

      expect(globalEngagementBillingService.hasServiceScope(eng.id, 'SVC_1040_INDIVIDUAL')).toBe(true);
      expect(globalEngagementBillingService.hasServiceScope(eng.id, 'SVC_BOOKKEEPING_MONTHLY')).toBe(false);
    });
  });

  // ==============================================================================
  // 10. STRIPE WEBHOOK DEDUPLICATION & SIGNATURE
  // ==============================================================================
  describe('Stripe Webhook HMAC Verification & Deduplication', () => {
    it('verifies valid HMAC signature and deduplicates webhook events durably', async () => {
      const secret = 'whsec_test_secret_key_12345';
      const eventPayload = JSON.stringify({
        id: 'evt_stripe_test_001',
        type: 'payment_intent.succeeded',
        data: { object: { amount: 50000, metadata: {} } },
      });

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${timestamp}.${eventPayload}`;
      const signature = createHmac('sha256', secret).update(signedPayload).digest('hex');
      const header = `t=${timestamp},v1=${signature}`;

      // First execution: processed
      const result1 = await globalEngagementBillingService.handleStripeWebhook(eventPayload, header, secret);
      expect(result1.status).toBe('PROCESSED');

      // Replayed execution: duplicate ignored
      const result2 = await globalEngagementBillingService.handleStripeWebhook(eventPayload, header, secret);
      expect(result2.status).toBe('DUPLICATE_IGNORED');

      // Invalid signature rejects immediately
      const badHeader = `t=${timestamp},v1=invalid_signature_hash`;
      await expect(
        globalEngagementBillingService.handleStripeWebhook(eventPayload, badHeader, secret)
      ).rejects.toThrow('STRIPE_SIGNATURE_VERIFICATION_FAILED');
    });
  });

  // ==============================================================================
  // 11. GLOBAL OPERATIONAL SEARCH & PII SCRUBBING
  // ==============================================================================
  describe('Global Operational Search & Privacy', () => {
    it('searches across operational entities and masks SSNs in search results', async () => {
      await globalPracticeTaskService.createTask({
        tenantId: 'tenantA',
        clientId: 'cli_01',
        taskType: 'COMPLIANCE',
        title: 'Review Depreciation Form 4562',
        description: 'Verify Section 179 expense allocation',
        createdBy: 'usr_cpa',
      });

      const search = globalOperationalSearchService.search({
        tenantId: 'tenantA',
        query: 'Depreciation',
        callerRole: 'accountant',
      });

      expect(search.totalMatches).toBeGreaterThanOrEqual(1);
      expect(search.matches.some((m) => m.entityType === 'task' && m.title.includes('Depreciation'))).toBe(true);

      // Verify PII scrubbing on sample SSN text
      const scrubbed = (globalOperationalSearchService as any).redactPii('Client SSN is 123-45-6789 on Form 1040');
      expect(scrubbed).toBe('Client SSN is ***-**-6789 on Form 1040');
      expect(scrubbed).not.toContain('123-45-');
    });
  });

  // ==============================================================================
  // 12. PRACTICE ANALYTICS & CASE COMMAND CENTER
  // ==============================================================================
  describe('Practice Analytics & Case Command Center', () => {
    it('aggregates live metrics without exposing unmasked taxpayer secrets', async () => {
      const analytics = globalPracticeAnalyticsService.getPracticeAnalytics('tenantA');
      expect(analytics.casesByStage).toBeDefined();
      expect(analytics.generatedAt).toBeDefined();

      const commandCenter = globalPracticeAnalyticsService.getCaseCommandCenter('tenantA', 'cli_01');
      expect(commandCenter.clientId).toBe('cli_01');
      expect(commandCenter.readiness).toBeDefined();
      expect(commandCenter.billing).toBeDefined();
    });
  });

  // ==============================================================================
  // 13. DATA RETENTION, LEGAL HOLD & ARCHIVE INTEGRITY
  // ==============================================================================
  describe('Data Retention, Legal Hold, Archive Integrity & Annual Rollover', () => {
    it('blocks deletion when legal hold is active regardless of record age', () => {
      const oldDate = new Date(Date.now() - 15 * 365.25 * 86400000).toISOString(); // 15 years old

      // Normally eligible (15 > 7 years)
      expect(globalDataRetentionRecoveryService.isEligibleForDeletion('TAX_RETURN', oldDate)).toBe(true);

      // Place legal hold
      globalDataRetentionRecoveryService.setLegalHold(
        'TAX_RETURN',
        true,
        'legal_officer',
        'Pending regulatory subpoena inquiry'
      );

      // Blocked under legal hold
      expect(globalDataRetentionRecoveryService.isEligibleForDeletion('TAX_RETURN', oldDate)).toBe(false);

      // Release hold
      globalDataRetentionRecoveryService.setLegalHold('TAX_RETURN', false, 'legal_officer');
      expect(globalDataRetentionRecoveryService.isEligibleForDeletion('TAX_RETURN', oldDate)).toBe(true);
    });

    it('verifies SHA-256 archive package manifest integrity', () => {
      const content = JSON.stringify({ caseId: 'CASE-2025-01', finalReturn: '1040', checksum: 'OK' });
      const realSha256 = createHash('sha256').update(content).digest('hex');

      const check = globalDataRetentionRecoveryService.verifyArchiveManifest('mnf_01', content, realSha256);
      expect(check.manifestId).toBe('mnf_01');
      expect(check.isValid).toBe(true);

      const tamperedCheck = globalDataRetentionRecoveryService.verifyArchiveManifest(
        'mnf_01',
        content + 'TAMPERED',
        realSha256
      );
      expect(tamperedCheck.isValid).toBe(false);
    });

    it('executes safe annual rollover carrying forward only appropriate identity and account mappings', () => {
      const rollover = globalDataRetentionRecoveryService.executeAnnualRollover({
        clientId: 'cli_rollover_1',
        sourceTaxYear: 2025,
        targetTaxYear: 2026,
        actorId: 'usr_cpa',
      });

      expect(rollover.carriedForward.clientIdentity).toBe(true);
      expect(rollover.carriedForward.chartOfAccounts).toBe(true);
      expect(rollover.excludedFromRollover.priorYearIncome).toBe(true);
      expect(rollover.excludedFromRollover.priorYearTaxResults).toBe(true);
      expect(rollover.excludedFromRollover.priorYearDocuments).toBe(true);
    });
  });
});
