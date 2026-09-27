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
exports.getSecureDocumentDownloadUrl = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
exports.getSecureDocumentDownloadUrl = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { documentId } = request.data;
    if (!documentId) {
        throw new https_1.HttpsError('invalid-argument', 'documentId is required.');
    }
    const callerUid = request.auth.uid;
    const callerClaims = request.auth.token;
    const db = admin.firestore();
    const docSnap = await db.collection('documents').doc(documentId).get();
    if (!docSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Document metadata not found.');
    }
    const docData = docSnap.data();
    // Access validation:
    const isOwner = docData.clientId === callerUid || docData.uploadedBy === callerUid;
    const isAssignedCpa = docData.assignedAccountantId === callerUid;
    const isAdmin = callerClaims.role === 'administrator';
    if (!isOwner && !isAssignedCpa && !isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Access denied. You do not have permission to view this document.');
    }
    if (docData.status === 'quarantined') {
        throw new https_1.HttpsError('failed-precondition', 'Document is quarantined pending security review.');
    }
    const bucket = admin.storage().bucket();
    const file = bucket.file(docData.storagePath);
    try {
        // Generate short-lived signed URL (15 minutes)
        const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000 // 15 minutes
        });
        // Record audit access
        await db.collection('auditLogs').add({
            action: 'DOCUMENT_DOWNLOADED',
            actorId: callerUid,
            targetResource: 'documents',
            targetId: documentId,
            metadata: JSON.stringify({ fileName: docData.fileName }),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            downloadUrl: signedUrl,
            fileName: docData.fileName,
            mimeType: docData.mimeType,
            expiresInMinutes: 15
        };
    }
    catch (error) {
        console.error('Signed URL generation error:', error);
        throw new https_1.HttpsError('internal', `Failed to generate secure download link: ${error.message}`);
    }
});
//# sourceMappingURL=documents.js.map