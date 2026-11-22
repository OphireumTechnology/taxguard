import { api } from './api';

export async function portalRead<T = any>(path: string, signal?: AbortSignal): Promise<T> {
  return api.request(path, { signal });
}
