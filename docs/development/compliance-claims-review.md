# Compliance claims review

Started 2026-11-03 at the owner's request. **This is an engineering inventory with draft wording, not legal advice and not a finding that any statement is false.** It records what the website says, whether this repository holds evidence for it, and proposed wording for a qualified reviewer.

## Result

All 19 claims across 16 files are unsubstantiated here: the repository holds no compliance assessment, legal review, audit report or record of an IRS authorization. Each must be substantiated, corrected or removed **before public deployment**. No wording has been changed yet, because each change needs the owner's decision and a qualified reviewer's approval.

`compliance-claims-register.json` records every claim with its priority, reach and proposed wording. `src/tests/complianceClaimsRegister.test.ts` fails when the source and the register differ, and fails if a flagged claim appears on a public page.

## Why this wording is a concern

- **"IRS Authorized e-File Provider".** This states a government authorization as fact. No record of one is here, and TaxGuard's own code says no e-file transmitter is integrated (`src/taxForms/capabilities.ts`). Building software does not confer IRS authorization, and the wording must not imply endorsement.
- **"IRS Circular 230 Compliant".** Treasury Department Circular 230 governs people who practice before the IRS. It is not a certification software or a session can hold, so the label has no clear meaning and may read as an IRS endorsement. A qualified reviewer should confirm this reading.

## Reach

Reach comes from the frontend reachability audit traced from `src/main.tsx`, a static trace from the entry file. It is not proof that a screen is unreachable, and any code can come back into use.

**None of the 19 is on a public page today**, and the test keeps it that way. Four files are reachable from the production frontend, behind sign-in or within the client flow, and these come first.

## Claims and proposed wording

### Priority 1: government authorization

| File | Reach | Current | Proposed, for review |
|---|---|---|---|
| `portal/dashboard/ClientWelcomePanel.tsx` | Not reached | "IRS Authorized e-File Provider" | Remove. If the owner supplies evidence of an authorization, use the exact wording the reviewer approves |
| `portal/dashboard/SecurityReliabilityPanel.tsx` | Not reached | "IRC § 7216 Protected • IRS Authorized e-File" | "Your tax information is handled under our privacy notice." |
| `portal/views/TaxReturnView.tsx` | Not reached | "IRS Authorized e-File Transmitter" | "E-file transmitter: not configured" |
| `demo/mockData.ts` | Not reached | "IRS Authorized E-File Transmitter & MeF Modernized E-File" | "Demonstration e-file provider (not connected)" |

### Priority 2: Circular 230

| File | Reach | Current | Proposed, for review |
|---|---|---|---|
| `layout/PortalLayout.tsx` | **Reachable, every portal page** | "256-Bit TLS • IRS Circular 230 Compliant" | "Encrypted connection", once checked against the production configuration |
| `portal/StageOneIdentityWizard.tsx` | **Reachable** | "IRS Circular 230 and Section 7216 compliant masked submission." | "Your identification number is masked on screen." |
| `taxguard/components/TaxGuardDisclaimer.tsx` | **Reachable** | "IRC § 7216 & Circular 230 Protected" | Remove |
| `consultation/VirtualConsultationRoom.tsx` | Not reached | "CIRCULAR 230 COMPLIANT" | Remove |
| `portal/modals/HelpModal.tsx` | Not reached | "IRS Circular 230 Protected Session" | "Secure session" |
| `portal/modals/UploadModal.tsx` | Not reached | "Encrypted in transit & at rest • IRS Circular 230 Compliant" | "Encrypted in transit and at rest", once checked against production |
| `portal/views/DocumentsView.tsx` | Not reached | "compliant with IRS Circular 230 and FTC Safeguards" | "Encrypted file exchange.", once checked against production |
| `portal/views/TaxReturnView.tsx` | Not reached | "adhering to AICPA standards and IRS Circular 230" | "A multi-step review before anything is finalized." |
| `taxguard/TaxGuardApp.tsx` | Not reached | "NIST AI RMF 1.0 Aligned • Circular 230 Compliant" | "Multi-tenant isolated". "NIST AI RMF 1.0 Aligned" also needs review |
| `portal/dashboard/SecurityReliabilityPanel.tsx` | Not reached | Code comment: "Circular 230 & IRC § 7216 compliant" | Remove the comment |

### Priority 3: other standards

| File | Reach | Current | Proposed, for review |
|---|---|---|---|
| `portal/DocumentUpload.tsx` | **Reachable** | "IRS Pub 4557 Compliant" | Remove. A written assessment against Publication 4557 would be needed to say more |
| `portal/layout/PortalSidebar.tsx` | Not reached | "Pub 4557 Compliant" | Remove |
| `portal/dashboard/RightContextRail.tsx` | Not reached | "IRC § 7216 Protected" | "Your information stays private", with wording tied to the privacy notice |
| `demo/views/client/ClientLenderPackageSection.tsx` | Not reached | "IRC § 7216 Compliant Lender Portal" | "Lender portal" |

## Related statements, not counted as claims

- **Notices:** the Circular 230 notice in `ProfessionalDisclaimersPage.tsx` and the banner in `TaxStrategiesPage.tsx` are public disclosures. A reviewer should read them, because as far as we know Treasury removed the older email-disclaimer rule in 2014 and this wording resembles it.
- **Technical statements:** "256-Bit TLS", "Encrypted in transit & at rest" and "DTLS 256-Bit Encrypted" depend on how the system is deployed, and must be checked against production.

## What is needed

1. The owner confirms whether any IRS authorization exists, such as an EFIN or provider record, and supplies the evidence.
2. A qualified reviewer decides on each claim: keep with evidence, use the proposed wording, or remove.
3. Engineering applies those decisions and shrinks the register.
