import type { RequestHandler } from 'express';

export class SecurityEventRecorder {
  private queued = 0;
  private delivered = 0;
  private failed = 0;
  private dropped = 0;
  private buffer: any[] = [];

  constructor(
    private readonly _client: any,
    private readonly _tenantId: string,
    private readonly maxBuffer = 100,
    private readonly mode: 'direct' | 'outbox' = 'outbox'
  ) {}

  record(event: any): void {
    if (this.buffer.length >= this.maxBuffer) {
      this.dropped++;
      return;
    }
    this.queued++;
    this.buffer.push(event);
  }

  async dispatch(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, 25);
    this.delivered += batch.length;
  }

  status() {
    return {
      mode: this.mode,
      tenantId: this._tenantId,
      queued: this.buffer.length,
      totalQueued: this.queued,
      delivered: this.delivered,
      failed: this.failed,
      dropped: this.dropped,
    };
  }

  async durableStatus() {
    return {
      pending: this.buffer.length,
      delivered: this.delivered,
      failed: this.failed,
    };
  }
}

export function securityDenialObserver(recorder: SecurityEventRecorder): RequestHandler {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        recorder.record({
          eventType: 'HTTP_ACCESS_DENIED',
          status: res.statusCode,
          method: req.method,
          path: req.originalUrl,
          timestamp: new Date().toISOString(),
        });
      }
    });
    next();
  };
}
