export function selectLedger(_env: NodeJS.ProcessEnv = process.env): {
  mode: 'memory' | 'durable';
  configured: boolean;
} {
  return {
    mode: 'memory',
    configured: false,
  };
}
