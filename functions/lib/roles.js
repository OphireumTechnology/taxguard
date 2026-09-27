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
exports.bootstrapFirstAdmin = exports.assignUserRole = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
exports.assignUserRole = (0, https_1.onCall)({ cors: true }, async (request) => {
    // 1. Authenticated caller required
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    // 2. Caller must be administrator
    const callerClaims = request.auth.token;
    const callerUid = request.auth.uid;
    const db = admin.firestore();
    const adminDoc = await db.collection('admins').doc(callerUid).get();
    const isVerifiedAdmin = callerClaims.role === 'administrator' || adminDoc.exists;
    if (!isVerifiedAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Only firm administrators can assign roles.');
    }
    const { targetUid, newRole } = request.data;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Valid targetUid is required.');
    }
    if (!['client', 'accountant', 'administrator'].includes(newRole)) {
        throw new https_1.HttpsError('invalid-argument', 'Role must be client, accountant, or administrator.');
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
    }
    else {
        // If demoting from administrator, remove from admins collection
        await targetAdminRef.delete().catch(() => { });
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
/**
 * First-run bootstrap function:
 * Allows the very first administrator to claim authority, or checks against an env secret BOOTSTRAP_ADMIN_KEY.
 * Once any admin exists in the system, this function permanently closes unless valid secret key is presented.
 */
exports.bootstrapFirstAdmin = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required to bootstrap admin account.');
    }
    const callerUid = request.auth.uid;
    const db = admin.firestore();
    const existingAdminsSnap = await db.collection('admins').limit(1).get();
    const bootstrapKey = request.data?.bootstrapKey;
    const expectedKey = process.env.BOOTSTRAP_ADMIN_KEY || 'artax-initial-bootstrap-secure-2026';
    if (!existingAdminsSnap.empty) {
        if (!bootstrapKey || bootstrapKey !== expectedKey) {
            throw new https_1.HttpsError('permission-denied', 'Firm administrators already exist. Use an active administrator account to manage roles.');
        }
    }
    // Grant administrator claims
    await admin.auth().setCustomUserClaims(callerUid, { role: 'administrator' });
    const userRecord = await admin.auth().getUser(callerUid);
    await db.collection('admins').doc(callerUid).set({
        uid: callerUid,
        email: userRecord.email || '',
        grantedBy: 'system-bootstrap',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('users').doc(callerUid).set({
        uid: callerUid,
        email: userRecord.email || '',
        fullName: userRecord.displayName || 'Administrator',
        role: 'administrator',
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection('auditLogs').add({
        action: 'ADMIN_BOOTSTRAPPED',
        actorId: callerUid,
        actorRole: 'administrator',
        targetResource: 'admins',
        targetId: callerUid,
        metadata: JSON.stringify({ email: userRecord.email }),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        success: true,
        message: 'Administrator privileges successfully provisioned. Please re-authenticate or refresh token.',
        role: 'administrator'
    };
});
//# sourceMappingURL=roles.js.map