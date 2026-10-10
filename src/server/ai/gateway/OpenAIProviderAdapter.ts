import type OpenAI from 'openai';
import { GovernanceError } from '../governance/contracts';
import { OpenAIReasoningProvider } from '../OpenAIReasoningProvider';
import type { ProviderAdapter,ProviderRequest,ProviderResponse } from './contracts';

/** No credential creation or live commissioning. Injected SDK doubles only in this gate. */
export class OpenAIProviderAdapter implements ProviderAdapter{
  readonly provider='OPENAI';
  constructor(private readonly client:Pick<OpenAI,'responses'>){if(process.env.NODE_ENV!=='test')throw new GovernanceError('AI_TEST_EXECUTION_FORBIDDEN');}
  invoke(request:ProviderRequest,signal:AbortSignal):Promise<ProviderResponse>{
    return new OpenAIReasoningProvider(this.client).reasonGoverned(request,signal);
  }
}
