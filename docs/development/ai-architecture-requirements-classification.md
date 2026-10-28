# TaxGuard AI architecture: requirement classification (2026-10-28)

Classification of the **Master Architecture Implementation Directive** (2026-10-28) against the repository, using the
states of the Development Execution Directive (2026-10-28). Source of truth for each row is `docs/development/architecture-implementation-register.json`
(register status in brackets) and the 11-page Architecture Overview recorded in
`docs/development/ai-architecture-overview-reconciliation.md`.

| State | Meaning here |
|---|---|
| IMPLEMENTED | Built and verified in development (unit, PostgreSQL or browser). **Not** production-ready: nothing is deployed and production refuses every durable router until the owner approves the review-only proposals. |
| PARTIAL | Some of the requirement is built; the gap is listed. |
| NOT_STARTED | Not built. |
| BLOCKED_EXTERNAL | Needs an external provider or service that is not commissioned. |
| BLOCKED_POLICY | Held by a standing instruction or policy (for example no live filing, Stage 09 not authorized). |
| REQUIRES_APPROVAL | Built as far as allowed; the next step is an owner, legal or professional decision. |

No component is production-ready. Block 66 (PR #37) and Block 67 (PRs #38, #41) are merged; `main` restored by PR #42.

## Section 3: agent architecture (pages 1-3)

| Requirement | State | Evidence and gap |
|---|---|---|
| A00 + A01-A60 identities, eight categories of page 3 | IMPLEMENTED | `src/ai/registry.ts`, migration `20261008000000` [AI-REGISTRY UNIT_VERIFIED]; page 3 categories match exactly |
| Defined responsibilities | REQUIRES_APPROVAL | Recorded for 59 agents from page 2 (reference only); A10/A39 undefined (OV-01, decided: unassigned) |
| Approved tools, permitted data, permitted stages | REQUIRES_APPROVAL | Permission tables exist and deny by default [AI-PERMISSIONS INTEGRATION_VERIFIED]; no per-agent grant is approved; page 9 is an example (OV-06/07/08) |
| Tenant/client/case/year scope | IMPLEMENTED | Server governance requires exact scope and live assignment [AI-PERMISSIONS, SEC-ISOLATION] |
| Model configuration, prompt version | REQUIRES_APPROVAL | Registries and versioning exist [AI-MODEL-PROMPT-REGISTRY]; no model or prompt approved |
| Input / output schema | PARTIAL | Prompt records carry required inputs and expected output schema; none written for any agent |
| Confidence and human-review requirements | PARTIAL | Thresholds per agent (all 1.0, i.e. always review) and approval policies exist [AI-HUMAN-APPROVAL]; per-agent values unapproved; owner decided always human review (OV-09) |
| Audit logging, error handling | IMPLEMENTED | Execution ledger and governance decisions, fail-closed admission [AI-RUN-RECORD, AI-GOV-PLANE] |
| Cost limits | PARTIAL | Token and cost tables exist [AI-COST]; every budget is 0 and no pricing is configured |
| Emergency stop | IMPLEMENTED | Global, agent, model, tool and workflow stops [AI-KILL-SWITCH PROVIDER_VERIFIED] |
| Non-commissioned state until approved | IMPLEMENTED | All 61 DRAFT; commissioning gates 0 / 61 |

## Section 4: A00 orchestration (page 4)

| Requirement | State | Evidence and gap |
|---|---|---|
| Event intake, case identification, verification | PARTIAL | Admission verifies tenant, user, role, case, year and stage; no general event intake or request classifier |
| Agent selection, permission verification | PARTIAL | Canonical routing for the bounded A00 -> A34 and A00 -> A10 purposes only [AI-A00, AI-COMMUNICATION] |
| Authorized context retrieval | PARTIAL | Scoped read repository; model input is counts only [AI-PROMPT-INJECTION] |
| AI reasoning | REQUIRES_APPROVAL | No model commissioned |
| Structured proposal, verification, confidence/risk | PARTIAL | Proposal and verification records exist; risk evaluation has no materiality policy [TAX-RISK] |
| Human-review routing | PARTIAL | Per-domain review exists; no central cross-domain approval queue [AI-HUMAN-APPROVAL] |
| Authoritative action, audit ledger | PARTIAL | Authoritative action records exist; durable routers not released [REC-AUTHORITATIVE] |
| No peer-to-peer agent communication, no automatic material approval | IMPLEMENTED | No such path exists; owner decision OV-09 |

## Section 5: document intelligence (page 5)

| Requirement | State | Evidence and gap |
|---|---|---|
| Upload with original, version, hash, tax year | IMPLEMENTED | [IN-DOCUMENTS BROWSER_VERIFIED] |
| Security scanning | BLOCKED_EXTERNAL | Quarantine and scan gate built; real scanner not commissioned (local fake only) |
| Classification, OCR/extraction | BLOCKED_EXTERNAL | Proposal and validation queue built with a synthetic stand-in [TAX-DOC-INTELLIGENCE] |
| Extraction validation, human verification | IMPLEMENTED | Accept / correct / reject queue, decided proposals required for Stage 03 (Blocks 63-64) |
| Duplicate / fraud checks | PARTIAL | A10 duplicate-hash advisory only; no fraud assessment |
| Evidence creation, reviewer identity and decision, audit | IMPLEMENTED | [TAX-EVIDENCE BROWSER_VERIFIED]; Block 66 conclusions |
| Federal / state analysis | PARTIAL | Conclusions recorded by people; no rule content or agent [TAX-RULE-ENGINE] |
| Deterministic calculation and verification | PARTIAL | Pinned runs, verification cases [TAX-CALCULATION, TAX-CALC-VERIFICATION PARTIAL]; synthetic rules only |
| Form mapping | PARTIAL | Block 67 (merged): deterministic mapping with lineage, jurisdiction and effective dates; synthetic form only |
| Diagnostics, professional review | PARTIAL | Case-readiness diagnostics and reviewer queue; no return-level diagnostics |

## Section 6: tax return pipeline (page 6)

| Requirement | State | Evidence and gap |
|---|---|---|
| A11 Evidence, A16 Book-to-Tax, A17 Research (as deterministic, human-run functions) | IMPLEMENTED | [TAX-EVIDENCE, TAX-BOOK-TO-TAX, TAX-RESEARCH]; not agents |
| A18-A27 tax domain agents | REQUIRES_APPROVAL | Not built; A21 naming conflict (OV-12) |
| Tax rule engine | PARTIAL | Versioned, year-aware, maker-checker; no real rule content (needs professional verification) |
| Calculation engine, A28 verification | PARTIAL | See section 5 |
| A29 Return preparation | BLOCKED_POLICY | Stage 09 blocked by policy [TAX-RETURN-PREP]; Block 68 |
| A30 Form mapping | PARTIAL | Block 67 |
| A31 Diagnostics, A33 Risk, A34 Reviewer, A35 QC | PARTIAL | Case-level only; no materiality policy; no separate QC role [TAX-DIAGNOSTICS, TAX-RISK, TAX-REVIEW-QC] |
| CPA/EA approval, signing, filing | BLOCKED_POLICY | Stages 10-13 and 16 gated [TAX-SIGN-FILE]; live filing prohibited |
| Material value traceable to evidence, rules, calculation, review | PARTIAL | Evidence -> conclusion -> calculation -> form line (Blocks 65-67); return assembly missing |

## Sections 7-9: governance, execution records, permissions (pages 7-9)

| Requirement | State | Evidence and gap |
|---|---|---|
| Agent, model, prompt registries; model versioning | IMPLEMENTED | Empty of approved models and prompts |
| Tool, data, stage permissions; default deny | IMPLEMENTED | Server-side, composed-schema PostgreSQL tests |
| Confidence thresholds, human approval requirements | IMPLEMENTED | Values unapproved (see section 3) |
| Token and cost limits | PARTIAL | No budgets configured |
| Evaluation | PARTIAL | Activation gate and records (review-only proposal); no evaluation runner |
| AI audit logs | IMPLEMENTED | [AI-RUN-RECORD] |
| Kill switch | IMPLEMENTED | Lifting a stop needs an approved policy |
| Compliance and policy engine | PARTIAL | Governance decisions and policy events; no firm-policy authoring |
| Monitoring and alerts | PARTIAL | Health endpoints; no log shipping or alerting [OPS-MONITORING] |
| ai_run record with every page-8 field and authoritative action reference | IMPLEMENTED | `AIRun` contract and ledger `20261008050000` |
| Page-9 per-agent permissions | REQUIRES_APPROVAL | Recorded as an example ceiling; owner kept human-only powers with people (OV-06) |

## Section 10: AI Control Center (page 10)

| Required section | State | Evidence and gap |
|---|---|---|
| Agent status, agent lifecycle | PARTIAL | Registry tab and commissioning gates; registry states are DRAFT/ACTIVE/RESTRICTED/DISABLED/OFFLINE/RETIRED, so Evaluated, Approved, Commissioned and Suspended are shown only as commissioning gates |
| AI runs, run outcomes | PARTIAL | Execution history table; no outcome summary chart |
| Compliance and risk, security events | PARTIAL | Governance decisions and security events tables; no compliance summary |
| Token and cost monitoring, model usage | PARTIAL | Usage tab per agent; no per-model view |
| Human approval queue | PARTIAL | Awaiting-review counts in the usage tab; no cross-domain queue |
| Agent activity, performance, exceptions | NOT_STARTED | Nothing operational to measure yet |
| Quick actions | NOT_STARTED | |
| Emergency kill switch | IMPLEMENTED | AI Emergency Stop panel |
| Architecture reference (not in page 10) | IMPLEMENTED | Architecture overview tab (this branch) |
| No illustrative metrics shown as real | IMPLEMENTED | Server projections only; OV-11 |

## Section 11: unified platform (page 11)

| Portal | State | Evidence and gap |
|---|---|---|
| Client portal: onboarding, documents, communication, case status, approvals | PARTIAL | [IN-PORTAL, IN-DOCUMENTS BROWSER_VERIFIED]; stages 09-18 shown as unavailable; email/SMS providers blocked |
| Staff portal: clients, documents, preparation, calculations, diagnostics, review, exceptions | PARTIAL | Case Workflow panels through Block 67; return preparation missing |
| Admin portal: governance, registry, models, permissions, monitoring, audit, security, configuration | PARTIAL | Control Center, staff access, audit center; no model or permission authoring UI (nothing approved to author) |
| Same authoritative records and boundaries in all portals | PARTIAL | Shared server boundaries; durable routers unreleased in production |

## Section 12: block order and the next authorized step

| Block | Requirement | Current state |
|---|---|---|
| 66 | Evidence-to-conclusion traceability | Merged (`b0e0dca`) |
| 67 | Deterministic form mapping | Merged (PR #38, follow-up PR #41); jurisdiction and effective dates; synthetic form only |
| 68 | Return preparation | NOT_STARTED; Block 67 merged; starts after the CI baseline (whitespace PR) and `main` protection |
| 69-72 | Calculation verification, diagnostics, risk, review and QC | PARTIAL foundations (above) |
| 73-77 | A00 orchestration, specialists, evaluation, provenance, AI security | PARTIAL foundations; specialists REQUIRE APPROVAL |
| 78 | Authoritative records | PARTIAL |
| 79-83 | External integrations | BLOCKED_EXTERNAL (no provider commissioned) |
| 84-86 | Monitoring, recovery, security | PARTIAL |
| 87-91 | Acceptance and production readiness | NOT_STARTED; production NO-GO |

**Next authorized step:** merge the whitespace-correction PR (first fully green CI on the restored `main`), protect
`main`, then validate and open this reconciliation branch as its own PR. Block 68 starts after those gates.
