import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  sendEmailVerification,
  onAuthStateChanged,
  getIdTokenResult,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { UserRole } from '../types';

export interface AuthUserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  organizationId?: string;
  status: 'active' | 'suspended' | 'pending';
  emailVerified: boolean;
  createdAt?: string;
}

/**
 * Extract trusted role from Firebase Auth custom claims, falling back to Firestore user profile.
 */
export async function getVerifiedUserRole(firebaseUser: FirebaseUser): Promise<UserRole> {
  try {
    const tokenResult = await getIdTokenResult(firebaseUser, false);
    if (tokenResult.claims.role && ['client', 'accountant', 'admin', 'super_admin'].includes(tokenResult.claims.role as string)) {
      return tokenResult.claims.role as UserRole;
    }
  } catch (err) {
    console.warn('Could not read custom claims from token:', err);
  }

  // Fallback: Check Firestore /admins or /users profile
  try {
    const adminCheck = await getDoc(doc(db, 'admins', firebaseUser.uid));
    if (adminCheck.exists()) {
      return 'admin';
    }

    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.role && ['client', 'accountant', 'admin', 'super_admin', 'senior_reviewer', 'legal_specialist', 'firm_manager', 'recruiter'].includes(data.role)) {
        return data.role as UserRole;
      }
    }
  } catch (err) {
    console.warn('Could not read user profile for role verification:', err);
  }

  // Public default
  return 'client';
}

/**
 * Register a new user with Firebase Authentication.
 * Security Invariant: New public registrations strictly receive the 'client' role.
 */
export async function registerWithEmail(
  name: string,
  email: string,
  pass: string,
  phone?: string,
  companyName?: string
): Promise<{ success: boolean; user?: AuthUserProfile; error?: string }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const fbUser = cred.user;

    // Update display name
    await updateProfile(fbUser, { displayName: name });

    // Send email verification
    try {
      await sendEmailVerification(fbUser);
    } catch (verifErr) {
      console.warn('Email verification send notice:', verifErr);
    }

    // Provision client profile in Firestore (Rules strictly enforce role == 'client' for public creates)
    const orgId = companyName ? `org_${fbUser.uid}` : '';
    const profile: AuthUserProfile = {
      uid: fbUser.uid,
      email: fbUser.email || email.trim(),
      fullName: name,
      role: 'client', // Strictly client
      phone: phone || '',
      organizationId: orgId,
      status: 'active',
      emailVerified: fbUser.emailVerified
    };

    await setDoc(doc(db, 'users', fbUser.uid), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (companyName) {
      await setDoc(doc(db, 'organizations', orgId), {
        id: orgId,
        name: companyName,
        ownerId: fbUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch((e) => console.warn('Org creation warning:', e));
    }

    return { success: true, user: profile };
  } catch (error: any) {
    let msg = error.message || 'Registration failed.';
    if (error.code === 'auth/email-already-in-use') {
      msg = 'This email address is already registered. Please log in or request a password reset.';
    } else if (error.code === 'auth/weak-password') {
      msg = 'Password is too weak. Please use at least 8 characters with letters and numbers.';
    } else if (error.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';
    }
    return { success: false, error: msg };
  }
}

/**
 * Log in with Firebase Authentication
 */
export async function loginWithEmail(
  email: string,
  pass: string
): Promise<{
  success: boolean;
  user?: AuthUserProfile;
  error?: string;
}> {
  try {
    /*
     * LIVE AUTHENTICATION BOUNDARY
     *
     * Firebase Authentication establishes identity here.
     *
     * Do NOT require a Firestore profile read before the
     * TaxGuard server session exists. Firestore rules may
     * intentionally restrict that read.
     *
     * The verified Firebase ID token is subsequently sent to
     * /api/auth/firebase-session, where Firebase Admin verifies
     * identity and restores/provisions the permanent LIVE
     * TaxGuard profile.
     */
    const cred = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      pass
    );

    const fbUser = cred.user;

    const profile: AuthUserProfile = {
      uid: fbUser.uid,
      email:
        fbUser.email ||
        email.trim().toLowerCase(),
      fullName:
        fbUser.displayName ||
        'Client',
      role: 'client',
      phone: '',
      organizationId: '',
      status: 'active',
      emailVerified: fbUser.emailVerified
    };

    return {
      success: true,
      user: profile
    };
  } catch (error: any) {
    let msg =
      error?.message ||
      'Sign in failed.';

    if (
      error?.code === 'auth/user-not-found' ||
      error?.code === 'auth/wrong-password' ||
      error?.code === 'auth/invalid-credential'
    ) {
      msg =
        'Invalid email or password combination. Please check your credentials and try again.';
    } else if (
      error?.code === 'auth/too-many-requests'
    ) {
      msg =
        'Access temporarily disabled by Firebase due to multiple failed authentication attempts. Please try again later.';
    } else if (
      error?.code === 'auth/user-disabled'
    ) {
      msg =
        'This account has been disabled.';
    }

    return {
      success: false,
      error: msg
    };
  }
}
/**
 * Sign out
 */
export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Forgot password - send password reset email
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://artaxserv.com';
    await sendPasswordResetEmail(auth, email.trim(), {
      url: `${origin}/#/login`
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send password reset email.' };
  }
}

/**
 * Confirm password reset with oobCode
 */
export async function completePasswordReset(oobCode: string, newPass: string): Promise<{ success: boolean; error?: string }> {
  try {
    await confirmPasswordReset(auth, oobCode, newPass);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to reset password.' };
  }
}

/**
 * Force refresh ID token after an authorized role change
 */
export async function refreshIdToken(): Promise<UserRole> {
  if (!auth.currentUser) return 'client';
  const tokenResult = await getIdTokenResult(auth.currentUser, true); // true forces refresh
  const role = (tokenResult.claims.role as UserRole) || 'client';
  return role;
}

/**
 * Returns the current Firebase ID token for secure server-side verification.
 * The token must be verified by Firebase Admin on the TaxGuard server.
 */
export async function getFirebaseIdToken(
  forceRefresh = false
): Promise<string | null> {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    return null;
  }

  return firebaseUser.getIdToken(forceRefresh);
}

