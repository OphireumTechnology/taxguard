/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function reportClientError(
  error: Error,
  incidentId?: string,
  extra?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[Telemetry Error Report]', {
      incidentId,
      errorName: error.name,
      errorMessage: error.message,
      extra
    });
  }
}
