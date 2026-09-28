import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { documentCanBeReleased } from './documentReleasePolicy';

export const getSecureDocumentDownloadUrl = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  if (process.env.TAXGUARD_DOCUMENT_RELEASE_ENABLED !== 'true') {
    throw new HttpsError('failed-precondition', 'Document release awaits trusted scanning and migration review.');
  }

  const { documentId } = request.data;
  if (!documentId) {
    throw new HttpsError('invalid-argument', 'documentId is required.');
  }

  const callerUid = request.auth.uid;
  const callerClaims = request.auth.token;
  const db = admin.firestore();

  const docSnap = await db.collection('documents').doc(documentId).get();
  if (!docSnap.exists) {
    throw new HttpsError('not-found', 'Document metadata not found.');
  }

  const docData = docSnap.data()!;

  // Access validation:
  const isOwner = docData.clientId === callerUid || docData.uploadedBy === callerUid;
  const isAssignedCpa = docData.assignedAccountantId === callerUid;
  const isAdmin = callerClaims.role === 'administrator';

  if (!isOwner && !isAssignedCpa && !isAdmin) {
    throw new HttpsError('permission-denied', 'Access denied. You do not have permission to view this document.');
  }

  if (!documentCanBeReleased({ ...docData, id: docSnap.id }, callerUid)) {
    throw new HttpsError('failed-precondition', 'Document is quarantined pending security review.');
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(docData.storagePath, { generation: docData.storageGeneration });

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
  } catch (error: any) {
    console.warn('Signed URL generation failed.');
    throw new HttpsError('internal', 'Failed to generate secure download link.');
  }
});
