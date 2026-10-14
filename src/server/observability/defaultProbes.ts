/** Runtime probes for the health router. Every value is a fixed state code, a boolean or a count. */
import { ProviderReadinessRegistry } from '../taxguard/providerReadiness.service';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { securityEventSink } from '../taxguard/audit/securityEventSink';
import { scannerConfiguration, type ScanCoordinator } from '../taxguard/documents/malwareScanning';
import type { HealthProbes, ProbeState } from './health';

const configured = (type: 'AUTHENTICATION' | 'STORAGE'): ProbeState => ProviderReadinessRegistry.getProviderStatus(type).status === 'CONFIGURED' ? 'OK' : 'NOT_CONFIGURED';

export function runtimeProbes(opts: { scanCoordinator?: () => ScanCoordinator | null } = {}): HealthProbes {
  return {
    async database() {
      const r = await ProviderReadinessRegistry.checkDatabaseSchemaReadiness();
      return { state: r.state === 'DATABASE_UNAVAILABLE' ? 'UNAVAILABLE' : 'OK', schema: r.state };
    },
    identity: () => configured('AUTHENTICATION'),
    storage: () => configured('STORAGE'),
    async scanner() {
      const c = scannerConfiguration(process.env);
      const state = c.state === 'REFUSED' ? c.code : c.state;
      const coordinator = opts.scanCoordinator?.();
      const tenant = process.env.TAXGUARD_TENANT_ID || '';
      if (!coordinator || !/^[A-Za-z0-9_-]{1,128}$/.test(tenant)) return { state };
      try { return { state, backlog: await coordinator.backlog(tenant) }; } catch { return { state: 'BACKLOG_UNAVAILABLE' }; }
    },
    ai: () => ({ state: ProviderReadinessRegistry.getProviderStatus('AI').status, materialActions: 'BLOCKED', providerCommissioned: false }),
    securityEvents() {
      const sink = securityEventSink();
      return sink ? { mode: 'DURABLE', ...sink.stats() } : { mode: 'MEMORY_ONLY' };
    },
    environment: () => ({ nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : process.env.NODE_ENV === 'test' ? 'test' : 'development',
      deployment: /^[a-z-]{1,20}$/.test(process.env.TAXGUARD_DEPLOYMENT_ENVIRONMENT || '') ? process.env.TAXGUARD_DEPLOYMENT_ENVIRONMENT! : 'unspecified',
      durableStore: practiceStoreConfigured() }),
  };
}
