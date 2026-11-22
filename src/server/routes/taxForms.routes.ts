import express from 'express';
import { authenticateToken } from '../auth';
import { FEDERAL_FORMS } from '../../taxForms/federalForms';
import { STATE_JURISDICTIONS } from '../../taxForms/stateJurisdictions';

export const taxFormsRouter = express.Router();

taxFormsRouter.use(authenticateToken);

taxFormsRouter.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    federalForms: FEDERAL_FORMS,
    stateJurisdictions: STATE_JURISDICTIONS,
    totalFederalForms: FEDERAL_FORMS.length,
    totalStateJurisdictions: STATE_JURISDICTIONS.length,
  });
});

taxFormsRouter.get('/federal', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ forms: FEDERAL_FORMS });
});

taxFormsRouter.get('/states', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ states: STATE_JURISDICTIONS });
});
