import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const PROVIDER_CONFIG_KEYS: Record<string, { clientIdKey: string; clientSecretKey: string; authUrl: string }> = {
  quickbooks: {
    clientIdKey: 'QBO_CLIENT_ID',
    clientSecretKey: 'QBO_CLIENT_SECRET',
    authUrl: 'https://appcenter.intuit.com/connect/oauth2'
  },
  xero: {
    clientIdKey: 'XERO_CLIENT_ID',
    clientSecretKey: 'XERO_CLIENT_SECRET',
    authUrl: 'https://login.xero.com/identity/connect/authorize'
  },
  freshbooks: {
    clientIdKey: 'FRESHBOOKS_CLIENT_ID',
    clientSecretKey: 'FRESHBOOKS_CLIENT_SECRET',
    authUrl: 'https://auth.freshbooks.com/service/auth/oauth/authorize'
  },
  zohobooks: {
    clientIdKey: 'ZOHO_CLIENT_ID',
    clientSecretKey: 'ZOHO_CLIENT_SECRET',
    authUrl: 'https://accounts.zoho.com/oauth/v2/auth'
  }
};

export const initiateAccountingOAuth = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { provider, organizationId } = request.data;
  const config = PROVIDER_CONFIG_KEYS[provider];

  if (!config) {
    throw new HttpsError('invalid-argument', `Unsupported integration provider: ${provider}`);
  }

  const clientId = process.env[config.clientIdKey];
  const clientSecret = process.env[config.clientSecretKey];

  if (!clientId || !clientSecret) {
    return {
      status: 'configuration_required',
      message: `${provider.toUpperCase()} OAuth credentials (${config.clientIdKey} and ${config.clientSecretKey}) are not configured in Cloud Functions secrets.`,
      requiresConfig: true,
      provider
    };
  }

  const state = Buffer.from(JSON.stringify({
    userId: request.auth.uid,
    organizationId,
    timestamp: Date.now()
  })).toString('base64');

  const redirectUri = `https://us-central1-${admin.app().options.projectId}.cloudfunctions.net/accountingOAuthCallback`;

  const authUrl = `${config.authUrl}?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  return {
    status: 'ready',
    authUrl,
    provider
  };
});

export const disconnectAccountingIntegration = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { connectionId } = request.data;
  const db = admin.firestore();

  const connRef = db.collection('integrationConnections').doc(connectionId);
  const connDoc = await connRef.get();

  if (!connDoc.exists) {
    throw new HttpsError('not-found', 'Integration connection not found.');
  }

  await connRef.update({
    status: 'disconnected',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await db.collection('auditLogs').add({
    action: 'INTEGRATION_DISCONNECTED',
    actorId: request.auth.uid,
    targetResource: 'integrationConnections',
    targetId: connectionId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, message: 'Integration safely disconnected.' };
});
