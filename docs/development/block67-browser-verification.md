# Block 67: browser verification

Suite 07, `deterministic form mapping on the real server` (default profile, real server, synthetic data and a
synthetic form). It runs after the Block 66 journey, whose approved wages conclusion (with its calculation run) it
maps.

1. A synthetic mapping rule (line 1a from the conclusion amount, line 16 from the run's `synthetic_amount`) is drafted
   by the accountant; the drafter's own approval is refused (403); the reviewer approves it after submission.
2. Beside the rule choice, a line linked to it (`aria-describedby`) gives the chosen rule's jurisdiction and effective
   dates ("federal US · in effect 2025-01-01 to open"). The reviewer tries to map: the refusal is shown as an alert ("Only the case's preparer can map the case to a form.").
3. The preparer maps: "Mapped SYN-1040 as version 1."; the mapping reads CURRENT.
4. After reload, the reviewer opens the values with the keyboard (`aria-expanded` true) and reads the provenance table
   (caption, column and row headers): line 1a shows the conclusion amount, the conclusion's short id and version, its
   run, rule set version and hash, and its evidence document.
5. The preparer revises the conclusion on the same sources with a corrected amount; the reviewer approves version 2.
6. After reload, mapping version 1 reads STALE with the reason "line 1a (f1_wages): a source conclusion or its
   calculation changed"; its values are unchanged.
7. The preparer maps again: version 2 is CURRENT, version 1 SUPERSEDED; keyboard focus stays on the panel heading.
   Version 2's line 1a is 7150.00 from conclusion version 2, and that conclusion's trace lists form line 1a.
8. A client token is refused on the mapping (403). At 375 px there is no horizontal overflow; no console errors.

Results of the full matrix on the synchronized branch are recorded in `block67-deterministic-form-mapping-report.md`
(Validation).

No screen-reader test was performed (not available in this environment).
