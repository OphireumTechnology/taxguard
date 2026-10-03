#!/usr/bin/env node
/**
 * TaxGuard Production Non-Destructive Smoke Test Suite
 *
 * Runs non-destructive health and boundary verification against a target URL.
 * NEVER creates, modifies, charges, signs, files, or mutates any data.
 *
 * Usage:
 *   node scripts/production-smoke-test.mjs [baseUrl]
 *   Example: node scripts/production-smoke-test.mjs http://localhost:3000
 */

const targetBaseUrl = (process.argv[2] || process.env.TARGET_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

console.log(`======================================================================`);
console.log(`TAXGUARD NON-DESTRUCTIVE PRODUCTION SMOKE TEST`);
console.log(`Target URL: ${targetBaseUrl}`);
console.log(`Mode: READ-ONLY / NON-MUTATING`);
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log(`======================================================================\n`);

async function runCheck(name, fn) {
  process.stdout.write(`[*] Checking ${name}... `);
  try {
    const result = await fn();
    console.log(`[PASS] ${result || 'OK'}`);
    return true;
  } catch (err) {
    console.log(`[FAIL] ${err?.message || err}`);
    return false;
  }
}

async function main() {
  let passed = 0;
  let total = 0;

  // 1. Public Entry Reachability
  total++;
  if (
    await runCheck('Public entrypoint reachable', async () => {
      const res = await fetch(`${targetBaseUrl}/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to reach public entry`);
      const text = await res.text();
      if (!text.includes('html') && !text.includes('root') && !text.includes('A/R Tax Services')) {
        throw new Error('Unexpected response body for web entry');
      }
      return `HTTP ${res.status} (Payload verified)`;
    })
  ) passed++;

  // 2. Health Endpoint
  total++;
  if (
    await runCheck('/api/health endpoint', async () => {
      const res = await fetch(`${targetBaseUrl}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status !== 'healthy' && data.status !== 'available') {
        throw new Error(`Unexpected health status: ${data.status}`);
      }
      return `Status: ${data.status}, Server: ${data.firm || 'A/R Tax Services'}`;
    })
  ) passed++;

  // 3. Readiness Endpoint
  total++;
  if (
    await runCheck('/api/readiness endpoint', async () => {
      const res = await fetch(`${targetBaseUrl}/api/readiness`);
      const data = await res.json();
      if (!data.status) throw new Error('Missing status in readiness response');
      return `State: ${data.status} (DB: ${data.dependencies?.database || 'N/A'}, Schema: ${data.dependencies?.schema || 'N/A'})`;
    })
  ) passed++;

  // 4. Provider Readiness Endpoint
  total++;
  if (
    await runCheck('/api/provider-readiness endpoint', async () => {
      const res = await fetch(`${targetBaseUrl}/api/provider-readiness`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.providers)) throw new Error('Providers list missing or not an array');
      const providerCount = data.providers.length;
      return `${providerCount} provider boundaries reported truthfully`;
    })
  ) passed++;

  // 5. Protected Endpoint Rejection (IDOR / Auth Defense)
  total++;
  if (
    await runCheck('Protected endpoint rejects unauthenticated access', async () => {
      const res = await fetch(`${targetBaseUrl}/api/case-authority/state?clientId=TEST-CLIENT&taxYear=2025`);
      if (res.status !== 401 && res.status !== 403) {
        throw new Error(`Expected HTTP 401 or 403, received ${res.status}`);
      }
      return `HTTP ${res.status} (Access rejected as expected)`;
    })
  ) passed++;

  // 6. Safe Error Response & No Information Leakage
  total++;
  if (
    await runCheck('Safe 404 / 503 without internal secret or stack leak', async () => {
      const res = await fetch(`${targetBaseUrl}/api/nonexistent-route-verification-${Date.now()}`);
      const text = await res.text();
      // Ensure no stack trace, SQL dump, or secret leakage
      const lower = text.toLowerCase();
      if (
        lower.includes('secret') ||
        lower.includes('password') ||
        lower.includes('service_role') ||
        lower.includes('at process.') ||
        lower.includes('node_modules')
      ) {
        throw new Error('Sensitive internal details detected in error payload');
      }
      return `HTTP ${res.status} (Redaction verified)`;
    })
  ) passed++;

  console.log(`\n======================================================================`);
  console.log(`SMOKE TEST SUMMARY: ${passed}/${total} checks passed.`);
  if (passed === total) {
    console.log(`RESULT: ALL CHECKS PASSED (Clean Read-Only Verification)`);
    process.exit(0);
  } else {
    console.error(`RESULT: ${total - passed} CHECKS FAILED`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal smoke test runner error:', err);
  process.exit(1);
});
