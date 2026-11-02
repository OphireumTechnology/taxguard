# Block 106: remaining references to third-party AI technology

Status: **development checkpoint.** No deployment. No model, runtime or governance rule changed.

The built browser bundle has none of these names, endpoints or paths: `npm run security:white-label` checks it after every
build. The references that remain in source are below. None reaches an ordinary user through a mounted screen.

## Kept on purpose (authorized records and notices)

| Where | What | Why |
|---|---|---|
| `docs/THIRD_PARTY_AI_NOTICES.md` | Creators and licences | Required truthful notice |
| `src/server/ai/localModelProvenance.ts` | Base model, engine, licences | Governance-role diagnostics only |
| `src/server/ai/TaxGuardAiAudit.ts`, `src/server/taxguard/authority.repository.ts` | Provider and model in audit records | Audit accuracy |

## Internal code, not sent to users

| Where | What |
|---|---|
| `src/server/ai/gateway/*`, `src/server/ai/OpenAIReasoningProvider.ts`, `src/server/ai/TaxGuardOpenAIService.ts` | Adapter and provider identifiers |
| `src/server/ai/TaxGuardGeminiGateway.ts` | Disabled gateway: `propose()` always refuses, so nothing is sent |
| `src/server/config/stagingConfiguration.ts` | The name of a secret variable, used to refuse exposing it |

## In source, removed from the build

These are in the source tree but not in the bundle: `src/taxguard/*` is not mounted by `App.tsx`, and `src/types/index.ts`
holds type declarations only.

| Where | What |
|---|---|
| `src/taxguard/views`, `components`, `services`, `knowledge`, `intelligence`, `types` | Former provider names |
| `src/types/index.ts` | A type union |
| `src/demo/mockData.ts` | Demonstration records |

## Development data

`src/data/intakeSeedData.ts` holds synthetic seed records with a former provider name, and `src/server/db.ts` loads them into
memory on every server. The one route that read that name into a response (`staging.routes.ts`, which production does not
mount) no longer includes it. The names stay in the fixtures because tests read them.

## Requires an owner decision

- **Optional cloud path.** `POST /api/case-authority/.../ai-review` calls a cloud provider, sending counts only, if an operator
  sets both `TAXGUARD_OPENAI_CASES_ENABLED=true` and an API key. It is off by default, and it is not a fallback: local failure
  never triggers it. The owner's configuration says cloud inference stays disabled, so removing the path is the owner's call.
- **`taxguard-private:8b`.** The older model name remains installed and has not been tested against the identity checks.
- **`ollama run`.** The terminal shows reasoning unless started with `--think=false`. Reasoning cannot be disabled from a
  Modelfile, so TaxGuard's own calls disable it on each request.
