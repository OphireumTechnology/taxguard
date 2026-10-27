# Block 66: browser verification

Suite 07, `tax conclusions with evidence-to-conclusion lineage on the real server` (default profile, real server,
synthetic data):

1. The preparer opens the case and proposes an income-inclusion conclusion citing a reviewed document and an approved
   calculation run; submits it.
2. The reviewer opens the lineage view (run and rule set, evidence and original document, VERIFIED) and approves.
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
Workflow. Manual WCAG review of the new panel (screen reader reading order of the lineage view) is outstanding.
