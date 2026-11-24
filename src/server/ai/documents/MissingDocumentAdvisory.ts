import type { StageTwoRequirementStatus, TaxRequirementItem, TaxRequirementManifest } from '../../../services/stageTwoRequirementManifest';
import { GovernanceError } from '../governance/contracts';

type Requirement = Pick<TaxRequirementItem, 'requirementId' | 'engagementId' | 'taxYear' | 'requirementLevel' | 'status'>;
type Manifest = Pick<TaxRequirementManifest, 'clientId' | 'engagementId' | 'taxYear' | 'manifestVersion'> & {
  readonly requirements: readonly Requirement[];
};
type Scope = Readonly<Pick<Manifest, 'clientId' | 'engagementId' | 'taxYear'>>;
type Finding = 'MISSING_EVIDENCE' | 'EVIDENCE_PENDING_REVIEW' | 'EVIDENCE_NEEDS_CORRECTION';
const STATUS: Record<StageTwoRequirementStatus, Finding | null> = {
  EXPECTED: 'MISSING_EVIDENCE',
  MISSING: 'MISSING_EVIDENCE',
  REQUESTED: 'MISSING_EVIDENCE',
  UPLOADED: 'EVIDENCE_PENDING_REVIEW',
  PROCESSING: 'EVIDENCE_PENDING_REVIEW',
  RECEIVED: 'EVIDENCE_PENDING_REVIEW',
  RECOGNIZED: 'EVIDENCE_PENDING_REVIEW',
  MATCHED: 'EVIDENCE_PENDING_REVIEW',
  NEEDS_REVIEW: 'EVIDENCE_PENDING_REVIEW',
  INCOMPLETE: 'EVIDENCE_NEEDS_CORRECTION',
  INVALID: 'EVIDENCE_NEEDS_CORRECTION',
  REJECTED: 'EVIDENCE_NEEDS_CORRECTION',
  WRONG_YEAR: 'EVIDENCE_NEEDS_CORRECTION',
  WRONG_TAXPAYER: 'EVIDENCE_NEEDS_CORRECTION',
  DUPLICATE: 'EVIDENCE_NEEDS_CORRECTION',
  SUPERSEDED: 'EVIDENCE_NEEDS_CORRECTION',
  COLLECTION_ACCEPTED: null,
  WAIVED: null,
  NOT_APPLICABLE: null,
  SATISFIED: null,
};
const LEVELS = new Set(['REQUIRED', 'CONDITIONAL', 'OPTIONAL', 'INFORMATIONAL']);

/** Local A09 capability. Its caller must supply a currently authorized authoritative manifest. */
export function inspectMissingDocuments(scope: Scope, manifest: Manifest) {
  if (!scope.clientId || !scope.engagementId || !Number.isSafeInteger(scope.taxYear)
    || manifest.clientId !== scope.clientId || manifest.engagementId !== scope.engagementId
    || manifest.taxYear !== scope.taxYear) throw new GovernanceError('AI_MANIFEST_SCOPE_INVALID');
  if (!Number.isSafeInteger(manifest.manifestVersion) || manifest.manifestVersion < 1
    || !Array.isArray(manifest.requirements)) throw new GovernanceError('AI_MANIFEST_INVALID');

  const seen = new Set<string>();
  const findings: { requirement_id: string; code: Finding; requirement_level: Requirement['requirementLevel'] }[] = [];
  for (const row of manifest.requirements) {
    if (!row || row.engagementId !== scope.engagementId || row.taxYear !== scope.taxYear
      || typeof row.requirementId !== 'string' || !row.requirementId.trim() || seen.has(row.requirementId)
      || typeof row.status !== 'string' || !Object.prototype.hasOwnProperty.call(STATUS, row.status) || !LEVELS.has(row.requirementLevel)) throw new GovernanceError('AI_MANIFEST_INVALID');

    seen.add(row.requirementId);
    const code = STATUS[row.status];
    if (code && (row.requirementLevel === 'REQUIRED' || row.requirementLevel === 'CONDITIONAL')) {
      findings.push({ requirement_id: row.requirementId, code, requirement_level: row.requirementLevel });
    }
  }

  return {
    agent_id: 'A09' as const, status: 'ADVISORY' as const, human_review_required: true as const,
    authoritative_mutation: false as const, manifest_version: manifest.manifestVersion, findings,
  };
}
