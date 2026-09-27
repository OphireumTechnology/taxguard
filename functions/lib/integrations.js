"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectAccountingIntegration = exports.initiateAccountingOAuth = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const PROVIDER_CONFIG_KEYS = {
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
exports.initiateAccountingOAuth = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { provider, organizationId } = request.data;
    const config = PROVIDER_CONFIG_KEYS[provider];
    if (!config) {
        throw new https_1.HttpsError('invalid-argument', `Unsupported integration provider: ${provider}`);
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
exports.disconnectAccountingIntegration = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { connectionId } = request.data;
    const db = admin.firestore();
    const connRef = db.collection('integrationConnections').doc(connectionId);
    const connDoc = await connRef.get();
    if (!connDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Integration connection not found.');
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
//# sourceMappingURL=integrations.js.map