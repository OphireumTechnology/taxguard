import { GovernanceError } from '../governance/contracts';
import type { CapabilityDefinition } from './contracts';

const uuid = { type: 'string', pattern: '^[0-9a-f-]{36}$', maxLength: 36 };
const metadata = { type: 'object', additionalProperties: false, required: ['source_id','document_record_id','document_version','source_hash','document_status','quarantine_status'], properties: {
  source_id: uuid, document_record_id: uuid, document_version: { type: 'integer', minimum: 1 },
  source_hash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, document_status: { enum: ['RELEASED','VERIFIED'] }, quarantine_status: { const: 'CLEAN' },
} };
function freeze<T>(value: T): T {
  if(value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
/** IDs reuse ai_tools. Executable binding is a fixed switch in ScopedReadRepository, never database/caller code. */
const definitions: readonly CapabilityDefinition[] = freeze([
  { id: 'workflow.read', version: '1', action: 'READ', data_class: 'INTERNAL', timeout_ms: 5000, maximum_rows: 1, maximum_output_bytes: 1024,
    input_schema: { type: 'object', additionalProperties: false, maxProperties: 0 },
    output_schema: { type: 'object', additionalProperties: false, required: ['capability_id','workflow_version','stage','status'], properties: {
      capability_id: { const: 'workflow.read' }, workflow_version: { const: 'LEGACY_18_V1' }, stage: { type: 'integer', minimum: 1, maximum: 18 }, status: { enum: ['ACTIVE','IN_REVIEW','READY'] },
    } } },
  { id: 'document.read', version: '1', action: 'READ', data_class: 'INTERNAL', timeout_ms: 5000, maximum_rows: 10, maximum_output_bytes: 8192,
    input_schema: { type: 'object', additionalProperties: false, required: ['source_ids'], properties: { source_ids: { type: 'array', minItems: 1, maxItems: 10, uniqueItems: true, items: uuid } } },
    output_schema: { type: 'object', additionalProperties: false, required: ['capability_id','evidence'], properties: { capability_id: { const: 'document.read' }, evidence: { type: 'array', maxItems: 10, items: metadata } } } },
]);
export function resolveCapability(id: unknown, version: unknown): CapabilityDefinition {
  const definition = definitions.find(d => d.id === id);
  if(!definition) throw new GovernanceError('AI_CAPABILITY_UNAVAILABLE');
  if(version !== definition.version) throw new GovernanceError('AI_CAPABILITY_VERSION_MISMATCH');
  return definition;
}
export function capabilityDefinitions(): readonly CapabilityDefinition[] { return definitions; }
