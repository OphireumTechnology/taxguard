import { describe, expect, it } from 'vitest';
import { assessMaterialActionPreparation, parseMaterialActionDraft } from '../server/ai/review/MaterialActionPreparation';

const fixture = () => ({
  state: 'DRAFT', policy_id: 'synthetic_policy', policy_version: 1,
  action_service: 'synthetic_unregistered_service', target_record_type: 'synthetic_record', target_fields: ['synthetic_field'],
  workflow_version: 'LEGACY_18_V1', workflow_stage: 10,
  scope: { tenant_id: 'synthetic_tenant', client_id: 'synthetic_client', tax_case_id: 'synthetic_case', tax_year: 2025 },
  evidence: [{ source_id: 'synthetic_source', source_hash: 'a'.repeat(64), document_version: 1 }],
  attestation_requirements: ['PREPARER', 'REVIEWER', 'CPA_EA'], distinct_professional_reviewer: 'UNRESOLVED',
});

describe('AI-16 preparatory boundary', () => {
  it('accepts a design artifact while refusing authority and execution', () => {
    expect(assessMaterialActionPreparation(fixture())).toMatchObject({ validation_status: 'STRUCTURALLY_VALID_ONLY', authorization: 'DENIED', action_executed: false });
    expect(assessMaterialActionPreparation(fixture()).blockers).toContain('INDEPENDENT_ATTESTATION_SOURCES_REQUIRED');
  });
  it('does not treat a proposed separation rule as a completed human attestation', () => {
    const draft = { ...fixture(), distinct_professional_reviewer: 'REQUIRED' };
    expect(assessMaterialActionPreparation(draft).authorization).toBe('DENIED');
  });
  it('detaches and freezes nested input to prevent policy mutation after validation', () => {
    const input = fixture(); const result = parseMaterialActionDraft(input);
    input.scope.tenant_id = 'other'; input.target_fields.push('another'); input.evidence[0].source_hash = 'b'.repeat(64);
    expect(result.scope.tenant_id).toBe('synthetic_tenant'); expect(result.target_fields).toHaveLength(1);
    expect(result.evidence[0].source_hash).toBe('a'.repeat(64)); expect(Object.isFrozen(result.evidence[0])).toBe(true);
    expect(() => { result.scope.tax_year = 2024; }).toThrow();
  });
  it.each([
    { state: 'ACTIVE' }, { policy_version: 0 }, { workflow_stage: 19 }, { workflow_version: 'NEW_18' },
    { target_fields: ['*'] }, { target_fields: ['x', 'x'] }, { target_fields: [] },
    { action_service: 'https://untrusted.example/write' }, { target_record_type: '../records' },
    { attestation_requirements: ['REVIEWER'] }, { attestation_requirements: ['REVIEWER', 'PREPARER', 'CPA_EA'] },
    { distinct_professional_reviewer: 'OPTIONAL' }, { approved: true }, { attestations: [{ role: 'CPA', completed: true }] },
    { evidence: [] }, { evidence: [{ source_id: 'source', source_hash: 'invalid', document_version: 1 }] },
    { evidence: [{ source_id: 'source', source_hash: 'a'.repeat(64), document_version: 0 }] },
    { evidence: [{ source_id: 'source', source_hash: 'a'.repeat(64), document_version: 1, verified: true }] },
  ])('rejects malformed or privilege-bearing draft %j', patch => {
    expect(() => parseMaterialActionDraft({ ...fixture(), ...patch })).toThrow('AI_INVALID_MATERIAL_DRAFT');
  });
  it.each([null, [], 'policy', { ...fixture().scope, tax_year: 2025.5 }, { ...fixture().scope, tenant_id: '' }, { ...fixture().scope, role: 'admin' }])('rejects malformed scope %j', scope => {
    expect(() => parseMaterialActionDraft({ ...fixture(), scope })).toThrow('AI_INVALID_MATERIAL_DRAFT');
  });
  it('rejects duplicate source identities even if the hashes differ', () => {
    const input = fixture(); input.evidence.push({ ...input.evidence[0], source_hash: 'b'.repeat(64) });
    expect(() => parseMaterialActionDraft(input)).toThrow('AI_INVALID_MATERIAL_DRAFT');
  });
});
