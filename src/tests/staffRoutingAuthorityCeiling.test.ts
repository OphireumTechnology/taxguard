import { expect, it } from 'vitest';
import { canAccessStaffWorkspace, resolveAuthoritativeStaffWorkspace } from '../config/canonicalRouting';
it.each(['billing', 'compliance', 'founder', 'executive', 'owner', 'legal_specialist', 'firm_manager', 'administrator', 'recruiter', 'unknown'])('does not infer accountant privileges for unmapped %s', role => {
  expect(canAccessStaffWorkspace(role)).toBe(false);
  expect(resolveAuthoritativeStaffWorkspace(role)).toBeNull();
});
it.each(['accountant', 'preparer'])('preserves proven accountant workspace mapping for %s', role => expect(resolveAuthoritativeStaffWorkspace(role)).toBe('accountant_workspace'));
it.each(['operations', 'practice_manager', 'bookkeeper', 'reviewer', 'senior_reviewer', 'admin', 'super_admin'])('preserves established %s routing', role => expect(resolveAuthoritativeStaffWorkspace(role)).not.toBeNull());
