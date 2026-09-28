import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
// Bundle application dependencies; use the Functions package's Admin SDK at runtime.
const root = fileURLToPath(new URL('../', import.meta.url));
await build({
  absWorkingDir: root,
  entryPoints: ['src/server/productionApp.ts'],
  outfile: 'functions/lib/taxguard-app.cjs',
  bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  external: ['firebase-admin', 'firebase-admin/*'],
  sourcemap: false,
});
