# Final Security Audit

**Scope:** Read-only review of the uncommitted TaxGuard client-data-isolation repair. No application or database changes were made as part of the audit. The deployed Supabase policy catalog was not available for inspection.

## Summary

| Area | Result |
|---|---|
| Production client authorization | FAIL |
| Cross-tenant isolation | PASS |
| `ProductionDocumentService` fallback | SAFE |
| Demo `clients[0]` production reachability | SAFE |
| Production fallback identities | PASS |
| Storage RLS/policy composition | FAIL |
| Staff assignment enforcement | FAIL |
| Sensitive logging | FAIL |
| “David Robert Anderson” exact origin | NOT PROVEN |

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|---|---|---|---|---|
| 1 | 🟠 HIGH | `src/server/routes/practice-operations.routes.ts` | 141-155 | An authenticated staff caller can omit `clientId` from `GET /api/operations/jobs`. The route then queries the tenant-wide queue, and the repository returns job payloads without client filtering, exposing other clients’ job data within that tenant. | 9/10 |
| 2 | 🟠 HIGH | `src/server/routes/stage-two-three.routes.ts` | 295-369 | Production accountant review-queue, item, and action routes use role checks without enforcing an active authorized client assignment. Whether live data is currently exposed was not established. | 8/10 |
| 3 | 🟡 MEDIUM | `src/server/auth.ts` | 38-55 | Authorization-denial logging persists caller-supplied `x-request-id` or `x-correlation-id` (up to 128 characters) as `requestId` and in `details` without format validation. Sensitive values placed in those headers could enter logs. | 9/10 |
| 4 | 🟡 MEDIUM | `supabase/migrations/20261004000000_taxguard_private_storage_client_scope.sql` | 7-40 | The new storage policy does not constrain or remove other permissive SELECT policies. PostgreSQL OR-composes permissive policies, so another policy could broaden access. No other such policy was found in repository migrations, but the deployed policy catalog was not inspected. | 9/10 |

## Reviewed behavior and identity fallbacks

- `ProductionDocumentService.fallbackClientId` supplies a missing client ID when normalizing a client-side document record; it is not an authorization decision. Server-side authorization must still be session-derived.
- `src/demo/services/AccountantCenterService.ts` uses `clients[0]` as a demo fallback. The reviewed production `App.tsx` does not import demo services, and the standalone TaxGuard route is blocked; no production Client Portal path to this fallback was found.
- Production Supabase identity resolution uses persisted records and does not fall back to in-memory identity, membership, or client records when resolution fails.
- Identity/default classification: `tenantA` test/demo fallback — **SAFE TEST/DEMO ONLY**; `tenantA` billing templates — **SAFE NON-AUTHORIZATION USE**; `tenant_ar_tax_prod` Stage 02/03 metadata — **SAFE NON-AUTHORIZATION USE**; `tenant_ar_tax_prod` sample data — **SAFE TEST/DEMO ONLY**; `clients[0]` — **SAFE TEST/DEMO ONLY**. No production-reachable `users[0]`, `defaultClient`, `sampleClient`, `demoClient`, or `mockClient` fallback was found.
- The exact source of the “David Robert Anderson” record is **NOT PROVEN** by the reviewed repository evidence.

## Recommendation

**REPAIR REQUIRED.** Address the unassigned-staff data exposure and assignment enforcement, sanitize or validate denial-log correlation identifiers, and verify the deployed `storage.objects` policy inventory for permissive policy composition before treating storage isolation as confirmed.
