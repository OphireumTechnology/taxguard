export function localAuthDiagnosticsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.TAXGUARD_LOCAL_AUTH_DIAGNOSTICS === 'true';
}

export function diagnoseRefusedLogin(..._args: unknown[]): Record<string, unknown> {
  return { reason: 'CREDENTIALS_REFUSED' };
}

export function logLocalAuthDiagnostic(..._args: unknown[]): void {
  // Intentionally silent unless explicitly enabled in development.
}
