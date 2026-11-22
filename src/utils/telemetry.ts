export function reportClientError(
  error: Error,
  incidentId?: string,
  metadata?: Record<string, unknown>
): void {
  if (typeof console !== 'undefined' && import.meta.env.DEV) {
    console.warn('[TaxGuard Telemetry]', incidentId || 'CLIENT_ERR', error.message, metadata || {});
  }
}
