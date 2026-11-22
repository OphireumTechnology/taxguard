export function runtimeProbes(options?: {
  scanCoordinator?: () => any;
  securityEvents?: () => any;
}) {
  return {
    process: 'healthy',
    uptimeSeconds: Math.round(process.uptime()),
    scanner: options?.scanCoordinator?.() ? 'configured' : 'disabled',
    securityEvents: options?.securityEvents?.() || { mode: 'MEMORY_ONLY' },
    timestamp: new Date().toISOString(),
  };
}
