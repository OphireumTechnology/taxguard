import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

// Effects are replayed the way React does: a changed dependency runs the previous cleanup first.
const h = vi.hoisted(() => ({ states: [] as any[], refs: [] as any[], effects: [] as any[], si: 0, ri: 0, ei: 0 }));
vi.mock('react', async original => {
  const actual = await original<any>();
  return { ...actual, useId: () => 'synthetic',
    useState: (initial: any) => { const i = h.si++; if (!(i in h.states)) h.states[i] = initial; return [h.states[i], (v: any) => { h.states[i] = typeof v === 'function' ? v(h.states[i]) : v; }]; },
    useRef: (initial: any) => { const i = h.ri++; return h.refs[i] ?? (h.refs[i] = { current: initial }); },
    useEffect: (effect: any, deps?: any[]) => {
      const i = h.ei++, old = h.effects[i];
      if (!old || !deps || deps.some((v, n) => !Object.is(v, old.deps?.[n]))) { old?.cleanup?.(); h.effects[i] = { deps, cleanup: effect() }; }
    } };
});
import { ClientTotpEnrollment } from '../components/portal/views/ClientMfaPanel';

const FACTOR = '11111111-1111-4111-8111-111111111111';
function find(tree: any, p: (n: any) => boolean): any { if (!tree || typeof tree !== 'object') return; if (p(tree)) return tree; for (const c of React.Children.toArray(tree.props?.children)) { const m = find(c, p); if (m) return m; } }
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const fresh = () => ({ begin: vi.fn().mockResolvedValue({ factorId: FACTOR, qrCode: 'data:image/png;base64,AA==', secret: 'SYNTHETICSECRET' }), verifyCode: vi.fn().mockResolvedValue(undefined), cancel: vi.fn().mockResolvedValue(undefined) });
const render = (props: any) => { h.si = h.ri = h.ei = 0; return ClientTotpEnrollment(props); };
beforeEach(() => { h.states = []; h.refs = []; h.effects = []; });

it('keeps the pending factor across re-renders that pass a new api object, and verifies it', async () => {
  const onEnrolled = vi.fn();
  let api = fresh();
  find(render({ onEnrolled, api }), n => n.type === 'button' && n.props.children === 'Start authenticator setup').props.onClick();
  await settle();
  // Parents commonly pass a fresh object literal on every render.
  const calls = { cancel: api.cancel };
  for (let i = 0; i < 3; i++) { const next = { ...fresh(), verifyCode: api.verifyCode, cancel: calls.cancel }; api = next; render({ onEnrolled, api }); }
  expect(calls.cancel).not.toHaveBeenCalled();
  find(render({ onEnrolled, api }), n => n.type === 'input' && n.props.autoComplete === 'one-time-code').props.onChange({ target: { value: '123456' } });
  find(render({ onEnrolled, api }), n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  await settle();
  expect(api.verifyCode).toHaveBeenCalledWith(FACTOR, '123456');
  expect(onEnrolled).toHaveBeenCalledOnce();
  expect(calls.cancel).not.toHaveBeenCalled();
});

it('still cancels an unverified setup when the panel unmounts', async () => {
  const api = fresh();
  find(render({ onEnrolled: vi.fn(), api }), n => n.type === 'button' && n.props.children === 'Start authenticator setup').props.onClick();
  await settle();
  render({ onEnrolled: vi.fn(), api });
  for (const e of h.effects) e?.cleanup?.();
  expect(api.cancel).toHaveBeenCalledWith(FACTOR);
});
