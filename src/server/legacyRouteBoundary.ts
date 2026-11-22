import type { Request, Response, NextFunction } from 'express';

export function legacyRouteBoundary() {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}
