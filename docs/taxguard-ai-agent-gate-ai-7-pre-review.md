# AI-7 pre-implementation review - unresolved authoritative mapping

Superseded by the user's mapping-resolution instruction. Missing individual authority is now explicitly UNMAPPED / DENIED, not a reason to request another gate approval. See taxguard-ai-canonical-architecture.md and taxguard-ai-agent-gate-ai-7.md. The historical findings below remain evidence of missing authority; the old required-input/stop guidance no longer controls development.

Continuous non-production implementation authorization is active. This is a requirements boundary, not a request to reapprove ordinary development or the next gate.

## Confirmed evidence

- src/ai/registry.ts registers A01-A04 as CLIENT SERVICES 01-04, DRAFT. Each description explicitly states that its exact specialized name requires the missing approved architecture mapping.
- docs/taxguard-ai-agent-baseline.md identifies the missing multipage TaxGuard AI Architecture Overview, including its page-9 permission matrix.
- docs/taxguard-ai-legacy-mapping.md states that unknown specialized identities/permissions must not be invented and that the visual-to-LEGACY_18_V1 stage mapping is not an authorized one-to-one mapping.
- design-reference/architecture-workflow.png was inspected again. It defines roles, domain services and the visual 18-stage workflow, not an A01-A04 responsibility/permission matrix.
- Scoped artifact inventory found no Architecture Overview PDF or per-agent matrix. tools/taxguard-agent-v2/config/architecture.json is unrelated legacy developer automation, not the taxpayer-serving canonical agent architecture.

The master directive lists onboarding, identity verification, engagement, communication, appointments and support for four agent IDs but does not assign those functions individually. Assigning them arbitrarily would violate narrow specialization, canonical authority and deny-by-default permission requirements. In particular, document metadata is not authoritative proof of identity, engagement acceptance or an appointment/communication action.

## Required input

Provide the approved mapping for A01, A02, A03 and A04, or the repository path to the approved Architecture Overview containing it. For each ID, establish:

- responsibility and supported task/purpose;
- permitted initiating roles and effective assignment;
- allowed capabilities/actions and data classes;
- authoritative evidence/source requirements;
- allowed stages using LEGACY_18_V1, or an explicitly approved compatibility mapping;
- required human approval and prohibited actions.

Do not provide credentials, taxpayer records or production keys. Existing continuous authorization remains sufficient for subsequent ordinary implementation once these requirements are resolved. Production activation and communications remain separately blocked.

## Safe resume

Complete/verify AI-6 validation and report first. Then use the approved mapping to implement AI-7 through existing governance, gateway, capability and ledger layers. Use only isolated ACTIVE fixtures, retain DRAFT deployment metadata, preserve all regression tests, validate fully, document and continue automatically. No AI-7 source implementation or permission grant has been made.
