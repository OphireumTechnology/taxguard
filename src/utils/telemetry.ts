/**
 * Telemetry reporting utility.
 * Sanitized client error reporting.
 */
export function reportClientError(
  error: Error,
  incidentId?: string,
  metadata?: Record<string, unknown>
): void {
  if (import.meta.env?.DEV) {
    console.warn('[Telemetry] Client error reported:', {
      incidentId,
      name: error?.name,
      message: error?.message,
      ...metadata
    });
  }
}
