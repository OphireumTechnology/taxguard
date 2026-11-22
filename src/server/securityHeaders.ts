import type { Response } from 'express';

export function applyFramingPolicy(res: Response, isProduction: boolean): void {
  if (isProduction) {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}
