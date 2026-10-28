import { expect, it } from 'vitest';
import { staffAuthProofIsCurrent } from '../server/staffSessionEpoch';
it('rejects before, same-second, and malformed staff proofs at a status epoch', () => {
  const member={role:'admin',status_changed_at:'2026-10-12T00:00:00.500Z'};
  const epoch=Date.parse(member.status_changed_at)/1000;
  expect(staffAuthProofIsCurrent(member,Math.floor(epoch))).toBe(false);
  expect(staffAuthProofIsCurrent(member,Math.ceil(epoch))).toBe(true);
  expect(staffAuthProofIsCurrent({...member,status_changed_at:'invalid'},Math.ceil(epoch))).toBe(false);
  expect(staffAuthProofIsCurrent(member,'bad')).toBe(false);
});
it('preserves initial staff activation without an epoch and client sign-in policy', () => {
  expect(staffAuthProofIsCurrent({role:'admin'},1)).toBe(true);
  expect(staffAuthProofIsCurrent({role:'client',status_changed_at:'invalid'},1)).toBe(true);
});
