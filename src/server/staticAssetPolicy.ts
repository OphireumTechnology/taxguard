import type { RequestHandler } from 'express';

// The current build puts the Node bundle next to public assets in dist.
// Never serve executable server bundles, source maps, internal archives, or backups from public directories.
export const protectServerBuildArtifacts: RequestHandler = (req, res, next) => {
  let pathname: string;
  try { pathname = decodeURIComponent(req.path); } catch { res.sendStatus(400); return; }
  if (/\.(?:cjs|map|zip|tar|gz|tgz|bak)(?:[\\/]|$)/i.test(pathname)) { res.sendStatus(404); return; }
  next();
};
