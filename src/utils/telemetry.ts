export function reportClientError(
  error: Error | string,
  incidentId?: string,
  context?: Record<string, unknown>
): void {
  if (typeof console !== 'undefined') {
    const message = typeof error === 'string' ? error : error?.message || 'Unknown client error';
    console.error('[ClientError]', incidentId ? `[${incidentId}]` : '', message, context ?? '');
  }
}
