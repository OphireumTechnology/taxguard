export function startMfaResetWorker(_options: {
  client: () => any;
  tenant: string;
  provider: any;
  workerId: string;
}) {
  return {
    stop() {
      // No-op when durable provider is inactive
    },
  };
}
