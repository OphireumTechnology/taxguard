import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const nativeName = '@rollup/rollup-linux-x64-gnu';

describe('locked cross-platform Rollup installation', () => {
  it('pins the Linux optional package to the exact locked Rollup version', () => {
    const version = lock.packages['node_modules/rollup'].version;
    expect(manifest.optionalDependencies[nativeName]).toBe(version);
    expect(lock.packages[''].optionalDependencies[nativeName]).toBe(version);
    expect(lock.packages['node_modules/rollup'].optionalDependencies[nativeName]).toBe(version);
    expect(lock.packages[`node_modules/${nativeName}`].version).toBe(version);
  });

  it('locks a registry integrity hash and skips the Linux binary on Windows', () => {
    const native = lock.packages[`node_modules/${nativeName}`];
    expect(native.integrity).toMatch(/^sha512-[A-Za-z0-9+/]+={0,2}$/);
    expect(native.resolved).toBe(`https://registry.npmjs.org/${nativeName}/-/rollup-linux-x64-gnu-${native.version}.tgz`);
    expect(native.optional).toBe(true);
    expect(native.os).toEqual(['linux']);
    expect(native.cpu).toEqual(['x64']);
  });

  it('preserves locked Windows native dependencies at the same Rollup version', () => {
    for (const platform of ['win32-x64-gnu', 'win32-x64-msvc']) {
      const native = lock.packages[`node_modules/@rollup/rollup-${platform}`];
      expect(native.version).toBe(lock.packages['node_modules/rollup'].version);
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
