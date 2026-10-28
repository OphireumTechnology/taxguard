/**
 * Client telemetry reporter for error reporting and diagnostic logging.
 */
export function reportClientError(
  error: Error,
  incidentId?: string,
  extra?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[telemetry] Error reported:', { incidentId, message: error.message, ...extra });
  }
}
