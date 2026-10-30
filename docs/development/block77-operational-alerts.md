# Block 77: operational alert conditions (no paging, no invented thresholds)

Status: **development checkpoint, stacked on Block 76.** No database change. Synthetic probes only.

## Purpose

The register records `OPS-MONITORING` as "no log shipping or alerting". The administrator diagnostics already report
each dependency's state. Block 77 turns those states into named alert conditions and writes every change as a
structured log line, so that a host log collector can ship and alert on it.

## As built

- **Conditions** (`src/server/observability/operationalAlerts.ts`). Each is a yes-or-no fact the probes already report:
  - `DATABASE_UNAVAILABLE` and `MIGRATIONS_NOT_READY` (both block readiness);
  - `IDENTITY_NOT_CONFIGURED` (blocks readiness) and `STORAGE_NOT_CONFIGURED`, in production only;
  - `SCANNER_BACKLOG_UNAVAILABLE`, `SCANS_FAILED` and `SCANS_OVERDUE`, with counts;
  - `SECURITY_EVENTS_NOT_DURABLE` (production only) and `SECURITY_EVENTS_LOST` (failed or dropped events, with counts).

  No rate, percentage or latency threshold is assumed. Those are owner decisions.
- **Log lines.** One JSON line per change on standard output:
  `{"type":"taxguard.operational_alert","state":"RAISED"|"CLEARED","condition",...,"at"}`. A line carries only the code,
  whether it blocks readiness, counts and the time: no URL, host, tenant, user, message or secret.
- **Endpoint.** `GET /api/operational-alerts`, for operational administrators with an AAL2 session (`no-store`). It
  evaluates now and returns the active conditions with the time each was first seen. The response also gives
  `delivery: NOT_CONFIGURED` (no email, SMS or paging provider is commissioned), `log: STDOUT_JSON_LINES` and the 5xx
  count since the process started.
- **Interval.** Evaluation runs on an interval only when `TAXGUARD_OPERATIONAL_ALERT_INTERVAL_SECONDS` is set (30 to
  3600 seconds). No default is assumed. The timer never keeps the process alive.
- **State.** Process-local, like the operational metrics. Not audit custody.
- **Tests.** `operationalAlerts.test.ts` (6) covers: each condition, the production-only conditions, the line format and
  first-seen times, interval bounds, and the endpoint's access rules and redaction. Two mutation checks are caught:
  production gating, and the CLEARED line.

## [OWNER] decisions

1. Who is alerted and how (provider, on-call rota, escalation), and which conditions page versus log.
2. Rate or latency thresholds (for example a 5xx rate), if any.
3. The evaluation interval and the log destination in each deployment.
