import { createFailClosedRouter } from './_failClosedRouter';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';

export function staffAccessDevelopmentConfigured(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED === 'true' &&
    practiceStoreConfigured()
  );
}

export function createStaffAccessRouter() {
  return createFailClosedRouter('STAFF_ACCESS');
}
