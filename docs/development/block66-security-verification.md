# Block 66: security verification

All cases run on real PostgreSQL with every proposal applied (`taxConclusions.db.test.ts`) unless noted.

| # | Attack or invariant | Result | Evidence |
|---|---|---|---|
| 1 | Cross-tenant conclusion read | `TAX_CONCLUSION_NOT_FOUND` | other-tenant manager on `/trace` |
| 2 | Cross-client evidence traversal | another client's document resolves `NOT_FOUND`; the other client's case lists nothing | isolation case |
| 3 | Wrong scope (unassigned staff) | `TAX_CONCLUSION_NOT_FOUND` / 404 on list | `tc-out` |
| 4 | Stale evidence used for finalization | readiness `ready: false`, blocker `STALE`; approval refused `TAX_CONCLUSION_STALE` | replacement case; suite 07 |
| 5 | Unverified OCR proposal as evidence | `TAX_CONCLUSION_SOURCE_UNRESOLVED … NOT_DECIDED` | refusal case |
| 6 | Preparer self-approval | `TAX_CONCLUSION_REVIEWER_REQUIRED`; reviewer ≠ preparer CHECK and `MAKER_CHECKER_VIOLATION` | flow case |
| 7 | Conclusion without evidence | `TAX_CONCLUSION_EVIDENCE_REQUIRED` | refusal case |
| 8 | Calculation without rule provenance | a run always carries rule set id and hash; an unknown or foreign run is `NOT_FOUND`; approval needs the run `REVIEW_APPROVED` | refusal case; trace case |
| 9 | Client access to reviewer notes | router refuses client roles (403); suite 07 client token refused | isolation case; suite 07 |
| 10 | Process-memory fallback in production | `/api/tax-engine` not mounted; conclusion routes answer `API_NOT_RELEASED`; cutover requires 20261019100000 | `routeCutover.test.ts` |
| 11 | History tampering | UPDATE/DELETE/TRUNCATE of conclusions and links refused (`TAX_CONCLUSION_HISTORY_IMMUTABLE`) | immutability case |
| 12 | Direct table or helper access | no table privilege for anon/authenticated/service_role; helpers not executable by service_role | immutability case |
| 13 | Revising a version twice / revising during review | `TAX_CONCLUSION_NOT_REVISABLE` | replacement case |
| 14 | Malformed identifiers / references | 404 for malformed ids; `TAX_CONCLUSION_INPUT_INVALID` for bad refs and types | trace and refusal cases |

Unchanged invariants confirmed by the full regression: Stage 03 extraction gate, Block 65 calculation lineage,
document quarantine, tenant/client/engagement/year isolation suites, AI default-deny and kill switch.
