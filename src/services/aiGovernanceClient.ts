import { apiEndpoint } from '../config/apiEndpoint';

export type AiControlCenterView = 'registry' | 'runs' | 'decisions' | 'security-events' | 'usage' | 'commissioning' | 'evaluations' | 'local-model' | 'command-center';
export type AiKillSwitchInput = { scope: 'GLOBAL'; reason: string }
  | { scope: 'AGENT'; agent_id: string; reason: string }
  | { scope: 'MODEL'; model_id: string; model_version: string; reason: string }
  | { scope: 'TOOL'; tool_id: string; reason: string }
  | { scope: 'WORKFLOW'; workflow_stage: number; reason: string };

/** No synthetic success: the server remains authoritative for governance and stops. */
export function createAiGovernanceClient(getToken: () => string | null) {
  async function request(path: string, options: RequestInit = {}, blob = false) {
    const token = getToken();
    if (!token) throw Object.assign(new Error('Sign in to access AI governance.'), { code: 'AI_AUTH_REQUIRED', status: 401 });
    const response = await fetch(apiEndpoint(path), {
      ...options,
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-session-token': token },
    });
    const data: unknown = blob && response.ok ? await response.blob() : await response.json().catch(() => undefined);
    if (getToken() !== token) throw Object.assign(new Error('The authenticated session changed.'), { code: 'SESSION_CHANGED' });
    if (!response.ok) {
      const error = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      throw Object.assign(new Error(typeof error.error === 'string' ? error.error : 'The AI governance request was refused.'), { status: response.status, code: error.code });
    }
    if (blob) return data as Blob;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Object.assign(new Error('Invalid AI governance response.'), { code: 'INVALID_API_RESPONSE' });
    return data as Record<string, unknown>;
  }
  return {
    getAiControlCenter: (view: AiControlCenterView, query: Record<string, string> = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== ''));
      return request(`/api/ai-governance/control-center/${view}${params.size ? `?${params}` : ''}`, { signal }) as Promise<Record<string, unknown>>;
    },
    listAiKillSwitches: (signal?: AbortSignal) => request('/api/ai-governance/kill-switches', { signal }) as Promise<{ kill_switches: unknown[] }>,
    activateAiKillSwitch: (payload: AiKillSwitchInput) => request('/api/ai-governance/kill-switches', { method: 'POST', body: JSON.stringify(payload) }) as Promise<Record<string, unknown>>,
    getAiCommandCenterMasterPlanImage: (signal?: AbortSignal) => request('/api/ai-governance/control-center/command-center/master-plan-image', { signal }, true) as Promise<Blob>,
  };
}
