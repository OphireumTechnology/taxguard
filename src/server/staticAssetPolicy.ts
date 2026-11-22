import path from 'path';
import type { Request, Response, NextFunction } from 'express';

export function isApiOrServerOnlyPath(reqPath: string): boolean {
  const lower = (reqPath || '').toLowerCase();
  return (
    lower === '/api' ||
    lower.startsWith('/api/') ||
    lower === '/webhooks' ||
    lower.startsWith('/webhooks/') ||
    lower.startsWith('/build/') ||
    lower.endsWith('server.cjs') ||
    lower.endsWith('.map')
  );
}

export function protectServerBuildArtifacts(req: Request, res: Response, next: NextFunction): void {
  const lower = (req.path || '').toLowerCase();
  if (lower.startsWith('/build/') || lower.endsWith('server.cjs') || lower.includes('design-reference')) {
    res.sendStatus(404);
    return;
  }
  next();
}

export function resolveProductionDistPath(): string {
  return path.resolve(process.cwd(), 'dist');
}

export function resolvePublicAssetsPath(): string {
  return path.resolve(process.cwd(), 'public');
}

export function resolveProductionIndexHtmlPath(distPath = resolveProductionDistPath()): string {
  return path.join(distPath, 'index.html');
}

export function createSpaFallbackHandler(distPath = resolveProductionDistPath()) {
  const indexFile = resolveProductionIndexHtmlPath(distPath);
  return (req: Request, res: Response, next: NextFunction) => {
    if (isApiOrServerOnlyPath(req.path)) {
      next();
      return;
    }
    res.sendFile(indexFile, (err) => {
      if (err) next();
    });
  };
}
