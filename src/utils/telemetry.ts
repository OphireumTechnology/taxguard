export interface ClientErrorContext {
  componentStack?: string;
  route?: string;
  [key: string]: unknown;
}

export function reportClientError(
  error: Error,
  incidentId?: string,
  context?: ClientErrorContext
): void {
  if (import.meta.env.DEV) {
    console.warn('[ClientErrorTelemetry]', {
      incidentId,
      name: error?.name,
      message: error?.message,
      ...context,
    });
  }
}
