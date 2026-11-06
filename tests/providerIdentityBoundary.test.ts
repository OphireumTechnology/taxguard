import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/supabase/config', () => ({ supabase: { auth: { onAuthStateChange: vi.fn() } } }));
import { createProviderIdentityBoundary, type ProviderIdentitySession } from '../src/services/providerIdentityBoundary';
import { createStaffInvitationLifecycle } from '../src/services/staffInvitationLifecycle';

const session = (id: string, token = id): ProviderIdentitySession => ({ access_token: token, user: { id, email: `${id}@example.test` } });
describe('provider identity privacy boundary', () => {
  it('invalidates old work on logout and account replacement', () => {
    let receive: (event: string, s: ProviderIdentitySession | null) => void;
    const boundary = createProviderIdentityBoundary(listener => { receive = listener; return () => {}; });
    const unmount = boundary.subscribe(() => {});
    receive!('SIGNED_IN', session('first')); const proof = boundary.capture();
    receive!('SIGNED_IN', session('second')); expect(boundary.isCurrent(proof)).toBe(false);
    const second = boundary.capture(); receive!('SIGNED_OUT', null);
    expect(boundary.isCurrent(second)).toBe(false); expect(boundary.getSnapshot().uid).toBeNull();
    unmount();
  });
  it('preserves same-user work through token refresh and MFA verification', () => {
    let receive: (event: string, s: ProviderIdentitySession | null) => void;
    const stop = vi.fn();
    const boundary = createProviderIdentityBoundary(listener => { receive = listener; return stop; });
    const unmount = boundary.subscribe(() => {});
    receive!('INITIAL_SESSION', session('first')); const proof = boundary.capture();
    receive!('TOKEN_REFRESHED', session('first', 'refreshed'));
    receive!('MFA_CHALLENGE_VERIFIED', session('first', 'verified'));
    expect(boundary.isCurrent(proof)).toBe(true); unmount(); expect(stop).toHaveBeenCalledOnce();
  });
});
describe('provider-only suppression lifecycle', () => {
  it('keeps suppression until pending work and logout finish', async () => {
    const release = vi.fn(); const signout = vi.fn().mockResolvedValue(undefined);
    let finish: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const lease = createStaffInvitationLifecycle(() => release, signout).mount();
    lease.track(pending); const closing = lease.close();
    expect(lease.isActive()).toBe(false); expect(signout).not.toHaveBeenCalled(); expect(release).not.toHaveBeenCalled();
    finish!(); await closing; expect(signout).toHaveBeenCalledOnce(); expect(release).toHaveBeenCalledOnce();
  });
  it('retains suppression when logout fails', async () => {
    const release = vi.fn(); const signout = vi.fn().mockRejectedValue(new Error('offline'));
    await createStaffInvitationLifecycle(() => release, signout).mount().close();
    expect(release).not.toHaveBeenCalled();
  });
  it('does not sign out a replacement mount', async () => {
    const release = vi.fn(); const signout = vi.fn().mockResolvedValue(undefined);
    const lifecycle = createStaffInvitationLifecycle(() => release, signout);
    const first = lifecycle.mount(); const replacement = lifecycle.mount();
    await first.close(); expect(signout).not.toHaveBeenCalled(); expect(replacement.isActive()).toBe(true);
    await replacement.close(); expect(signout).toHaveBeenCalledOnce();
  });
});
