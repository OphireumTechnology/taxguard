# Messaging, appointments and legal matters: access policy decision (owner)

Status: **read-only audit; no access was changed.** These three domains still decide staff access per client. Each
domain holds both engagement-attached records and general client-level records. The general records need an
approved policy before anything changes.

## Findings (current definitions, execution order)

| Domain | Records carry | Staff access today | What an engagement-year assignee reaches |
|---|---|---|---|
| Messaging (`taxguard_comm_*`, proposal 039 / 20261013390000) | thread: optional `engagement_id`, optional `case_id`; messages `CLIENT_VISIBLE` or `INTERNAL_ONLY` | `taxguard_doc_actor`: any active assignment to the client, or a manager | every thread of the client, including other engagements' threads and their `INTERNAL_ONLY` staff notes; can open threads on any engagement and post to any thread |
| Appointments and rooms (`taxguard_apt_*`, `taxguard_room_*`, 20261014400000 / 20261016030000) | optional `engagement_id`, `staff_uid`, staff-only `internal_note` | `taxguard_doc_actor` | every appointment of the client, including internal notes and other staff members' meetings; can reschedule or transition them |
| Legal matters (`taxguard_legal_*`, 20261014420000) | optional `engagement_id`; external attorney and law-firm details | `taxguard_doc_actor` (`taxguard_legal_staff_actor` adds no engagement check) | every matter of the client, including counsel details, and can update or transition them |

Client access is correct in all three: a client reaches only its own client, never sees `INTERNAL_ONLY` messages or
internal notes, and archived threads are hidden.

## Engagement-attached records (recommended, no policy question)

A thread, appointment or matter that names an engagement (or a case) belongs to that engagement. The recommended
rule is the one Packages A, B and 20261018100000 already use (`taxguard_staff_record_scope` /
`taxguard_practice_item_scope`):
- engagement only: visible to staff assigned to any year of that engagement;
- case-linked thread: the case's engagement and year;
- refusals reuse the existing not-found codes, so an out-of-scope record is indistinguishable from a missing one.

This is ready to implement once the owner confirms the general-record policy below, so the domain changes once.

## General client-level records (owner decision required)

These are threads, appointments and matters with no engagement, such as a client's general question, an intake
meeting or an estate matter not tied to a return.

| Option | Who sees a general record | Benefit | Risk |
|---|---|---|---|
| A. Client-level (today) | any staff member with an active assignment to the client, plus managers | continuity: the whole team sees the client's general conversation | an engagement-scoped preparer reads internal notes and legal matters unrelated to their work; least privilege not met |
| B. Whole-client only | client-wide staff, managers and administrators | strongest confidentiality | the assigned preparer cannot see or answer the client's general questions; replies are delayed; clients may resend to the wrong channel |
| **C. Participants plus whole-client (recommended)** | client-wide staff, managers and administrators, plus the record's own participants (thread creator and message authors, the appointment's `staff_uid` and creator, and the matter's `created_by` and last `updated_by`; legal matters have no assignee column) | least privilege with continuity: people already in the conversation keep it, and nobody else is added silently | a general thread must be routed (assign a participant, or attach an engagement) to reach the team; this needs a small routing action for managers |

**Recommendation: C**, plus a manager action to attach a general record to an engagement, which then follows the
engagement rule. `INTERNAL_ONLY` messages in a general thread follow the thread's visibility, never wider.

## Implementation outline (after approval)

1. One proposal replacing the current `taxguard_comm_*`, `taxguard_apt_*`, `taxguard_room_*` and `taxguard_legal_*`
   reads and writes. Each is copied from its current definition with a scope check (engagement-attached: record
   scope; general: the approved option).
2. Failing-first DB tests that mirror `practiceClientDetailScope.db`. They cover cross-engagement, cross-year,
   general records under the chosen option, participants, client-wide staff, managers, administrators, clients,
   other clients and tenants, revocation, refused writes leaving no rows or audit entries, and no existence
   disclosure on replay.
3. Browser suites 10 (messaging) and the appointment and legal suites are rerun unchanged, plus a staff-portal
   check that a scoped preparer's inbox omits other engagements' threads.
