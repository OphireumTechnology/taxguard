# Block 94: browser evidence in four traceability rows

Status: **development checkpoint, stacked on Block 93 (`3a2fcc0`).** Register only; no server, database or user
interface change.

## Purpose

Four rows of the traceability register still said "browser NOT VERIFIED", although local synthetic browser journeys
cover them. The other rows with browser journeys already name their suites and keep independent acceptance as NOT
VERIFIED; `CONTROL-PRACTICE-CLIENTS` is the model. This block brings the four rows into line. Each cited journey was
checked in the suite before it was named.

| Row | Journeys now named |
|---|---|
| `CONTROL-BILLING` | Suite 02: an accountant drafts and submits, and a different manager approves and numbers the invoice. The client pays with the sandbox test card exactly once. An outside refund is recorded once, and the client never sees its reason. |
| `CONTROL-DOCUMENT-VAULT` | Suite 02: an upload stays quarantined until the fake scanner's verdict. Staff accept it and the client downloads it. A replacement reason is public while staff notes stay hidden. OCR proposals are decided in Document Review and never shown to the client. |
| `CONTROL-STAFF-ACCOUNT-SECURITY` | Suite 01: the page renders, and session management stays closed for local sessions. Suite 08: durable sessions are listed and revoked through the real server. The browser page renders, but its tools report that they are not enabled without browser provider configuration. |
| `CONTROL-LEDGER-WORKFLOWS` | Suite 03: independent review, return and correction, with self-approval refused; reconciliation to zero variance; book-to-tax approval. Suite 06: the bookkeeper panels read the durable ledger. |

The ledger row also corrects its gap. Book-to-tax and the bookkeeper dashboard are durable; document matching and
accounting sync are not (Block 81).

## What does not change

Every row keeps "Independent browser acceptance NOT VERIFIED". The generated `browserAcceptance` field stays
`NOT VERIFIED` for every requirement. These journeys run on the loopback server with synthetic data and a fake
scanner; they are not independent acceptance. Status classifications are unchanged.
