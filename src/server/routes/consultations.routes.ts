import { createFailClosedRouter } from './_failClosedRouter';

export function createConsultationReviewRouter() {
  return createFailClosedRouter('CONSULTATIONS_REVIEW');
}

export function createPublicConsultationRouter() {
  return createFailClosedRouter('PUBLIC_CONSULTATION_INTAKE', { requireAuth: false });
}
