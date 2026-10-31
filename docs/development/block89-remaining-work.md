# Block 89: remaining durability work and what each item needs

Status: **development checkpoint, stacked on Block 88 (`ea52cb5`).** Register and documentation only; no server or
database change.

## Where Blocks 81–89 leave the in-memory routes

The production route inventory (Block 81) found 146 production routes over process-local state, plus the payment
webhook. All are refused in production, and the inventory test keeps it that way. Blocks 82–88 added durable
replacements; Blocks 83, 87 and 89 recorded what each refused route's work is covered by.

| Coverage | Routes |
|---|---|
| `REPLACED`: every route's work has a named durable route | 28 |
| `PARTIAL`: durable routes cover part, and the gap is stated | 102 |
| `NONE`: no durable route | 17 |

Every durable replacement is a review-only proposal. Its router stays unmounted in production until the owner
approves the proposals and they are applied.

| Block | Durable work added | Proposal |
|---|---|---|
| 82 | Background job queue | `20261019240000` |
| 84 | Task reassignment and staff workload | `20261019250000` |
| 85 | Deadline escalation, derived when read | `20261019260000` |
| 86 | Staff task-assignment notifications | `20261019270000` |
| 88 | Practice search | `20261019280000` |

## Block 89 correction

**Practice analytics (`operations-analytics`).** The durable practice summary already reports most of the in-memory
analytics figures:
- cases by stage, which includes the Stage 11 and Stage 12 counts the in-memory service reported as returns awaiting
  signature and filing;
- open, overdue and ready-for-review tasks;
- document requests;
- receivables.

Block 85's escalation view counts deadlines by level. Not reproduced: the active-client count, and paid revenue,
which is Codex's Phase 15 billing. The in-memory bookkeeping backlog was always 0. The manager dashboard group names
the same two durable reads.

## Every remaining gap needs a decision, a provider or a review

No gap left in the register can be closed by development alone without inventing policy. Each needs one of the
following.

**1. Owner approval of proposals: case authority (82 routes).**

`case-authority-scoped` (74 routes) is partly covered by the cases router. The reviewer decisions, workspace, action
and queue (5 routes) have no durable provider. Durable case authority is next priority 1 in the status document. It
starts with approving the case, tax-engine and practice proposals already written.

**2. Owner policy.**

| Gap | Decision needed |
|---|---|
| Retention periods and legal holds (`operations-retention-archive`) | The retention schedule and legal-hold authority |
| Staff free-text notifications (`operations-notifications`) | The general-record (messaging) policy |
| Profile amendments (`profile-amendments`) | Which identity fields need which verification evidence |
| Client-service views (`operations-client-service`) | What the operations role may see of client records: tenant-wide or by assignment |
| Client view of job status (Block 82) | Whether clients may see their own jobs |
| Escalation thresholds (Block 85) | Confirm or replace the in-memory defaults: 7 days, 48 hours, critical after 7 days overdue or when statutory |

**3. External providers.**

| Gap | Provider |
|---|---|
| Payment webhook (`operations-payment-webhook`) | A payment provider |
| Accounting sync and document matching (`bookkeeping-without-durable-adapter`) | An accounting connector |
| E-mail and SMS notifications | Transports and channel-consent wording |

**4. Tax-content review.**

Stage 02 reconciliation (`stage-two-reconciliation`) needs the questionnaire-derived document requirements reviewed
as tax content before the engine is moved onto durable inputs.

**5. Other routes partly replaced, with smaller gaps.** These are not blockers, but their equivalence is not reviewed
route by route.

| Group | Gap |
|---|---|
| `operations-requests` | Signature and payment requests are carried by signature packages and invoices |
| `operations-search` | Invoices are not searched (Codex billing) |
| `operations-rollover` | The in-memory route recorded nothing |
| `case-authority-onboarding` | The legacy provisioning flow was not compared route by route |

## Recommended next steps for the owner

1. Review and approve the practice proposals: `20261012250000`, `20261018100000`, `20261019230000`, and
   `20261019250000` to `20261019280000`. Together with the jobs proposal `20261019240000`, this gives the `practice`
   and `jobs` cutover routes everything Blocks 82–88 built.
2. Decide the six policy questions above. Each one closes or narrows a named gap.
3. Choose providers when payments, accounting sync or messaging are to be commissioned.
