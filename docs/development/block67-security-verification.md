# Block 67: security verification

All cases run on real PostgreSQL with every proposal applied (`taxFormMapping.db.test.ts`) unless noted.

| # | Attack or invariant | Result | Evidence |
|---|---|---|---|
| 1 | Manually injected form value | INSERT without a source refused by CHECK; no table privilege for anon, authenticated or service_role; only the mapping RPC writes | injection case |
| 2 | Editing or removing a mapped value or mapping | UPDATE / DELETE / TRUNCATE refused (`TAX_FORM_MAPPING_IMMUTABLE`); a mapping only moves CURRENT → SUPERSEDED | injection case |
| 3 | Value from an unapproved, stale or uncalculated conclusion | refused: `SOURCE_STALE`, `CALCULATION_SOURCE_REQUIRED`, `CALCULATION_NOT_APPROVED`; only APPROVED conclusions are candidates | refusal and staleness cases |
| 4 | Guessing between candidates | `AMBIGUOUS_SOURCE` refuses the whole mapping; nothing is written | refusal case |
| 5 | Unapproved or self-approved mapping rule | `TAX_FORM_RULE_NOT_APPROVED`; `MAKER_CHECKER_VIOLATION`; `TAX_CONTENT_REVIEWER_REQUIRED`; unverified source `TAX_SOURCE_NOT_VERIFIED` | governance case; suite 07 |
| 6 | Changing a submitted rule | `TAX_FORM_MAPPING_IMMUTABLE` | governance case |
| 7 | Rule of another year or return family | `TAX_FORM_RULE_SCOPE_MISMATCH` | refusal case |
| 8 | Mapping by anyone but the case preparer | `TAX_FORM_MAPPING_PREPARER_REQUIRED` (reviewer); suite 07 shows the refusal as an alert | refusal case; suite 07 |
| 9 | Cross-tenant, unassigned staff, same client in another tax year | `TAX_FORM_MAPPING_NOT_FOUND`; 404 on list and map | isolation case |
| 10 | Client access | router refuses client roles (403); suite 07 client token refused | isolation case; suite 07 |
| 11 | Silent recalculation after a source change | stored values unchanged and read STALE (`SOURCE_CHANGED`, `SOURCE_STALE`, `MAPPING_RULE_SUPERSEDED`); a new mapping version is needed | staleness cases; suite 07 |
| 12 | Process-memory fallback in production | `/api/tax-engine` not mounted; form-mapping routes answer `API_NOT_RELEASED`; cutover requires `20261019110000` | `routeCutover.test.ts` |
| 13 | Direct helper access | derivation, staleness and stored-value helpers not executable by service_role | injection case |

Mutation checks (applied to the test database only): disabling the staleness check in the derivation fails case 3's
test; summing an ambiguous SINGLE line fails case 4's test and three others. Both pass on the unmodified proposal.
