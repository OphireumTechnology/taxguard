/**
 * TaxGuard Engagement Management & Deterministic Invoicing Service
 * Controls service catalog, explicit engagement scopes, deterministic money billing,
 * invoice lifecycles (DRAFT, ISSUED, PARTIALLY_PAID, PAID, PAST_DUE, VOID),
 * and Stripe payment provider boundaries with durable webhook idempotency.
 */

import { randomUUID, createHmac } from 'node:crypto';
import {
  ServiceCatalogItem,
  EngagementDossier,
  EngagementLifecycleStatus,
  InvoiceRecord,
  InvoiceLineItem,
  InvoicePaymentRecord,
  InvoiceStatus,
  computeInvoiceTotals,
  roundCurrency
} from './types';
import { globalDurableIdempotencyService } from './durableIdempotency.service';

export class EngagementBillingService {
  private catalog = new Map<string, ServiceCatalogItem>();
  private engagements = new Map<string, EngagementDossier>();
  private invoices = new Map<string, InvoiceRecord>();
  private payments: InvoicePaymentRecord[] = [];

  constructor() {
    this.seedDefaultCatalog();
  }

  private seedDefaultCatalog(): void {
    const defaults: Array<Omit<ServiceCatalogItem, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        tenantId: 'tenantA',
        serviceCode: 'SVC_1040_INDIVIDUAL',
        name: 'Individual Form 1040 Tax Preparation',
        description: 'Federal Form 1040 and resident state filing with standard deduction and tax credit optimization.',
        category: 'INDIVIDUAL_TAX',
        billingMethod: 'FLAT_FEE',
        baseFee: 450.0,
        isActive: true,
      },
      {
        tenantId: 'tenantA',
        serviceCode: 'SVC_1120S_CORP',
        name: 'S-Corporation Form 1120-S Compliance',
        description: 'Federal Form 1120-S corporate return, Schedule K-1 distribution schedules, and state filings.',
        category: 'BUSINESS_TAX',
        billingMethod: 'FLAT_FEE',
        baseFee: 1250.0,
        isActive: true,
      },
      {
        tenantId: 'tenantA',
        serviceCode: 'SVC_BOOKKEEPING_MONTHLY',
        name: 'Monthly General Ledger Reconciliation',
        description: 'Double-entry general ledger reconciliation, adjusting entries, and GAAP financial statements.',
        category: 'BOOKKEEPING',
        billingMethod: 'SUBSCRIPTION',
        baseFee: 650.0,
        isActive: true,
      },
      {
        tenantId: 'tenantA',
        serviceCode: 'SVC_TAX_PLANNING_ADVISORY',
        name: 'Strategic Tax Advisory & QBI Planning',
        description: 'Multi-year tax minimization modeling, Section 199A qualification, and entity structuring.',
        category: 'ADVISORY',
        billingMethod: 'FLAT_FEE',
        baseFee: 850.0,
        isActive: true,
      },
    ];

    const now = new Date().toISOString();
    for (const item of defaults) {
      const id = `cat_${item.serviceCode}`;
      this.catalog.set(`${item.tenantId}::${item.serviceCode}`, {
        ...item,
        id,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // ============================================================
  // 1. SERVICE CATALOG
  // ============================================================

  getServiceCatalog(tenantId: string): ServiceCatalogItem[] {
    const existing = Array.from(this.catalog.values()).filter((c) => c.tenantId === tenantId && c.isActive);
    if (existing.length === 0 && tenantId) {
      const templateItems = Array.from(this.catalog.values()).filter((c) => c.tenantId === 'tenantA' && c.isActive);
      const now = new Date().toISOString();
      for (const item of templateItems) {
        this.catalog.set(`${tenantId}::${item.serviceCode}`, {
          ...item,
          id: `cat_${tenantId}_${item.serviceCode}`,
          tenantId,
          createdAt: now,
          updatedAt: now,
        });
      }
      return Array.from(this.catalog.values()).filter((c) => c.tenantId === tenantId && c.isActive);
    }
    return existing;
  }

  async addServiceToCatalog(params: Omit<ServiceCatalogItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceCatalogItem> {
    const now = new Date().toISOString();
    const id = `cat_${params.serviceCode}`;
    const item: ServiceCatalogItem = {
      ...params,
      id,
      baseFee: roundCurrency(params.baseFee),
      createdAt: now,
      updatedAt: now,
    };
    this.catalog.set(`${params.tenantId}::${params.serviceCode}`, item);
    return item;
  }

  // ============================================================
  // 2. ENGAGEMENT MANAGEMENT & SCOPE AUTHORIZATION
  // ============================================================

  async createEngagement(params: {
    tenantId: string;
    clientId: string;
    engagementCode: string;
    taxYear: number;
    authorizedServices: string[];
    responsibleAccountantId?: string;
    responsibleReviewerId?: string;
    totalContractValue?: number;
  }): Promise<EngagementDossier> {
    const id = `eng_${randomUUID()}`;
    const now = new Date().toISOString();

    const engagement: EngagementDossier = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      engagementCode: params.engagementCode,
      taxYear: params.taxYear,
      status: 'DRAFT',
      authorizedServices: params.authorizedServices,
      responsibleAccountantId: params.responsibleAccountantId,
      responsibleReviewerId: params.responsibleReviewerId,
      termsAgreed: false,
      consents: {},
      totalContractValue: roundCurrency(params.totalContractValue || 0),
      createdAt: now,
      updatedAt: now,
    };

    this.engagements.set(id, engagement);
    return engagement;
  }

  /**
   * Enforce explicit engagement scope check
   * A tax preparation engagement does NOT authorize bookkeeping write-back;
   * A bookkeeping engagement does NOT authorize tax filing.
   */
  hasServiceScope(engagementId: string, requiredServiceCode: string): boolean {
    const eng = this.engagements.get(engagementId);
    if (!eng || eng.status !== 'ACTIVE') return false;
    return eng.authorizedServices.includes(requiredServiceCode);
  }

  async updateEngagementStatus(
    engagementId: string,
    status: EngagementLifecycleStatus,
    termsAgreed?: boolean
  ): Promise<EngagementDossier> {
    const eng = this.engagements.get(engagementId);
    if (!eng) throw new Error(`ENGAGEMENT_NOT_FOUND: ${engagementId}`);

    const now = new Date().toISOString();
    eng.status = status;
    if (termsAgreed !== undefined) {
      eng.termsAgreed = termsAgreed;
      if (termsAgreed) {
        eng.termsAgreedAt = now;
        eng.termsHash = `hash_${randomUUID().slice(0, 8)}`;
      }
    }
    eng.updatedAt = now;
    this.engagements.set(engagementId, eng);
    return eng;
  }

  getEngagement(engagementId: string): EngagementDossier | undefined {
    return this.engagements.get(engagementId);
  }

  // ============================================================
  // 3. DETERMINISTIC INVOICING
  // ============================================================

  async createDraftInvoice(params: {
    tenantId: string;
    clientId: string;
    engagementId?: string;
    dueDate: string;
    lines: Array<{ serviceCode: string; description: string; quantity: number; unitRate: number }>;
    adjustments?: number;
    tax?: number;
    createdBy: string;
  }): Promise<InvoiceRecord> {
    const id = `inv_${randomUUID()}`;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const { subtotal, total } = computeInvoiceTotals(params.lines, params.adjustments || 0, params.tax || 0);

    const lineItems: InvoiceLineItem[] = params.lines.map((l) => ({
      id: randomUUID(),
      invoiceId: id,
      serviceCode: l.serviceCode,
      description: l.description,
      quantity: l.quantity,
      unitRate: roundCurrency(l.unitRate),
      amount: roundCurrency(l.quantity * l.unitRate),
    }));

    const invoice: InvoiceRecord = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      engagementId: params.engagementId,
      invoiceNumber,
      status: 'DRAFT',
      lines: lineItems,
      subtotal,
      adjustments: roundCurrency(params.adjustments || 0),
      tax: roundCurrency(params.tax || 0),
      total,
      amountPaid: 0.0,
      balanceDue: total,
      currency: 'USD',
      dueDate: params.dueDate,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.invoices.set(id, invoice);
    return invoice;
  }

  async issueInvoice(invoiceId: string, issuedByUid: string): Promise<InvoiceRecord> {
    const inv = this.invoices.get(invoiceId);
    if (!inv) throw new Error(`INVOICE_NOT_FOUND: ${invoiceId}`);
    if (inv.status !== 'DRAFT') {
      throw new Error(`INVALID_STATUS_FOR_ISSUE: Cannot issue invoice in status ${inv.status}`);
    }

    const now = new Date().toISOString();
    inv.status = 'ISSUED';
    inv.issueDate = now.split('T')[0];
    inv.issuedBy = issuedByUid;
    inv.updatedAt = now;
    this.invoices.set(invoiceId, inv);
    return inv;
  }

  async voidInvoice(invoiceId: string, voidedByUid: string, reason: string): Promise<InvoiceRecord> {
    const inv = this.invoices.get(invoiceId);
    if (!inv) throw new Error(`INVOICE_NOT_FOUND: ${invoiceId}`);
    if (inv.amountPaid > 0) {
      throw new Error('CANNOT_VOID_PAID_INVOICE: Invoices with recorded payments cannot be voided; use credit note.');
    }

    const now = new Date().toISOString();
    inv.status = 'VOID';
    inv.voidReason = reason;
    inv.voidedBy = voidedByUid;
    inv.voidedAt = now;
    inv.balanceDue = 0;
    inv.updatedAt = now;
    this.invoices.set(invoiceId, inv);
    return inv;
  }

  async recordPayment(params: {
    tenantId: string;
    invoiceId: string;
    clientId: string;
    amount: number;
    paymentMethod: InvoicePaymentRecord['paymentMethod'];
    recordedBy: string;
    providerTransactionId?: string;
    idempotencyKey?: string;
  }): Promise<{ payment: InvoicePaymentRecord; invoice: InvoiceRecord }> {
    const inv = this.invoices.get(params.invoiceId);
    if (!inv) throw new Error(`INVOICE_NOT_FOUND: ${params.invoiceId}`);
    if (inv.status === 'VOID') throw new Error('CANNOT_PAY_VOID_INVOICE');

    const paymentAmount = roundCurrency(params.amount);
    if (paymentAmount <= 0) throw new Error('INVALID_PAYMENT_AMOUNT: Amount must be positive');

    const newAmountPaid = roundCurrency(inv.amountPaid + paymentAmount);
    const newBalanceDue = roundCurrency(Math.max(0, inv.total - newAmountPaid));

    let newStatus: InvoiceStatus = inv.status;
    if (newBalanceDue === 0) {
      newStatus = 'PAID';
    } else if (newAmountPaid > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    inv.amountPaid = newAmountPaid;
    inv.balanceDue = newBalanceDue;
    inv.status = newStatus;
    inv.updatedAt = new Date().toISOString();

    const payment: InvoicePaymentRecord = {
      id: `pay_${randomUUID()}`,
      tenantId: params.tenantId,
      invoiceId: params.invoiceId,
      clientId: params.clientId,
      amount: paymentAmount,
      paymentMethod: params.paymentMethod,
      status: 'SETTLED',
      providerTransactionId: params.providerTransactionId,
      idempotencyKey: params.idempotencyKey,
      recordedBy: params.recordedBy,
      createdAt: new Date().toISOString(),
    };

    this.payments.push(payment);
    this.invoices.set(params.invoiceId, inv);

    return { payment, invoice: inv };
  }

  // ============================================================
  // 4. STRIPE WEBHOOK & PROVIDER BOUNDARY
  // ============================================================

  /**
   * Verify Stripe Webhook HMAC signature and enforce durable deduplication
   */
  async handleStripeWebhook(
    payloadString: string,
    signatureHeader: string,
    secret: string
  ): Promise<{ status: 'PROCESSED' | 'DUPLICATE_IGNORED'; eventType: string }> {
    if (!secret) {
      throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED: Missing STRIPE_WEBHOOK_SECRET');
    }

    // Verify HMAC SHA-256 signature
    const signatureParts = signatureHeader.split(',').reduce((acc, part) => {
      const [k, v] = part.trim().split('=');
      if (k && v) acc[k] = v;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = signatureParts['t'];
    const expectedSig = signatureParts['v1'];

    if (!timestamp || !expectedSig) {
      throw new Error('INVALID_STRIPE_SIGNATURE_HEADER');
    }

    const signedPayload = `${timestamp}.${payloadString}`;
    const hmac = createHmac('sha256', secret).update(signedPayload).digest('hex');

    if (hmac !== expectedSig) {
      throw new Error('STRIPE_SIGNATURE_VERIFICATION_FAILED');
    }

    const event = JSON.parse(payloadString) as { id: string; type: string; data?: any };
    const idempotencyKey = `stripe_event_${event.id}`;
    const invoiceId = event.data?.object?.metadata?.invoiceId;
    const matchedInv = invoiceId ? this.invoices.get(invoiceId) : undefined;
    const configuredTenant = (process.env.TAXGUARD_TENANT_ID || '').trim();
    if (process.env.NODE_ENV === 'production' && !configuredTenant && !matchedInv?.tenantId) {
      throw new Error('PRODUCTION_TENANT_REQUIRED: Missing authoritative production TAXGUARD_TENANT_ID.');
    }
    const webhookTenantId = matchedInv?.tenantId || configuredTenant || 'tenantA';

    // Durable idempotency check
    const acquire = await globalDurableIdempotencyService.acquire(
      webhookTenantId,
      'STRIPE_WEBHOOK',
      'STRIPE',
      idempotencyKey,
      event.id
    );

    if (acquire.status === 'COMPLETED') {
      return { status: 'DUPLICATE_IGNORED', eventType: event.type };
    }

    // Process event
    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const amount = (event.data?.object?.amount || 0) / 100;
      if (invoiceId && amount > 0) {
        const inv = this.invoices.get(invoiceId);
        if (inv) {
          await this.recordPayment({
            tenantId: inv.tenantId,
            invoiceId,
            clientId: inv.clientId,
            amount,
            paymentMethod: 'STRIPE',
            recordedBy: 'stripe_webhook',
            providerTransactionId: event.id,
            idempotencyKey,
          });
        }
      }
    }

    if (acquire.status === 'ACQUIRED') {
      await globalDurableIdempotencyService.complete(
        webhookTenantId,
        'STRIPE_WEBHOOK',
        idempotencyKey,
        { eventId: event.id, eventType: event.type }
      );
    }

    return { status: 'PROCESSED', eventType: event.type };
  }

  // ============================================================
  // 5. CLIENT & STAFF QUERIES
  // ============================================================

  queryInvoices(params: {
    tenantId: string;
    clientId?: string;
    status?: InvoiceStatus;
    callerRole: string;
    callerClientId?: string;
  }): InvoiceRecord[] {
    let list = Array.from(this.invoices.values()).filter((i) => i.tenantId === params.tenantId);

    if (params.callerRole === 'client') {
      // Client isolation: only client's own invoices, and NO drafts unless issued
      list = list.filter((i) => i.clientId === params.callerClientId && i.status !== 'DRAFT');
    } else if (params.clientId) {
      list = list.filter((i) => i.clientId === params.clientId);
    }

    if (params.status) {
      list = list.filter((i) => i.status === params.status);
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  clear(): void {
    this.catalog.clear();
    this.engagements.clear();
    this.invoices.clear();
    this.payments = [];
    this.seedDefaultCatalog();
  }
}

export const globalEngagementBillingService = new EngagementBillingService();
