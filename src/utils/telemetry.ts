export function reportClientError(
  error: Error,
  incidentId?: string,
  context?: Record<string, unknown>
): void {
  if (import.meta.env.DEV) {
    console.warn('[Telemetry] Client error captured:', {
      incidentId,
      name: error?.name,
      message: error?.message,
      ...context,
    });
  }
}
