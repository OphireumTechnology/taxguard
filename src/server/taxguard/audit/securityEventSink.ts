export interface SecurityEventSinkTarget {
  record: (event: Record<string, any>) => void;
}

let activeSink: SecurityEventSinkTarget | null = null;

export function securityEventSink(): SecurityEventSinkTarget | null {
  return activeSink;
}

export function configureDurableSecurityEvents(
  _env: NodeJS.ProcessEnv,
  _required = false,
  _getClient?: () => any
): string {
  activeSink = null;
  return 'MEMORY_ONLY';
}
