import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHmac } from 'crypto';
import { paymentsRouter } from '../server/routes/payments.routes';
import { db } from '../server/db';
import { createSession } from '../server/auth';
import type { Invoice } from '../types';

let server: Server;
let origin: string;
const testSecret = 'whsec_test_secret_for_payments_unit_testing';

let tokenClient1: string;
let tokenClient2: string;
let tokenAdmin: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentsRouter);

  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;

  db.sessions.clear();
  db.invoices.clear();

  // Seed client user 1
  const clientUser1 = {
    id: 'user_client_test_1',
    email: 'client1@artaxservices.com',
    name: 'Alice Client',
    role: 'client' as const,
    clientId: 'CL-001',
    status: 'active' as const,
    isVerified: true,
    createdAt: new Date().toISOString()
  };
  db.users.set(clientUser1.id, clientUser1);
  tokenClient1 = createSession(clientUser1.id, clientUser1.role);

  // Seed client user 2
  const clientUser2 = {
    id: 'user_client_test_2',
    email: 'client2@artaxservices.com',
    name: 'Bob Client',
    role: 'client' as const,
    clientId: 'CL-002',
    status: 'active' as const,
    isVerified: true,
    createdAt: new Date().toISOString()
  };
  db.users.set(clientUser2.id, clientUser2);
  tokenClient2 = createSession(clientUser2.id, clientUser2.role);

  // Seed admin user
  const adminUser = {
    id: 'user_admin_test',
    email: 'admin@artaxservices.com',
    name: 'Victoria Reynolds',
    role: 'admin' as const,
    status: 'active' as const,
    isVerified: true,
    createdAt: new Date().toISOString()
  };
  db.users.set(adminUser.id, adminUser);
  tokenAdmin = createSession(adminUser.id, adminUser.role);

  // Seed invoices
  const inv1: Invoice = {
    id: 'inv_client1_1040',
    invoiceNumber: 'INV-100001',
    clientId: 'user_client_test_1',
    clientName: 'Alice Client',
    description: 'Individual 1040 Tax Preparation',
    amount: 850.00,
    currency: 'USD',
    status: 'pending',
    issuedDate: '2026-09-01',
    dueDate: '2026-10-01'
  };
  db.invoices.set(inv1.id, inv1);

  const inv2: Invoice = {
    id: 'inv_client2_1120s',
    invoiceNumber: 'INV-100002',
    clientId: 'user_client_test_2',
    clientName: 'Bob Client',
    description: 'S-Corporation 1120-S Advisory',
    amount: 1500.00,
    currency: 'USD',
    status: 'pending',
    issuedDate: '2026-09-01',
    dueDate: '2026-10-01'
  };
  db.invoices.set(inv2.id, inv2);
});

describe('Payments Route Authority and Security Gate', () => {
  it('requires authentication for charge endpoint (401)', async () => {
    const res = await fetch(`${origin}/api/payments/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100 })
    });
    expect(res.status).toBe(401);
  });

  it('rejects missing or non-positive amount when no invoice referenced (400)', async () => {
    const res = await fetch(`${origin}/api/payments/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClient1}`
      },
      body: JSON.stringify({ amount: 0 })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/valid payment amount is required/i);
  });

  it('rejects referenced invoice that does not exist (404)', async () => {
    const res = await fetch(`${origin}/api/payments/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClient1}`
      },
      body: JSON.stringify({ invoiceId: 'inv_nonexistent_9999' })
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/referenced invoice not found/i);
  });

  it('enforces IDOR / BOLA authorization: client 1 cannot pay client 2 invoice (403)', async () => {
    const res = await fetch(`${origin}/api/payments/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClient1}`
      },
      body: JSON.stringify({ invoiceId: 'inv_client2_1120s' })
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it('enforces server amount authority: client cannot underpay target invoice', async () => {
    // Client 1 attempts to pass amount: 1.00 for $850.00 invoice
    const res = await fetch(`${origin}/api/payments/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClient1}`
      },
      body: JSON.stringify({
        invoiceId: 'inv_client1_1040',
        amount: 1.00 // Client tampering attempt
      })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Server must enforce the authoritative invoice amount ($850.00), not $1.00
    expect(body.receipt.amount).toBe(850.00);
    expect(body.invoice.amount).toBe(850.00);
    expect(body.invoice.status).toBe('paid');
  });

  it('rejects duplicate payment on already settled invoice (400)', async () => {
    // Settle first
    const inv = db.invoices.get('inv_client1_1040')!;
    inv.status = 'paid';
    db.invoices.set(inv.id, inv);

    const res = await fetch(`${origin}/api/payments/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClient1}`
      },
      body: JSON.stringify({ invoiceId: 'inv_client1_1040' })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already been paid/i);
  });

  it('provides mutation idempotency replay on duplicate idempotency key', async () => {
    const idemKey = `idem_test_${Date.now()}`;

    const res1 = await fetch(`${origin}/api/payments/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClient1}`
      },
      body: JSON.stringify({
        invoiceId: 'inv_client1_1040',
        idempotencyKey: idemKey
      })
    });

    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);

    // Second request with same idempotency key
    const res2 = await fetch(`${origin}/api/payments/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenClient1}`
      },
      body: JSON.stringify({
        invoiceId: 'inv_client1_1040',
        idempotencyKey: idemKey
      })
    });

    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.idempotentReplay).toBe(true);
    expect(body2.transaction.invoiceId).toBe('inv_client1_1040');
  });

  it('validates signed Stripe webhook and updates invoice state', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', testSecret);

    const eventPayload = {
      id: `evt_${Date.now()}`,
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          metadata: {
            invoiceId: 'inv_client2_1120s'
          }
        }
      }
    };

    const payloadString = JSON.stringify(eventPayload);
    const signature = createHmac('sha256', testSecret).update(payloadString).digest('hex');

    const res = await fetch(`${origin}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature
      },
      body: payloadString
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);

    const updatedInv = db.invoices.get('inv_client2_1120s');
    expect(updatedInv?.status).toBe('paid');
    vi.unstubAllEnvs();
  });

  it('rejects invalid signature on Stripe webhook (400)', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', testSecret);

    const eventPayload = {
      id: `evt_${Date.now()}`,
      type: 'payment_intent.succeeded'
    };

    const res = await fetch(`${origin}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid_signature_hex_digest'
      },
      body: JSON.stringify(eventPayload)
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/signature verification failed/i);
    vi.unstubAllEnvs();
  });

  it('fails closed in production if webhook secret is missing (503)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const res = await fetch(`${origin}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'sig'
      },
      body: JSON.stringify({ id: 'evt_1' })
    });

    expect(res.status).toBe(503);
    vi.unstubAllEnvs();
  });

  it('isolates invoice listings by client (client 1 only sees their invoice)', async () => {
    const res = await fetch(`${origin}/api/payments/invoices`, {
      headers: {
        Authorization: `Bearer ${tokenClient1}`
      }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoices.length).toBe(1);
    expect(body.invoices[0].id).toBe('inv_client1_1040');
  });

  it('allows admin to view all invoices across all clients', async () => {
    const res = await fetch(`${origin}/api/payments/invoices`, {
      headers: {
        Authorization: `Bearer ${tokenAdmin}`
      }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoices.length).toBe(2);
  });
});
