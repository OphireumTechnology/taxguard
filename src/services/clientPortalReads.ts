/** Authenticated GET for the client dashboard's durable reads (vault, billing, client-portal engagements). */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export async function portalRead<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new Error('Authenticated session required.');
  const response = await fetch(apiEndpoint(path), { cache: 'no-store', credentials: 'omit', signal, headers: { Authorization: `Bearer ${token}` } });
  if (getStoredToken() !== token) throw new Error('Session changed.');
  if (!response.ok) throw new Error('Read refused: ' + response.status);
  return await response.json() as T;
}
