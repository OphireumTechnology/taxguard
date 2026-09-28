# TaxGuard LIVE Development & Deployment Policy

TaxGuard is developed as a LIVE production application.

## Source Control

- `main` represents the production website.
- Development branches contain work in progress.
- Every production milestone must have a Git commit.
- Production deployments must be traceable to a Git commit.
- No untested source code may be promoted to `main`.

## Required Release Gates

Before production promotion:

1. TypeScript compilation must pass.
2. Targeted feature/security tests must pass.
3. Full regression suite must pass.
4. Production build must pass.
5. Production/demo boundary tests must pass.
6. No browser-exposed secrets are permitted.
7. No production source may depend on demo authority.
8. Security-critical services must fail closed when unavailable.

## Production Authority

LIVE TaxGuard must use:

- authenticated server APIs;
- Firebase Authentication;
- durable server-side persistence;
- production document storage;
- server-side authorization;
- immutable/auditable workflow events;
- maker-checker controls;
- server-side AI gateway;
- production environment configuration.

Demo services, synthetic authority, mock authorization,
simulated production persistence and browser-side system-of-record
state are prohibited from LIVE execution.

## AI

OpenAI/Gemini integrations execute server-side only.

AI results are advisory/proposed outputs and may not independently:

- approve tax positions;
- certify validation;
- approve returns;
- authorize signatures;
- authorize filing;
- override deterministic tax calculations;
- bypass professional review.

## Deployment

Validated milestone:

Development Branch
    -> Tests
    -> Production Build
    -> Commit
    -> Push
    -> main
    -> GitHub Actions
    -> artaxserv.com
    -> Post-deployment verification

A successful local build alone does not constitute a production release.
