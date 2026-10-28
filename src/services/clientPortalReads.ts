import { api } from './api';

export async function portalRead<T>(path: string, signal?: AbortSignal): Promise<T> {
  return await api.get<T>(path, { signal });
}
