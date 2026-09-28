import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const assignUserRole = onCall({ cors: true }, async (request) => {
  // 1. Authenticated caller required
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  // 2. Caller must be administrator
  const callerClaims = request.auth.token;
  const callerUid = request.auth.uid;

  const db = admin.firestore();
  const adminDoc = await db.collection('admins').doc(callerUid).get();

  const isVerifiedAdmin = callerClaims.role === 'administrator' || adminDoc.exists;
  if (!isVerifiedAdmin) {
    throw new HttpsError('permission-denied', 'Only firm administrators can assign roles.');
  }

  const { targetUid, newRole } = request.data;
  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid targetUid is required.');
  }

  if (!['client', 'accountant', 'administrator'].includes(newRole)) {
    throw new HttpsError('invalid-argument', 'Role must be client, accountant, or administrator.');
  }

  // Set Firebase Auth Custom Claims
  await admin.auth().setCustomUserClaims(targetUid, { role: newRole });

  // Synchronize Firestore user document
  const userRef = db.collection('users').doc(targetUid);
  await userRef.set({
    role: newRole,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Update admins collection if administrator
  const targetAdminRef = db.collection('admins').doc(targetUid);
  if (newRole === 'administrator') {
    const userRecord = await admin.auth().getUser(targetUid);
    await targetAdminRef.set({
      uid: targetUid,
      email: userRecord.email || '',
      grantedBy: callerUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    // If demoting from administrator, remove from admins collection
    await targetAdminRef.delete().catch(() => {});
  }

  // Record audit log
  await db.collection('auditLogs').add({
    action: 'ROLE_ASSIGNED',
    actorId: callerUid,
    actorRole: 'administrator',
    targetResource: 'users',
    targetId: targetUid,
    metadata: JSON.stringify({ assignedRole: newRole }),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    success: true,
    message: `User ${targetUid} has been granted the ${newRole} role. Token will refresh on next login or refresh.`,
    targetUid,
    role: newRole
  };
});

/** Public administrator bootstrap is permanently disabled. Provision through an audited operator process. */
export const bootstrapFirstAdmin = onCall({ cors: false }, async (_request) => {
  throw new HttpsError('failed-precondition', 'Public administrator bootstrap is disabled. Contact the authorized system operator.');
});
