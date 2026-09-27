import * as admin from 'firebase-admin';

// Initialize Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp();
}

export { assignUserRole, bootstrapFirstAdmin } from './roles';
export { bookAppointmentTransaction } from './appointments';
export { createStripeCheckoutSession, stripeWebhook } from './stripe';
export { getSecureDocumentDownloadUrl } from './documents';
export { initiateAccountingOAuth, disconnectAccountingIntegration } from './integrations';
