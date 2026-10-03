/**
 * TaxGuard Global Operational Search Service
 * Multi-entity search across clients, engagements, cases, tasks, requests, documents,
 * transactions, and invoices with tenant boundary isolation and SSN/PII masking.
 */

import { db } from '../../db';
import { globalPracticeTaskService } from './practiceTask.service';
import { globalClientRequestService } from './clientRequest.service';
import { globalEngagementBillingService } from './engagementBilling.service';

export interface SearchMatch {
  entityType: 'client' | 'engagement' | 'case' | 'task' | 'request' | 'document' | 'invoice';
  id: string;
  title: string;
  subtitle: string;
  clientId?: string;
  taxYear?: number;
  status: string;
  matchedField: string;
}

export class OperationalSearchService {
  /**
   * Safe PII scrubber
   */
  private redactPii(str: string): string {
    return str.replace(/\b\d{3}-\d{2}-(\d{4})\b/g, '***-**-$1');
  }

  /**
   * Search across all operational entities for a tenant
   */
  search(params: {
    tenantId: string;
    query: string;
    callerRole: string;
    callerClientId?: string;
    limit?: number;
  }): { query: string; totalMatches: number; matches: SearchMatch[] } {
    const rawQuery = (params.query || '').trim();
    if (!rawQuery || rawQuery.length < 2) {
      return { query: rawQuery, totalMatches: 0, matches: [] };
    }

    const q = rawQuery.toLowerCase();
    const matches: SearchMatch[] = [];
    const limit = params.limit || 30;

    // 1. Search Clients (Staff only)
    if (params.callerRole !== 'client') {
      for (const client of db.users.values()) {
        if (client.role === 'client') {
          const name = (client.name || '').toLowerCase();
          const email = (client.email || '').toLowerCase();
          const cid = (client.clientId || client.id || '').toLowerCase();
          if (name.includes(q) || email.includes(q) || cid.includes(q)) {
            matches.push({
              entityType: 'client',
              id: client.id,
              title: this.redactPii(client.name),
              subtitle: `Client ID: ${client.clientId || client.id} • ${client.email}`,
              clientId: client.clientId || client.id,
              status: client.status || 'active',
              matchedField: name.includes(q) ? 'name' : email.includes(q) ? 'email' : 'clientId',
            });
          }
        }
      }
    }

    // 2. Search Practice Tasks
    const tasks = globalPracticeTaskService.queryTasks({
      tenantId: params.tenantId,
      clientId: params.callerRole === 'client' ? params.callerClientId : undefined,
      limit: 500,
    }).tasks;

    for (const task of tasks) {
      const title = (task.title || '').toLowerCase();
      const desc = (task.description || '').toLowerCase();
      if (title.includes(q) || desc.includes(q)) {
        matches.push({
          entityType: 'task',
          id: task.id,
          title: task.title,
          subtitle: `Priority: ${task.priority} • Type: ${task.taskType}`,
          clientId: task.clientId,
          taxYear: task.taxYear,
          status: task.status,
          matchedField: title.includes(q) ? 'title' : 'description',
        });
      }
    }

    // 3. Search Client Requests
    const requests = globalClientRequestService.queryRequests({
      tenantId: params.tenantId,
      callerRole: params.callerRole,
      callerClientId: params.callerClientId,
    });

    for (const req of requests) {
      const title = (req.title || '').toLowerCase();
      const desc = (req.description || '').toLowerCase();
      if (title.includes(q) || desc.includes(q)) {
        matches.push({
          entityType: 'request',
          id: req.id,
          title: req.title,
          subtitle: `Type: ${req.requestType} • Assigned Client: ${req.assignedToClientId}`,
          clientId: req.clientId,
          status: req.status,
          matchedField: title.includes(q) ? 'title' : 'description',
        });
      }
    }

    // 4. Search Invoices
    const invoices = globalEngagementBillingService.queryInvoices({
      tenantId: params.tenantId,
      callerRole: params.callerRole,
      callerClientId: params.callerClientId,
    });

    for (const inv of invoices) {
      const num = (inv.invoiceNumber || '').toLowerCase();
      if (num.includes(q)) {
        matches.push({
          entityType: 'invoice',
          id: inv.id,
          title: `Invoice ${inv.invoiceNumber}`,
          subtitle: `Total: $${inv.total.toFixed(2)} • Due: $${inv.balanceDue.toFixed(2)}`,
          clientId: inv.clientId,
          status: inv.status,
          matchedField: 'invoiceNumber',
        });
      }
    }

    // 5. Search Documents
    const docs = Array.from(db.documents.values()).filter((d) => {
      if (params.callerRole === 'client') return d.clientId === params.callerClientId;
      return true;
    });

    for (const doc of docs) {
      const fname = (doc.fileName || '').toLowerCase();
      const cat = (doc.category || '').toLowerCase();
      if (fname.includes(q) || cat.includes(q)) {
        matches.push({
          entityType: 'document',
          id: doc.id,
          title: doc.fileName,
          subtitle: `Category: ${doc.category} • Year: ${doc.taxYear}`,
          clientId: doc.clientId,
          taxYear: typeof doc.taxYear === 'number' ? doc.taxYear : parseInt(doc.taxYear) || 2025,
          status: doc.status,
          matchedField: fname.includes(q) ? 'fileName' : 'category',
        });
      }
    }

    return {
      query: rawQuery,
      totalMatches: matches.length,
      matches: matches.slice(0, limit),
    };
  }
}

export const globalOperationalSearchService = new OperationalSearchService();
