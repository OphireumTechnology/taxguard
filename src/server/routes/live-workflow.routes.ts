import { Router } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';

const liveWorkflowRouter = Router();

liveWorkflowRouter.get('/state', authenticateToken, (req: AuthenticatedRequest, res) => {
  const taxYear = Number(req.query.taxYear) || 2025;
  res.json({
    clientId: req.user?.clientId || req.user?.id,
    taxYear,
    currentStage: 1,
    completedStages: [],
    status: 'ACTIVE',
    stages: Array.from({ length: 18 }, (_, i) => ({
      stage: i + 1,
      status: i === 0 ? 'IN_PROGRESS' : 'LOCKED',
    })),
  });
});

liveWorkflowRouter.get('/eligibility', authenticateToken, (_req, res) => {
  res.json({ eligible: true, blockers: [] });
});

liveWorkflowRouter.post('/complete-stage', authenticateToken, (req, res) => {
  res.json({ success: true, stage: Number(req.body?.stage) || 1 });
});

export default liveWorkflowRouter;
