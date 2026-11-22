# TaxGuard AI workforce development rehearsal

The AI Control Center's Architecture Overview combines the 61 design roles with the existing commissioning matrix. The Overview supplies planned responsibilities and human review gates. The commissioning matrix supplies implementation scope and deployment status.

Run `npm run qa:ai-workforce` from a development checkout. The suite covers the rendered roster, A00 routing and orchestration, A10 duplicate-hash advisory, the governed gateway, and the independent human proposal review boundary. It uses synthetic data and injected providers. It does not need live credentials or hosted services.

The durable queue proposal can be rehearsed independently with `npm run test:db -- src/tests-db/durableJobQueue.db.test.ts`. This suite provisions disposable local PostgreSQL. It rehearses enqueue, lease claim, a local A10 duplicate check on fixed test evidence, and fenced completion. The rehearsal verifies the advisory in the test process and records queue transitions in Postgres. Hosted result persistence and governed dispatch are separate work.

## Hosted worker prerequisites

Before connecting the queue to agent execution, approve the queue schema for the target staging database. Define a claim boundary for AI jobs so the worker leaves other job types available to their owners. Carry a durable reference to the requesting actor and scope, resolve current authorization on dispatch, and keep user session tokens out of job payloads. Preserve lease fencing and record terminal results with the execution ledger. Rehearse with a dedicated staging project and synthetic data, then review the evidence before enabling any hosted agent.

All 61 registrations remain DRAFT. A21 uses the Architecture Overview's Individual Tax name for development. A39 remains unassigned. GitHub and hosting actions require the owner's separate approval.

## A10 durable dispatch review block

The disposable PostgreSQL suite explicitly loads `docs/development/sql/ai-advisory-job-draft.sql` for the new A10 cases. The draft partitions AI and ordinary claims, requires a current lease for completion, and atomically saves an A10 duplicate-group count and the terminal queue event. Advisory summaries always require human review. The draft exposes no browser read endpoint and retains no document hashes or raw evidence in the result.

The worker accepts case-scoped A10 requests with selected source IDs. It resolves evidence before inspection and again before recording the result. The tests inject a synthetic resolver. Before hosted integration, bind this contract to current server-side actor, tenant, client, case, tax-year and stage authorization, including kill switches and atomic result acceptance against current governance evidence. The draft is outside the migration manifest and has no Railway entry point.
