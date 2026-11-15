export function reportClientError(
  error: Error,
  incidentId?: string,
  metadata?: Record<string, unknown>,
): void {
  if (import.meta.env.DEV) {
    console.warn('[ClientTelemetry]', incidentId ?? 'NO_INCIDENT_ID', error.message, metadata ?? {});
  }
}
