# Block 87: coverage corrections for reconciliation, search and archive verification

Status: **development checkpoint, stacked on Block 86 (`3a577ed`).** Register and documentation only; no server or
database change. Synthetic data only.

## Purpose

The next gap on the list was the Stage 02 reconciliation snapshot. Looking at what a durable version would take
showed that three entries in the Block 83 coverage map were inaccurate. This block corrects them instead of building
something the facts do not support.

## Corrections

**1. Stage 02 reconciliation (`stage-two-reconciliation`): NONE → PARTIAL.**

The in-memory engine (`StageTwoReconciliationService`, about 1,200 lines) does four things:
- derives the applicable document requirements from the questionnaire answers;
- matches uploaded evidence to them;
- isolates wrong-year and wrong-taxpayer documents;
- writes the result into the in-memory Stage 01 and Stage 02 services.

The durable system already tracks required documents another way. They are staff-created document requests, from
templates, and `GET /api/vault/requests/missing` lists the outstanding ones. Those two vault routes are now the named
replacements.

The questionnaire-derived requirements are tax content: which documents a return needs. They are not reproduced
durably here. Moving them to durable data would mean refactoring the engine into a pure function over durable
questionnaire and vault inputs. Its requirement rules would also need to be reviewed as tax content first. Neither is
done in this block.

**2. Operational search (`operations-search`, split out): NONE → PARTIAL.**

The in-memory search covers clients, cases, requests, tasks and invoices. The durable practice client list
(`GET /api/practice/clients?q=`) already searches clients by name, within the actor's scope. Searching the other
record types together has no durable route.

**3. Archive verification (`operations-retention-archive`): stays NONE, with a corrected gap.**

`POST /api/operations/archive/verify` computes a SHA-256 of a payload the caller supplies and compares it with a hash
the caller also supplies. It never looks up a stored archive manifest, so it verifies nothing authoritative. No
archive manifest store exists. Retention periods and legal holds remain owner policy.

## Result

Of 147 refused routes:

| Coverage | Routes |
|---|---|
| `REPLACED` | 28 |
| `PARTIAL` | 102 |
| `NONE` | 17 |

The 28 replaced routes include Block 85's practice task, deadline and team group. The route inventory test passes:
every replacement route exists and none is itself refused.

## What remains

Each remaining gap needs one of the following.

| Needs | Gaps |
|---|---|
| Owner-approved proposals | Case authority |
| Owner policy | Retention, legal holds, staff messaging, client access to job status, identity verification for profile amendments, the operations role's access to client records |
| Providers | Payments, accounting sync, e-mail and SMS |
| Tax-content review | Questionnaire-derived Stage 02 requirements |

Two more gaps were corrected in this block:
- **Profile amendments:** they cover sensitive identity fields (legal name, SSN, TIN, EIN, ITIN, date of birth,
  entity classification, authorized representative). Approving them needs an identity verification policy.
- **Client-service views:** what the operations role may see of client records is not decided.

Smaller items need none of these:
- the analytics figures;
- combined search across cases, requests and tasks.
