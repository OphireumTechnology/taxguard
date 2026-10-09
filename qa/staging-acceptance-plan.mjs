// Scenario inventory only; no account creation, credentials, network requests or approvals.
/** @type {Array<{id: string, workflow: string, route: string, expected: string, browserStatus: string, stage?: number, workflowVersion?: string}>} */
const scenarios = [
  ['CLIENT-AUTH', 'Client onboarding and authentication', '/portal/login', 'Invalid/expired sessions conceal scoped records; recorded onboarding never implies verified identity or legally sufficient consent.'],
  ['CLIENT-DOCUMENTS', 'Client dashboard and documents', '/portal/dashboard', 'Exact client/year reads only; quarantined or unverified documents remain unavailable; upload failure never reports success.'],
  ['BOOKKEEPER', 'Bookkeeper review and session isolation', '/staff/workspace', 'Only assigned client/year records; no Accountant/Reviewer privileges; no uncommissioned period-close success.'],
  ['ACCOUNTANT', 'Accountant review and dashboard', '/staff/workspace', 'Assignment/year changes clear prior artifacts; unavailable lineage or providers remain unavailable.'],
  ['REVIEWER', 'Reviewer queue and maker-checker', '/staff/workspace', 'Current independent assignment required; no self-approval or privileged final approval without complete governed evidence.'],
  ['PRACTICE-MANAGER', 'Practice Manager workflows', '/staff/workspace', 'Only approved operational scope; no inferred tax certification or reassignment capability.'],
  ['CLIENT-SERVICE', 'Client Service workflows', '/staff/workspace', 'Client-visible content excludes internal notes; no autonomous send or invented booking/receipt.'],
  ['ADMIN', 'Administrative experience', '/staff/workspace', 'No inferred practitioner authority; uncommissioned jobs/billing/audit views report unavailable.'],
  ['CONSENT', 'Consent and authorization boundaries', '/portal/profile', 'Missing/revoked purpose evidence blocks protected transport; stored flags do not certify legal sufficiency.'],
  ['SESSION', 'Error handling and session expiration', '/staff/workspace', 'Expiry/revocation removes prior content, navigation references and dialogs; recovery requires fresh authorized data.'],
  ['ACCESSIBILITY', 'Keyboard, focus and responsive layouts', '/staff/workspace', 'Real 390/768/1280px viewports, zoom, keyboard and screen-reader checks; focus trap, Escape and restoration verified independently.'],
].map(([id, workflow, route, expected]) => ({ id, workflow, route, expected, browserStatus: 'NOT VERIFIED' }));
const stages = ['ONBOARD', 'COLLECT', 'VALIDATE', 'RECORD', 'RECONCILE', 'REVIEW', 'REPORT', 'PLAN', 'PREPARE_TAXES', 'APPROVE', 'SIGN', 'FILE', 'GOVERNMENT_FEEDBACK', 'RESOLVE', 'MONITOR', 'ARCHIVE', 'RENEW', 'REPEAT'];
for (const [index, name] of stages.entries()) scenarios.push({ id: `STAGE-${String(index + 1).padStart(2, '0')}`, workflow: name,
  route: '/portal/dashboard', stage: index + 1, workflowVersion: 'LEGACY_18_V1', browserStatus: 'NOT VERIFIED',
  expected: 'Verify recorded stage view, unknown/missing evidence denial, role separation and controlled unavailable integrations. Do not advance protected stages or fabricate external proof.' });
export const stagingAcceptancePlan = Object.freeze({
  scope: 'AUTHORIZED_ISOLATED_SYNTHETIC_STAGING_ONLY',
  requiredFixtures: ['Two isolated tenants', 'Two clients per tenant', 'Two tax years', 'Distinct preparer and reviewer', 'Active, suspended, expired and revoked sessions', 'Missing/revoked consent', 'Released, quarantined and missing documents', 'Unavailable dependencies'],
  prohibitions: ['No production target', 'No real taxpayer data', 'No provider delivery or regulated transition without separate approval', 'No AI-16 material writes', 'No invented attestations'],
  evidenceRequired: ['Approved target/environment', 'Artifact hash', 'Browser engine/version and actual viewport', 'Scenario/operator/time', 'Observed UI and HTTP outcomes', 'Redacted evidence reference', 'Independent reviewer'],
  scenarios: Object.freeze(scenarios.map(scenario => Object.freeze(scenario))),
  releaseRecommendation: 'NO-GO',
});
