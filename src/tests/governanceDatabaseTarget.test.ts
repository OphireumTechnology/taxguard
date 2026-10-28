import { describe, expect, it } from 'vitest';
import { governanceDatabaseTarget } from '../server/ai/governance/productionGovernance';

describe('AI governance database target', () => {
  it('production uses DATABASE_URL over TLS and ignores any local override', () => {
    expect(governanceDatabaseTarget({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@db.example.invalid:5432/x', TAXGUARD_AI_GOVERNANCE_LOCAL_DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/x' }))
      .toEqual({ url: 'postgres://u:p@db.example.invalid:5432/x', tls: true });
    expect(governanceDatabaseTarget({ NODE_ENV: 'production', TAXGUARD_AI_GOVERNANCE_LOCAL_DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/x' })).toBeNull();
  });
  it('outside production accepts only an explicit loopback PostgreSQL URL, without TLS', () => {
    for (const host of ['127.0.0.1', 'localhost', '[::1]'])
      expect(governanceDatabaseTarget({ NODE_ENV: 'development', TAXGUARD_AI_GOVERNANCE_LOCAL_DATABASE_URL: `postgres://u:p@${host}:5432/x` })).toEqual({ url: `postgres://u:p@${host}:5432/x`, tls: false });
    expect(governanceDatabaseTarget({ NODE_ENV: 'development', DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/x' })).toBeNull();
  });
  it('refuses remote hosts, other protocols and malformed values locally', () => {
    for (const url of ['postgres://u:p@db.example.invalid:5432/x', 'postgres://u:p@10.0.0.5:5432/x', 'postgres://u:p@127.0.0.1.example.invalid/x',
      'mysql://u:p@127.0.0.1/x', 'https://127.0.0.1/x', 'not a url', ''])
      expect(governanceDatabaseTarget({ NODE_ENV: 'test', TAXGUARD_AI_GOVERNANCE_LOCAL_DATABASE_URL: url }), url).toBeNull();
  });
});
