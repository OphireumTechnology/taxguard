import { apiRequest } from './api';

export async function portalRead<T = any>(path: string, _options?: any): Promise<T> {
  const normalized = path.startsWith('/api/') ? path : `/api/client-portal/${path.replace(/^\/+/, '')}`;
  return apiRequest<T>(normalized, { method: 'GET' });
}
