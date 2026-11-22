import { Router } from 'express';
import { authenticateToken } from '../auth';

const taxguardAiRouter = Router();

taxguardAiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'available',
    mode: 'proposal_only',
    externalFilingEnabled: false,
    providerConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
});

taxguardAiRouter.post('/propose', authenticateToken, (_req, res) => {
  res.status(503).json({
    code: 'AI_PROVIDER_NOT_COMMISSIONED',
    error: 'Server-side AI proposal engine is not commissioned in this environment.',
  });
});

export default taxguardAiRouter;
