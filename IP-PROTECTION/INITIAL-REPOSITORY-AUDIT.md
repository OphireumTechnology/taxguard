# TaxGuard IP source audit – initial repository inventory

**Repository:** OphireumTechnology/taxguard  
**Branch reviewed:** main  
**Commit reviewed:** d46fe26252305d579f66b16435b64e37183bf074  
**Audit mode:** Read-only metadata inventory and targeted content checks  
**Repository visibility:** Public (user instructed to keep public)  
**Date:** 2026-11-23

## Scope and method

The repository's recursive Git tree was inspected. The tree returned 1,715 tracked blob entries and was not truncated. File extensions and paths were inventoried. Targeted GitHub code searches were run for copyright notices, SPDX license headers, OPH identifiers, generated-file markers and third-party notices. Selected files including package.json, the existing third-party AI notice, SECURITY-REVIEW.md and CI/deployment workflows were read.

This is an initial audit, not a verified ownership determination. The connector did not independently inspect all 1,254 source/configuration candidate files line by line or establish who authored each commit. A repository-wide read-only scanner has been added separately to generate a per-file report in GitHub Actions.

## Inventory observed

- Total tracked blobs: 1,715.
- Source/configuration candidates by extension: 1,254 (TypeScript, TSX, JavaScript, MJS, SQL, HTML, CSS, YAML and related files).
- TypeScript: 670.
- TSX: 385.
- SQL: 126.
- MJS: 56.
- Markdown documents: 211.
- No root LICENSE, COPYING or NOTICE file was found in the recursive tree.
- Existing third-party AI notice: docs/THIRD_PARTY_AI_NOTICES.md.
- Existing SPDX search result: src/App.tsx contains SPDX-License-Identifier: Apache-2.0. This must be investigated; do not overwrite it or assume it applies to the entire repository.
- Existing UI copyright search result: src/components/common/Footer.tsx renders a dynamic company copyright label. A UI footer is not proof of source-code ownership.
- Package manifest identifies direct dependencies including React, Supabase JS, Express, OpenAI SDK, pg, Vite, TypeScript, Vitest and others. Transitive license obligations require lockfile/SBOM analysis.

## Important ownership and provenance findings

1. GitHub repository ownership and commit history do not by themselves prove copyright ownership.
2. The supplied DTI business name Ophireum Multimedia Production (DTI BN 7567003), associated with proprietor Leodenis Deveza Languisan, is not a separate juridical person.
3. Ophireum Technology is the intended IP holding entity; user has stated it currently has only a DTI business name and no separate SEC corporation.
4. No developer-by-developer assignment chain was established in this repository scan.
5. AI platform provenance for ChatGPT, Claude, Gemini, Replit and other tools is not established at file level.
6. Third-party AI model notice identifies Qwen3 8B model weights and Ollama inference engine as third-party components and expressly states Ophireum did not create/train or exclusively own them.
7. Public repository visibility is retained as instructed. This audit does not change repository visibility, secrets, deployment configuration, source files or runtime behavior.

## Immediate file-level handling rules

- Do not bulk-insert blanket copyright headers.
- Preserve all SPDX, copyright and third-party license notices.
- Mark every file UNVERIFIED until its author, rights holder, license and assignment evidence are checked.
- Add an Ophireum source identifier only after the file's provenance is documented. An identifier may be used as an asset tracking label, but must not imply exclusive ownership.
- Keep generated code, vendor code, migrations, tests, documentation and original source code distinguishable.
- Do not expose credentials or inspect secret values as part of this IP attribution audit.

## Next audit actions

1. Run the read-only GitHub Actions scan and download its JSON artifact.
2. Review the file-level inventory and identify third-party/generated files.
3. Reconcile commit authors and pull requests with actual human contributors and developer contracts.
4. Review all package dependencies and SQL migration provenance.
5. Populate AI provenance records from developer/platform records; do not infer AI use from code style.
6. Obtain signed assignments from every actual rights holder.
7. Only then add file-level attribution to confirmed company-owned original code.
8. After the SEC IP holding entity exists, execute transfer deeds and update ownership references to its exact legal name.

## Limitations

This report does not constitute a legal opinion, copyright registration, patentability opinion, security audit or proof of ownership. The initial inventory is based on Git metadata and targeted file searches. Full file-level attribution requires the automated scan artifact plus contributor and contract evidence.
