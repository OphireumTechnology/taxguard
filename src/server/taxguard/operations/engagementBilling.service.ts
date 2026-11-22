class EngagementBillingService {
  private catalog: any[] = [];
  private invoices = new Map<string, any>();

  async handleStripeWebhook(_payload: string, _signature: string, _secret: string): Promise<any> {
    throw Object.assign(new Error('PAYMENT_PROVIDER_NOT_COMMISSIONED'), {
      code: 'PAYMENT_PROVIDER_NOT_COMMISSIONED',
      status: 503,
    });
  }

  getServiceCatalog(tenantId?: string): any[] {
    return this.catalog.filter((item) => !tenantId || item.tenantId === tenantId);
  }

  addServiceToCatalog(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_BILLING_STORE_REQUIRED'), {
      code: 'DURABLE_BILLING_STORE_REQUIRED',
      status: 503,
    });
  }

  queryInvoices(filter?: { tenantId?: string; clientId?: string; status?: string; [key: string]: any }): any[] {
    return Array.from(this.invoices.values()).filter((inv) => {
      if (filter?.tenantId && inv.tenantId !== filter.tenantId) return false;
      if (filter?.clientId && inv.clientId !== filter.clientId) return false;
      if (filter?.status && inv.status !== filter.status) return false;
      return true;
    });
  }

  getInvoice(invoiceId: string, _tenantId?: string): any | null {
    return this.invoices.get(invoiceId) ?? null;
  }

  createDraftInvoice(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_BILLING_STORE_REQUIRED'), {
      code: 'DURABLE_BILLING_STORE_REQUIRED',
      status: 503,
    });
  }

  issueInvoice(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_BILLING_STORE_REQUIRED'), {
      code: 'DURABLE_BILLING_STORE_REQUIRED',
      status: 503,
    });
  }

  voidInvoice(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_BILLING_STORE_REQUIRED'), {
      code: 'DURABLE_BILLING_STORE_REQUIRED',
      status: 503,
    });
  }

  recordPayment(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_BILLING_STORE_REQUIRED'), {
      code: 'DURABLE_BILLING_STORE_REQUIRED',
      status: 503,
    });
  }
}

export const globalEngagementBillingService = new EngagementBillingService();
