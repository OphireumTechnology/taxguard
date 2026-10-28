# Block 66: browser verification

Suite 07, `tax conclusions with evidence-to-conclusion lineage on the real server` (default profile, real server,
synthetic data):

1. The preparer cites a document that does not exist: the refusal is shown as an alert in words ("Refused: a cited
   source does not resolve for this case …"); then proposes an income-inclusion conclusion citing a reviewed document
   and an approved calculation run, and submits it.
2. The reviewer opens the lineage view with the keyboard (calculation and rule set, evidence and original document,
   VERIFIED), tabs to the review note and the approve button and approves with Enter.
3. Page reload: the conclusion is still APPROVED; readiness reads "All current conclusions are approved and current."
4. The client uploads a new version of the source document; it is scanned CLEAN and awaits review.
5. Page reload: the conclusion shows STALE with the stale sources listed; readiness reads "Finalization blocked:
   version 1 stale".
6. Staff review the new version; a new calculation run is recorded and approved.
7. The preparer revises the conclusion (new amount, revalidated evidence, new run) and submits version 2.
8. The reviewer approves version 2; after reload it is APPROVED, version 1 has left the list, and the history reads
   version 1 SUPERSEDED, version 2 APPROVED. A client token is refused on the trace.
9. At 375 px the panel has no horizontal overflow; no console errors in either session.

Tablet and desktop widths are the suite's default desktop viewport; the existing 375 px checks cover the rest of Case
Workflow.

## Accessibility review (before the PR)

Structural review of the Tax conclusions panel and its lineage view: the component source, the rendered page in
Microsoft Edge (suite 07) and the accessibility tree Edge exposes to assistive technology (Playwright `ariaSnapshot`
of the panel at review time and at the stale state, read by hand).

| Check | Result |
|---|---|
| Heading order | PASS: Case Workflow h2 → stage h3 → Tax conclusions h4 → each conclusion h5 → lineage sections h6 (calculation and rule, research and authority, workpaper, verified evidence and original documents, review history, audit); suite 07 asserts no level is skipped |
| Accessible names of controls | PASS after fix: every field has a visible label; buttons repeated per conclusion now carry the conclusion's short id (`Submit conclusion 1a2b3c4d for review`, `Approve conclusion …`, `Return conclusion … for correction`, `Reject conclusion …`, `Show lineage of conclusion …`, `Revise conclusion …`) |
| Keyboard navigation and focus order | PASS: native buttons, fields and forms only; suite 07 opens the lineage, tabs lineage toggle → review note → approve, and approves with Enter |
| Focus visibility | PASS: the global `:focus-visible` outline applies; suite 07 asserts the focused button has an outline |
| Focus after actions | FIXED: after an action whose button disappears (submit, approve), focus went to the page body; it now moves to the panel heading. "Revise" now moves focus to the Statement field of the form it fills |
| Status not by colour only | PASS: status is text in the conclusion heading ("… version 1 · status STALE"); stale sources are a named list with reasons in words; lineage entries say VERIFIED or STALE with the reason |
| Status word exposed | FIXED: the status badge carried `aria-label="Conclusion status"` on a `<strong>`, which can replace the word APPROVED / STALE for assistive technology; the label is removed and the heading reads "status APPROVED" |
| Lineage hierarchy | PASS: the lineage is a named region (`Conclusion lineage`) with h6 sections and lists, calculation inputs as a nested list; the toggle has `aria-expanded` and now `aria-controls` |
| Reading order of lineage and decision | FIXED: the accessibility tree showed the opened lineage after the Approve / Return / Reject buttons, so a keyboard or screen-reader user met the decision before the evidence; the lineage now follows its toggle and precedes the review form (suite 07 asserts the document order) |
| Lists and tables | PASS: stale sources, lineage entries, review history and audit are lists; the panel has no tables |
| Refusals and messages announced | FIXED: success and readiness messages were inserted together with their live region, which screen readers often do not announce; both regions now stay mounted (`Conclusion action result`, `Conclusion readiness`) and errors use `role="alert"`; suite 07 checks a refusal alert and the status messages |
| Disabled controls explained | FIXED: "Propose conclusion" and "Return / Reject" were disabled without saying why; each now references a visible hint (`aria-describedby`) |
| 375 px | PASS: no horizontal overflow (suite 07) |

The accessibility trees were captured with `E2E_A11Y_SNAPSHOT_DIR=<folder outside the repository>`; without that
variable suite 07 writes nothing. They are working evidence and are not committed.

Covered by automated tests: `caseConclusionsPanel.test.tsx` (mounted live regions, focusable heading, described save
button, no name on the status element) and the suite 07 journey (above).

**MANUAL STRUCTURAL ACCESSIBILITY: PASS** (after the fixes above).

**SCREEN READER VERIFICATION: NOT AVAILABLE.** No screen reader was run: this environment can drive a browser but
cannot operate or hear NVDA, JAWS or Narrator. The accessibility tree review is not a substitute; a person should still
check the reading order of the lineage view and the announcements with a screen reader before release.

Residual: the middle dot (·) separators in conclusion and lineage lines may be read aloud as "middle dot" by some
screen readers.
