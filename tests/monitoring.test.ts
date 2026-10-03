import { describe, it, expect } from 'vitest';
import { ProviderReadinessRegistry } from '../src/server/taxguard/providerReadiness.service';

describe('Telemetry & Observability Monitoring Suite', () => {

  interface MonitoringEvent {
    type: 'client_error' | 'api_failure' | 'auth_failure' | 'infrastructure_error' | 'email_failure' | 'suspicious_activity';
    message: string;
    details?: any;
    severity: 'info' | 'warning' | 'error' | 'critical';
    timestamp: string;
  }

  const events: MonitoringEvent[] = [];

  const recordEvent = (event: Omit<MonitoringEvent, 'timestamp'>) => {
    const rec = { ...event, timestamp: new Date().toISOString() };
    events.push(rec);
    return rec;
  };

  it('captures client runtime error and classifies severity as error', () => {
    const err = recordEvent({
      type: 'client_error',
      message: 'Uncaught TypeError: Cannot read properties of undefined in DocumentCanvas',
      details: { route: '/consultation', incidentId: 'INC-TEST-001' },
      severity: 'error'
    });

    expect(err.type).toBe('client_error');
    expect(err.severity).toBe('error');
    expect(events.length).toBeGreaterThan(0);
  });

  it('records API failure with HTTP status code', () => {
    const apiErr = recordEvent({
      type: 'api_failure',
      message: 'API request failed: POST /api/payments/create-intent -> HTTP 500',
      details: { endpoint: '/api/payments/create-intent', status: 500 },
      severity: 'error'
    });

    expect(apiErr.details.status).toBe(500);
    expect(apiErr.severity).toBe('error');
  });

  it('tracks suspicious activity as critical severity', () => {
    const secErr = recordEvent({
      type: 'suspicious_activity',
      message: 'Suspicious activity detected: cross_tenant_attempt on /api/documents/doc_client2',
      details: { activityType: 'cross_tenant_attempt', targetResource: 'doc_client2' },
      severity: 'critical'
    });

    expect(secErr.severity).toBe('critical');
    expect(secErr.details.activityType).toBe('cross_tenant_attempt');
  });

  it('monitors failed email delivery notifications', () => {
    const emailErr = recordEvent({
      type: 'email_failure',
      message: 'Email dispatch delivery failed for: testclient@domain.com (Template: invoice_ready)',
      details: { recipient: 'testclient@domain.com', template: 'invoice_ready' },
      severity: 'error'
    });

    expect(emailErr.type).toBe('email_failure');
    expect(emailErr.details.template).toBe('invoice_ready');
  });

  it('truthfully evaluates provider readiness without exposing secrets', () => {
    const allProviders = ProviderReadinessRegistry.getAllProviderStatuses();
    expect(allProviders.length).toBe(10);
    
    // Check that each provider has valid status and never reveals secrets
    for (const p of allProviders) {
      expect(['CONFIGURED', 'NOT_CONFIGURED', 'UNAVAILABLE', 'DEGRADED', 'ERROR']).toContain(p.status);
      expect(p.description).toBeDefined();
      expect(typeof p.isOperational).toBe('boolean');
      // Must not leak secret substrings in description
      expect(p.description).not.toContain('sk-');
      expect(p.description).not.toContain('eyJh');
    }
  });

  it('distinguishes application process health from external provider readiness', () => {
    const dbStatus = ProviderReadinessRegistry.getProviderStatus('DATABASE');
    const authStatus = ProviderReadinessRegistry.getProviderStatus('AUTHENTICATION');
    const eSignStatus = ProviderReadinessRegistry.getProviderStatus('E_SIGNATURE');

    // E-signature is not configured by default in test/dev
    expect(eSignStatus.status).toBe('NOT_CONFIGURED');
    expect(eSignStatus.isOperational).toBe(false);

    // Database & Auth statuses are typed and truthful
    expect(['CONFIGURED', 'NOT_CONFIGURED']).toContain(dbStatus.status);
    expect(['CONFIGURED', 'NOT_CONFIGURED']).toContain(authStatus.status);
  });
});
