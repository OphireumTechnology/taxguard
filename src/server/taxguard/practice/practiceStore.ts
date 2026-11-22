export interface PracticeRpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>
  ): PromiseLike<{ data: any; error: { code?: string; message?: string } | null }>;
}
