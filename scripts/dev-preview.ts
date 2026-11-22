import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

async function startFrontendPreviewServer() {
  const port = Number(process.env.PORT) || 3000;
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', mode: 'frontend-preview' });
  });

  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: 'custom',
  });

  app.use(vite.middlewares);

  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/')) {
      return res.status(503).json({
        error: 'Backend API routes are unavailable in frontend preview mode.',
      });
    }
    try {
      const indexPath = path.resolve(process.cwd(), 'index.html');
      const rawHtml = await fs.readFile(indexPath, 'utf-8');
      const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(transformed);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(
      `[DESTRIA TAX SERVICES LLC] Frontend preview server ready on http://0.0.0.0:${port}`
    );
  });
}

async function boot() {
  try {
    await import('../server.ts');
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'ERR_MODULE_NOT_FOUND') {
      console.warn(
        `[dev-preview] Full server.ts skipped due to missing upstream server module (${err.message}). Starting Vite frontend preview server...`
      );
      await startFrontendPreviewServer();
      return;
    }
    throw error;
  }
}

boot().catch((error) => {
  console.error('[dev-preview] Fatal startup error:', error);
  process.exit(1);
});
