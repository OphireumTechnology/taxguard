import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  App
} from 'firebase-admin/app';

import {
  getAuth,
  Auth
} from 'firebase-admin/auth';

import {
  getFirestore,
  Firestore
} from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

function initializeFirebaseAdmin(): void {
  if (adminApp) return;

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID;

  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  const privateKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
      /\\n/g,
      '\n'
    );

  const applicationCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  try {
    /*
     * Preferred local/server configuration:
     * GOOGLE_APPLICATION_CREDENTIALS points to a service-account
     * JSON file stored OUTSIDE the repository.
     *
     * Legacy FIREBASE_ADMIN_* environment variables remain
     * supported for compatibility.
     */
    const credential =
      applicationCredentials
        ? applicationDefault()
        : projectId && clientEmail && privateKey
          ? cert({
              projectId,
              clientEmail,
              privateKey
            })
          : null;

    if (!credential) {
      console.warn(
        '[Firebase Admin] Server credentials are not configured. ' +
        'Firebase Admin authentication is disabled.'
      );
      return;
    }

    adminApp =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            credential,
            ...(projectId ? { projectId } : {})
          });

    adminAuth = getAuth(adminApp);

    const databaseId =
      process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
      '(default)';

    adminDb = getFirestore(
      adminApp,
      databaseId
    );

    console.log(
      `[Firebase Admin] Initialized database ${databaseId}`
    );
  } catch (error) {
    adminApp = null;
    adminAuth = null;
    adminDb = null;

    console.error(
      '[Firebase Admin] Initialization failed.',
      error
    );
  }
}

initializeFirebaseAdmin();

export function getFirebaseAdminAuth(): Auth | null {
  return adminAuth;
}

export function getFirebaseAdminDb(): Firestore | null {
  return adminDb;
}

export function isFirebaseAdminConfigured(): boolean {
  return adminAuth !== null && adminDb !== null;
}

// This is created by Ophireum Multimedia Productions
/**
 * Verifies a Firebase ID token using the server-side Firebase Admin SDK.
 * Returns the decoded token only after Firebase has cryptographically
 * verified its signature, issuer, audience, and expiration.
 */
export async function verifyFirebaseIdToken(
  idToken: string
) {
  if (!adminAuth) {
    throw new Error(
      'Firebase Admin authentication is not configured.'
    );
  }

  if (!idToken || !idToken.trim()) {
    throw new Error(
      'Firebase ID token is required.'
    );
  }

  return adminAuth.verifyIdToken(
    idToken,
    true
  );
}
