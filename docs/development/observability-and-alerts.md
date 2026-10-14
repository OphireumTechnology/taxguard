# Observability and alerting (Phase 10)

**Status:** implemented in source and validated in local tests. No log shipping, alert routing or
dashboard exists yet for any hosted environment.

## Endpoints

| Endpoint | Audience | Answers | Never reveals |
|---|---|---|---|
| `GET /api/health/live` | public (load balancer) | `{"status":"alive"}` | anything else |
| `GET /api/health/ready` | public (load balancer) | 200 `{"status":"ready"}` / 503 `{"status":"not_ready"}` — ready means the database schema is ready and identity is configured | dependency names, states, versions, hosts, tenants, timings |
| `GET /api/health/diagnostics` | active administrators of a tenant (authenticated) | per-area state codes and counts: process (uptime, memory), environment (runtime, deployment label, durable store on/off), database (`state`, migration readiness), identity, storage, scanner (state, request backlog), AI (state, material actions `BLOCKED`, provider not commissioned), security events (mode and sink counters) | URLs, connection strings, keys, secrets, tenant identifiers, row contents |
| `GET /api/health` (existing) | public | liveness and firm details (the development server no longer reports whether an AI key is configured) | — |
| `GET /api/readiness`, `/api/provider-readiness` (existing) | existing consumers | provider configuration states (no values) | values |

Probes time out after 3 s, so a hanging database makes readiness `not_ready` instead of hanging the
endpoint. Tests: `src/tests/healthEndpoints.test.ts` (including a lost database connection and secrets
present in the environment).

## Signals

- **Audit center, category SECURITY** (proposal 048): authentication failures, lockouts, access and
  isolation denials, MFA requirement failures, scanner callback rejections, repeated-request markers.
- **Security-event sink counters** (diagnostics): `recorded`, `suppressed`, `rejected`, `failed`,
  `dropped`, `pending`.
- **Scan backlog** (diagnostics, proposal 050): `open`, `overdue`, `failed24h`, `pendingDocuments`.
- **Server logs**: startup lines `[security-events] <state>` and `[malware-scanner] <state>` (codes only).

## Alert conditions and responses (to configure when log shipping exists)

| Condition | Threshold (proposal) | Response |
|---|---|---|
| Readiness 503 | 2 consecutive checks (1 min) | Check diagnostics `database` / `identity`; provider status page; restore runbook if data loss |
| 5xx rate | > 2 % of requests over 5 min | Inspect server logs; roll back the last deployment if correlated |
| `SECURITY_REPEATED_REQUESTS` rows | any | Identify the category and fingerprint; consider blocking at the edge; review the rate-limit policy (owner decision) |
| Security events suppressed | > 0 for the tenant-wide bound | Possible flood; same as above; confirm the log is not being drowned |
| Sink `failed` or `dropped` increasing | > 0 over 15 min | Database reachability or proposal 048 not applied; events are still in memory only |
| `SECURITY_SCANNER_CALLBACK_REJECTED` | any | Possible forged or replayed verdicts; rotate the callback secret if signatures were valid but replayed |
| Scan backlog `overdue` or `failed24h` | > 0 | Scanner outage; documents stay quarantined by design; contact the provider |
| `SECURITY_CROSS_TENANT_ACCESS_ATTEMPT` / `CLIENT_ISOLATION_VIOLATION_ATTEMPT` | any | Treat as an incident; preserve logs; review the actor's sessions |
| AI kill-switch activation (`KILL_*` audit rows) | any | Confirm who activated it and why; AI stays stopped until reviewed |

Owner decisions: alert destinations and on-call routing; log retention; whether staging alerts page anyone.
