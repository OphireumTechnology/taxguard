import { expect, it, vi } from 'vitest';
import { protectServerBuildArtifacts } from '../server/staticAssetPolicy';
it.each(['/server.cjs', '/server.cjs.map', '/%73erver.cjs', '/SERVER.CJS', '/server.cjs/extra'])('blocks server artifact %s', path => {
  const sendStatus = vi.fn(); const next = vi.fn();
  protectServerBuildArtifacts({ path } as any, { sendStatus } as any, next);
  expect(sendStatus).toHaveBeenCalledWith(404); expect(next).not.toHaveBeenCalled();
});
it('allows public JavaScript assets', () => {
  const next = vi.fn();
  protectServerBuildArtifacts({ path: '/assets/index.js' } as any, {} as any, next);
  expect(next).toHaveBeenCalledOnce();
});
