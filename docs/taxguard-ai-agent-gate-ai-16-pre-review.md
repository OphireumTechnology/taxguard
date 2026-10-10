# AI-16 required material-action architecture boundary

Review only. No authoritative action handler implemented or privilege granted. The earlier missing optional agent mappings remain denied and are not themselves a stop request.

After the lifecycle diagnosis and full validation, development resumed through the restricted AI-15 correction/rejection service. That service deliberately refuses APPROVED. A real AI-16 material-action service cannot bypass this requirement or claim an always-denied placeholder is actual authoritative execution.

## Required decisions

1. Define the initial concrete record-writing operation, its exact server-owned action/service identity, target record/fields, permitted initiating human roles and workflow stage, evidence/rule prerequisites and idempotency contract. The foundation's action_service text field is not a trusted executable catalog. Existing agent permissions remain DENY; broad CREATE/UPDATE/APPROVE would not establish a narrow material action profile.
2. Define the required PREPARER -> REVIEWER -> CPA/EA attestation chain for that operation, including whether reviewer and CPA/EA must be distinct people and which source proves each completed attestation. Current ai_human_reviews excludes a PREPARER role and its trigger binds reviewer_user_id to the case's single reviewer_uid. requested_by proves initiation, not preparer approval. A verified CPA credential proves qualification, not completion of an additional approval step.
3. Establish the durable target adapter and cutover boundary. Legacy process-local case authority is not silently promoted to durable material-record authority. Production cutover/migrations/data changes remain separately prohibited.

This is a required material-authority decision, not a routine gate/test approval. Granting an arbitrary mutation or treating a model/run/high confidence as human approval would violate the architecture. Final approval and material authoritative writes remain blocked; optional unmapped agents remain UNMAPPED_DENIED. No production action is requested.

Resume: resolve the concrete action/attestation profile from an authoritative repository policy or explicit governance decision; implement the narrow server-owned action service and additive test-only schema changes if necessary; verify independent human authority, scope, evidence, immutable audit, replay and rollback; run all regressions before proceeding to AI-17. Do not widen scope by copying another agent's permissions.
