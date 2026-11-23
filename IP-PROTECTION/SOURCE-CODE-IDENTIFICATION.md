# OPHIREUM SOURCE CODE IDENTIFICATION POLICY

**Repository:** OphireumTechnology/taxguard  
**Project:** TaxGuard AI  
**Business development origin supplied for this audit:** Ophireum Multimedia Production  
**DTI Business Name Registration No.:** 7567003  
**Proprietor identified by the business:** Leodenis Deveza Languisan  
**Intended IP holding entity:** Ophireum Technology  
**Current legal status of intended IP holder:** DTI business name only, according to information supplied; no separate SEC corporation confirmed.

## 1. Purpose

This policy establishes a consistent identifier and provenance record for source code and other software assets developed for Ophireum projects. It supports asset inventory, development traceability, copyright documentation, third-party license review and future IP assignment.

## 2. Identifier format

Use the following asset identifier format:

`OPH-IP-SRC-[PROJECT]-[ASSET-NUMBER]`

TaxGuard project prefix: `OPH-IP-SRC-TAXGUARD`

Example only: `OPH-IP-SRC-TAXGUARD-000001`

Assign identifiers through the software asset register. Do not invent or reuse identifiers.

## 3. Attribution and ownership status

Until the legal chain of title is verified and valid assignments are completed, repository records must distinguish:

- Development origin or business association;
- Actual human author or contributor, where known;
- Current legal rights holder, where verified;
- Third-party and open-source components;
- AI-assisted contributions and relevant platform terms;
- Intended future IP holding entity.

The intended IP holding entity is **Ophireum Technology**. This statement does not establish that a separate corporation exists or that rights have already been transferred to it.

The DTI business name **Ophireum Multimedia Production**, DTI Registration No. **7567003**, is associated with proprietor **Leodenis Deveza Languisan**, as supplied for this audit. The DTI business name is not represented here as a separate juridical person.

## 4. Source file headers

Do not automatically add a blanket exclusive-ownership or copyright notice to every existing source file.

Before adding a file-level notice, review authorship, employment or contractor agreements, assignment records, third-party notices and applicable licenses. Preserve all existing third-party copyright and license notices.

Where attribution is appropriate but ownership remains under review, use a neutral provenance comment such as:

```text
Ophireum Project Asset ID: OPH-IP-SRC-TAXGUARD-[REGISTERED-ID]
Project: TaxGuard AI
Development origin: Ophireum Multimedia Production (DTI BN 7567003)
Proprietor identified for business: Leodenis Deveza Languisan
Intended IP holding entity: Ophireum Technology
Ownership status: Subject to authorship, assignment and license verification.
```

Use a comment syntax suitable for the file type. Do not insert comments into formats that do not support comments.

## 5. AI-assisted development

Record material AI-assisted work in `AI-PROVENANCE-REGISTER.csv`. Record the platform, model if known, date, task, human contributor, affected files, commit or pull request, and applicable platform terms.

AI use alone does not establish company ownership. Human authorship, human inventorship where relevant, platform terms and third-party rights must be reviewed.

## 6. Third-party and open-source components

Record dependencies and incorporated components in `THIRD-PARTY-LICENSES.csv`. Preserve required notices and comply with the applicable license. Do not claim exclusive ownership of third-party components.

## 7. Change control

New files and material changes should be linked to a Git commit or pull request and an asset/provenance record. Use signed commits where practical. Preserve repository history.

## 8. Legal status

This policy is an internal recordkeeping standard. It is not itself a copyright registration, patent filing, trademark registration, assignment, or proof of exclusive ownership. Any transfer to a future SEC-registered Ophireum Technology entity requires valid written instruments signed by the actual rights holders and appropriate corporate approvals.
