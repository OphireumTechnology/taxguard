import { createFailClosedRouter } from './_failClosedRouter';
export function createPublicContactRouter() {
  return createFailClosedRouter('PUBLIC_CONTACT_INTAKE', { requireAuth: false });
}
