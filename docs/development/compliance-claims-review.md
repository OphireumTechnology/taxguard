# Compliance claims review

Started 2026-11-03 at the owner's request. **This is an engineering inventory, not legal advice and not a finding that any statement is false.** It records what the website says and whether this repository holds evidence for it.

## Result

The repository holds no evidence for any flagged claim: no compliance assessment, legal review, audit report, or record of an IRS authorization. Each one must be substantiated, corrected or removed **before public deployment**. None has been changed, because the wording needs a decision from the owner and a qualified reviewer.

`compliance-claims-register.json` lists each file and count. `src/tests/complianceClaimsRegister.test.ts` fails when the source and the register differ.

## Why the wording matters

Treasury Department Circular 230 sets rules for people who practice before the IRS. It is not a certification that software or a session can hold, so "IRS Circular 230 Compliant" on a screen has no clear meaning and may read as an IRS endorsement. A qualified reviewer should confirm this reading.

## Flagged claims, most serious first

| Priority | Claim | Where | Concern |
|---|---|---|---|
| 1 | "IRS Authorized e-File Provider", "IRS Authorized e-File" | `ClientWelcomePanel.tsx`, `SecurityReliabilityPanel.tsx`, `TaxReturnView.tsx` | Claims a government authorization. No record of one is here, and TaxGuard's own code says no e-file transmitter is integrated (`src/taxForms/capabilities.ts`) |
| 2 | "IRS Circular 230 Compliant", "CIRCULAR 230 COMPLIANT", "IRS Circular 230 Protected Session" | `PortalLayout.tsx`, `UploadModal.tsx`, `VirtualConsultationRoom.tsx`, `HelpModal.tsx`, `DocumentsView.tsx`, `StageOneIdentityWizard.tsx` | Software or a session is described as compliant. The portal header shows this on every portal page |
| 3 | "IRS Pub 4557 Compliant" | `DocumentUpload.tsx`, `PortalSidebar.tsx` | Publication 4557 is guidance on safeguarding data. No assessment against it is on file |
| 4 | "IRC § 7216 Protected" | `RightContextRail.tsx`, `SecurityReliabilityPanel.tsx` | Implies a legal status for disclosure and use rules that no review has confirmed |
| 5 | "adhering to AICPA standards and IRS Circular 230" | `TaxReturnView.tsx` | A claim about professional conduct that only the practice can make and support |

## Related statements, not counted as claims

- **Notices:** the Circular 230 notice in `ProfessionalDisclaimersPage.tsx` and the banner in `TaxStrategiesPage.tsx` are disclosures. A reviewer should still read them, because Treasury removed the older email-disclaimer rule in 2014 and this wording resembles it.
- **Other technical statements:** "256-Bit TLS", "Encrypted in transit & at rest" and "DTLS 256-Bit Encrypted" depend on how the system is deployed. They should be checked against the production configuration.
- **Demonstration code:** `src/demo` and `src/taxguard` are in the register because they are in the source, even though most of that code is not in the production bundle.

## What is needed

1. The owner confirms whether any IRS authorization exists, such as an EFIN or provider record, and supplies the evidence.
2. A qualified reviewer decides on each claim: keep with evidence, correct, or remove.
3. Engineering applies those decisions and shrinks the register.
