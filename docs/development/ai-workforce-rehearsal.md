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

## A09 missing-document advisory

The local A09 evaluator reads a scoped Stage Two requirement manifest. It reports required and conditional evidence as missing, pending review, or needing correction. It excludes accepted, waived, inapplicable, satisfied, optional and informational rows. It rejects mixed engagement or tax-year records, duplicate requirement identifiers and unknown statuses. Output includes requirement IDs, manifest version and finding codes for human review.

The evaluator is a deterministic specialist component. A hosted handler still needs an authorized durable manifest resolver, independent approval and queue/ledger integration. The commissioning matrix continues to count only existing routed handlers. A10 now sends malformed evidence to permanent refusal instead of leaving the lease to expire and retry.

## Collection specialist components

A05 checks a scoped vault snapshot using the existing server upload metadata validator. It reports intake metadata defects, pending scans, unavailable documents and missing request links. The advisory does not release a scan or authorize a document operation.

A08 compares staged extraction fields against independently resolved anchors for the same released document version. It reports missing anchors or value mismatches using field keys and page numbers. The report excludes actual extracted values and cannot verify a field or change an authoritative tax record.

Both components use synthetic tests and need governed evidence resolvers, scoped review UI, and queue integration before hosting. A07 also requires a commissioned OCR provider and authoritative source lineage. The legacy sample extraction path stays outside this production integration. The release gate across all 61 requires approved scopes, staged exercises, review evidence, and owner resolution of A39.

## SQL-backed A10 dispatch composition

The local staging composition uses the durable job's requesting actor and resolves the tax year from the exact tenant, client and case in PostgreSQL. It evaluates A00 coordination and A10 document-read policies separately using the existing SQL governance store. The selected metadata, advisory calculation and fenced completion share one serializable database transaction. Policy denial records a refused queue attempt and no advisory result. Unexpected failures roll back the transaction.

The disposable PostgreSQL regression enqueues two jobs through the API using synthetic evaluation records. The first stores one duplicate group for human review. After case assignment revocation, the worker refuses the second job and stores no advisory.

The hosted pilot still needs approved staging configuration and case assignments, a successful run using approved governance fixtures, and a hosted exercise of the scoped review API and case panel. No agent is activated by this composition. Use only an isolated staging database and synthetic evidence while verifying the rollout.

## Stage One onboarding advisories (A01–A04)

The four server functions in `src/server/ai/onboarding/OnboardingAdvisories.ts` accept a trusted case scope and a matching metadata projection. A01 identifies missing intake, contact and consent steps. A02 refers pending or inconsistent identity evidence to staff. A03 lists proposed services and separately identifies requested codes absent from the approved catalog so staff can resolve scope for that tax year. A04 selects applicable organizer question IDs with missing or conflicting answers. Each returns a draft for human review.

The synthetic tests exercise all four decisions, case mismatch and unexpected identity fields. These deterministic components still need a server-authorized projection from onboarding records, stage and assignment checks, and review queue integration before users can invoke them.

### A10 Stage Three case panel

The shared staff case workflow displays the latest 20 completed duplicate checks for the selected Stage Three case. The database checks active case assignment and job visibility before returning summaries. An unavailable result and an empty result have distinct displays. The assigned reviewer can inspect the document IDs, versions, statuses and duplicate groups. Acknowledging or returning a finding sends the preview fingerprint to the review endpoint. The database rechecks assignment, reviewer independence and current evidence before recording one decision for the job.

| Agent | Implementation | Website integration | Hosted staging acceptance | Production commissioning |
|---|---|---|---|---|
| A10 | Duplicate calculation, queue and review transaction exercised in a disposable database | Stage Three case panel implements preview and decision controls | Pending an isolated deployment and a decision by an approved independent reviewer | Pending |

For hosted acceptance, record the deployed commit, synthetic case and job identifiers, evidence fingerprint, reviewer assignment, decision, and outcome after reopening the case. Verify that the saved decision matches the preview and a revoked assignment prevents another review. Keep document contents and session credentials out of the acceptance record.

### Identifying the A10 path under acceptance

The staff case workflow pilot in this branch uses `CaseDuplicateAdvisories` and `jobService`. Record the job ID, the version returned by the job's `a10-review` preview, and the resulting `ACKNOWLEDGED` or `RETURNED` decision. Reopen the same case in the staff case workflow and confirm the decision on that job.

The workforce panel on main at `f569f085a863a69e2d142f08c9de25f1400f269f` uses `StageThreeDuplicateAdvisoryPanel` and `aiWorkforceService.recordDecision` with an advisory ID. Track acceptance for that API separately. Evidence from one panel establishes shared decision persistence only after a test correlates the job and advisory and reads the same decision through both paths.
