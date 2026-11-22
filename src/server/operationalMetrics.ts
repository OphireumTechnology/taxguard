import type { Request, Response, NextFunction } from 'express';

export function createOperationalMetrics() {
  let totalRequests = 0;
  let errorResponses = 0;
  const startedAt = new Date().toISOString();

  const middleware = (_req: Request, res: Response, next: NextFunction) => {
    totalRequests += 1;
    res.on('finish', () => {
      if (res.statusCode >= 500) errorResponses += 1;
    });
    next();
  };

  const snapshot = () => ({
    startedAt,
    totalRequests,
    errorResponses,
    uptimeSeconds: Math.round(process.uptime()),
  });

  return { middleware, snapshot };
}
