import { expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { protectServerBuildArtifacts } from '../server/staticAssetPolicy';

it.each([
  '/server.cjs',
  '/server.cjs.map',
  '/%73erver.cjs',
  '/SERVER.CJS',
  '/server.cjs/extra',
  '/taxguard-transfer.zip',
  '/backup.tar.gz',
  '/archive.tgz',
  '/database.bak'
])('blocks server artifact and internal archives %s', path => {
  const sendStatus = vi.fn(); const next = vi.fn();
  protectServerBuildArtifacts({ path } as any, { sendStatus } as any, next);
  expect(sendStatus).toHaveBeenCalledWith(404); expect(next).not.toHaveBeenCalled();
});

it('allows public JavaScript assets', () => {
  const next = vi.fn();
  protectServerBuildArtifacts({ path: '/assets/index.js' } as any, {} as any, next);
  expect(next).toHaveBeenCalledOnce();
});

it('ensures no development transfer zip archives exist in public directory', () => {
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    const zipFiles = files.filter(f => f.toLowerCase().endsWith('.zip'));
    expect(zipFiles).toEqual([]);
  }
});

