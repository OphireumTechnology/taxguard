/**
 * What the AI Command Center says exists, served to governance roles only, so it stays out of the public bundle. A status
 * is a claim, so every IMPLEMENTED item names evidence in this repository (src/tests/aiCommandCenterManifest.test.ts
 * checks each path exists), and IMPLEMENTED means built and tested locally, never deployed. Nothing here is a live metric:
 * live figures come from the server's own reads and are attached by `live`.
 */
export type ModuleStatus = 'IMPLEMENTED' | 'PLANNED' | 'UNAVAILABLE' | 'BLOCKED';
export type SectionId = 'knowledge' | 'inference' | 'tax_preparation' | 'governance' | 'evaluation' | 'operations';
export interface CommandCenterModule {
  id: string; section: SectionId; name: string; status: ModuleStatus; description: string;
  evidence: string[]; blocker?: string; gate?: string; link?: { label: string; href: string }; live?: 'knowledge' | 'inference' | 'governance';
}
export type LifecycleStatus = 'IN_PROGRESS' | 'BLOCKED' | 'NOT_STARTED';
export interface LifecycleStage { id: string; name: string; status: LifecycleStatus; evidence: string[]; blockers: string[]; gates: string[] }

const R = 'local-ai/rag/autonomous/';
const AUDIT = 'docs/development/TAXGUARD_FULL_FUNCTIONALITY_AUDIT.md';
const WORKSPACE = { label: 'Open staff workspace', href: '/staff/workspace' };
const CONSOLE = { label: 'Open administrator console', href: '/staff/super-admin' };

export const COMMAND_CENTER_SECTIONS: { id: SectionId; name: string; summary: string }[] = [
  { id: 'knowledge', name: 'Knowledge Engine', summary: 'Authoritative research, document acquisition, extraction, embeddings and knowledge status.' },
  { id: 'inference', name: 'AI Inference', summary: 'The private inference service, model health and retrieval.' },
  { id: 'tax_preparation', name: 'Tax Preparation', summary: 'Authorized case workflows, forms, calculations and diagnostics.' },
  { id: 'governance', name: 'Human Governance', summary: 'Independent review, approval queues and audit evidence.' },
  { id: 'evaluation', name: 'Evaluation Center', summary: 'Retrieval quality, citation accuracy, refusal performance and regression testing.' },
  { id: 'operations', name: 'System Operations', summary: 'Service health, background jobs, configuration and monitoring.' },
];

export const COMMAND_CENTER_MODULES: CommandCenterModule[] = [
  { id: 'source-registry', section: 'knowledge', name: 'Source registry', status: 'IMPLEMENTED', live: 'knowledge', description: 'A controlled list of research sources. Only active, openly accessible sources can be fetched, and unlisted hosts are refused.', evidence: [R + 'tests/test_research_foundation.py'], gate: 'The owner approves any new source.' },
  { id: 'discovery', section: 'knowledge', name: 'Discovery and source verification', status: 'IMPLEMENTED', live: 'knowledge', description: 'Finds candidate documents on approved sources and verifies them. Run by hand, in staging only.', evidence: [R + 'tests/test_verify_research_candidates.py'] },
  { id: 'quarantine', section: 'knowledge', name: 'Quarantine acquisition', status: 'IMPLEMENTED', live: 'knowledge', description: 'Downloads verified documents into quarantine with their hashes and structure checks. Documents stay unapproved.', evidence: [R + 'tests/test_acquire_verified_documents.py'] },
  { id: 'extraction', section: 'knowledge', name: 'Extraction, chunking and embeddings', status: 'IMPLEMENTED', live: 'knowledge', description: 'Turns quarantined documents into staged chunks and embeddings. Suspicious text is held back from embedding.', evidence: [R + 'tests/test_process_knowledge.py'] },
  { id: 'tax-year', section: 'knowledge', name: 'Tax-year intelligence', status: 'IMPLEMENTED', live: 'knowledge', description: 'Keeps tax year, processing year, revision and legal status apart, and sends conflicts to a person. Not validated by a tax professional.', evidence: [R + 'tests/test_research_foundation.py'] },
  { id: 'research-controller', section: 'knowledge', name: 'Continuous research controller', status: 'PLANNED', evidence: [], description: 'Would check official sources for updates and changed documents, within resource budgets.', blocker: 'Not built.' },
  { id: 'scheduled-learning', section: 'knowledge', name: 'Scheduled learning', status: 'BLOCKED', evidence: [], description: 'Unattended research runs.', blocker: 'Stays disabled until the owner separately authorizes it.', gate: 'Owner authorization.' },
  { id: 'licensed-standards', section: 'knowledge', name: 'Licensed accounting standards', status: 'BLOCKED', evidence: [R + 'tests/test_research_foundation.py'], description: 'FASB and AICPA material.', blocker: 'Requires a recorded license that permits this use.', gate: 'Owner decision.' },

  { id: 'inference-service', section: 'inference', name: 'TaxGuard AI Inference Engine', status: 'IMPLEMENTED', live: 'inference', description: 'A server-side adapter to the local model. Browsers never reach the model, its address or its configuration.', evidence: ['src/tests/aiWhiteLabelBranding.test.tsx', 'src/tests/userFacingModelText.test.ts'] },
  { id: 'inference-worker', section: 'inference', name: 'Inference worker and screens', status: 'PLANNED', evidence: [], description: 'Would carry approved requests from TaxGuard screens to the inference engine.', blocker: 'Not built, so no ordinary screen uses local inference yet.' },
  { id: 'retrieval-baseline', section: 'inference', name: 'Knowledge retrieval (baseline)', status: 'IMPLEMENTED', live: 'knowledge', description: 'Embedding search over staged knowledge. Only the evaluation scripts use it, and it serves no application screen.', evidence: [R + 'tests/test_compare_retrieval.py'] },
  { id: 'retrieval-hybrid', section: 'inference', name: 'Hybrid retrieval', status: 'BLOCKED', live: 'knowledge', description: 'Keyword and embedding search combined.', evidence: [R + 'tests/test_compare_retrieval.py'], blocker: 'Did not pass the held-out evaluation, so the baseline stays.', gate: 'A new frozen question set.' },
  { id: 'ai-agents', section: 'inference', name: 'The 61 AI agents', status: 'BLOCKED', live: 'governance', description: 'All agents are recorded as drafts with no permission, stage, model or provider.', evidence: ['src/tests/aiCommissioningRecords.test.ts'], blocker: 'None is commissioned.', gate: 'Owner approval for each agent.', link: CONSOLE },

  { id: 'case-workflow', section: 'tax_preparation', name: 'Case workflow, stages 01 to 08', status: 'IMPLEMENTED', description: 'Case stages and transitions under assignment and maker-checker rules. Local only; production needs database approval.', evidence: [AUDIT, 'src/tests/accountantObjectAuthorization.test.ts'], gate: 'Database proposals approved by the owner.', link: WORKSPACE },
  { id: 'tax-forms', section: 'tax_preparation', name: 'Tax forms library', status: 'IMPLEMENTED', description: 'A static catalog of forms for practice staff.', evidence: [AUDIT], link: { label: 'Open forms library', href: '/staff/forms' } },
  { id: 'calculations', section: 'tax_preparation', name: 'Tax rules, draft return and diagnostics', status: 'UNAVAILABLE', description: 'Structure only: panels and approval paths exist, without real tax rules behind them.', evidence: [AUDIT], blocker: 'Real rules need owner and professional decisions.', gate: 'Professional and owner policies.', link: WORKSPACE },
  { id: 'signing-filing', section: 'tax_preparation', name: 'Signing, filing and acknowledgements', status: 'BLOCKED', description: 'Stages 11 to 13 are inactive. TaxGuard has not filed any return.', evidence: [AUDIT], blocker: 'Not authorized.', gate: 'Owner authorization and provider credentials.' },

  { id: 'maker-checker', section: 'governance', name: 'Maker-checker enforcement', status: 'IMPLEMENTED', description: 'The server enforces separate preparer and approver, whatever the browser sends.', evidence: ['src/tests/aiGovernanceControlPlane.test.ts', 'src/tests/accountantObjectAuthorization.test.ts'] },
  { id: 'audit-center', section: 'governance', name: 'Audit center', status: 'IMPLEMENTED', description: 'Redacted audit and security views for administrators.', evidence: ['src/tests/auditCenter.test.ts', 'src/tests/auditAppendOnlyProposal.test.ts'], link: CONSOLE },
  { id: 'emergency-stop', section: 'governance', name: 'AI emergency stop', status: 'IMPLEMENTED', live: 'governance', description: 'Stops AI activity by agent, model, tool or globally. Lifting a stop needs an approved policy.', evidence: ['src/tests/aiKillSwitchActivation.test.ts', 'src/tests/aiEmergencyStopPanel.test.tsx'], link: CONSOLE },
  { id: 'review-queue', section: 'governance', name: 'Knowledge review queue', status: 'IMPLEMENTED', live: 'knowledge', description: 'Items waiting for a person. The evaluation can recommend, and it can never approve.', evidence: [R + 'tests/test_evaluate_knowledge.py'] },
  { id: 'knowledge-approval', section: 'governance', name: 'Approving knowledge from this website', status: 'PLANNED', evidence: [], description: 'This website has no approval control. A researcher could never approve their own documents through it, because no such action exists here.', blocker: 'Not built. Needs an independent reviewer flow on the server first.', gate: 'Independent human review.' },

  { id: 'knowledge-evaluation', section: 'evaluation', name: 'Knowledge evaluation', status: 'IMPLEMENTED', live: 'knowledge', description: 'Checks source integrity, completeness, suspicious text, currency and citations, and builds the review queue.', evidence: [R + 'tests/test_evaluate_knowledge.py'] },
  { id: 'retrieval-comparison', section: 'evaluation', name: 'Retrieval comparison', status: 'IMPLEMENTED', live: 'knowledge', description: 'Compares retrieval methods on frozen questions under a pass or fail rule fixed in advance.', evidence: [R + 'tests/test_compare_retrieval.py'] },
  { id: 'agent-evaluation', section: 'evaluation', name: 'AI agent evaluation records', status: 'IMPLEMENTED', description: 'Shows evaluation dimensions and records for agents. No agent has passed, because none is commissioned.', evidence: ['src/tests/aiControlCenterEvaluations.test.ts'], link: CONSOLE },
  { id: 'next-question-set', section: 'evaluation', name: 'New frozen question set', status: 'PLANNED', evidence: [], description: 'The current held-out questions have been seen, so any new retriever needs a new set.', blocker: 'Not written.' },

  { id: 'provider-readiness', section: 'operations', name: 'Provider readiness', status: 'IMPLEMENTED', description: 'Reports which outside providers are configured. Filing, e-signature, payments and accounting sync are not commissioned.', evidence: ['src/tests/adminProviderReadinessSession.test.ts'], link: CONSOLE },
  { id: 'job-queue', section: 'operations', name: 'Background job queue', status: 'IMPLEMENTED', description: 'Durable background jobs for operational administrators. Local only until its database proposal is approved.', evidence: [AUDIT, 'src/tests-e2e/11-appointments-audit-legal.e2e.test.ts'], link: WORKSPACE },
  { id: 'route-cutover', section: 'operations', name: 'Route cutover status', status: 'IMPLEMENTED', description: 'Shows which production routes are durable and which are still refused.', evidence: ['src/tests/routeCutover.test.ts'] },
  { id: 'monitoring', section: 'operations', name: 'Log shipping and alert routing', status: 'UNAVAILABLE', description: 'Health endpoints exist, but nothing ships logs or routes alerts.', evidence: [AUDIT], blocker: 'Needs a provider.', gate: 'Owner decision.' },
  { id: 'deployment', section: 'operations', name: 'Production deployment', status: 'BLOCKED', description: 'Nothing here is deployed, and no hosted database migration has been applied.', evidence: [AUDIT], blocker: 'Awaiting owner approval of database proposals and providers.', gate: 'Owner approval.' },
];

export const COMMAND_CENTER_LIFECYCLE: LifecycleStage[] = [
  { id: 'plan', name: 'Plan', status: 'IN_PROGRESS', evidence: ['docs/development/master-completion-plan.md', AUDIT], blockers: ['Open owner decisions recorded in the audit.'], gates: ['Owner decisions'] },
  { id: 'develop', name: 'Develop', status: 'IN_PROGRESS', evidence: ['docs/development/TAXGUARD_MASTER_COMPLETION_STATUS.md'], blockers: ['Inference worker and research controller are not built.'], gates: ['Maker-checker on protected changes'] },
  { id: 'test', name: 'Test', status: 'IN_PROGRESS', evidence: ['docs/taxguard-master-traceability.json', 'src/tests/routeCutover.test.ts'], blockers: ['Local test runs only; hosted continuous integration results are not read here.'], gates: ['Full regression run before each merge'] },
  { id: 'evaluate', name: 'Evaluate', status: 'IN_PROGRESS', evidence: [R + 'tests/test_evaluate_knowledge.py', R + 'tests/test_compare_retrieval.py'], blockers: ['Hybrid retrieval did not pass.', 'Answers given without retrieved evidence are not yet stopped.', 'Not validated by a tax professional.'], gates: ['Frozen question sets'] },
  { id: 'review', name: 'Review', status: 'BLOCKED', evidence: [R + 'tests/test_evaluate_knowledge.py'], blockers: ['No knowledge has been reviewed or approved by a person.'], gates: ['Independent human review'] },
  { id: 'deploy', name: 'Deploy', status: 'BLOCKED', evidence: [AUDIT], blockers: ['No deployment or hosted database migration is authorized.'], gates: ['Owner approval'] },
  { id: 'operate', name: 'Operate and improve', status: 'NOT_STARTED', evidence: [], blockers: ['Nothing is deployed.', 'Scheduled learning stays disabled.'], gates: ['Owner authorization'] },
];
