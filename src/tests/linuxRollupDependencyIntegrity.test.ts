import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const nativePackages = [
  { parent: 'rollup', linux: '@rollup/rollup-linux-x64-gnu', windows: '@rollup/rollup-win32-x64-msvc', tarball: 'rollup-linux-x64-gnu' },
  { parent: 'lightningcss', linux: 'lightningcss-linux-x64-gnu', windows: 'lightningcss-win32-x64-msvc', tarball: 'lightningcss-linux-x64-gnu' },
  { parent: '@tailwindcss/oxide', linux: '@tailwindcss/oxide-linux-x64-gnu', windows: '@tailwindcss/oxide-win32-x64-msvc', tarball: 'oxide-linux-x64-gnu' }
];

describe('locked cross-platform build native dependencies', () => {
  it.each(nativePackages)('pins $linux to the exact locked $parent version', ({ parent, linux }) => {
    const version = lock.packages[`node_modules/${parent}`].version;
    expect(manifest.optionalDependencies[linux]).toBe(version);
    expect(lock.packages[''].optionalDependencies[linux]).toBe(version);
    expect(lock.packages[`node_modules/${parent}`].optionalDependencies[linux]).toBe(version);
    expect(lock.packages[`node_modules/${linux}`].version).toBe(version);
  });

  it.each(nativePackages)('integrity-locks $linux with Linux x64 platform resolution', ({ linux, tarball }) => {
    const native = lock.packages[`node_modules/${linux}`];
    expect(native.integrity).toMatch(/^sha512-[A-Za-z0-9+/]+={0,2}$/);
    expect(native.resolved).toBe(`https://registry.npmjs.org/${linux}/-/${tarball}-${native.version}.tgz`);
    expect(native.optional).toBe(true);
    expect(native.os).toEqual(['linux']);
    expect(native.cpu).toEqual(['x64']);
  });

  it.each(nativePackages)('preserves the Windows $parent native dependency', ({ parent, windows }) => {
    const packages = parent === 'rollup' ? [windows, '@rollup/rollup-win32-x64-gnu'] : [windows];
    for (const name of packages) {
      const native = lock.packages[`node_modules/${name}`];
      expect(native.version).toBe(lock.packages[`node_modules/${parent}`].version);
      expect(native.os).toEqual(['win32']);
      expect(native.optional).toBe(true);
    }
  });

  it.each(['deploy-pages.yml', 'taxguard-development-ci.yml'])(
    'uses the lockfile with explicit development and optional dependencies in %s',
    file => {
      const workflow = readFileSync(`.github/workflows/${file}`, 'utf8');
      expect(workflow).toContain('run: npm ci --include=dev --include=optional');
      expect(workflow).not.toMatch(/npm install|--package-lock=false|--no-save/);
      expect(workflow).not.toContain('\t');
    }
  );
});
