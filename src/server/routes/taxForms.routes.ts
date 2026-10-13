/**
 * Tax Forms Library API: read-only reference catalog for practice staff.
 * No tenant or taxpayer data is read or returned, and there are no write endpoints.
 */
import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../auth';
import { TAX_FORMS_LIBRARY_ROLES } from '../../taxForms/access';
import { formView, libraryCatalog } from '../../taxForms/registry';
import { FEDERAL_FORMS } from '../../taxForms/federalForms';

export const taxFormsRouter = Router();

taxFormsRouter.use(authenticateToken, requireRole(...TAX_FORMS_LIBRARY_ROLES));
taxFormsRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

taxFormsRouter.get('/', (_req: AuthenticatedRequest, res: Response) => {
  res.json(libraryCatalog());
});

taxFormsRouter.get('/forms/:id', (req: AuthenticatedRequest, res: Response) => {
  const form = FEDERAL_FORMS.find(f => f.id === req.params.id);
  if (!form) return res.status(404).json({ error: 'Form not found in the library.', code: 'FORM_NOT_FOUND' });
  return res.json({ form: formView(form) });
});
