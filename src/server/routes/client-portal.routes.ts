import { createFailClosedRouter } from './_failClosedRouter';

export function createClientPortalRouter() {
  return createFailClosedRouter('CLIENT_PORTAL');
}

export function createClientSignaturesRouter() {
  return createFailClosedRouter('CLIENT_SIGNATURES');
}
