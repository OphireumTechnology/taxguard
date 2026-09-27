# TaxGuard Production Deployment Architecture

## Required runtime boundary

TaxGuard production uses two runtime responsibilities.

### Frontend

The React/Vite application serves the user interface.

Frontend routes may use SPA fallback.

### API

All /api routes must execute on the TaxGuard Node/Express backend.

API routes must never fall through to the static frontend or index.html.

## Authentication flow

1. User authenticates through Firebase Authentication.
2. Browser obtains the Firebase ID token.
3. Browser POSTs the token to the TaxGuard firebase-session endpoint.
4. The request must reach the Node API runtime.
5. Firebase Admin verifies the token.
6. TaxGuard resolves the application user and permanent Client ID.
7. The server establishes the TaxGuard application session.
8. Authorization and client/tenant boundaries are enforced.

HTTP 405 on the session POST is a production release blocker.

## Production security

Production CORS must use explicit approved HTTPS origins.

Wildcard production origins are prohibited.

Server credentials and service-account private keys must remain server-side.

Secrets must not be committed to the repository or bundled into the frontend.

## Verification

Local unit tests do not prove that production infrastructure works.

Production must independently verify:

- health
- API routing
- CORS
- Firebase authentication
- application session
- database persistence
- tenant isolation
- document intelligence
- audit
- monitoring
- backup and restore
- security
- end-to-end workflow

## Tax filing

External electronic tax submission remains disabled until a separately authorized and validated filing integration is implemented.
