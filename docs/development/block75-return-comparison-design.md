# Block 75: return comparison with the previous version and the prior year (design and as built)

Status: **development checkpoint, stacked on Block 74.** The database change is the review-only proposal
`20261019200000`; nothing is applied to a hosted database. Synthetic data only. Owner decisions are **[OWNER]**.

## Purpose

The architecture register lists "per-return variance and prior-year anomaly checks" as the gap in
`TAX-CALC-VERIFICATION`. Reviewers and quality control (the synthetic checklist item `PRIOR_YEAR_COMPARED`) need to
see what changed in a return. Block 75 adds a read-only, deterministic comparison of one return version's mapped
values with:

- the **previous version** of the same case and template: what changed since the last preparation;
- the client's **prior-year return**: the latest version of tax year - 1 approved at Stage 09, for the same
  jurisdiction and return family.

It invents no threshold. Variance flags appear only under the owner's approved variance policy, and none is seeded.

## Rules

- **Read only.** The comparison is computed when it is read. It gates nothing, changes nothing and is not stored. A
  flag is information for the reviewer, not a finding or a decision.
- **Matching.** Lines match only on identical identifiers: form, schedule, line and field, plus the form version within
  one tax year. A key that appears twice on either side, or with different value types, is `AMBIGUOUS` and carries no
  values. A cross-year line crosswalk is tax content and is not encoded (see [OWNER] 2).
- **Kinds.** `CHANGED`, `UNCHANGED`, `ADDED` (only in this version), `REMOVED` (only in the base), `AMBIGUOUS`. Each
  line gives both values, the change and, where the base is not zero, the change in basis points of the base.
- **Prior-year basis.** Only a version with status `APPROVED` (Stage 09) counts. Drafts, submitted, returned and
  superseded versions do not. The result says whether that version has gone stale since.
- **Access.** Anyone who may read the version can read its comparison (the case's live preparer or reviewer, a
  practice manager, the QC assignee, the final authorizer). Prior-year values also need access to the prior-year case.
  Otherwise, and when no approved prior-year version exists, `priorYear` is `{status: NOT_AVAILABLE, taxYear}`, with no
  identifiers, values or reason.
- **Variance policy.** `taxguard_tax_variance_policies` is versioned and immutable, approved by someone other than its
  author, and written only by a reviewed database change. It has a minimum change amount and a minimum change in basis
  points of the prior value. Under the latest policy, a prior-year `MONEY` line that is `CHANGED`, `ADDED` or `REMOVED` is
  flagged when its change reaches the amount and, unless the prior value is zero, the share. `INTEGER` lines and the
  previous-version comparison are never flagged. Without a policy, `varianceCheck` is `NOT_CONFIGURED` and every
  `variance` is null.

## As built

- **Proposal `20261019200000`:**
  - the policy table, with an immutability guard and a no-truncate trigger;
  - internals: `taxguard_tax_return_value_rows` and `taxguard_tax_return_value_diff`;
  - entry point: `taxguard_tax_return_comparison`, scoped by `taxguard_tax_return_final_scope`.
  - Only the entry point is granted to `service_role`. The table has no privileges for any API role.
- **Route:** `GET /api/tax-engine/returns/:id/comparison`. It is readable by practice managers. Production cutover
  refuses it until the proposal is approved (it is in the tax-engine cutover entry, with sentinel
  `taxguard_tax_return_comparison`).
- **Interface:** "Show comparison of {version}" on every version in the draft return panel (`ReturnComparisonView`). It
  shows:
  - the variance-check status in a live region;
  - changes since the previous version and against the prior year, line by line in words;
  - flagged lines marked "above the practice variance threshold, review it".
- **Tests:**
  - PostgreSQL acceptance 5/5 (`taxReturnComparison.db.test.ts`), with a 2024 and a 2025 return built through the real
    functions. Covered:
    - the Stage 09 basis;
    - scope, including a 2025-only reviewer who is not shown 2024 values;
    - the previous-version comparison;
    - variance flags under a synthetic policy;
    - immutability and privileges.
  - Three mutation checks are each caught: skipping the prior-year case access check, accepting a prior-year version
    that is not approved, and flagging regardless of the thresholds.
  - Unit tests for the service, the line text, the list and the manager access, plus a cutover test.
  - Browser suite 07: the preparer opens the comparison of version 2 with the keyboard. The test checks the revised
    wages against version 1, that no prior-year return is available, and that the variance check is not configured.

## [OWNER] decisions

1. The variance policy: whether one applies, its amount and share, whether it differs by line or return family, and
   whether a flag should become a diagnostic finding or a QC checklist input (today it is information only).
2. A cross-year line crosswalk: which line of one year's form corresponds to which line of the next. It is tax
   content, and would need verified sources and maker-checker like form rules.
3. Which prior-year return is the basis when the practice did not prepare it, for example a return filed elsewhere
   and entered as evidence. Today only a return prepared and approved in TaxGuard counts.
4. Whether a QC assignee or final authorizer who is not on the prior-year case may see prior-year values. Today they
   may not (fail closed).

## Not in scope

Storing comparisons, turning flags into findings, amounts derived from documents outside the return, and any change to
readiness, Stage 10 or Stage 11. Nothing is signed, filed or transmitted, and no AI agent is involved.
