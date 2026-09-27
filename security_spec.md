# A/R Tax Services Portal - Security Specification & Test Matrix

## 1. Core Data Invariants & Zero-Trust Architecture
1. **Denial-by-Default**: Every path without an explicit allow rule is completely denied.
2. **Client Isolation**: A client (`role == 'client'`) can only read and create records where `ownerId == request.auth.uid` or `clientId == request.auth.uid`. A client cannot query another client's documents, invoices, appointments, or notifications.
3. **Accountant Assignment Binding**: An accountant can only access clients, documents, and requests where they are formally assigned (`assignedAccountantId == request.auth.uid` or explicitly assigned via organization/engagement).
4. **Administrator Verification**: Administrative rights are derived strictly from server-verified custom claims (`request.auth.token.role == 'administrator'`) or trusted lookup in `/admins/$(request.auth.uid)`.
5. **No Self-Assigned Privileges**: Users cannot change their own `role`, elevate privileges, mark subscriptions as paid, or approve their own invoices through Firestore client writes.
6. **Payment & Subscription Sanctity**: Subscriptions, Invoices status updates to `paid`, and Payments can only be written or altered by trusted Cloud Functions (`processedWebhookEvents`, Stripe signature verification).
7. **Storage Object Isolation**: Documents in Cloud Storage are quarantined in paths `/organizations/{orgId}/clients/{clientId}/{documentId}`. Reads require ownership or assigned CPA/Admin authorization.
8. **Audit Trail Immutability**: Records in `auditLogs` and `processedWebhookEvents` are append-only by server/functions and cannot be modified or deleted.

---

## 2. The "Dirty Dozen" Attack Payloads (Targeted Failures)
These payloads are intentionally constructed to test perimeter defenses. Under production rules, each payload MUST return `PERMISSION_DENIED`.

1. **Payload 1: Privilege Escalation on Register**
   - Attempt: Client registers `/users/{uid}` with `role: "administrator"`.
   - Result: `PERMISSION_DENIED`. Users cannot set role to administrator on creation.

2. **Payload 2: Role Mutation on User Profile**
   - Attempt: Authenticated client updates `/users/{uid}` with `role: "accountant"`.
   - Result: `PERMISSION_DENIED`. Field `role` is immutable by client.

3. **Payload 3: Cross-Client Profile Snoop**
   - Attempt: Client A (`uid_client_A`) queries `get /users/uid_client_B`.
   - Result: `PERMISSION_DENIED`. PII isolation blocks non-owner reads.

4. **Payload 4: Unassigned Accountant Snooping**
   - Attempt: Accountant X (`uid_cpa_X`) reads `/documents/{docId}` where `assignedAccountantId: "uid_cpa_Y"`.
   - Result: `PERMISSION_DENIED`. Strict assignment gate blocks access.

5. **Payload 5: Client Forging Paid Subscription**
   - Attempt: Client writes `/subscriptions/{subId}` with `status: "active"`, `amountCents: 0`.
   - Result: `PERMISSION_DENIED`. Client cannot create or update subscriptions.

6. **Payload 6: Client Self-Marking Invoice Paid**
   - Attempt: Client issues update to `/invoices/{invId}` with `{ status: "paid" }`.
   - Result: `PERMISSION_DENIED`. Invoices can only be marked paid via Cloud Functions.

7. **Payload 7: Client Reassigning CPA**
   - Attempt: Client updates `/serviceRequests/{reqId}` with `assignedAccountantId: "friendly_cpa"`.
   - Result: `PERMISSION_DENIED`. `affectedKeys` does not permit client modifying assignment.

8. **Payload 8: Shadow Field Injection (Resource Poisoning)**
   - Attempt: Client creates `/serviceRequests/{reqId}` containing unknown ghost field `{ isPreApproved: true, bypassKyc: true }`.
   - Result: `PERMISSION_DENIED`. Schema validation blocks unallowed keys.

9. **Payload 9: Huge String Denial-of-Wallet Attack**
   - Attempt: Client writes `/messages/{msgId}` with a 2MB string payload in `content`.
   - Result: `PERMISSION_DENIED`. Boundary check `size() <= 5000` rejects payload.

10. **Payload 10: Appointment Double-Booking via Direct Write**
    - Attempt: Client writes directly to `/appointments/{aptId}` bypassing the conflict-checking Cloud Function.
    - Result: `PERMISSION_DENIED`. Direct client creates must follow strict validation or transacted booking function.

11. **Payload 11: Tampering with Webhook Idempotency Store**
    - Attempt: Client writes to `/processedWebhookEvents/evt_test123`.
    - Result: `PERMISSION_DENIED`. Webhook store is write-restricted to trusted service account.

12. **Payload 12: Audit Log Deletion/Alteration**
    - Attempt: Compromised user attempts `delete /auditLogs/{logId}`.
    - Result: `PERMISSION_DENIED`. Audit logs are strictly immutable and non-deletable.
