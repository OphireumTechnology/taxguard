import type { Response } from 'express';

/**
 * Production responses are never framable by another site (clickjacking of the authenticated portals) and tell
 * browsers to use HTTPS only. Development keeps framing open for preview tools and never sends HSTS.
 */
export const PRODUCTION_FRAMING_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
});

export function applyFramingPolicy(res: Response, production: boolean) {
  if (production) {
    for (const [name, value] of Object.entries(PRODUCTION_FRAMING_HEADERS)) res.setHeader(name, value);
  } else {
    res.removeHeader('X-Frame-Options');
  }
}
