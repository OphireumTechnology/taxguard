import { Router } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { canReadTaxFormsLibrary } from '../../taxForms/access';
import { DEFAULT_TAX_FORMS_CATALOG } from '../../taxForms/registry';

export const taxFormsRouter = Router();

taxFormsRouter.get('/', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (!canReadTaxFormsLibrary(req.user)) {
    return res.status(403).json({ code: 'STAFF_ROLE_REQUIRED', error: 'Practice staff access required.' });
  }
  return res.json(DEFAULT_TAX_FORMS_CATALOG);
});
