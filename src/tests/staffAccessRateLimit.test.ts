import { expect, it } from 'vitest';
import { StaffAccessRateLimit } from '../server/staffAccessRateLimit';
it('bounds request attempts and resets only at window expiry', () => {
  let now=1000; const limiter=new StaffAccessRateLimit(2,1000,2,()=>now);
  expect(limiter.allow('sourceA')).toBe(true); expect(limiter.allow('sourceA')).toBe(true); expect(limiter.allow('sourceA')).toBe(false);
  now=1999; expect(limiter.allow('sourceA')).toBe(false);
  now=2000; expect(limiter.allow('sourceA')).toBe(true);
});
it('fails closed at capacity rather than evicting active throttles', () => {
  let now=1000; const limiter=new StaffAccessRateLimit(1,1000,2,()=>now);
  expect(limiter.allow('A')).toBe(true); expect(limiter.allow('B')).toBe(true); expect(limiter.allow('C')).toBe(false);
  expect(limiter.allow('A')).toBe(false);
  now=2000; expect(limiter.allow('C')).toBe(true);
});
it('does not reset on backward clock movement', () => {
  let now=1000; const limiter=new StaffAccessRateLimit(1,1000,2,()=>now);
  expect(limiter.allow('A')).toBe(true); now=0; expect(limiter.allow('A')).toBe(false);
});
