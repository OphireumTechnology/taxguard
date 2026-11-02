/**
 * Server-side technical provenance of the local model, for authorized administrators and audit records. Never sent to
 * ordinary users. The brand does not change where the weights and software come from: Ophireum Technology operates and
 * configures this model; it did not create the weights or the inference software and does not exclusively own them.
 */
export const LOCAL_MODEL_ID = 'ophir-model:8b';
export const LOCAL_MODEL_PROVENANCE = Object.freeze({
  modelId: LOCAL_MODEL_ID,
  baseModel: { name: 'Qwen3 8B', identifier: 'qwen3:8b', creator: 'Qwen team, Alibaba Cloud', licence: 'Apache License 2.0' },
  inferenceEngine: { name: 'Ollama', creator: 'Ollama Inc.', licence: 'MIT License' },
  operatorRole: 'Operates and configures this model. Did not create the underlying weights or software and does not exclusively own them.',
  notices: 'docs/THIRD_PARTY_AI_NOTICES.md',
});
