export function reportClientError(error: Error | unknown, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Telemetry Client Error]', error, context);
  }
}
