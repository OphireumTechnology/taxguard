import fs from 'fs';
import path from 'path';
import type { RequestHandler } from 'express';

const BLOCKED_ARTIFACT_PATTERN = /\.(?:cjs|map|zip|tar|gz|tgz|bak)(?:[\\/]|$)/i;

// The current build puts the Node bundle next to public assets in dist.
// Never serve executable server bundles, source maps, internal archives, or backups from public directories.
export const protectServerBuildArtifacts: RequestHandler = (req, res, next) => {
  let pathname: string;
  try { pathname = decodeURIComponent(req.path); } catch { res.sendStatus(400); return; }
  if (BLOCKED_ARTIFACT_PATTERN.test(pathname)) { res.sendStatus(404); return; }
  next();
};

/**
 * Identifies server-only paths (/api, /webhooks, /taxguardApi, /taxguard)
 * that must never be swallowed by the frontend SPA fallback.
 */
export function isApiOrServerOnlyPath(rawPath: string): boolean {
  const normalized = (rawPath || '').trim();
  return (
    normalized === '/api' ||
    normalized.startsWith('/api/') ||
    normalized === '/webhooks' ||
    normalized.startsWith('/webhooks/') ||
    normalized === '/taxguardApi' ||
    normalized.startsWith('/taxguardApi/') ||
    normalized === '/taxguard' ||
    normalized.startsWith('/taxguard/')
  );
}

/**
 * Resolves the compiled Vite production directory (dist/) robustly whether
 * executed via `node build/server.cjs`, `tsx server.ts`, or from a parent directory.
 */
export function resolveProductionDistPath(customDistDir?: string): string {
  if (customDistDir) return path.resolve(customDistDir);

  const moduleDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const candidates = [
    path.resolve(moduleDir, '../dist'),
    path.resolve(moduleDir, '../../dist'),
    path.resolve(moduleDir, 'dist'),
    path.resolve(process.cwd(), 'dist'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), 'dist');
}

/**
 * Resolves the public static assets directory (public/) robustly across runtimes.
 */
export function resolvePublicAssetsPath(customPublicDir?: string): string {
  if (customPublicDir) return path.resolve(customPublicDir);

  const moduleDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const candidates = [
    path.resolve(moduleDir, '../public'),
    path.resolve(moduleDir, '../../public'),
    path.resolve(moduleDir, 'public'),
    path.resolve(process.cwd(), 'public'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), 'public');
}

/**
 * Resolves the SPA entry HTML file (`dist/index.html`) robustly.
 */
export function resolveProductionIndexHtmlPath(customDistDir?: string): string {
  const distDir = resolveProductionDistPath(customDistDir);
  const distIndex = path.join(distDir, 'index.html');
  if (fs.existsSync(distIndex)) {
    return distIndex;
  }

  const moduleDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const fallbackCandidates = [
    path.resolve(moduleDir, '../index.html'),
    path.resolve(moduleDir, '../../index.html'),
    path.resolve(moduleDir, 'index.html'),
    path.resolve(process.cwd(), 'index.html'),
  ];

  for (const fallback of fallbackCandidates) {
    if (fs.existsSync(fallback)) {
      return fallback;
    }
  }

  return distIndex;
}

/**
 * Express middleware/route handler for serving the SPA `dist/index.html`
 * on clean frontend routes while strictly excluding `/api`, `/webhooks`,
 * and blocked static build/archive artifacts.
 */
export function createSpaFallbackHandler(customDistDir?: string): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      res.sendStatus(400);
      return;
    }

    if (BLOCKED_ARTIFACT_PATTERN.test(pathname)) {
      res.sendStatus(404);
      return;
    }

    if (isApiOrServerOnlyPath(req.path) || isApiOrServerOnlyPath(pathname)) {
      next();
      return;
    }

    const indexHtmlPath = resolveProductionIndexHtmlPath(customDistDir);
    if (!fs.existsSync(indexHtmlPath)) {
      res.status(404).json({ code: 'SPA_INDEX_NOT_FOUND' });
      return;
    }

    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtmlPath);
  };
}

