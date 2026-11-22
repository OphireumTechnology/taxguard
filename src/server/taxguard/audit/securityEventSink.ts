export interface DurableSecurityEventSink {
  record(event: any): void;
  stats(): { queued: number; delivered: number; failed: number; dropped: number };
}

let activeSink: DurableSecurityEventSink | null = null;

export function securityEventSink(): DurableSecurityEventSink | null {
  return activeSink;
}

export function configureDurableSecurityEvents(
  env: NodeJS.ProcessEnv,
  _strict = false,
  _getClient?: () => any
): string {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    activeSink = null;
    return 'MEMORY_ONLY';
  }
  return 'MEMORY_ONLY';
}
