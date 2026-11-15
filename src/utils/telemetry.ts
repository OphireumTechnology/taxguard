export function reportClientError(
  error: Error,
  incidentId?: string,
  metadata?: { componentStack?: string; route?: string }
): void {
  if (import.meta.env.DEV) {
    console.warn('[TaxGuard Telemetry]', {
      incidentId,
      name: error?.name,
      message: error?.message,
      route: metadata?.route
    });
  }
}
