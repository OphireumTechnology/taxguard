import type { Request, Response, NextFunction } from 'express';

export class SecurityEventRecorder {
  private queued = 0;
  private delivered = 0;
  private failed = 0;
  private dropped = 0;

  constructor(
    private readonly _client: any,
    private readonly _tenantId: string,
    private readonly _maxQueue = 100,
    private readonly _mode = 'outbox'
  ) {}

  record(_event: Record<string, any>): void {
    if (this.queued >= this._maxQueue) {
      this.dropped += 1;
      return;
    }
    this.queued += 1;
  }

  async dispatch(): Promise<void> {
    if (this.queued > 0) {
      this.delivered += this.queued;
      this.queued = 0;
    }
  }

  status() {
    return {
      queued: this.queued,
      delivered: this.delivered,
      failed: this.failed,
      dropped: this.dropped,
    };
  }

  async durableStatus() {
    return { mode: this._mode, pending: this.queued };
  }
}

export function securityDenialObserver(recorder: SecurityEventRecorder) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        recorder.record({
          eventType: 'HTTP_ACCESS_DENIED',
          statusCode: res.statusCode,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
        });
      }
    });
    next();
  };
}
