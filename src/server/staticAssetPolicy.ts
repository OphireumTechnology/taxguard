import type { RequestHandler } from 'express';

// The current build puts the Node bundle next to public assets in dist.
// Never serve executable server bundles or source maps from that directory.
export const protectServerBuildArtifacts: RequestHandler = (req, res, next) => {
  let pathname: string;
  try { pathname = decodeURIComponent(req.path); } catch { res.sendStatus(400); return; }
  if (/\.(?:cjs|map)(?:[\\/]|$)/i.test(pathname)) { res.sendStatus(404); return; }
  next();
};
