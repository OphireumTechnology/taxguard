import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { assertSyntheticModuleIsolation } from './isolation';
export default defineConfig({
  root: path.resolve('qa/synthetic-shell'), envDir: false, publicDir: false, plugins: [react(), {
    name: 'synthetic-only-dependencies',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk') assertSyntheticModuleIsolation(Object.keys(chunk.modules));
    },
  }],
  resolve: { alias: [{ find: /^(?:\.\.\/)+context\/AppContext$/, replacement: path.resolve('qa/synthetic-shell/context.tsx') }], dedupe: ['react', 'react-dom'] },
  build: { outDir: path.resolve('qa/synthetic-shell/artifacts'), emptyOutDir: false },
});
