# Block 76: AI evaluation records in the Control Center (read-only)

Status: **development checkpoint, stacked on Block 75.** No database change: it reads the tables of the review-only
evaluation proposal `20261018140000` when they exist. Synthetic data only. No agent is commissioned.

## Purpose

The register lists "no Control Center view of evaluations" as a gap in `AI-EVALUATION`. Governance staff need to see
why no agent version can be activated. They can now see that before any model is commissioned or any evaluation run.

## As built

- **Read projection** `ControlCenterReadService.evaluations(token)`, served at
  `GET /api/ai-governance/control-center/evaluations`. As with the other Control Center views, only governance roles
  can read it, it is scoped to the verified tenant, and responses are `no-store`.
  - **Framework.** It reports `NOT_APPLIED` while the proposal's tables do not exist. Every current agent version is then
    `NOT_PASSED` with reason `EVALUATION_FRAMEWORK_NOT_APPLIED`.
  - **Suites** (the latest 100 of the tenant). For each suite: who wrote it and who approved it (approver and author are
    distinct by CHECK), and whether it requires every registered dimension, which the gate requires.
  - **Runs** (the latest 50 of the tenant). For each run: the pinned agent, model and prompt versions, the
    database-derived status, and coverage per dimension (cases, failures, whether the requirement is met). Case keys and
    evidence hashes are never returned.
  - **Activation gate by agent.** For each agent's current version, the condition of
    `ai_agent_version_activation_gate`, re-evaluated: `PASSED`, or `NOT_PASSED` with `MODEL_OR_PROMPT_NOT_CONFIGURED`
    or `NO_PASSING_EVALUATION`. As in the trigger, a passing run counts whichever tenant recorded it, because agent
    versions are global. `activation: NOT_PERFORMED_HERE`: the view activates nothing.
- **Interface:** an Evaluations tab in the AI Control Center (`AiEvaluationView`). It shows the framework status, the
  count of versions that would pass the gate (in a live region), suites, runs with their coverage, and the gate for each
  agent, in words.
- **Tests:** `aiControlCenterEvaluations.test.ts` on PGlite covers:
  - before and after the proposal is applied;
  - an unapproved suite, a failing run, a partial suite, and a passing run against an approved full suite (gate passes;
    nothing is activated);
  - tenant scope, role denial, and the HTTP route (`no-store`, no mutation methods).

  Panel unit tests cover the tab and the wording.

## Not in scope

Running evaluations, approving suites, activating versions, model calls and owner thresholds per dimension. Those stay
owner and governance decisions (`AI-AGENTS-SPECIALISTS` remains blocked by policy).
