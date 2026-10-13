# Document requests and checklists (Phase 3)

**PRODUCTION STATUS: NO-GO.** Proposal 031 (`20261012310000_taxguard_document_requests.sql`) is
**not applied** anywhere. The routes answer only through the development-only durable vault router.
Synthetic data only. No e-mail or SMS is sent.

## Model

| Concept | Behaviour |
| --- | --- |
| Firm checklist (`taxguard_docreq_templates`) | Manager-defined list of documents to request (title, vault category, required/optional, optional accepted types and minimum count). Versioned on save. **Contains no tax rules**; what to request is the firm's decision. |
| Request (`taxguard_doc_requests`) | Scoped to tenant, client, engagement and tax year (foreign key to the engagement year). Upload requirements: category, accepted file types (subset of the vault's types), minimum verified documents, optional due date, instructions. Created individually (idempotency key) or by applying a checklist (re-applying never duplicates). |
| Status | `OPEN` → `SUBMITTED` (a linked document is awaiting scan or review) → `FULFILLED` (enough linked documents **VERIFIED by staff review**). `WAIVED` / `CANCELLED` are final and need a recorded reason. Status is recomputed by a trigger whenever a linked document changes status; a replacement request or rejection reopens it. |
| Link (`taxguard_doc_request_links`) | Append-only. Clients may link only their own uploads; the document must be in the same engagement year, match the category and accepted types, and not be infected, rejected or superseded. |
| Notification (`taxguard_client_notifications`) | In-app outbox for the client: request created, reminder, fulfilled, waived, withdrawn, replacement needed, rejected. Channel `IN_APP`, delivery `NOT_CONFIGURED`. Titles only — never document contents, reviewer notes or amounts. Only `read_at` may change, once, by the client. |

## Authority (database-enforced)

- Create / apply checklist / remind: staff with access to the client (not clients, recruiters or bookkeepers).
- Waive a **required** request: the engagement year's assigned reviewer or a manager; optional requests: any staff with access. Withdraw (cancel): managers. Optimistic `rowVersion` on both.
- Reminders: at most one per request per 24 hours (429 otherwise).
- Missing-document tracker and request-aware review queue: staff, filtered to clients they may see.
- Every create, link, status change, waiver, withdrawal, reminder and checklist save is audited with `metadata.clientId`.

## Stage 2 and 3 integration

Proposal 026 now calls an extension hook, `taxguard_case_evidence_checks`, on attested stages (a
no-op unless a later proposal defines it; re-applying 026 never replaces it). Proposal 031 defines it:

- Stage 2: `requiredDocumentRequestsResolved` (no required request OPEN or SUBMITTED) and `noDocumentsAwaitingScan`.
- Stage 3: the above plus `noDocumentsAwaitingReview`.

The reviewer's attestation cannot complete the stage while any of these is false
(`STAGE_GATE_NOT_MET` with the failed checks), and the checks are stored with the stage evidence.

## API (`/api/vault`)

`GET /requests/missing`, `GET /requests/review-queue`, `GET|POST /request-templates`,
`GET|POST /clients/:clientId/requests`, `POST /clients/:clientId/requests/apply-template`,
`POST /clients/:clientId/requests/:requestId/(link|waive|cancel|remind)`,
`GET /clients/:clientId/notifications`, `POST /clients/:clientId/notifications/:id/read`.
The practice-manager capability list admits these (except the client-only read receipt) only while
the development-only durable routers are configured.

## UI

- Client portal → Documents: **Requested documents** (status, due/overdue, upload straight into a
  request with its accepted types) and **Notices** with unread count and "Mark read".
- Practice Manager → **Document Requests**: missing-document tracker (tax year, overdue only, Remind),
  per-client requests (Waive / Withdraw with recorded reason), new request, apply a firm checklist,
  save a checklist.

## Tests

`documentRequestsHttp.test.ts` (8; mutation-checked: removing the 026 hook call or breaking the
fulfilment rule fails it), `documentRequestsPanels.test.tsx` (4), `proposalCompositionSecurity`
(031 included), `npm run test:db` composition (031 included), browser `05-document-requests` (4).

## Limitations

No e-mail/SMS delivery (no provider; outbox only). No per-request client comments. Accountant and
reviewer workspaces reach requests through the API and the manager module only. Proposal unapplied.
