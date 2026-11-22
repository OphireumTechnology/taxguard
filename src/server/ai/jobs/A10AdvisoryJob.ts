import { isDeepStrictEqual } from 'node:util';
import type { EvidenceMetadata } from '../capabilities/contracts';
import { inspectSelectedDocumentDuplicates } from '../documents/DocumentDuplicateAdvisory';
import type { ClaimedJob, DurableJobWorker } from '../../taxguard/operations/durableJobWorker';

type ScopedA10Job = Readonly<{
  tenantId: string;
  clientId: string;
  caseId: string;
  actorId: string;
  sourceIds: readonly string[];
}>;

/** Resolve current actor, stage, grant and evidence scope on every call. Wire only to a governed resolver. */
export type ResolveA10Evidence = (request: ScopedA10Job) => Promise<readonly EvidenceMetadata[] | null>;

function parseClaim(job: ClaimedJob): ScopedA10Job | null {
  const { tenantId, clientId, caseId, createdBy, payload } = job;
  if (job.jobType !== 'AI_PROPOSAL' || !payload || payload.agentId !== 'A10'
    || Object.keys(payload).sort().join(',') !== 'agentId,sourceIds'
    || typeof clientId !== 'string' || !clientId || typeof caseId !== 'string' || !caseId
    || typeof createdBy !== 'string' || !createdBy) return null;

  const ids = payload.sourceIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 10 || new Set(ids).size !== ids.length
    || !ids.every(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))) return null;

  return Object.freeze({ tenantId, clientId, caseId, actorId: createdBy, sourceIds: Object.freeze([...ids]) });
}

function evidenceMatches(ids: readonly string[], evidence: readonly EvidenceMetadata[]) {
  return isDeepStrictEqual([...ids].sort(), evidence.map(row => row.source_id).sort());
}

/** One bounded iteration. No HTTP route, provider or hosted process instantiates this draft. */
export async function runA10AdvisoryJob(worker: DurableJobWorker, resolveEvidence: ResolveA10Evidence) {
  const job = await worker.claimAi();
  if (!job) return 'IDLE';

  const refuse = async (code: string) => {
    await worker.fail(job, { code, message: 'Advisory job was refused.', permanent: true });
    return 'REFUSED' as const;
  };

  const request = parseClaim(job);
  if (!request) return refuse('VALIDATION_AI_PAYLOAD');

  const evidence = await resolveEvidence(request);
  if (!evidence || !evidenceMatches(request.sourceIds, evidence)) return refuse('AUTH_AI_EVIDENCE');

  const snapshot = structuredClone([...evidence]).sort((left, right) => left.source_id.localeCompare(right.source_id));
  const report = inspectSelectedDocumentDuplicates(snapshot);

  const latest = await resolveEvidence(request);
  if (!latest || !isDeepStrictEqual(snapshot, [...latest].sort((left, right) => left.source_id.localeCompare(right.source_id)))) {
    return refuse('AUTH_AI_EVIDENCE_CHANGED');
  }

  // The store fences completion and writes the summary and queue event in a single transaction.
  await worker.completeA10(job, report.duplicate_groups.length);
  return 'COMPLETED';
}
