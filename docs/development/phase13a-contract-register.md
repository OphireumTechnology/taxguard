# Phase 13A contract register (C1–C8)

Branch `claude/taxguard-phase13a-contract-completion`, from `origin/main` `6c3390c` (merge of PR #19). Synthetic data
only. No proposal has been applied anywhere external, nothing has been deployed, and the protected
production project is never accessed. C9 is covered by PR #18 and is not duplicated here. Nothing
from the unmerged PR #18 or PR #20 is included.

Status columns are independent. **Implemented in code** means the code is committed on this branch;
**locally validated** means unit (PGlite) tests pass on this machine; **staging validated** and
**production commissioned** need an isolated non-production project and owner approval. Neither
exists yet.

| ID | Contract | Implemented in code | Locally validated | Staging validated | Production commissioned |
|---|---|---|---|---|---|
| C1 | Client consultation history | YES | YES | NO | NO |
| C2 | Client MFA management | PARTIAL (status only) | YES | NO | NO |
| C3 | Client reads for tax stages 04–08 | YES | YES | NO | NO |
| C4 | Durable staff onboarding | YES (status); dossier deferred | YES | NO | NO |
| C5 | Durable consultation rooms | YES (no video provider) | YES | NO | NO |
| C6 | Notification delivery preferences | YES (in-app only) | YES | NO | NO |
| C7 | Live per-agent commissioning records | YES (read-only) | YES | NO | NO |
| C8 | Contact form delivery | PREPARED, DISABLED | YES | NO | NO |

## C3: client reads for tax stages 04–08

- Proposal `20261016000000_taxguard_portal_case_stages.sql`: `taxguard_portal_case_stages`.
- Route: `GET /api/client-portal/clients/:clientId/case-stages?engagementId&taxYear`.
- UI: `ClientCaseStageView`, shown for stages 04–08 in the client portal.
- The response gives case status, the active stage, that stage's requirements, boolean-only
  system checks, evidence counts, and whether a preparer and reviewer are assigned. It gives no
  staff identities, notes or financial figures. Draft and cancelled engagements are not shown to
  clients.
- Stages 09–18 stay blocked.
- Tests: `portalCaseStages.test.ts` (11): cross-client, cross-tenant, unassigned staff, recruiter,
  guessed ids, malformed input, private metadata and service-role-only grants.

## C1: client consultation history

- Proposal `20261016010000_taxguard_portal_consultations.sql`: `taxguard_portal_consultations`.
- Route: `GET /api/client-portal/clients/:clientId/consultations`, keyset paged with an opaque
  cursor.
- UI: `ClientConsultationHistoryPanel` on the client dashboard.
- Only the client's own converted requests are returned, with the appointment's current status.
- Tests: `portalConsultations.test.ts` (7).

## C4: durable staff onboarding

- Proposal `20261016020000_taxguard_staff_onboarding_status.sql`.
- Server: `staffOnboardingStatus.ts`.
- Route: `POST /api/staff-access/onboarding/status`, using the verified provider token.
- UI: `StaffOnboardingStatusPage` on the `staff_onboarding` route, which still requires a signed-in
  user. It reports membership status, invitation acceptance, MFA assurance and recovery state,
  assignment counts, and next steps.
- The in-memory onboarding wizard is no longer reachable. `/api/onboarding` stays mounted for
  `AppContext` callers.
- **Deferred (owner decision):** a professional dossier (credentials, PTIN / EFIN) needs an
  approved data and retention model.
- Tests: `staffOnboardingStatus.test.ts` (12).

## C5: durable consultation rooms

- Proposal `20261016030000_taxguard_appointment_rooms.sql`.
- Routes:
  - `GET /api/scheduling/clients/:clientId/appointments/:id/room`
  - `POST .../room/join|leave`
- UI: `ConsultationRoomPanel`, shown in confirmed remote appointment details, and the
  `virtual_consultation_room` route.
- Room state is derived from the appointment: OPEN, NOT_YET_OPEN, NOT_CONFIRMED, NOT_REMOTE,
  CANCELLED or ENDED. The window runs from 15 minutes before the start to 15 minutes after the end.
  The meeting link is shown only while the room is open.
- Participants are the client, the assigned host and practice managers.
- Join / leave events are append-only, idempotent and capped at 50 per participant, and are audited
  with identifiers only.
- **No video is provided, recorded or implied:** `videoProvider` is `NOT_COMMISSIONED`. Recording
  needs a provider, a consent policy and a retention policy.
- The in-memory room UI is no longer reachable. `/api/consultation-rooms` is still mounted and
  should be retired once no consumers remain.
- Tests: `appointmentRooms.test.ts` (9) and `consultationRoomUi.test.tsx` (4).

## C6: notification preferences

- Proposal `20261016040000_taxguard_notification_preferences.sql`. It uses a new table,
  `taxguard_client_notification_prefs`; the unused legacy `taxguard_notification_preferences`,
  whose e-mail flag defaults to TRUE, is left untouched.
- Routes: `GET|POST /api/vault/clients/:clientId/notification-preferences`.
- UI: `ClientNotificationPreferencesPanel`, below the notifications list.
- Only document reminders can be turned off. Document-request notices and security / legal notices
  are locked on. Muting hides reminders for that client user only, and the list reports how many
  are hidden.
- E-mail and SMS are reported as NOT_COMMISSIONED and cannot be stored. The change uses an
  optimistic version, an audit row and a cap of 200 changes.
- **Blocked (owner decision):** e-mail / SMS transport, channel-consent wording and a retention
  policy.
- The legacy in-memory `/api/practice-operations/notifications/preferences` route has no frontend
  consumer and is left for retirement.
- Tests: `notificationPreferences.test.ts` (7) and `notificationPreferencesUi.test.tsx` (3).

## C7: live per-agent commissioning records

- Code: `ControlCenterReadService.commissioning()`, served at
  `GET /api/ai-governance/control-center/commissioning` to governance roles.
- UI: "Live governance records" in the AI commissioning view.
- Read-only facts per agent come from the tenant's live governance tables: registry status, model
  and prompt approval, grants (including non-read grants), active approval policies, emergency stops
  and recorded runs.
- DRAFT stays DRAFT and stopped agents show as STOPPED. No commissioning-record schema exists, so
  no agent is ever reported as commissioned. AI-16 material actions are always BLOCKED. There are no
  enable, approve or commission controls.
- Tests: `aiCommissioningRecords.test.ts` (6), including a before/after snapshot proving no
  mutation, and `aiLiveCommissioningUi.test.tsx` (2).

## C8: contact form delivery (prepared, disabled)

- Proposal `20261016050000_taxguard_contact_intake.sql`.
- Code: `ContactStore` and `/api/public/contact`, mounted on the development server only.
- Two gates keep it disabled:
  1. The route answers 503 `CONTACT_INTAKE_DISABLED` unless `TAXGUARD_CONTACT_INTAKE=enabled` is
     set with a configured store.
  2. The database refuses every submission (`CONTACT_INTAKE_NOT_APPROVED`) until an approved intake
     policy is recorded. The proposal inserts none and provides no writer.
- With a policy, the policy drives consent version, retention expiry and abuse limits. There is a
  honeypot, idempotency, a manager-only list and an expiry purge.
- No e-mail is sent, and no response claims delivery. The contact page keeps its e-mail hand-off.
- Tests: `contactIntake.test.ts` (7). A synthetic policy is inserted only to exercise the gated
  path.

## C2: client MFA management (partial)

- Code: `src/supabase/clientMfa.ts` and `ClientMfaPanel`, in the client security "MFA &
  Credentials" tab.
- It reads the identity provider's assurance level and factor counts for the client's own provider
  session. There is no parallel credential store, and nothing is enrolled, verified or removed.
- **Blocked:**
  - Enrolment. Client sign-in does not yet ask for an authenticator (no AAL2 step), so an enrolled
    factor would not protect the account.
  - A client MFA policy and a recovery process are owner decisions.
  - Provider-backed actions need a non-production project.
- Tests: `clientMfaStatus.test.tsx` (4) and the existing `clientSecurityTruthfulness.test.tsx`.

## Owner decisions raised by Phase 13A

1. Staff professional dossier data model and retention (C4).
2. Video provider, recording consent and retention, if rooms should carry video (C5).
3. E-mail / SMS transport, channel-consent wording and notification retention (C6).
4. A commissioning-record schema and approval workflow; AI-16 stays blocked (C7).
5. Contact intake policy: consent wording, retention period and abuse limits (C8).
6. Client MFA policy, a client sign-in AAL2 step and the recovery process (C2).
7. Retirement of `/api/consultation-rooms`, `/api/onboarding` and the in-memory notification
   preferences route once no consumers remain.
