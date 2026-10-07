/**
 * Stripe PCI-Compliant Payments, Subscriptions & Webhook Replay Protection
 * Enforces idempotency keys, duplicate payment prevention, refund records,
 * and signed webhook event validation.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { db, WebhookRecord } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../auth';
import { Invoice } from '../../types';
import { isStaffCurrentlyAssignedToClient } from '../assignment-authorization';

export const paymentsRouter = Router();

export function requireLiveStripeProcessor(_req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({
      code: 'PROVIDER_NOT_CONFIGURED',
      error: 'Stripe payment provider is not configured in production. Live charges are blocked.'
    });
    return;
  }

  res.status(503).json({
    code: 'PAYMENT_PROCESSOR_UNAVAILABLE',
    error: 'Live Stripe processing is unavailable. Configured credentials cannot be used to simulate a settled payment.'
  });
}

// Process Checkout / Payment with Idempotency Key & Amount Authority
paymentsRouter.post('/charge', authenticateToken, requireLiveStripeProcessor, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      amount,
      currency,
      invoiceId,
      servicePlanId,
      description,
      paymentMethod,
      idempotencyKey,
      discountCode
    } = req.body;

    // IDEMPOTENCY KEY & DUPLICATE PAYMENT PREVENTION
    if (idempotencyKey) {
      const existingWebhook = Array.from(db.webhooks.values()).find(w => w.idempotencyKey === idempotencyKey);
      if (existingWebhook) {
        db.logSecurityEvent({
          eventType: 'IDEMPOTENT_DUPLICATE_PAYMENT_INTERCEPTED',
          ipAddress: req.ip || 'unknown',
          userId: req.user.id,
          details: `Duplicate payment charge intercepted for idempotency key ${idempotencyKey}. Returned existing transaction response.`,
          severity: 'info'
        });

        return res.status(200).json({
          message: 'Idempotent request recognized: payment was previously processed.',
          status: 'paid',
          idempotentReplay: true,
          transaction: existingWebhook.payload
        });
      }
    }

    let targetInvoice: Invoice | undefined;
    let finalAmount = 0;

    if (invoiceId) {
      // INVOICE AUTHORITY & IDOR / BOLA PROTECTION
      targetInvoice = db.invoices.get(invoiceId);
      if (!targetInvoice) {
        return res.status(404).json({ error: 'Referenced invoice not found.' });
      }

      // Authorization check: Client cannot pay or access another client's invoice
      const isClientRole = req.user.role === 'client' || req.user.role === 'prospective_client';
      const isOwner = targetInvoice.clientId === req.user.id || (req.user.clientId && targetInvoice.clientId === req.user.clientId);

      if (isClientRole && !isOwner) {
        db.logSecurityEvent({
          eventType: 'UNAUTHORIZED_INVOICE_PAYMENT_ATTEMPT',
          ipAddress: req.ip || 'unknown',
          userId: req.user.id,
          details: `Client ${req.user.email} attempted to pay invoice #${targetInvoice.invoiceNumber} owned by client ${targetInvoice.clientId}.`,
          severity: 'critical'
        });
        return res.status(403).json({ error: 'Forbidden: You do not have authorization to pay or inspect this invoice.' });
      }

      if (targetInvoice.status === 'paid') {
        return res.status(400).json({ error: 'Invoice has already been paid and settled.' });
      }

      // SERVER AMOUNT AUTHORITY: Authoritative amount comes from invoice, NOT browser input!
      finalAmount = Number(targetInvoice.amount);
    } else {
      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Valid payment amount is required when no invoice is referenced.' });
      }
      finalAmount = Number(amount);
    }

    let appliedDiscount = 0;

    // Support verified promotional codes (PALMETTO10 = 10% off, LEGACY25 = $25 off)
    if (discountCode) {
      const code = String(discountCode).toUpperCase().trim();
      if (code === 'PALMETTO10') {
        appliedDiscount = Math.round(finalAmount * 0.10 * 100) / 100;
        finalAmount = Math.max(0, finalAmount - appliedDiscount);
      } else if (code === 'LEGACY25') {
        appliedDiscount = 25;
        finalAmount = Math.max(0, finalAmount - appliedDiscount);
      }
    }

    finalAmount = Math.round(finalAmount * 100) / 100;

    if (targetInvoice) {
      targetInvoice.status = 'paid';
      targetInvoice.paidAt = new Date().toISOString();
      targetInvoice.paymentMethod = paymentMethod || 'Visa ending in 4242 (Stripe PCI)';
      db.invoices.set(targetInvoice.id, targetInvoice);
    } else {
      // Create new paid invoice
      const newInvId = `inv_${randomUUID()}`;
      targetInvoice = {
        id: newInvId,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        clientId: req.user.clientId || req.user.id,
        clientName: req.user.name,
        servicePlanId,
        description: description || 'A/R Tax Services Professional Engagement Settlement',
        amount: finalAmount,
        currency: currency || 'USD',
        status: 'paid',
        issuedDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        paidAt: new Date().toISOString(),
        paymentMethod: paymentMethod || 'Stripe Test Mode (PCI DSS Compliant)'
      };
      db.invoices.set(newInvId, targetInvoice);
    }

    // Record idempotent transaction record
    const recordedWebhook: WebhookRecord = {
      id: `txn_${randomUUID()}`,
      idempotencyKey: idempotencyKey || `idem_${randomUUID()}`,
      source: 'stripe',
      eventType: 'payment_intent.succeeded',
      payload: {
        invoiceId: targetInvoice.id,
        amount: finalAmount,
        discountApplied: appliedDiscount,
        currency: currency || 'USD',
        receiptNumber: `REC-${Date.now().toString().slice(-8)}`,
        settledAt: new Date().toISOString(),
        stripeChargeId: `ch_test_${randomUUID().slice(0, 16)}`
      },
      status: 'processed',
      processedAt: new Date().toISOString()
    };
    db.webhooks.set(recordedWebhook.id, recordedWebhook);

    // Update onboarding payment status if client is onboarding
    const onboarding = db.onboardingStates.get(req.user.id);
    if (onboarding) {
      onboarding.paymentMethodAuthorized = true;
      db.onboardingStates.set(req.user.id, onboarding);
    }

    db.logAudit({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'PAYMENT_SETTLED_PCI',
      resource: `Invoice #${targetInvoice.invoiceNumber}`,
      details: `Payment of $${finalAmount.toFixed(2)} USD successfully processed. Receipt: ${recordedWebhook.payload.receiptNumber}.`,
      ipAddress: req.ip || 'unknown',
      severity: 'info'
    });

    return res.status(200).json({
      success: true,
      message: 'Payment settled successfully.',
      invoice: targetInvoice,
      receipt: recordedWebhook.payload
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Payment processing failure.' });
  }
});

// Signed Webhook Verification Endpoint
paymentsRouter.post('/webhook', (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, missing webhook secret must fail closed
  if (isProduction && !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe webhook secret is not configured in production.' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_artax_sandbox_test_secret';
  const { id, type, data } = req.body || {};

  // Verify HMAC signature in production or whenever stripe-signature header is present
  if (isProduction || signature) {
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header.' });
    }

    try {
      const payload = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : JSON.stringify(req.body);
      const computed = createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const sigBuf = Buffer.from(signature);
      const compBuf = Buffer.from(computed);

      const isValid = sigBuf.length === compBuf.length && timingSafeEqual(sigBuf, compBuf);
      if (!isValid) {
        db.logSecurityEvent({
          eventType: 'STRIPE_WEBHOOK_SIGNATURE_MISMATCH',
          ipAddress: req.ip || 'unknown',
          details: 'Incoming webhook failed cryptographic HMAC signature check.',
          severity: 'critical'
        });
        return res.status(400).json({ error: 'Webhook signature verification failed.' });
      }
    } catch {
      return res.status(400).json({ error: 'Signature calculation error.' });
    }
  }

  // Duplicate webhook replay protection
  const eventId = id || `evt_${Date.now()}`;
  if (db.webhooks.has(eventId)) {
    return res.status(200).json({ received: true, status: 'duplicate_ignored' });
  }

  // If webhook contains an invoice payment confirmation, settle invoice
  if (type === 'invoice.payment_succeeded' || type === 'payment_intent.succeeded') {
    const invoiceId = data?.object?.metadata?.invoiceId || data?.invoiceId;
    if (invoiceId) {
      const inv = db.invoices.get(invoiceId);
      if (inv && inv.status !== 'paid') {
        inv.status = 'paid';
        inv.paidAt = new Date().toISOString();
        inv.paymentMethod = 'Stripe Webhook Settlement';
        db.invoices.set(inv.id, inv);
      }
    }
  }

  db.webhooks.set(eventId, {
    id: eventId,
    idempotencyKey: eventId,
    source: 'stripe',
    eventType: type || 'invoice.payment_succeeded',
    payload: data || req.body,
    status: 'processed',
    processedAt: new Date().toISOString()
  });

  return res.json({ received: true, eventId });
});

// List Invoices with strict client isolation
paymentsRouter.get('/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  let list = Array.from(db.invoices.values());
  const isClientRole = req.user.role === 'client' || req.user.role === 'prospective_client';

  if (isClientRole) {
    const userClientId = req.user.clientId;
    list = list.filter(i => i.clientId === req.user!.id || (userClientId && i.clientId === userClientId));
  } else if (['accountant', 'senior_reviewer', 'reviewer', 'preparer'].includes(req.user.role)) {
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Authorized tenant context is unavailable.' });
    list = list.filter(invoice => {
      const client = db.users.get(invoice.clientId) ||
        Array.from(db.users.values()).find(candidate =>
          ['client', 'prospective_client'].includes(candidate.role) &&
          candidate.clientId === invoice.clientId
        );
      return isStaffCurrentlyAssignedToClient({
        userId: req.user!.id,
        tenantId,
        clientId: invoice.clientId,
        clientTenantId: client?.tenantId,
        assignments: db.getClientBindings(invoice.clientId),
        authorizedClientIds: req.user!.authorizedClientIds,
        production: process.env.NODE_ENV === 'production'
      });
    });
  } else if (['admin', 'administrator', 'super_admin', 'super_administrator'].includes(req.user.role)) {
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Authorized tenant context is unavailable.' });
    list = list.filter(invoice => {
      const client = db.users.get(invoice.clientId) ||
        Array.from(db.users.values()).find(candidate =>
          ['client', 'prospective_client'].includes(candidate.role) &&
          candidate.clientId === invoice.clientId
        );
      return client?.tenantId === tenantId;
    });
  } else if (req.query.clientId && typeof req.query.clientId === 'string') {
    return res.status(403).json({ error: 'Forbidden: Invoice access is not permitted.' });
  } else {
    return res.status(403).json({ error: 'Forbidden: Invoice access is not permitted.' });
  }

  return res.json({ invoices: list });
});
