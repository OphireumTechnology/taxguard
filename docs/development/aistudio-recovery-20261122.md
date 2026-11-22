# AI Studio recovery — 2026-11-22

Validated baseline: 4c2593d269fb953129df6218a373a96824c2bb08 (CI 44985894916; Pages 44986439018).
Damaged upload: 64b1012bd296821714844dca12a11bbbee93f635.
Recovery: 5962558d7d1296e83d1acf0df78e4d464109937d.

The recovery tree differs from the validated baseline solely by fourteen homepage visual assets/components/styles. The integration guard in run 44993056698 compared against the damaged upload and flagged removal of its newly introduced unavailable-router helper and two restored modules. The restored live-workflow route delegates to LiveWorkflowRepository and retains its production migration gate; the restored invitation lifecycle delegates to the supplied logout callback and retains suppression on failure. The guard, approval list, workflow and existing tests remain unchanged. Added independent regression coverage for logout failure and replacement-lease ownership. Full CI and live release verification remain required.
