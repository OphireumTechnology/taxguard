/**
 * Client-Side Telemetry & Observability Reporter
 * Dispatches non-blocking runtime monitoring metrics to /api/monitoring
 */

const getBaseUrl = (): string => {
  return '';
};

export async function reportClientError(
  error: Error | string,
  incidentId?: string,
  extra?: { route?: string; componentStack?: string }
): Promise<void> {
  try {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'object' && error?.stack ? error.stack.slice(0, 500) : extra?.componentStack;
    await fetch(`${getBaseUrl()}/api/monitoring/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        stack,
        route: extra?.route || window.location.pathname,
        incidentId,
        userAgent: navigator.userAgent
      }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Non-blocking telemetry
  }
}

export async function reportApiFailure(endpoint: string, status: number, error: any, method = 'GET'): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/api/monitoring/api-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, status, error: String(error || ''), method }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Non-blocking telemetry
  }
}

export async function reportAuthFailure(email: string, reason: string, attemptType = 'login'): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/api/monitoring/auth-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, reason, attemptType }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Non-blocking telemetry
  }
}

export async function reportFirebaseError(functionName: string, error: any): Promise<void> {
  try {
    const code = error?.code || 'UNKNOWN';
    const message = error?.message || String(error);
    await fetch(`${getBaseUrl()}/api/monitoring/firebase-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ functionName, code, message }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Non-blocking telemetry
  }
}

export async function reportSuspiciousActivity(activityType: string, targetResource: string, reason: string): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/api/monitoring/suspicious-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityType, targetResource, reason }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Non-blocking telemetry
  }
}
