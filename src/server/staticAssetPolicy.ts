import express, { type RequestHandler } from 'express';
import path from 'node:path';
import fs from 'node:fs';

const BLOCKED_ARTIFACT_PATTERNS = [
  /^\/?build(\/|$)/i,
  /^\/?server\.(ts|js|cjs|mjs)(\.map)?$/i,
  /^\/?\.env(\.|$)/i,
  /^\/?\.git(\/|$)/i,
  /^\/?design-reference(\/|$)/i,
  /^\/?docs\/proposed-migrations(\/|$)/i,
];

export function isApiOrServerOnlyPath(urlPath: string): boolean {
  const clean = (urlPath || '').split('?')[0];
  return (
    clean === '/api' ||
    clean.startsWith('/api/') ||
    clean === '/webhooks' ||
    clean.startsWith('/webhooks/') ||
    BLOCKED_ARTIFACT_PATTERNS.some((re) => re.test(clean))
  );
}

export const protectServerBuildArtifacts: RequestHandler = (req, res, next) => {
  let target = req.path || req.originalUrl || '';
  try {
    target = decodeURIComponent(target);
  } catch {
    // keep raw target
  }
  if (BLOCKED_ARTIFACT_PATTERNS.some((re) => re.test(target))) {
    res.status(404).end();
    return;
  }
  next();
};

export function resolveProductionDistPath(customPath?: string): string {
  return customPath ? path.resolve(customPath) : path.resolve(process.cwd(), 'dist');
}

export function resolvePublicAssetsPath(customPath?: string): string {
  return customPath ? path.resolve(customPath) : path.resolve(process.cwd(), 'public');
}

export function resolveProductionIndexHtmlPath(distPath?: string): string {
  return path.join(resolveProductionDistPath(distPath), 'index.html');
}

export function createSpaFallbackHandler(distPath?: string): RequestHandler {
  const indexPath = resolveProductionIndexHtmlPath(distPath);
  return (req, res, next) => {
    if (isApiOrServerOnlyPath(req.path)) {
      return next();
    }
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return res.status(404).json({ code: 'SPA_BUNDLE_NOT_FOUND' });
  };
}
